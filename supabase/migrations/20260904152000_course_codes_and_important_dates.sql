create function private.normalize_course_code(p_value text) returns text
language plpgsql
immutable
set search_path=''
as $$
declare
  parts text[];
begin
  parts:=regexp_match(upper(trim(coalesce(p_value,''))),'(^|[^A-Z0-9])([A-Z]{4})[[:space:]-]*([0-9]{4})(?:[[:space:]-]*([UG])(?=$|[^A-Z0-9]))?(?=$|[^A-Z0-9])');
  if parts is null then return null; end if;
  return parts[2]||' '||parts[3]||coalesce(parts[4],'U');
end $$;

revoke all on function private.normalize_course_code(text) from public,anon,authenticated;

create unique index courses_normalized_code_unique
  on public.courses(private.normalize_course_code(code))
  where private.normalize_course_code(code) is not null;

create function public.resolve_grade_course(
  p_course_code text,
  p_course_title text,
  p_term_code text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  canonical text;
  uploader public.profiles%rowtype;
  selected_course public.courses%rowtype;
  selected_term public.course_terms%rowtype;
  created_course boolean:=false;
begin
  select * into uploader from public.profiles where id=(select auth.uid()) and is_active;
  if uploader.id is null then raise exception 'An active staff account is required.' using errcode='42501'; end if;
  canonical:=private.normalize_course_code(p_course_code);
  if canonical is null then raise exception 'Course code must contain four letters followed by four numbers and an optional U or G.'; end if;
  if not exists(select 1 from public.academic_terms where code=p_term_code) then raise exception 'Unknown academic term.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(canonical,0));
  select * into selected_course from public.courses where private.normalize_course_code(code)=canonical;
  if selected_course.id is null then
    insert into public.courses(code,title,department,organization_unit_id)
    values(canonical,coalesce(nullif(trim(p_course_title),''),canonical),substring(canonical from 1 for 4),uploader.organization_unit_id)
    returning * into selected_course;
    insert into public.course_terms(course_id,term_code,instructor_id)
    values(selected_course.id,p_term_code,uploader.id)
    returning * into selected_term;
    created_course:=true;
    insert into public.audit_events(actor_id,action,entity_type,entity_id,details)
    values(uploader.id,'course.created_from_grade_upload','course',selected_course.id::text,jsonb_build_object('code',canonical,'term',p_term_code));
  else
    select * into selected_term from public.course_terms where course_id=selected_course.id and term_code=p_term_code;
    if selected_term.id is null then
      if uploader.role not in ('dean','academic_director','chair','program_lead') or not private.can_access_unit(selected_course.organization_unit_id) then
        raise exception '% is not configured for active term %.',selected_course.code,p_term_code using errcode='42501';
      end if;
      insert into public.course_terms(course_id,term_code,instructor_id)
      values(selected_course.id,p_term_code,uploader.id)
      returning * into selected_term;
    elsif not private.can_submit_course_term(selected_term.id) then
      raise exception 'Not authorized for this course term' using errcode='42501';
    end if;
  end if;

  return jsonb_build_object(
    'course_id',selected_course.id,
    'course_term_id',selected_term.id,
    'course_code',selected_course.code,
    'course_title',selected_course.title,
    'created_course',created_course
  );
end $$;

revoke all on function public.resolve_grade_course(text,text,text) from public,anon;
grant execute on function public.resolve_grade_course(text,text,text) to authenticated;

drop function public.submit_public_grade_upload(text,text,text,text,numeric[]);

create function private.submit_public_grade_upload(
  p_course_code text,
  p_file_course_code text,
  p_course_title text,
  p_faculty_name text,
  p_faculty_email text,
  p_grades numeric[]
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  canonical text;
  file_canonical text;
  faculty public.profiles%rowtype;
  selected_course public.courses%rowtype;
  selected_term public.course_terms%rowtype;
  current_term text;
  active_upload public.grade_uploads%rowtype;
  existing_grades numeric[];
  upload_id uuid;
  submission_id uuid;
  next_version integer;
  row_count integer;
  avg_grade numeric;
  pass_pct numeric;
  dist jsonb;
  submitted_name_key text;
  assigned_name_key text;
  created_course boolean:=false;
begin
  canonical:=private.normalize_course_code(p_course_code);
  file_canonical:=private.normalize_course_code(p_file_course_code);
  if canonical is null or file_canonical is null then raise exception 'Enter a course code with four letters followed by four numbers and an optional U or G.'; end if;
  if canonical<>file_canonical then raise exception 'The entered course code does not match the uploaded file.'; end if;
  if p_faculty_name is null or length(trim(p_faculty_name)) not between 2 and 120 then raise exception 'Enter your full name.'; end if;
  if p_faculty_email is null or length(trim(p_faculty_email)) not between 3 and 254 or trim(p_faculty_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Enter a valid faculty email.'; end if;
  row_count:=coalesce(array_length(p_grades,1),0);
  if row_count<1 or row_count>5000 then raise exception 'Grades must contain 1 to 5000 rows.'; end if;
  if exists(select 1 from unnest(p_grades) g where g is null or g<0 or g>100) then raise exception 'Every grade must be between 0 and 100.'; end if;

  select * into faculty from public.profiles where lower(email)=lower(trim(p_faculty_email)) and is_active limit 1;
  submitted_name_key:=regexp_replace(regexp_replace(lower(trim(p_faculty_name)),'^(dr|prof|professor|mr|ms|mrs)[.]?[[:space:]]+','','i'),'[^a-z0-9]','','g');
  assigned_name_key:=regexp_replace(regexp_replace(lower(trim(coalesce(faculty.full_name,''))),'^(dr|prof|professor|mr|ms|mrs)[.]?[[:space:]]+','','i'),'[^a-z0-9]','','g');
  if faculty.id is null or submitted_name_key='' or submitted_name_key<>assigned_name_key then
    raise exception 'Course or faculty details could not be verified.';
  end if;
  select code into current_term from public.academic_terms where is_current;
  if current_term is null then raise exception 'No current academic term is configured.'; end if;
  if (select count(*) from public.public_grade_submissions where lower(faculty_email)=lower(trim(p_faculty_email)) and created_at>=now()-interval '1 hour')>=10 then
    raise exception 'Too many submissions. Try again later.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(canonical,0));
  select * into selected_course from public.courses where private.normalize_course_code(code)=canonical;
  if selected_course.id is null then
    insert into public.courses(code,title,department,organization_unit_id)
    values(canonical,coalesce(nullif(trim(p_course_title),''),canonical),substring(canonical from 1 for 4),faculty.organization_unit_id)
    returning * into selected_course;
    insert into public.course_terms(course_id,term_code,instructor_id)
    values(selected_course.id,current_term,faculty.id)
    returning * into selected_term;
    created_course:=true;
  else
    select * into selected_term from public.course_terms where course_id=selected_course.id and term_code=current_term;
    if selected_term.id is null or selected_term.instructor_id<>faculty.id then
      raise exception 'Course or faculty details could not be verified.';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(selected_term.id::text,0));
  select * into active_upload from public.grade_uploads where course_term_id=selected_term.id and is_active;
  if active_upload.id is not null then
    select array_agg(final_grade order by source_row) into existing_grades from public.grade_entries where grade_upload_id=active_upload.id;
    if existing_grades=p_grades then
      select id into submission_id from public.public_grade_submissions where grade_upload_id=active_upload.id;
      if submission_id is null then
        insert into public.public_grade_submissions(course_term_id,grade_upload_id,faculty_name,faculty_email)
        values(selected_term.id,active_upload.id,trim(p_faculty_name),lower(trim(p_faculty_email))) returning id into submission_id;
      end if;
      return jsonb_build_object('receipt_id',submission_id,'course_code',selected_course.code,'course_title',selected_course.title,'term_code',current_term,'enrolled_count',active_upload.enrolled_count,'duplicate',true,'created_course',false);
    end if;
  end if;
  if (select count(*) from public.public_grade_submissions where course_term_id=selected_term.id and lower(faculty_email)=lower(trim(p_faculty_email)) and created_at>=now()-interval '1 hour')>=5 then
    raise exception 'Too many submissions for this course. Try again later.';
  end if;

  select coalesce(max(version),0)+1 into next_version from public.grade_uploads where course_term_id=selected_term.id;
  update public.grade_uploads set is_active=false where course_term_id=selected_term.id and is_active;
  insert into public.grade_uploads(course_term_id,version,is_active,uploaded_by,submission_source)
  values(selected_term.id,next_version,true,faculty.id,'public') returning id into upload_id;
  insert into public.grade_entries(grade_upload_id,source_row,final_grade)
  select upload_id,ordinality,grade from unnest(p_grades) with ordinality as x(grade,ordinality);
  select round(avg(g),2),round(100.0*count(*) filter(where g>=50)/count(*),2),jsonb_build_object(
    'A',count(*) filter(where g>=80),'B',count(*) filter(where g>=70 and g<80),'C',count(*) filter(where g>=60 and g<70),'D',count(*) filter(where g>=50 and g<60),'F',count(*) filter(where g<50)
  ) into avg_grade,pass_pct,dist from unnest(p_grades) g;
  update public.grade_uploads set enrolled_count=row_count,class_average=avg_grade,pass_rate=pass_pct,distribution_json=dist where id=upload_id;
  insert into public.public_grade_submissions(course_term_id,grade_upload_id,faculty_name,faculty_email)
  values(selected_term.id,upload_id,trim(p_faculty_name),lower(trim(p_faculty_email))) returning id into submission_id;
  insert into public.audit_events(actor_id,action,entity_type,entity_id,details)
  values(null,case when created_course then 'grade_upload.public_created_with_course' else 'grade_upload.public_created' end,'course_term',selected_term.id::text,jsonb_build_object('upload_id',upload_id,'submission_id',submission_id,'version',next_version,'rows',row_count,'course_created',created_course));
  return jsonb_build_object('receipt_id',submission_id,'course_code',selected_course.code,'course_title',selected_course.title,'term_code',current_term,'enrolled_count',row_count,'duplicate',false,'created_course',created_course);
end $$;

revoke all on function private.submit_public_grade_upload(text,text,text,text,text,numeric[]) from public,anon,authenticated;

create function public.submit_public_grade_upload(
  p_course_code text,
  p_file_course_code text,
  p_course_title text,
  p_faculty_name text,
  p_faculty_email text,
  p_grades numeric[]
) returns jsonb
language sql
security definer
set search_path=''
as $$
  select private.submit_public_grade_upload(p_course_code,p_file_course_code,p_course_title,p_faculty_name,p_faculty_email,p_grades)
$$;

revoke all on function public.submit_public_grade_upload(text,text,text,text,text,numeric[]) from public;
grant execute on function public.submit_public_grade_upload(text,text,text,text,text,numeric[]) to anon,authenticated;

create table public.important_dates (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null check (academic_year ~ '^[0-9]{4}-[0-9]{2}$'),
  semester text not null check (semester in ('Fall','Winter','Spring/Summer')),
  starts_on date not null,
  ends_on date not null,
  short_name text not null check (length(short_name) between 2 and 80),
  description text not null check (length(description) between 2 and 2000),
  sort_order integer not null check (sort_order between 1 and 500),
  source_file_name text not null check (length(source_file_name) between 1 and 255),
  imported_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on>=starts_on),
  unique(academic_year,sort_order)
);

create index important_dates_year_semester_date_idx on public.important_dates(academic_year,semester,starts_on);
create trigger important_dates_updated before update on public.important_dates for each row execute function public.set_updated_at();
alter table public.important_dates enable row level security;
grant select,insert,update,delete on table public.important_dates to authenticated;

create policy important_dates_read on public.important_dates for select to authenticated using(private.is_active_staff());
create policy important_dates_dean_manage on public.important_dates for all to authenticated
using(private.current_role()='dean') with check(private.current_role()='dean' and imported_by=(select auth.uid()));

create function public.import_important_dates(p_academic_year text,p_source_file_name text,p_rows jsonb) returns integer
language plpgsql
security invoker
set search_path=''
as $$
declare
  item jsonb;
  item_number integer;
  imported integer:=0;
  starts date;
  ends date;
begin
  if private.current_role()<>'dean' then raise exception 'Only deans can manage important dates.' using errcode='42501'; end if;
  if p_academic_year is null or p_academic_year !~ '^[0-9]{4}-[0-9]{2}$' then raise exception 'Academic year must use YYYY-YY format.'; end if;
  if p_source_file_name is null or length(trim(p_source_file_name)) not between 1 and 255 then raise exception 'A source file name is required.'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 500 then raise exception 'Important dates must contain 1 to 500 rows.'; end if;
  delete from public.important_dates where academic_year=p_academic_year;
  for item,item_number in select value,ordinality::integer from jsonb_array_elements(p_rows) with ordinality loop
    if item->>'semester' not in ('Fall','Winter','Spring/Summer') then raise exception 'Row % has an invalid semester.',item_number; end if;
    starts:=(item->>'starts_on')::date;
    ends:=(item->>'ends_on')::date;
    if ends<starts then raise exception 'Row % ends before it starts.',item_number; end if;
    if length(trim(coalesce(item->>'short_name',''))) not between 2 and 80 then raise exception 'Row % has an invalid short name.',item_number; end if;
    if length(trim(coalesce(item->>'description',''))) not between 2 and 2000 then raise exception 'Row % has an invalid description.',item_number; end if;
    insert into public.important_dates(academic_year,semester,starts_on,ends_on,short_name,description,sort_order,source_file_name,imported_by)
    values(p_academic_year,item->>'semester',starts,ends,trim(item->>'short_name'),trim(item->>'description'),item_number,trim(p_source_file_name),(select auth.uid()));
    imported:=imported+1;
  end loop;
  insert into public.audit_events(actor_id,action,entity_type,entity_id,details)
  values((select auth.uid()),'important_dates.imported','academic_year',p_academic_year,jsonb_build_object('source_file',trim(p_source_file_name),'rows',imported));
  return imported;
end $$;

revoke all on function public.import_important_dates(text,text,jsonb) from public,anon;
grant execute on function public.import_important_dates(text,text,jsonb) to authenticated;

alter publication supabase_realtime add table public.important_dates;
