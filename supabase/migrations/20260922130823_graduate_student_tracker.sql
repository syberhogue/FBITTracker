create table public.graduate_students (
  id uuid primary key default gen_random_uuid(),
  student_number text not null unique check (length(trim(student_number)) between 1 and 50),
  student_name text not null check (length(trim(student_name)) between 1 and 200),
  email text not null default '' check (length(email) <= 254),
  supervisor_name text not null check (length(trim(supervisor_name)) between 1 and 200),
  supervisor_id uuid references public.profiles(id),
  organization_unit_id uuid references public.organization_units(id),
  start_date date not null check (extract(day from start_date) = 1 and extract(month from start_date) in (1,5,9) and extract(year from start_date) between 2000 and 2100),
  defence_date date check (defence_date >= start_date),
  revision_type text not null default 'minor' check (revision_type in ('minor','major')),
  completed_on date check (completed_on >= start_date and completed_on <= current_date),
  notes text not null default '' check (length(notes) <= 5000),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
create index graduate_students_supervisor_idx on public.graduate_students(supervisor_id);
create index graduate_students_unit_idx on public.graduate_students(organization_unit_id);
create index graduate_students_creator_idx on public.graduate_students(created_by);

-- Access follows existing organizational scopes. A named supervisor alone does
-- not grant access: supervisor_id must reference their authenticated profile.
create function private.can_manage_graduate(unit_id uuid, creator uuid, supervisor uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select private.is_active_staff() and (
    private.current_role() in ('dean','academic_director') or
    (private.current_role() in ('chair','program_lead') and private.can_access_unit(unit_id)) or
    (private.current_role() in ('graduate_supervisor','research_lead') and creator = (select auth.uid())) or
    supervisor = (select auth.uid())
  )
$$;
revoke all on function private.can_manage_graduate(uuid,uuid,uuid) from public, anon;
grant execute on function private.can_manage_graduate(uuid,uuid,uuid) to authenticated;

alter table public.graduate_students enable row level security;
revoke all on public.graduate_students from anon, authenticated;
grant select, insert on public.graduate_students to authenticated;
grant update(student_number,student_name,email,supervisor_name,supervisor_id,organization_unit_id,start_date,defence_date,revision_type,completed_on,notes) on public.graduate_students to authenticated;
create policy graduates_read on public.graduate_students for select to authenticated
using (private.can_manage_graduate(organization_unit_id,created_by,supervisor_id));
create policy graduates_insert on public.graduate_students for insert to authenticated
with check (created_by = (select auth.uid()) and private.current_role() in ('dean','academic_director','chair','program_lead','graduate_supervisor','research_lead') and private.can_access_unit(organization_unit_id));
create policy graduates_update on public.graduate_students for update to authenticated
using (private.can_manage_graduate(organization_unit_id,created_by,supervisor_id))
with check (private.can_manage_graduate(organization_unit_id,created_by,supervisor_id) and private.can_access_unit(organization_unit_id));

create table public.graduate_task_records (
  student_id uuid not null references public.graduate_students(id) on delete cascade,
  task_key text not null check (task_key in ('form-office','form-sgps','thesis-office','distribute-thesis','examiner-report','oral-exam','chair-report','final-thesis') or task_key ~ '^report:[0-9]{4}-(01|05|09)-01$'),
  completed_on date check (completed_on <= current_date),
  notes text not null default '' check (length(notes) <= 5000),
  primary key (student_id, task_key)
);
alter table public.graduate_task_records enable row level security;
revoke all on public.graduate_task_records from anon, authenticated;
grant select, insert, update on public.graduate_task_records to authenticated;
create policy graduate_records_read on public.graduate_task_records for select to authenticated
using (exists(select 1 from public.graduate_students s where s.id = student_id));
create policy graduate_records_insert on public.graduate_task_records for insert to authenticated
with check (exists(select 1 from public.graduate_students s where s.id = student_id));
create policy graduate_records_update on public.graduate_task_records for update to authenticated
using (exists(select 1 from public.graduate_students s where s.id = student_id))
with check (exists(select 1 from public.graduate_students s where s.id = student_id));
