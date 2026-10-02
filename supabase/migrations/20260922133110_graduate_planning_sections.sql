alter table public.graduate_task_records add column expected_on date;
alter table public.graduate_task_records drop constraint graduate_task_records_task_key_check;
alter table public.graduate_task_records add constraint graduate_task_records_task_key_check check (
  task_key in ('form-office','form-sgps','thesis-office','distribute-thesis','examiner-report','oral-exam','chair-report','final-thesis')
  or task_key ~ '^report:[0-9]{4}-(01|05|09)-01$'
  or task_key ~ '^course:[1-5]$'
  or task_key ~ '^custom:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);
alter table public.graduate_task_records add constraint graduate_expected_course_only check (expected_on is null or task_key ~ '^course:[1-5]$');

create table public.graduate_categories (
  student_id uuid not null references public.graduate_students(id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9-]{1,50}$'),
  name text not null check (length(trim(name)) between 1 and 100),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 5 check (sort_order >= 0),
  primary key (student_id,key)
);
create table public.graduate_deadlines (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  category_key text not null,
  title text not null check (length(trim(title)) between 1 and 200),
  due_date date not null,
  foreign key (student_id,category_key) references public.graduate_categories(student_id,key) on delete cascade
);
create index graduate_deadlines_category_idx on public.graduate_deadlines(student_id,category_key);
create table public.graduate_tracker_links (
  student_id uuid not null references public.graduate_students(id) on delete cascade,
  tracker_id uuid not null references public.trackers(id) on delete cascade,
  primary key (student_id,tracker_id)
);
create index graduate_tracker_links_tracker_idx on public.graduate_tracker_links(tracker_id);

alter table public.graduate_categories enable row level security;
alter table public.graduate_deadlines enable row level security;
alter table public.graduate_tracker_links enable row level security;
revoke all on public.graduate_categories,public.graduate_deadlines,public.graduate_tracker_links from anon,authenticated;
grant select,insert,update on public.graduate_categories,public.graduate_deadlines to authenticated;
grant select,insert,delete on public.graduate_tracker_links to authenticated;

create policy graduate_categories_read on public.graduate_categories for select to authenticated using (exists(select 1 from public.graduate_students s where s.id=student_id));
create policy graduate_categories_insert on public.graduate_categories for insert to authenticated with check (exists(select 1 from public.graduate_students s where s.id=student_id));
create policy graduate_categories_update on public.graduate_categories for update to authenticated using (exists(select 1 from public.graduate_students s where s.id=student_id)) with check (exists(select 1 from public.graduate_students s where s.id=student_id));
create policy graduate_deadlines_read on public.graduate_deadlines for select to authenticated using (exists(select 1 from public.graduate_students s where s.id=student_id));
create policy graduate_deadlines_insert on public.graduate_deadlines for insert to authenticated with check (exists(select 1 from public.graduate_students s where s.id=student_id));
create policy graduate_deadlines_update on public.graduate_deadlines for update to authenticated using (exists(select 1 from public.graduate_students s where s.id=student_id)) with check (exists(select 1 from public.graduate_students s where s.id=student_id));
create policy graduate_tracker_links_read on public.graduate_tracker_links for select to authenticated using (exists(select 1 from public.graduate_students s where s.id=student_id) and private.can_access_tracker(tracker_id));
create policy graduate_tracker_links_insert on public.graduate_tracker_links for insert to authenticated with check (exists(select 1 from public.graduate_students s where s.id=student_id) and private.can_access_tracker(tracker_id));
create policy graduate_tracker_links_delete on public.graduate_tracker_links for delete to authenticated using (exists(select 1 from public.graduate_students s where s.id=student_id) and private.can_access_tracker(tracker_id));

create function private.seed_graduate_categories() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  insert into public.graduate_categories(student_id,key,name,color,sort_order) values
    (new.id,'reports','Semester research progress reports','#2563eb',0),
    (new.id,'courses','Coursework','#7c3aed',1),
    (new.id,'student','Student / Supervisor','#059669',2),
    (new.id,'office','Program Office / GPA','#0284c7',3),
    (new.id,'sgps','SGPS','#ea580c',4);
  return new;
end $$;
revoke all on function private.seed_graduate_categories() from public,anon;
create trigger seed_graduate_categories after insert on public.graduate_students for each row execute function private.seed_graduate_categories();
insert into public.graduate_categories(student_id,key,name,color,sort_order)
select s.id,c.key,c.name,c.color,c.sort_order from public.graduate_students s cross join (values
  ('reports','Semester research progress reports','#2563eb',0),
  ('courses','Coursework','#7c3aed',1),
  ('student','Student / Supervisor','#059669',2),
  ('office','Program Office / GPA','#0284c7',3),
  ('sgps','SGPS','#ea580c',4)
) c(key,name,color,sort_order);
