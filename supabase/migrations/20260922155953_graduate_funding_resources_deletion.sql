-- Tombstones preserve deletion of generated tasks and default categories.
alter table public.graduate_categories add column is_deleted boolean not null default false;
alter table public.graduate_task_records add column is_deleted boolean not null default false;
alter table public.graduate_deadlines
  add column is_deleted boolean not null default false,
  add column funding_kind text,
  add column grant_name text,
  add column amount numeric(12,2),
  add column starts_on date,
  add constraint graduate_funding_period check (
    (funding_kind is null and grant_name is null and amount is null and starts_on is null)
    or (funding_kind is not null and funding_kind in ('GRA','RA')
      and grant_name is not null and length(trim(grant_name)) between 1 and 200
      and amount is not null and amount > 0 and amount <> 'NaN'::numeric
      and starts_on is not null and extract(day from starts_on)=1 and extract(month from starts_on) in (1,5,9)
      and due_date in ((starts_on+interval '4 months'-interval '1 day')::date,
        (starts_on+interval '8 months'-interval '1 day')::date,
        (starts_on+interval '12 months'-interval '1 day')::date))
  );
alter table public.graduate_task_records drop constraint graduate_task_records_item_type_check;
alter table public.graduate_task_records add constraint graduate_task_records_item_type_check check (item_type in ('Form','Report','Research Paper','Thesis','Meeting','Course','Milestone'));
alter table public.graduate_deadlines drop constraint graduate_deadlines_item_type_check;
alter table public.graduate_deadlines add constraint graduate_deadlines_item_type_check check (item_type in ('Form','Report','Research Paper','Thesis','Meeting','Course','Milestone'));
alter table public.graduate_task_records drop constraint graduate_task_records_task_key_check;
alter table public.graduate_task_records add constraint graduate_task_records_task_key_check check (
  task_key in ('form-office','form-sgps','thesis-office','distribute-thesis','examiner-report','oral-exam','chair-report','final-thesis','committee:formation','planning:defence','planning:submission')
  or task_key ~ '^report:[0-9]{4}-(01|05|09)-01$'
  or task_key ~ '^committee:meeting:[0-9]{4}-(01|05|09)-01$'
  or task_key ~ '^chapter:(introduction|literature|methodology|results|discussion)$'
  or task_key ~ '^course:[1-5]$'
  or task_key ~ '^(custom|funding-form):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);
create or replace function private.seed_graduate_categories() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  insert into public.graduate_categories(student_id,key,name,color,sort_order) values
    (new.id,'reports','Semester research progress reports','#2563eb',0),
    (new.id,'courses','Coursework','#7c3aed',1),
    (new.id,'thesis-planning','Thesis/Defence planning','#0d9488',2),
    (new.id,'committee','Supervisory Committee','#b45309',3),
    (new.id,'funding','Funding','#15803d',4);
  return new;
end $$;
insert into public.graduate_categories(student_id,key,name,color,sort_order)
select id,'funding','Funding','#15803d',4 from public.graduate_students on conflict(student_id,key) do nothing;

create table public.graduate_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check(length(trim(title)) between 1 and 200),
  url text not null check(length(url)<=2048 and url ~ '^https?://[^[:space:]]+$'),
  description text not null default '' check(length(description)<=2000),
  audience text not null default 'Both' check(audience in ('Students','Supervisors','Both')),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
create index graduate_resources_created_by_idx on public.graduate_resources(created_by);
alter table public.graduate_resources enable row level security;
revoke all on public.graduate_resources from anon,authenticated;
grant select,insert,delete on public.graduate_resources to authenticated;
grant update(title,url,description,audience) on public.graduate_resources to authenticated;
create policy graduate_resources_read on public.graduate_resources for select to authenticated using ((select private.is_active_staff()));
create policy graduate_resources_insert on public.graduate_resources for insert to authenticated with check (
  (select private.is_active_staff()) and created_by=(select auth.uid())
  and (select private.current_role()) in ('dean','academic_director','chair','program_lead','graduate_supervisor','research_lead')
);
create policy graduate_resources_update on public.graduate_resources for update to authenticated
using ((select private.is_active_staff()) and (created_by=(select auth.uid()) or (select private.current_role()) in ('dean','academic_director')))
with check ((select private.is_active_staff()) and (created_by=(select auth.uid()) or (select private.current_role()) in ('dean','academic_director')));
create policy graduate_resources_delete on public.graduate_resources for delete to authenticated
using ((select private.is_active_staff()) and (created_by=(select auth.uid()) or (select private.current_role()) in ('dean','academic_director')));
