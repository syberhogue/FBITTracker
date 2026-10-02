-- Curriculum proposals keep each workflow snapshot together so template creation
-- and edits are atomic. Versions prevent concurrent editors losing stage history.
create function private.valid_curriculum_stages(stages jsonb, start_date date, change_type text)
returns boolean language plpgsql stable security invoker set search_path = '' as $$
declare stage jsonb; link jsonb; arc_date date; publication_date date; actual date;
begin
  if jsonb_typeof(stages) <> 'array' or jsonb_array_length(stages) not between 1 and 100 then return false; end if;
  if (select count(*) from jsonb_array_elements(stages)) <> (select count(distinct s->>'id') from jsonb_array_elements(stages) s) then return false; end if;
  if change_type = 'New Programs' then
    if not exists(select 1 from jsonb_array_elements(stages) s where s->>'id' = 'noi-development' and s->>'purpose' = 'Development' and s->>'committee' is null)
      or not exists(select 1 from jsonb_array_elements(stages) s where s->>'id' = 'arc-approval' and s->>'purpose' = 'Approval' and s->>'committee' = 'ARC')
      or not exists(select 1 from jsonb_array_elements(stages) s where s->>'id' = 'noi-publication' and s->>'purpose' = 'Information' and s->>'committee' is null) then return false; end if;
    select (s->>'completed_on')::date into arc_date from jsonb_array_elements(stages) s where s->>'id' = 'arc-approval' and s->>'outcome' = 'approved';
    select (s->>'completed_on')::date into publication_date from jsonb_array_elements(stages) s where s->>'id' = 'noi-publication' and s->>'outcome' = 'reported';
  end if;
  for stage in select value from jsonb_array_elements(stages) loop
    if jsonb_typeof(stage) <> 'object' or not (stage ?& array['id','title','committee','purpose','due_date','agenda_date','completed_on','outcome','notes','links']) then return false; end if;
    if jsonb_typeof(stage->'id') <> 'string' or length(stage->>'id') not between 1 and 100 or jsonb_typeof(stage->'title') <> 'string' or length(trim(stage->>'title')) not between 1 and 200 then return false; end if;
    if stage->>'purpose' is null or stage->>'purpose' not in ('Approval','Information','Development') or stage->>'outcome' is null or stage->>'outcome' not in ('pending','in-progress','approved','reported','completed','rejected') then return false; end if;
    if jsonb_typeof(stage->'committee') <> 'null' and (jsonb_typeof(stage->'committee') <> 'string' or stage->>'committee' not in ('UEC','FC','USC','AC','ARC')) then return false; end if;
    if jsonb_typeof(stage->'notes') <> 'string' or length(stage->>'notes') > 5000 or jsonb_typeof(stage->'links') <> 'array' or jsonb_array_length(stage->'links') > 30 then return false; end if;
    foreach actual in array array[(stage->>'due_date')::date, (stage->>'agenda_date')::date, (stage->>'completed_on')::date] loop
      if actual is not null and (actual < '2000-01-01'::date or actual > '2102-12-31'::date) then return false; end if;
    end loop;
    if stage->>'agenda_date' is not null and (stage->>'due_date' is null or (stage->>'agenda_date')::date > (stage->>'due_date')::date) then return false; end if;
    actual := (stage->>'completed_on')::date;
    if (actual is not null) <> (stage->>'outcome' in ('approved','reported','completed')) then return false; end if;
    if actual is not null and (actual < start_date or actual > current_date or (stage->>'purpose' = 'Approval' and stage->>'outcome' <> 'approved') or (stage->>'purpose' = 'Information' and stage->>'outcome' <> 'reported') or (stage->>'purpose' = 'Development' and stage->>'outcome' <> 'completed')) then return false; end if;
    if stage->>'outcome' = 'rejected' and stage->>'purpose' <> 'Approval' then return false; end if;
    if change_type = 'New Programs' and actual is not null and stage->>'id' not in ('noi-development','arc-approval') then
      if arc_date is null or arc_date > actual then return false; end if;
      if stage->>'id' <> 'noi-publication' and (publication_date is null or publication_date > actual or actual > (publication_date + interval '2 years')::date) then return false; end if;
    end if;
    for link in select value from jsonb_array_elements(stage->'links') loop
      if jsonb_typeof(link) <> 'object' or not (link ?& array['title','url']) or jsonb_typeof(link->'title') <> 'string' or length(trim(link->>'title')) not between 1 and 200 or jsonb_typeof(link->'url') <> 'string' or length(link->>'url') > 2000 or link->>'url' !~ '^https?://[^[:space:]/]+[^[:space:]]*$' then return false; end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end $$;
