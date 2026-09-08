create function public.create_academic_term(
  p_code text,
  p_name text,
  p_starts_on date,
  p_ends_on date,
  p_is_current boolean default false
) returns text
language plpgsql
security invoker
set search_path=''
as $$
declare
  normalized_code text:=upper(trim(p_code));
begin
  if private.current_role() not in ('dean','academic_director') then
    raise exception 'Only deans and academic directors can create academic terms.' using errcode='42501';
  end if;
  if normalized_code is null or normalized_code !~ '^[FWS][0-9]{2}$' then
    raise exception 'Term code must use F, W, or S followed by a two-digit year.';
  end if;
  if p_name is null or length(trim(p_name)) not between 2 and 100 then
    raise exception 'Enter a term name between 2 and 100 characters.';
  end if;
  if p_starts_on is null or p_ends_on is null or p_ends_on<p_starts_on then
    raise exception 'The term end date must be on or after its start date.';
  end if;
  if exists(select 1 from public.academic_terms where code=normalized_code) then
    raise exception 'That academic term already exists.';
  end if;

  if coalesce(p_is_current,false) then
    update public.academic_terms set is_current=false where is_current;
  end if;
  insert into public.academic_terms(code,name,starts_on,ends_on,is_current)
  values(normalized_code,trim(p_name),p_starts_on,p_ends_on,coalesce(p_is_current,false));
  insert into public.audit_events(actor_id,action,entity_type,entity_id,details)
  values((select auth.uid()),'academic_term.created','academic_term',normalized_code,jsonb_build_object('is_current',coalesce(p_is_current,false),'starts_on',p_starts_on,'ends_on',p_ends_on));
  return normalized_code;
end $$;

revoke all on function public.create_academic_term(text,text,date,date,boolean) from public,anon;
grant execute on function public.create_academic_term(text,text,date,date,boolean) to authenticated;

create policy uploads_delete on public.grade_uploads
for delete to authenticated
using(private.can_submit_course_term(course_term_id));

create function public.delete_course_term_grades(p_course_id uuid,p_term_code text) returns integer
language plpgsql
security invoker
set search_path=''
as $$
declare
  target_course_term uuid;
  deleted_count integer;
begin
  select id into target_course_term
  from public.course_terms
  where course_id=p_course_id and term_code=upper(trim(p_term_code));

  if target_course_term is null or not private.can_submit_course_term(target_course_term) then
    raise exception 'Not authorized to delete grades for this course term.' using errcode='42501';
  end if;

  delete from public.grade_uploads where course_term_id=target_course_term;
  get diagnostics deleted_count=row_count;
  insert into public.audit_events(actor_id,action,entity_type,entity_id,details)
  values((select auth.uid()),'grade_uploads.deleted','course_term',target_course_term::text,jsonb_build_object('term_code',upper(trim(p_term_code)),'deleted_uploads',deleted_count));
  return deleted_count;
end $$;

revoke all on function public.delete_course_term_grades(uuid,text) from public,anon;
grant execute on function public.delete_course_term_grades(uuid,text) to authenticated;
