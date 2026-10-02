import { describe, expect, it } from 'vitest';
import { availableCourseRequirements, committeeReadiness, committeeTasks, completionDates, coursesCompleted, defenceTasks, graduateSections, programmeStatus, researchReports, semesterEnd, semesterStart, suggestedDefenceDate, taskStatus, thesisPlanningTasks, timelineSemesters, type GraduateStudent } from '../src/lib/graduate';
import { zoomTimelineRange } from '../src/lib/graduateTimeline';

const student: GraduateStudent = { id: 'student', student_number: '1001', student_name: 'Test Student', email: '', supervisor_name: 'Supervisor', supervisor_id: null, organization_unit_id: null, start_date: '2024-09-01', defence_date: '2026-08-31', revision_type: 'minor', completed_on: null, notes: '', created_by: 'staff' };

describe('MSc calendar', () => {
  it.each([
    ['Fall', '2024-09-01', '2024-12-31', '2025-04-30', '2025-08-31'],
    ['Winter', '2024-01-01', '2024-04-30', '2024-08-31', '2024-12-31'],
    ['Summer', '2024-05-01', '2024-08-31', '2024-12-31', '2025-04-30'],
  ] as const)('generates nine semester reports from a %s start', (semester, start, first, second, third) => {
    expect(semesterStart(semester, 2024)).toBe(start);
    const reports = researchReports({ ...student, start_date: start }, '2024-09-22');
    expect(reports).toHaveLength(9);
    expect(reports.slice(0, 3).map(task => task.dueDate)).toEqual([first, second, third]);
    expect(completionDates(start)).toEqual({ target: start.replace('2024', '2026'), maximum: start.replace('2024', '2027') });
  });
  it('keeps reports required past the maximum and stops after the completion semester', () => {
    expect(researchReports(student, '2028-02-01')).toHaveLength(11);
    expect(researchReports({ ...student, completed_on: '2026-07-10' }, '2028-02-01')).toHaveLength(6);
    expect(researchReports({ ...student, completed_on: '2026-07-10' }, '2028-02-01').at(-1)?.dueDate).toBe('2026-08-31');
  });
  it('distinguishes the target and maximum, including the deadline day', () => {
    expect(programmeStatus(student, '2026-09-01')).toBe('Target due today');
    expect(programmeStatus(student, '2026-09-02')).toBe('Past target');
    expect(programmeStatus(student, '2027-09-01')).toBe('Maximum due today');
    expect(programmeStatus(student, '2027-09-02')).toBe('Past maximum');
  });
  it('captures all eight exam tasks and the supplied responsibility assignments', () => {
    const tasks = defenceTasks(student);
    expect(tasks.map(task => task.dueDate)).toEqual(['2026-07-20', '2026-07-27', '2026-07-27', '2026-08-03', '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-28']);
    expect(tasks.filter(task => task.owner === 'Student / Supervisor')).toHaveLength(4);
    expect(tasks.filter(task => task.owner === 'Program Office / GPA')).toHaveLength(3);
    expect(tasks.filter(task => task.owner === 'SGPS')).toHaveLength(1);
  });
  it('uses calendar months for major revisions and clamps month ends', () => {
    expect(defenceTasks({ ...student, revision_type: 'major' }).at(-1)?.dueDate).toBe('2027-02-28');
    expect(defenceTasks({ ...student, defence_date: '2027-08-31', revision_type: 'major' }).at(-1)?.dueDate).toBe('2028-02-29');
  });
  it('leaves defence tasks unscheduled until a date is set and retains stable keys', () => {
    const unscheduled = defenceTasks({ ...student, defence_date: null });
    expect(unscheduled.every(task => task.dueDate === null)).toBe(true);
    expect(taskStatus(unscheduled[0], undefined, '2026-09-22')).toBe('Awaiting defence date');
    expect(unscheduled.map(task => task.key)).toEqual(defenceTasks(student).map(task => task.key));
  });
  it('treats a report as overdue only after semester end and records lateness', () => {
    const task = researchReports(student, '2024-09-22')[0];
    expect(taskStatus(task, undefined, '2024-12-31')).toBe('Due today');
    expect(taskStatus(task, undefined, '2025-01-01')).toBe('Overdue');
    expect(taskStatus(task, { student_id: 'student', task_key: task.key, completed_on: '2025-01-02', notes: '' }, '2025-01-02')).toBe('Completed late');
  });
  it('plans five individual course requirements independently from report deadlines', () => {
    const records = [{ student_id: student.id, task_key: 'course:2', expected_on: '2026-05-31', completed_on: '2026-05-29', notes: '' }];
    const sections = graduateSections(student, [], [], records, '2026-09-22');
    expect(sections.find(section => section.key === 'courses')?.tasks).toHaveLength(5);
    expect(sections.find(section => section.key === 'courses')?.tasks[1].dueDate).toBe('2026-05-31');
    expect(sections.find(section => section.key === 'courses')?.tasks[0].dueDate).toBeNull();
    expect(coursesCompleted(records, student.id)).toBe(1);
    expect(sections.find(section => section.key === 'reports')?.tasks[0].title).toBe('Fall 2024');
  });
  it('keeps custom categories, deadlines, and colors scoped to the selected student', () => {
    const categories = [{ student_id: student.id, key: 'thesis', name: 'Thesis', color: '#9333ea', sort_order: 9 }, { student_id: 'another', key: 'other', name: 'Other', color: '#000000', sort_order: 5 }];
    const deadlines = [{ student_id: student.id, id: 'deadline', category_key: 'thesis', title: 'Proposal', due_date: '2026-10-15' }];
    const sections = graduateSections(student, categories, deadlines, [], '2026-09-22');
    expect(sections).toHaveLength(6);
    expect(sections.at(-1)?.color).toBe('#9333ea');
    expect(sections.at(-1)?.tasks[0]).toMatchObject({ key: 'custom:deadline', title: 'Proposal', dueDate: '2026-10-15' });
  });
  it.each([['2024-09-01', '2026-08-01'], ['2024-01-01', '2025-12-01'], ['2024-05-01', '2026-04-01']])('suggests a defence one month before the two-year anniversary for %s', (start, expected) => {
    expect(suggestedDefenceDate(start)).toBe(expected);
  });
  it('plans chapter writing windows around semester one, year two and thesis submission', () => {
    const tasks = thesisPlanningTasks(student);
    expect(tasks.find(task => task.key === 'chapter:literature')).toMatchObject({ startsOn: '2024-11-30', dueDate: '2024-12-31' });
    expect(tasks.find(task => task.key === 'chapter:introduction')).toMatchObject({ startsOn: '2025-08-01', dueDate: '2025-09-01' });
    expect(tasks.find(task => task.key === 'chapter:methodology')).toMatchObject({ startsOn: '2026-04-27', dueDate: '2026-05-27' });
    expect(tasks.find(task => task.key === 'chapter:results')).toMatchObject({ startsOn: '2026-05-27', dueDate: '2026-06-27' });
    expect(tasks.find(task => task.key === 'chapter:discussion')).toMatchObject({ startsOn: '2026-06-27', dueDate: '2026-07-27' });
    const rescheduled = thesisPlanningTasks({ ...student, defence_date: '2026-09-30' }, [{ student_id: student.id, task_key: 'chapter:methodology', expected_on: '2026-06-27', completed_on: null, is_draft: true, notes: '' }]);
    expect(rescheduled.find(task => task.key === 'chapter:methodology')?.dueDate).toBe('2026-06-27');
    expect(rescheduled.find(task => task.key === 'chapter:discussion')?.dueDate).toBe('2026-08-26');
  });
  it('requires committee formation within eight months and meetings every semester', () => {
    const tasks = committeeTasks(student, '2026-09-22');
    expect(tasks[0].dueDate).toBe('2025-05-01');
    expect(tasks).toHaveLength(10);
    expect(tasks[1]).toMatchObject({ key: 'committee:meeting:2024-09-01', dueDate: '2024-12-31' });
    expect(committeeTasks({ ...student, completed_on: '2026-05-31' }, '2028-09-22')).toHaveLength(7);
  });
  it('distinguishes chapter drafts from completion and overdue drafts', () => {
    const task = thesisPlanningTasks(student)[0];
    const record = { student_id: student.id, task_key: task.key, completed_on: null, is_draft: true, notes: '' };
    expect(taskStatus(task, record, '2024-12-30')).toBe('Draft');
    expect(taskStatus(task, record, '2025-01-01')).toBe('Draft · overdue');
    expect(taskStatus(task, { ...record, is_draft: false, completed_on: '2024-12-30' }, '2025-01-01')).toBe('Completed');
  });
  it('renders calendar semester bands across year boundaries and leap years', () => {
    expect(timelineSemesters('2023-12-15', '2024-06-01')).toEqual([
      { start: '2023-09-01', end: '2024-01-01', name: 'Fall 2023', semester: 'Fall' },
      { start: '2024-01-01', end: '2024-05-01', name: 'Winter 2024', semester: 'Winter' },
      { start: '2024-05-01', end: '2024-09-01', name: 'Summer 2024', semester: 'Summer' },
    ]);
  });
  it('merges student deadlines without exposing retired administrative sections or losing task identity', () => {
    const oldCategories = ['student', 'office', 'sgps'].map((key, sort_order) => ({ student_id: student.id, key, name: key, color: '#123456', sort_order }));
    const records = [{ student_id: student.id, task_key: 'form-office', completed_on: '2026-07-19', notes: 'Submitted', item_type: 'Form' as const }];
    const sections = graduateSections(student, oldCategories, [{ id: 'existing', student_id: student.id, category_key: 'student', title: 'Existing student task', due_date: '2026-07-01', item_type: 'Meeting' }], records, '2026-09-22');
    expect(sections.map(section => section.key)).toEqual(['reports', 'courses', 'thesis-planning', 'committee', 'funding']);
    const tasks = sections.find(section => section.key === 'thesis-planning')!.tasks;
    expect(tasks).toHaveLength(12);
    expect(tasks.find(task => task.key === 'form-office')).toMatchObject({ dueDate: '2026-07-20', itemType: 'Form' });
    expect(taskStatus(tasks.find(task => task.key === 'form-office')!, records[0])).toBe('Completed');
    expect(tasks.find(task => task.key === 'custom:existing')).toMatchObject({ itemType: 'Meeting', categoryKey: 'thesis-planning' });
    expect(tasks.some(task => task.owner !== 'Student / Supervisor')).toBe(false);
  });
  it('retains a custom chapter writing window and item symbol after defence rescheduling', () => {
    const records = [{ student_id: student.id, task_key: 'chapter:methodology', completed_on: null, expected_on: '2026-06-30', planned_start_on: '2026-04-15', item_type: 'Report' as const, notes: '' }];
    const tasks = graduateSections({ ...student, defence_date: '2026-10-15' }, [], [], records).flatMap(section => section.tasks);
    expect(tasks.find(task => task.key === 'chapter:methodology')).toMatchObject({ startsOn: '2026-04-15', dueDate: '2026-06-30', itemType: 'Report' });
    expect(tasks.find(task => task.key === 'report:2024-09-01')?.itemType).toBe('Report');
    expect(tasks.find(task => task.key === 'committee:meeting:2024-09-01')?.itemType).toBe('Meeting');
    expect(tasks.find(task => task.key === 'chapter:results')?.itemType).toBe('Thesis');
  });
  it.each([['2024-01-01', '2024-04-30'], ['2024-05-01', '2024-08-31'], ['2024-09-01', '2024-12-31']])('assigns a course for the entire semester beginning %s', (start, end) => {
    expect(semesterEnd(start)).toBe(end);
    const records = [{ student_id: student.id, task_key: 'course:3', course_semester_start: start, expected_on: end, completed_on: null, notes: '' }];
    expect(availableCourseRequirements(student.id, records)).toEqual([1, 2, 4, 5]);
    expect(availableCourseRequirements('another-student', records)).toEqual([1, 2, 3, 4, 5]);
    expect(graduateSections(student, [], [], records).find(section => section.key === 'courses')?.tasks[2]).toMatchObject({ startsOn: start, dueDate: end });
    expect(availableCourseRequirements(student.id, [...records, { student_id: student.id, task_key: 'course:1', expected_on: '2026-01-31', completed_on: null, notes: '' }])).toEqual([2, 4, 5]);
  });
  it('uses an explicit thesis submission date for the deadline and suggested chapter windows', () => {
    const planned = { ...student, thesis_submission_date: '2026-07-01' };
    expect(defenceTasks(planned).find(task => task.key === 'thesis-office')?.dueDate).toBe('2026-07-01');
    expect(thesisPlanningTasks(planned).find(task => task.key === 'chapter:discussion')).toMatchObject({ startsOn: '2026-06-01', dueDate: '2026-07-01' });
    expect(thesisPlanningTasks({ ...planned, defence_date: '2026-10-15' }).find(task => task.key === 'chapter:discussion')?.dueDate).toBe('2026-07-01');
    expect(thesisPlanningTasks({ ...planned, thesis_submission_date: null }).find(task => task.key === 'chapter:discussion')?.dueDate).toBe('2026-07-27');
  });
  it('requires an additional committee member beyond supervisors and identifies missing defence appointments', () => {
    expect(committeeReadiness({ ...student, co_supervisor_name: 'Co-supervisor' })).toEqual({ hasAdditionalMember: false, hasChair: false, hasExaminer: false });
    expect(committeeReadiness({ ...student, committee_members: ['supervisor'] }).hasAdditionalMember).toBe(false);
    expect(committeeReadiness({ ...student, committee_members: ['Member'], committee_chair: 'Member', university_examiner: 'Examiner' })).toEqual({ hasAdditionalMember: true, hasChair: true, hasExaminer: true });
    expect(committeeReadiness({ ...student, committee_chair: 'Not a member' }).hasChair).toBe(false);
  });
  it('zooms around the pointer and clamps both ends and the minimum seven-day window', () => {
    const day = 86400000;
    const bounds = { low: 0, high: 1000 * day };
    expect(zoomTimelineRange(bounds, bounds, 0.5, 0.25)).toEqual({ low: 125 * day, high: 625 * day });
    expect(zoomTimelineRange(bounds, bounds, 0.001, 0)).toEqual({ low: 0, high: 7 * day });
    expect(zoomTimelineRange(bounds, bounds, 0.001, 1)).toEqual({ low: 993 * day, high: 1000 * day });
    expect(zoomTimelineRange(bounds, { low: 300 * day, high: 500 * day }, 20)).toEqual(bounds);
    expect(zoomTimelineRange({ low: 0, high: day }, { low: 0, high: day }, 0.1)).toEqual({ low: 0, high: day });
  });
});