revoke all on function private.valid_curriculum_stages(jsonb,date,text) from public, anon;
grant execute on function private.valid_curriculum_stages(jsonb,date,text) to authenticated;

create function private.valid_curriculum_calendar(meetings jsonb, academic_year integer)
returns boolean language plpgsql stable security invoker set search_path = '' as $$
declare meeting jsonb; day date;
begin
  if jsonb_typeof(meetings) <> 'array' or jsonb_array_length(meetings) > 200 then return false; end if;
  if (select count(*) from jsonb_array_elements(meetings)) <> (select count(distinct m->>'id') from jsonb_array_elements(meetings) m) or (select count(*) from jsonb_array_elements(meetings)) <> (select count(distinct (m->>'committee',m->>'meeting_date')) from jsonb_array_elements(meetings) m) then return false; end if;
  for meeting in select value from jsonb_array_elements(meetings) loop
    if jsonb_typeof(meeting) <> 'object' or not (meeting ?& array['id','academic_year','committee','meeting_date','voting','agenda_lead_days']) then return false; end if;
    if jsonb_typeof(meeting->'id') <> 'string' or length(meeting->>'id') not between 1 and 100 or jsonb_typeof(meeting->'committee') <> 'string' or meeting->>'committee' not in ('UEC','FC','USC','AC','ARC') or jsonb_typeof(meeting->'voting') <> 'boolean' then return false; end if;
    if jsonb_typeof(meeting->'academic_year') <> 'number' or (meeting->>'academic_year')::integer <> academic_year or jsonb_typeof(meeting->'agenda_lead_days') <> 'number' or (meeting->>'agenda_lead_days')::integer not between 0 and 60 then return false; end if;
    day := (meeting->>'meeting_date')::date;
    if day is null or jsonb_typeof(meeting->'meeting_date') <> 'string' or day < make_date(academic_year,9,1) or day > make_date(academic_year+1,8,31) then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $$;
revoke all on function private.valid_curriculum_calendar(jsonb,integer) from public, anon;
grant execute on function private.valid_curriculum_calendar(jsonb,integer) to authenticated;

create table public.curriculum_changes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 200),
  change_type text not null check (change_type in ('Major Program Modifications','Minor Program Adjustments','Minor Curriculum Changes','New Programs','New Specializations','New Courses','New Pathway')),
  approval_process text not null check (approval_process in ('Standard','V1','V2')),
  organization_unit_id uuid references public.organization_units(id),
  start_date date not null check (start_date between '2000-01-01'::date and '2100-12-31'::date),
  implementation_year integer not null check (implementation_year between 2000 and 2100),
  description text not null default '' check (length(description) <= 5000),
  stages jsonb not null check (private.valid_curriculum_stages(stages,start_date,change_type)),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  check (implementation_year >= extract(year from start_date)::integer - case when extract(month from start_date) < 9 then 1 else 0 end)
);
create index curriculum_changes_creator_idx on public.curriculum_changes(created_by);
create index curriculum_changes_unit_idx on public.curriculum_changes(organization_unit_id);

