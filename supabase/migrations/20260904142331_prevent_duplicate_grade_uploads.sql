create or replace function public.submit_grade_upload(p_course_term_id uuid,p_grades numeric[]) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  upload_id uuid;
  next_version integer;
  row_count integer;
  avg_grade numeric;
  pass_pct numeric;
  dist jsonb;
  active_upload public.grade_uploads%rowtype;
  existing_grades numeric[];
begin
  if not private.can_submit_course_term(p_course_term_id) then
    raise exception 'Not authorized for this course term' using errcode='42501';
  end if;

  row_count:=coalesce(array_length(p_grades,1),0);
  if row_count<1 or row_count>5000 then raise exception 'Grades must contain 1 to 5000 rows'; end if;
  if exists(select 1 from unnest(p_grades) g where g is null or g<0 or g>100) then raise exception 'Every grade must be between 0 and 100'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_course_term_id::text,0));
  select * into active_upload from public.grade_uploads where course_term_id=p_course_term_id and is_active;
  if active_upload.id is not null then
    select array_agg(final_grade order by source_row) into existing_grades
    from public.grade_entries
    where grade_upload_id=active_upload.id;

    if existing_grades=p_grades then
      return jsonb_build_object(
        'upload_id',active_upload.id,
        'version',active_upload.version,
        'enrolled_count',active_upload.enrolled_count,
        'class_average',active_upload.class_average,
        'pass_rate',active_upload.pass_rate,
        'distribution',active_upload.distribution_json,
        'duplicate',true
      );
    end if;
  end if;

  select coalesce(max(version),0)+1 into next_version from public.grade_uploads where course_term_id=p_course_term_id;
  update public.grade_uploads set is_active=false where course_term_id=p_course_term_id and is_active;
  insert into public.grade_uploads(course_term_id,version,is_active,uploaded_by)
    values(p_course_term_id,next_version,true,(select auth.uid())) returning id into upload_id;
  insert into public.grade_entries(grade_upload_id,source_row,final_grade)
    select upload_id,ordinality,grade from unnest(p_grades) with ordinality as x(grade,ordinality);
  select round(avg(g),2),round(100.0*count(*) filter(where g>=50)/count(*),2),jsonb_build_object(
    'A',count(*) filter(where g>=80),
    'B',count(*) filter(where g>=70 and g<80),
    'C',count(*) filter(where g>=60 and g<70),
    'D',count(*) filter(where g>=50 and g<60),
    'F',count(*) filter(where g<50)
  ) into avg_grade,pass_pct,dist from unnest(p_grades) g;
  update public.grade_uploads set enrolled_count=row_count,class_average=avg_grade,pass_rate=pass_pct,distribution_json=dist where id=upload_id;
  insert into public.audit_events(actor_id,action,entity_type,entity_id,details)
    values((select auth.uid()),'grade_upload.created','course_term',p_course_term_id::text,jsonb_build_object('upload_id',upload_id,'version',next_version,'rows',row_count));
  return jsonb_build_object(
    'upload_id',upload_id,
    'version',next_version,
    'enrolled_count',row_count,
    'class_average',avg_grade,
    'pass_rate',pass_pct,
    'distribution',dist,
    'duplicate',false
  );
end $$;

revoke all on function public.submit_grade_upload(uuid,numeric[]) from public,anon;
grant execute on function public.submit_grade_upload(uuid,numeric[]) to authenticated;
