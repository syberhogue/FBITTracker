begin;
select no_plan();
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
insert into public.graduate_students(id,student_number,student_name,supervisor_name,start_date,organization_unit_id)
values('92000000-0000-0000-0000-000000000001','MSC-FUND-TEST','Funding Test','Supervisor','2024-09-01','10000000-0000-0000-0000-000000000002');
select lives_ok($$insert into public.graduate_deadlines(id,student_id,category_key,title,due_date,starts_on,funding_kind,grant_name,amount)
values('93000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','funding','GRA: Discovery','2025-08-31','2024-09-01','GRA','Discovery',18000)$$,'GRA funding may cover one full year');
select throws_ok($$update public.graduate_deadlines set due_date='2025-12-31' where id='93000000-0000-0000-0000-000000000001'$$,'23514',null,'Funding cannot exceed a year');
select throws_ok($$update public.graduate_deadlines set due_date='2025-08-30' where id='93000000-0000-0000-0000-000000000001'$$,'23514',null,'Funding ends on a semester boundary');
select throws_ok($$update public.graduate_deadlines set starts_on='2024-10-01',due_date='2025-01-31' where id='93000000-0000-0000-0000-000000000001'$$,'23514',null,'Funding starts on a semester boundary');
select throws_ok($$update public.graduate_deadlines set amount=0 where id='93000000-0000-0000-0000-000000000001'$$,'23514',null,'Funding amount must be positive');
select throws_ok($$update public.graduate_deadlines set grant_name=null where id='93000000-0000-0000-0000-000000000001'$$,'23514',null,'Funding requires a grant');
select lives_ok($$update public.graduate_deadlines set funding_kind='RA',starts_on='2025-01-01',due_date='2025-08-31' where id='93000000-0000-0000-0000-000000000001'$$,'RA funding supports two semesters');
select lives_ok($$insert into public.graduate_task_records(student_id,task_key,completed_on) values('92000000-0000-0000-0000-000000000001','funding-form:93000000-0000-0000-0000-000000000001','2024-12-01')$$,'Funding form completion is stored independently');
select lives_ok($$update public.graduate_deadlines set item_type='Research Paper',is_deleted=true where id='93000000-0000-0000-0000-000000000001'$$,'Research Paper symbol and deadline deletion are accepted');
select is((select is_deleted from public.graduate_deadlines where id='93000000-0000-0000-0000-000000000001'),true,'Deadline deletion persists');
select lives_ok($$insert into public.graduate_task_records(student_id,task_key,is_deleted,item_type) values('92000000-0000-0000-0000-000000000001','report:2024-09-01',true,'Research Paper')$$,'Built-in deletion and changed symbol are stored');
select lives_ok($$update public.graduate_categories set is_deleted=true where student_id='92000000-0000-0000-0000-000000000001' and key='committee'$$,'A default category can be deleted');
select is((select is_deleted from public.graduate_categories where student_id='92000000-0000-0000-0000-000000000001' and key='committee'),true,'Category deletion persists');

select lives_ok($$insert into public.graduate_resources(id,title,url,audience) values('94000000-0000-0000-0000-000000000001','Graduate forms','https://example.test/forms','Both')$$,'Dean can create a shared resource');
select throws_ok($$insert into public.graduate_resources(title,url) values('Unsafe','javascript:alert(1)')$$,'23514',null,'Resources require HTTP or HTTPS URLs');
select throws_ok($$update public.graduate_resources set created_by='00000000-0000-0000-0000-000000000003' where id='94000000-0000-0000-0000-000000000001'$$,'42501',null,'Resource ownership cannot be reassigned');
select ok(not has_table_privilege('anon','public.graduate_resources','SELECT'),'Anonymous users cannot read resources');

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
with changed as (update public.graduate_deadlines set is_deleted=false where id='93000000-0000-0000-0000-000000000001' returning id) select is((select count(*) from changed),0::bigint,'Out-of-scope staff cannot change deadline deletion');
select is((select count(*) from public.graduate_resources where id='94000000-0000-0000-0000-000000000001'),1::bigint,'Active staff in other units can view shared resources');
with changed as (update public.graduate_resources set title='Forbidden' where id='94000000-0000-0000-0000-000000000001' returning id) select is((select count(*) from changed),0::bigint,'Non-owners cannot edit another staff resource');
with removed as (delete from public.graduate_resources where id='94000000-0000-0000-0000-000000000001' returning id) select is((select count(*) from removed),0::bigint,'Non-owners cannot delete another staff resource');
select lives_ok($$insert into public.graduate_resources(id,title,url,audience) values('94000000-0000-0000-0000-000000000002','Supervisor guide','https://example.test/supervisors','Supervisors')$$,'Chair can contribute a resource');
select lives_ok($$update public.graduate_resources set title='Updated supervisor guide' where id='94000000-0000-0000-0000-000000000002'$$,'Resource author can edit their resource');
select is((select title from public.graduate_resources where id='94000000-0000-0000-0000-000000000002'),'Updated supervisor guide','Resource edits persist');

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';
select throws_ok($$insert into public.graduate_resources(title,url) values('Forbidden','https://example.test')$$,'42501',null,'Read-only staff cannot add resources');
reset role;
update public.profiles set is_active=false where id='00000000-0000-0000-0000-000000000003';
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';
select is((select count(*) from public.graduate_resources),0::bigint,'Inactive resource authors cannot read resources');
with changed as (update public.graduate_resources set title='Inactive edit' where id='94000000-0000-0000-0000-000000000002' returning id) select is((select count(*) from changed),0::bigint,'Inactive authors cannot change resources');
select * from finish();
rollback;