create function private.can_manage_curriculum(unit_id uuid, creator uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select private.is_active_staff() and (private.current_role() in ('dean','academic_director') or creator = (select auth.uid()) or (private.current_role() in ('chair','program_lead') and private.can_access_unit(unit_id)))
$$;
revoke all on function private.can_manage_curriculum(uuid,uuid) from public, anon;
grant execute on function private.can_manage_curriculum(uuid,uuid) to authenticated;
alter table public.curriculum_changes enable row level security;
revoke all on public.curriculum_changes from anon, authenticated;
grant select, insert, delete on public.curriculum_changes to authenticated;
grant update(title,start_date,implementation_year,description,stages,version) on public.curriculum_changes to authenticated;
create policy curriculum_read on public.curriculum_changes for select to authenticated using (private.can_manage_curriculum(organization_unit_id,created_by));
create policy curriculum_insert on public.curriculum_changes for insert to authenticated with check (private.is_active_staff() and private.current_role() <> 'instructor' and created_by = (select auth.uid()) and private.can_access_unit(organization_unit_id));
create policy curriculum_update on public.curriculum_changes for update to authenticated using (private.can_manage_curriculum(organization_unit_id,created_by)) with check (private.can_manage_curriculum(organization_unit_id,created_by));
create policy curriculum_delete on public.curriculum_changes for delete to authenticated using (private.can_manage_curriculum(organization_unit_id,created_by));

create table public.curriculum_calendars (
  academic_year integer primary key check (academic_year between 2000 and 2100),
  meetings jsonb not null check (private.valid_curriculum_calendar(meetings,academic_year)),
  version integer not null default 1 check (version > 0)
);
alter table public.curriculum_calendars enable row level security;
revoke all on public.curriculum_calendars from anon, authenticated;
grant select, insert on public.curriculum_calendars to authenticated;
grant update(meetings,version) on public.curriculum_calendars to authenticated;
create policy curriculum_calendar_read on public.curriculum_calendars for select to authenticated using (private.is_active_staff());
create policy curriculum_calendar_insert on public.curriculum_calendars for insert to authenticated with check (private.is_active_staff() and private.current_role() in ('dean','academic_director','chair','program_lead'));
create policy curriculum_calendar_update on public.curriculum_calendars for update to authenticated using (private.is_active_staff() and private.current_role() in ('dean','academic_director','chair','program_lead')) with check (private.is_active_staff() and private.current_role() in ('dean','academic_director','chair','program_lead'));

-- Seed only the explicitly supplied university meeting dates. Faculty recurrence
-- defaults are generated in the client and become editable calendar snapshots.
insert into public.curriculum_calendars(academic_year, meetings)
select 2026, jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'academic_year',2026,'committee',committee,'meeting_date',day,'voting',voting,'agenda_lead_days',0))
from (values
  ('USC','2026-09-16',true),('USC','2026-10-20',true),('USC','2026-12-15',true),('USC','2027-01-19',true),('USC','2027-02-16',true),('USC','2027-03-16',true),('USC','2027-04-20',true),('USC','2027-05-18',true),('USC','2027-06-15',true),
  ('AC','2026-09-22',true),('AC','2026-10-27',false),('AC','2026-11-24',true),('AC','2027-01-26',true),('AC','2027-02-23',false),('AC','2027-03-23',true),('AC','2027-04-27',false),('AC','2027-05-25',true),('AC','2027-06-15',true)
) as supplied(committee,day,voting);
-- Append the first and second Tuesdays for September 2026 through August 2027.
update public.curriculum_calendars set meetings = meetings || (
  select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'academic_year',2026,'committee',committee,'meeting_date',to_char(first_day + ((2 - extract(dow from first_day)::integer + 7) % 7) + extra,'YYYY-MM-DD'),'voting',true,'agenda_lead_days',lead))
  from (select d::date first_day from generate_series('2026-09-01'::date,'2027-08-01'::date,interval '1 month') d) months
  cross join (values ('FC',0,7),('UEC',7,5)) faculty(committee,extra,lead)
) where academic_year = 2026;

create function private.check_curriculum_write() returns trigger language plpgsql security invoker set search_path = '' as $$
declare stage jsonb;
begin
  if tg_op = 'UPDATE' and new.version <> old.version + 1 then raise exception 'Version must increment by one' using errcode = '23514'; end if;
  if tg_table_name = 'curriculum_changes' then
    for stage in select value from jsonb_array_elements(new.stages) loop
      if stage->>'purpose' = 'Approval' and exists (
        select 1 from public.curriculum_calendars c cross join lateral jsonb_array_elements(c.meetings) m
        where m->>'committee' = stage->>'committee' and not (m->>'voting')::boolean and m->>'meeting_date' in (stage->>'due_date',stage->>'completed_on')
      ) then raise exception 'Approval stages cannot use information-only committee sessions' using errcode = '23514'; end if;
    end loop;
  end if;
  return new;
end $$;
revoke all on function private.check_curriculum_write() from public, anon, authenticated;
create trigger curriculum_write_check before insert or update on public.curriculum_changes for each row execute function private.check_curriculum_write();
create trigger curriculum_calendar_write_check before update on public.curriculum_calendars for each row execute function private.check_curriculum_write();
