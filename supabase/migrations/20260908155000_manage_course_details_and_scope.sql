alter table public.course_terms
  add column section text not null default '' check (length(section) <= 40);

create policy overrides_delete on public.submission_status_overrides
for delete to authenticated
using(exists(
  select 1
  from public.course_terms ct
  where ct.course_id=public.submission_status_overrides.course_id
    and ct.term_code=public.submission_status_overrides.term_code
    and private.can_manage_course_term(ct.id)
));

create function public.update_course_details(
  p_course_id uuid,
  p_term_code text,
  p_code text,
  p_title text,
  p_department text,
  p_section text,
  p_instructor_id uuid default null
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  target_course public.courses%rowtype;
  target_term public.course_terms%rowtype;
  code_parts text[];
  canonical_code text;
begin
  select * into target_course from public.courses where id=p_course_id;
  if target_course.id is null
    or private.current_role() not in ('dean','academic_director','chair','program_lead')
    or not private.can_access_unit(target_course.organization_unit_id) then
    raise exception 'Not authorized to edit this course.' using errcode='42501';
  end if;

  code_parts:=regexp_match(upper(trim(coalesce(p_code,''))),'^([A-Z]{4})[[:space:]-]*([0-9]{4})(?:[[:space:]-]*([UG]))?$');
  if code_parts is null then
    raise exception 'Course code must contain four letters followed by four numbers and an optional U or G.';
  end if;
  canonical_code:=code_parts[1]||' '||code_parts[2]||coalesce(code_parts[3],'U');
  if length(trim(coalesce(p_title,''))) not between 2 and 200 then
    raise exception 'Course title must be between 2 and 200 characters.';
  end if;
  if length(trim(coalesce(p_department,''))) not between 2 and 120 then
    raise exception 'Department must be between 2 and 120 characters.';
  end if;
  if length(trim(coalesce(p_section,''))) > 40 then
    raise exception 'Section must be 40 characters or fewer.';
  end if;
  if not exists(select 1 from public.academic_terms where code=upper(trim(p_term_code))) then
    raise exception 'Unknown academic term.';
  end if;
  if p_instructor_id is not null and not exists(select 1 from public.profiles where id=p_instructor_id and is_active) then
    raise exception 'Choose an active instructor.';
  end if;

  update public.courses
  set code=canonical_code,title=trim(p_title),department=trim(p_department)
  where id=p_course_id;

  select * into target_term
  from public.course_terms
  where course_id=p_course_id and term_code=upper(trim(p_term_code));
  if target_term.id is null then
    insert into public.course_terms(course_id,term_code,instructor_id,section)
    values(p_course_id,upper(trim(p_term_code)),p_instructor_id,trim(coalesce(p_section,'')))
    returning * into target_term;
  else
    update public.course_terms
    set instructor_id=p_instructor_id,section=trim(coalesce(p_section,'')),updated_at=now()
    where id=target_term.id
    returning * into target_term;
  end if;

  insert into public.audit_events(actor_id,action,entity_type,entity_id,details)
  values((select auth.uid()),'course.updated','course',p_course_id::text,jsonb_build_object(
    'term_code',target_term.term_code,
    'code',canonical_code,
    'section',target_term.section,
    'instructor_id',p_instructor_id
  ));
  return jsonb_build_object('course_id',p_course_id,'course_term_id',target_term.id,'course_code',canonical_code);
end $$;

revoke all on function public.update_course_details(uuid,text,text,text,text,text,uuid) from public,anon;
grant execute on function public.update_course_details(uuid,text,text,text,text,text,uuid) to authenticated;

create function public.remove_course_scope(
  p_course_id uuid,
  p_term_code text,
  p_scope text
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  target_course public.courses%rowtype;
  target_term public.course_terms%rowtype;
  normalized_term text:=upper(trim(p_term_code));
begin
  if p_scope not in ('term','history') then
    raise exception 'Removal scope must be term or history.';
  end if;
  select * into target_course from public.courses where id=p_course_id;
  if target_course.id is null
    or private.current_role() not in ('dean','academic_director','chair','program_lead')
    or not private.can_access_unit(target_course.organization_unit_id) then
    raise exception 'Not authorized to remove this course.' using errcode='42501';
  end if;

  if p_scope='term' then
    select * into target_term
    from public.course_terms
    where course_id=p_course_id and term_code=normalized_term;
    if target_term.id is null then
      raise exception '% is not configured for %.',target_course.code,normalized_term;
    end if;
    if not private.can_manage_course_term(target_term.id) then
      raise exception 'Not authorized to remove this course from the term.' using errcode='42501';
    end if;
    delete from public.submission_status_overrides where course_id=p_course_id and term_code=normalized_term;
    delete from public.course_terms where id=target_term.id;
    insert into public.audit_events(actor_id,action,entity_type,entity_id,details)
    values((select auth.uid()),'course.removed_from_term','course',p_course_id::text,jsonb_build_object('term_code',normalized_term,'course_code',target_course.code));
  else
    delete from public.courses where id=p_course_id;
    insert into public.audit_events(actor_id,action,entity_type,entity_id,details)
    values((select auth.uid()),'course.deleted','course',p_course_id::text,jsonb_build_object('course_code',target_course.code));
  end if;

  return jsonb_build_object('course_id',p_course_id,'term_code',normalized_term,'scope',p_scope);
end $$;

revoke all on function public.remove_course_scope(uuid,text,text) from public,anon;
grant execute on function public.remove_course_scope(uuid,text,text) to authenticated;
