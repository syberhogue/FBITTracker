alter table public.grade_uploads
  add column submission_source text not null default 'authenticated'
  check (submission_source in ('authenticated','public'));

create table public.public_grade_submissions (
  id uuid primary key default gen_random_uuid(),
  course_term_id uuid not null references public.course_terms(id) on delete cascade,
  grade_upload_id uuid not null unique references public.grade_uploads(id) on delete cascade,
  faculty_name text not null check (length(faculty_name) between 2 and 120),
  faculty_email text not null check (length(faculty_email) between 3 and 254),
  created_at timestamptz not null default now()
);

create index public_grade_submissions_rate_idx
  on public.public_grade_submissions(course_term_id,lower(faculty_email),created_at desc);

alter table public.public_grade_submissions enable row level security;
revoke all on table public.public_grade_submissions from public,anon,authenticated;

create function private.submit_public_grade_upload(
  p_course_code text,
  p_file_course_code text,
  p_faculty_name text,
  p_faculty_email text,
  p_grades numeric[]
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  target record;
  active_upload public.grade_uploads%rowtype;
  existing_grades numeric[];
  upload_id uuid;
  submission_id uuid;
  next_version integer;
  row_count integer;
  avg_grade numeric;
  pass_pct numeric;
  dist jsonb;
  form_code text;
  file_code text;
  submitted_name_key text;
  assigned_name_key text;
begin
  if p_course_code is null or length(trim(p_course_code)) not between 3 and 100 then raise exception 'Enter a valid course code.'; end if;
  if p_file_course_code is null or length(trim(p_file_course_code)) not between 3 and 160 then raise exception 'The uploaded file must contain one Course Code.'; end if;
  if p_faculty_name is null or length(trim(p_faculty_name)) not between 2 and 120 then raise exception 'Enter your full name.'; end if;
  if p_faculty_email is null or length(trim(p_faculty_email)) not between 3 and 254 or trim(p_faculty_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Enter a valid faculty email.'; end if;

  row_count:=coalesce(array_length(p_grades,1),0);
  if row_count<1 or row_count>5000 then raise exception 'Grades must contain 1 to 5000 rows.'; end if;
  if exists(select 1 from unnest(p_grades) g where g is null or g<0 or g>100) then raise exception 'Every grade must be between 0 and 100.'; end if;

  form_code:=upper(regexp_replace(p_course_code,'[^A-Za-z0-9]','','g'));
  file_code:=upper(regexp_replace(p_file_course_code,'[^A-Za-z0-9]','','g'));
  if form_code<>file_code and position(form_code in file_code)=0 and position(file_code in form_code)=0 then
    raise exception 'The entered course code does not match the uploaded file.';
  end if;

  select
    ct.id as course_term_id,
    ct.instructor_id,
    c.code as course_code,
    c.title as course_title,
    term.code as term_code,
    instructor.full_name as instructor_name,
    instructor.email as instructor_email
  into target
  from public.course_terms ct
  join public.courses c on c.id=ct.course_id
  join public.academic_terms term on term.code=ct.term_code and term.is_current
  join public.profiles instructor on instructor.id=ct.instructor_id and instructor.is_active
  where form_code=upper(regexp_replace(c.code,'[^A-Za-z0-9]','','g'))
     or position(upper(regexp_replace(c.code,'[^A-Za-z0-9]','','g')) in form_code)>0
  order by (form_code=upper(regexp_replace(c.code,'[^A-Za-z0-9]','','g'))) desc
  limit 1;

  if target.course_term_id is null or lower(trim(p_faculty_email))<>lower(target.instructor_email) then
    raise exception 'Course or faculty details could not be verified.';
  end if;

  submitted_name_key:=regexp_replace(
    regexp_replace(lower(trim(p_faculty_name)),'^(dr|prof|professor|mr|ms|mrs)[.]?[[:space:]]+','','i'),
    '[^a-z0-9]','','g'
  );
  assigned_name_key:=regexp_replace(
    regexp_replace(lower(trim(target.instructor_name)),'^(dr|prof|professor|mr|ms|mrs)[.]?[[:space:]]+','','i'),
    '[^a-z0-9]','','g'
  );
  if submitted_name_key='' or submitted_name_key<>assigned_name_key then
    raise exception 'Course or faculty details could not be verified.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target.course_term_id::text,0));
  select * into active_upload
  from public.grade_uploads
  where course_term_id=target.course_term_id and is_active;

  if active_upload.id is not null then
    select array_agg(final_grade order by source_row) into existing_grades
    from public.grade_entries
    where grade_upload_id=active_upload.id;
    if existing_grades=p_grades then
      select id into submission_id from public.public_grade_submissions where grade_upload_id=active_upload.id;
      if submission_id is null then
        insert into public.public_grade_submissions(course_term_id,grade_upload_id,faculty_name,faculty_email)
          values(target.course_term_id,active_upload.id,trim(p_faculty_name),lower(trim(p_faculty_email)))
          returning id into submission_id;
        insert into public.audit_events(actor_id,action,entity_type,entity_id,details)
          values(null,'grade_upload.public_duplicate_received','course_term',target.course_term_id::text,jsonb_build_object('upload_id',active_upload.id,'submission_id',submission_id,'rows',row_count));
      end if;
      return jsonb_build_object(
        'receipt_id',submission_id,
        'course_code',target.course_code,
        'course_title',target.course_title,
        'term_code',target.term_code,
        'enrolled_count',active_upload.enrolled_count,
        'duplicate',true
      );
    end if;
  end if;

  if (
    select count(*)
    from public.public_grade_submissions
    where course_term_id=target.course_term_id
      and lower(faculty_email)=lower(trim(p_faculty_email))
      and created_at>=now()-interval '1 hour'
  )>=5 then
    raise exception 'Too many submissions for this course. Try again later.';
  end if;

  select coalesce(max(version),0)+1 into next_version
  from public.grade_uploads
  where course_term_id=target.course_term_id;
  update public.grade_uploads set is_active=false where course_term_id=target.course_term_id and is_active;
  insert into public.grade_uploads(course_term_id,version,is_active,uploaded_by,submission_source)
    values(target.course_term_id,next_version,true,target.instructor_id,'public')
    returning id into upload_id;
  insert into public.grade_entries(grade_upload_id,source_row,final_grade)
    select upload_id,ordinality,grade from unnest(p_grades) with ordinality as x(grade,ordinality);
  select
    round(avg(g),2),
    round(100.0*count(*) filter(where g>=50)/count(*),2),
    jsonb_build_object(
      'A',count(*) filter(where g>=80),
      'B',count(*) filter(where g>=70 and g<80),
      'C',count(*) filter(where g>=60 and g<70),
      'D',count(*) filter(where g>=50 and g<60),
      'F',count(*) filter(where g<50)
    )
  into avg_grade,pass_pct,dist
  from unnest(p_grades) g;
  update public.grade_uploads
  set enrolled_count=row_count,class_average=avg_grade,pass_rate=pass_pct,distribution_json=dist
  where id=upload_id;
  insert into public.public_grade_submissions(course_term_id,grade_upload_id,faculty_name,faculty_email)
    values(target.course_term_id,upload_id,trim(p_faculty_name),lower(trim(p_faculty_email)))
    returning id into submission_id;
  insert into public.audit_events(actor_id,action,entity_type,entity_id,details)
    values(null,'grade_upload.public_created','course_term',target.course_term_id::text,jsonb_build_object('upload_id',upload_id,'submission_id',submission_id,'version',next_version,'rows',row_count));

  return jsonb_build_object(
    'receipt_id',submission_id,
    'course_code',target.course_code,
    'course_title',target.course_title,
    'term_code',target.term_code,
    'enrolled_count',row_count,
    'duplicate',false
  );
end $$;

revoke all on function private.submit_public_grade_upload(text,text,text,text,numeric[]) from public,anon,authenticated;

create function public.submit_public_grade_upload(
  p_course_code text,
  p_file_course_code text,
  p_faculty_name text,
  p_faculty_email text,
  p_grades numeric[]
) returns jsonb
language sql
security definer
set search_path=''
as $$
  select private.submit_public_grade_upload(p_course_code,p_file_course_code,p_faculty_name,p_faculty_email,p_grades)
$$;

revoke all on function public.submit_public_grade_upload(text,text,text,text,numeric[]) from public;
grant execute on function public.submit_public_grade_upload(text,text,text,text,numeric[]) to anon,authenticated;
