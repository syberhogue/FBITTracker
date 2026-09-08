drop function if exists public.submit_public_grade_upload(text,text,text,text,text,numeric[]);
drop function if exists private.submit_public_grade_upload(text,text,text,text,text,numeric[]);

create function private.submit_public_grade_upload(
  p_course_code text,
  p_file_course_code text,
  p_course_title text,
  p_term_code text,
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
  selected_term_code text;
  faculty public.profiles%rowtype;
  selected_course public.courses%rowtype;
  selected_term public.course_terms%rowtype;
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
  selected_term_code:=upper(trim(p_term_code));
  if canonical is null or file_canonical is null then raise exception 'Enter a course code with four letters followed by four numbers and an optional U or G.'; end if;
  if canonical<>file_canonical then raise exception 'The entered course code does not match the uploaded file.'; end if;
  if not exists(select 1 from public.academic_terms where code=selected_term_code) then raise exception 'The semester in the uploaded file is not configured.'; end if;
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
    values(selected_course.id,selected_term_code,faculty.id)
    returning * into selected_term;
    created_course:=true;
  else
    select * into selected_term from public.course_terms where course_id=selected_course.id and term_code=selected_term_code;
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
      return jsonb_build_object('receipt_id',submission_id,'course_code',selected_course.code,'course_title',selected_course.title,'term_code',selected_term_code,'enrolled_count',active_upload.enrolled_count,'duplicate',true,'created_course',false);
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
  values(null,case when created_course then 'grade_upload.public_created_with_course' else 'grade_upload.public_created' end,'course_term',selected_term.id::text,jsonb_build_object('upload_id',upload_id,'submission_id',submission_id,'version',next_version,'rows',row_count,'course_created',created_course,'term_code',selected_term_code));
  return jsonb_build_object('receipt_id',submission_id,'course_code',selected_course.code,'course_title',selected_course.title,'term_code',selected_term_code,'enrolled_count',row_count,'duplicate',false,'created_course',created_course);
end $$;

revoke all on function private.submit_public_grade_upload(text,text,text,text,text,text,numeric[]) from public,anon,authenticated;

create function public.submit_public_grade_upload(
  p_course_code text,
  p_file_course_code text,
  p_course_title text,
  p_term_code text,
  p_faculty_name text,
  p_faculty_email text,
  p_grades numeric[]
) returns jsonb
language sql
security definer
set search_path=''
as $$
  select private.submit_public_grade_upload(p_course_code,p_file_course_code,p_course_title,p_term_code,p_faculty_name,p_faculty_email,p_grades)
$$;

revoke all on function public.submit_public_grade_upload(text,text,text,text,text,text,numeric[]) from public;
grant execute on function public.submit_public_grade_upload(text,text,text,text,text,text,numeric[]) to anon,authenticated;
