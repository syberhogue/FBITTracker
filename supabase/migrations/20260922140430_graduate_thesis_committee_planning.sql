alter table public.graduate_students
  add column co_supervisor_id uuid references public.profiles(id),
  add column co_supervisor_name text not null default '' check (length(co_supervisor_name) <= 200),
  add constraint graduate_distinct_supervisors check (supervisor_id is null or co_supervisor_id is null or supervisor_id <> co_supervisor_id);
create index graduate_students_co_supervisor_idx on public.graduate_students(co_supervisor_id);
grant update(co_supervisor_id,co_supervisor_name) on public.graduate_students to authenticated;

drop policy graduates_read on public.graduate_students;
drop policy graduates_update on public.graduate_students;
create policy graduates_read on public.graduate_students for select to authenticated
using (private.can_manage_graduate(organization_unit_id,created_by,supervisor_id) or (private.is_active_staff() and co_supervisor_id=(select auth.uid())));
create policy graduates_update on public.graduate_students for update to authenticated
using (private.can_manage_graduate(organization_unit_id,created_by,supervisor_id) or (private.is_active_staff() and co_supervisor_id=(select auth.uid())))
with check ((private.can_manage_graduate(organization_unit_id,created_by,supervisor_id) or (private.is_active_staff() and co_supervisor_id=(select auth.uid()))) and private.can_access_unit(organization_unit_id));

-- Resolve changed account selections through the same profile visibility as the UI.
-- Unchanged account names remain available when a co-supervisor edits a student.
create function private.graduate_supervisor_names() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.supervisor_id is not null and (tg_op='INSERT' or new.supervisor_id is distinct from old.supervisor_id) then
    select full_name into new.supervisor_name from public.profiles where id=new.supervisor_id and is_active;
    if new.supervisor_name is null then raise exception 'Choose an active supervisor account available to you.' using errcode='23514'; end if;
  end if;
  if new.co_supervisor_id is null then new.co_supervisor_name:='';
  elsif tg_op='INSERT' or new.co_supervisor_id is distinct from old.co_supervisor_id then
    select full_name into new.co_supervisor_name from public.profiles where id=new.co_supervisor_id and is_active;
    if new.co_supervisor_name is null then raise exception 'Choose an active co-supervisor account available to you.' using errcode='23514'; end if;
  end if;
  return new;
end $$;
revoke all on function private.graduate_supervisor_names() from public,anon;
create trigger graduate_supervisor_names before insert or update on public.graduate_students for each row execute function private.graduate_supervisor_names();

alter table public.graduate_task_records add column is_draft boolean not null default false;
alter table public.graduate_task_records drop constraint graduate_task_records_task_key_check;
alter table public.graduate_task_records add constraint graduate_task_records_task_key_check check (
  task_key in ('form-office','form-sgps','thesis-office','distribute-thesis','examiner-report','oral-exam','chair-report','final-thesis','committee:formation','planning:defence','planning:submission')
  or task_key ~ '^report:[0-9]{4}-(01|05|09)-01$'
  or task_key ~ '^committee:meeting:[0-9]{4}-(01|05|09)-01$'
  or task_key ~ '^chapter:(introduction|literature|methodology|results|discussion)$'
  or task_key ~ '^course:[1-5]$'
  or task_key ~ '^custom:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);
alter table public.graduate_task_records drop constraint graduate_expected_course_only;
alter table public.graduate_task_records add constraint graduate_expected_planning_only check (expected_on is null or task_key ~ '^course:[1-5]$' or task_key ~ '^chapter:(introduction|literature|methodology|results|discussion)$');
alter table public.graduate_task_records add constraint graduate_chapter_draft_only check (not is_draft or (task_key ~ '^chapter:(introduction|literature|methodology|results|discussion)$' and completed_on is null));

create or replace function private.seed_graduate_categories() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  insert into public.graduate_categories(student_id,key,name,color,sort_order) values
    (new.id,'reports','Semester research progress reports','#2563eb',0),
    (new.id,'courses','Coursework','#7c3aed',1),
    (new.id,'thesis-planning','Thesis/Defence planning','#0d9488',2),
    (new.id,'committee','Supervisory Committee','#b45309',3),
    (new.id,'student','Student / Supervisor','#059669',4),
    (new.id,'office','Program Office / GPA','#0284c7',5),
    (new.id,'sgps','SGPS','#ea580c',6);
  return new;
end $$;
update public.graduate_categories set sort_order=sort_order+2 where sort_order>=2;
insert into public.graduate_categories(student_id,key,name,color,sort_order)
select s.id,c.key,c.name,c.color,c.sort_order from public.graduate_students s cross join (values
  ('thesis-planning','Thesis/Defence planning','#0d9488',2),
  ('committee','Supervisory Committee','#b45309',3)
) c(key,name,color,sort_order) on conflict(student_id,key) do nothing;

-- Existing manually chosen defence dates are preserved.
update public.graduate_students set defence_date=(start_date+interval '23 months')::date where defence_date is null;
