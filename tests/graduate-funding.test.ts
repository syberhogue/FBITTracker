import { describe, expect, it } from 'vitest';
import { availableCourseRequirements, coursesCompleted, defaultGraduateCategories, fundingDates, graduateSections, type GraduateDeadline, type GraduateStudent, type GraduateTaskRecord } from '../src/lib/graduate';
import { shiftedGraduateTask } from '../src/lib/graduateTimeline';
import { graduateCalendarExport, graduatePrintHtml, graduateTextExport } from '../src/lib/graduateExport';

const student: GraduateStudent = { id: 'student', student_number: 'MSC-1', student_name: 'Test', email: '', supervisor_name: 'Supervisor', supervisor_id: null, organization_unit_id: null, start_date: '2024-09-01', defence_date: '2026-08-01', revision_type: 'minor', completed_on: null, notes: '', created_by: 'staff' };
const funding: GraduateDeadline = { id: 'fund', student_id: student.id, category_key: 'funding', title: 'GRA: Discovery', due_date: '2025-08-31', starts_on: '2024-09-01', funding_kind: 'GRA', grant_name: 'Discovery', amount: 18000 };

describe('MSc funding and deletion', () => {
  it.each([
    ['2024-09-01', 3, '2025-08-31', '2024-08-01'],
    ['2025-01-01', 2, '2025-08-31', '2024-12-01'],
    ['2025-05-01', 1, '2025-08-31', '2025-04-01'],
  ] as const)('plans semester funding and the advance form from %s', (start, semesters, end, form) => {
    expect(fundingDates(start, semesters)).toEqual({ end, form });
  });
  it('shifts the whole funding period and derived form while preserving completion history', () => {
    const records: GraduateTaskRecord[] = [{ student_id: student.id, task_key: 'funding-form:fund', completed_on: '2024-07-31', notes: 'Submitted' }];
    const section = graduateSections(student, [], [funding], records).find(section => section.key === 'funding')!;
    expect(section.tasks[0]).toMatchObject({ startsOn: '2024-09-01', fundingSemesters: 3 });
    expect(section.tasks[0].timing).toContain('$18,000.00 CAD');
    const shifted = shiftedGraduateTask(section.tasks[0], '2025-12-31');
    expect(shifted.startsOn).toBe('2025-01-01');
    const updated = graduateSections(student, [], [{ ...funding, starts_on: shifted.startsOn, due_date: shifted.dueDate! }], records).find(section => section.key === 'funding')!;
    expect(updated.tasks[1]).toMatchObject({ key: 'funding-form:fund', dueDate: '2024-12-01', itemType: 'Form' });
    expect(records[0].completed_on).toBe('2024-07-31');
  });
  it('keeps deleted defaults, tasks and funding forms out of views and exports', () => {
    const categories = defaultGraduateCategories(student.id).map(category => ({ ...category, is_deleted: category.key === 'committee' }));
    const records: GraduateTaskRecord[] = [{ student_id: student.id, task_key: 'report:2024-09-01', completed_on: null, notes: '', is_deleted: true }];
    const sections = graduateSections(student, categories, [{ ...funding, is_deleted: true }], records);
    expect(sections.some(section => section.key === 'committee')).toBe(false);
    expect(sections.flatMap(section => section.tasks).some(task => task.key === records[0].task_key)).toBe(false);
    expect(sections.find(section => section.key === 'funding')?.tasks).toEqual([]);
    const text = graduateTextExport({ student, sections, records, links: [] }, '2026-09-22');
    expect(text).not.toContain('committee meeting');
    expect(text).not.toContain('Discovery');
  });
  it('releases deleted course assignments and honours changed symbols for custom deadlines', () => {
    const records: GraduateTaskRecord[] = [{ student_id: student.id, task_key: 'course:1', completed_on: '2024-12-31', notes: '', expected_on: '2024-12-31', is_deleted: true }, { student_id: student.id, task_key: 'custom:paper', completed_on: null, notes: '', item_type: 'Research Paper' }];
    expect(availableCourseRequirements(student.id, records)).toEqual([1, 2, 3, 4, 5]);
    expect(coursesCompleted(records, student.id)).toBe(0);
    const sections = graduateSections(student, [], [{ id: 'paper', student_id: student.id, title: 'Paper', category_key: 'thesis-planning', due_date: '2025-01-01', item_type: 'Milestone' }], records);
    expect(sections.flatMap(section => section.tasks).find(task => task.key === 'custom:paper')?.itemType).toBe('Research Paper');
  });
  it('exports funding as a calendar duration and the advance form as a separate date', () => {
    const data = { student, sections: graduateSections(student, [], [funding], []), records: [], links: [] };
    const ics = graduateCalendarExport(data, new Date('2026-09-22T12:00:00Z')).replace(/\r\n /g, '');
    const period = ics.split('BEGIN:VEVENT').find(event => event.includes('custom%3Afund@'))!;
    expect(period).toContain('DTSTART;VALUE=DATE:20240901');
    expect(period).toContain('DTEND;VALUE=DATE:20250901');
    const form = ics.split('BEGIN:VEVENT').find(event => event.includes('funding-form%3Afund@'))!;
    expect(form).toContain('DTSTART;VALUE=DATE:20240801');
  });
  it('prints an escaped vector overview including today and all visible sections', () => {
    const sections = graduateSections(student, [], [{ ...funding, title: '<script>alert(1)</script>' }], []);
    const html = graduatePrintHtml({ student, sections, records: [], links: [] }, '2026-09-22');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const svg = doc.querySelector('svg')!;
    expect(svg.getAttribute('aria-label')).toContain('today 2026-09-22');
    expect(svg.textContent).toContain('Funding');
    expect(svg.textContent).toContain('Today · 2026-09-22');
    expect(doc.querySelector('script')).toBeNull();
    expect(svg.querySelector('title')?.textContent).toBeTruthy();
  });
});
