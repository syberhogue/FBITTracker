alter table public.graduate_task_records
  add column planned_start_on date,
  add column item_type text check (item_type in ('Form','Report','Thesis','Meeting','Course','Milestone')),
  add constraint graduate_chapter_start check (planned_start_on is null or
    (task_key ~ '^chapter:(introduction|literature|methodology|results|discussion)$'
      and expected_on is not null and planned_start_on <= expected_on));
alter table public.graduate_deadlines
  add column item_type text not null default 'Milestone'
    check (item_type in ('Form','Report','Thesis','Meeting','Course','Milestone'));

create or replace function private.seed_graduate_categories() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  insert into public.graduate_categories(student_id,key,name,color,sort_order) values
    (new.id,'reports','Semester research progress reports','#2563eb',0),
    (new.id,'courses','Coursework','#7c3aed',1),
    (new.id,'thesis-planning','Thesis/Defence planning','#0d9488',2),
    (new.id,'committee','Supervisory Committee','#b45309',3);
  return new;
end $$;

-- Keep task keys and their completion history; move custom student deadlines.
update public.graduate_deadlines set category_key='thesis-planning' where category_key='student';
-- Existing administrative categories and records remain stored for history,
-- but are excluded from the planning interface and from new student defaults.
