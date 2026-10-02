import { describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import { graduateSections, type GraduateStudent, type GraduateTaskRecord } from '../src/lib/graduate';
import { foldCalendarLine, graduateCalendarExport, graduateCsvExport, graduatePrintHtml, graduateTextExport, type GraduateExportData } from '../src/lib/graduateExport';
import { canDragGraduateTask, dateStamp, DAY, shiftedGraduateTask, snapGraduateDeadline, timelineDivisions } from '../src/lib/graduateTimeline';

const student: GraduateStudent = { id: 'student', student_number: 'MSC-1', student_name: 'Zoë, Test', email: 'student@example.test', supervisor_name: 'Supervisor', supervisor_id: null, organization_unit_id: null, start_date: '2024-09-01', defence_date: '2026-08-31', revision_type: 'minor', completed_on: null, notes: '=HYPERLINK("unsafe")\nResearch, notes', created_by: 'staff', committee_members: ['Member'], committee_chair: 'Member', university_examiner: 'Examiner' };
const records: GraduateTaskRecord[] = [{ student_id: student.id, task_key: 'course:1', expected_on: '2024-12-31', course_semester_start: '2024-09-01', completed_on: '2024-12-30', notes: 'Finished' }];
const data: GraduateExportData = { student, records, sections: graduateSections(student, [], [], records, '2026-09-22'), links: [{ title: 'Thesis tracker', url: 'https://example.test/trackers/1/timeline' }] };

describe('MSc exports', () => {
  it('exports summary, committee, all tasks including unscheduled courses, completion, notes and links to text', () => {
    const text = graduateTextExport(data, '2026-09-22');
    for (const value of ['Zoë, Test', 'University Examiner: Examiner', 'Course requirement 5', 'Unscheduled', 'Completed: 2024-12-30', 'Research, notes', data.links[0].url]) expect(text).toContain(value);
  });
  it('round-trips CSV punctuation and neutralizes spreadsheet formulas', () => {
    const parsed = Papa.parse<string[]>(graduateCsvExport(data, '2026-09-22').replace(/^\uFEFF/, '')).data;
    expect(parsed[0]).toHaveLength(12);
    expect(parsed.every(row => row.length === 12)).toBe(true);
    expect(parsed.find(row => row[4] === 'Student notes')?.[10]).toBe(`'${student.notes}`);
    expect(parsed.find(row => row[4] === 'Course requirement 1')?.slice(6, 10)).toEqual(['2024-09-01', '2024-12-31', 'Completed', '2024-12-30']);
    expect(parsed[1][2]).toBe('Zoë, Test');
  });
  it('exports stable calendar identities, all-day dates and exclusive duration ends', () => {
    const text = graduateCalendarExport(data, new Date('2026-09-22T12:00:00Z'));
    const unfolded = text.replace(/\r\n /g, '');
    expect(unfolded).toContain('DTSTAMP:20260922T120000Z');
    const course = unfolded.split('BEGIN:VEVENT').find(event => event.includes('UID:student.course%3A1@'))!;
    expect(course).toContain('DTSTART;VALUE=DATE:20240901\r\nDTEND;VALUE=DATE:20250101');
    expect(unfolded).toContain('Zoë\\, Test');
    expect(unfolded).not.toContain('Course requirement 5');
    expect(unfolded.match(/BEGIN:VEVENT/g)).toHaveLength(34);
    expect(text.split('\r\n').every(line => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });
  it('folds UTF-8 without losing code points', () => {
    const original = 'DESCRIPTION:' + 'é😀'.repeat(70);
    const folded = foldCalendarLine(original);
    expect(folded.replace(/\r\n /g, '')).toBe(original);
    expect(folded.split('\r\n').every(line => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });
  it('escapes student content in the printable report and includes hidden sections', () => {
    const html = graduatePrintHtml({ ...data, student: { ...student, student_name: '<img src=x onerror=alert(1)>', notes: '<script>bad()</script>' } }, '2026-09-22');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Course requirement 5');
    expect(html).toContain('Semester research progress reports');
    expect(html).toContain('Thesis tracker');
  });
});

describe('MSc timeline manipulation', () => {
  it('progresses from semesters to months to Monday weeks to days across leap February', () => {
    expect(timelineDivisions(dateStamp('2024-01-01'), dateStamp('2026-01-01')).detail).toBe('semester');
    expect(timelineDivisions(dateStamp('2024-01-01'), dateStamp('2024-07-01')).ticks.map(tick => tick.date)).toContain('2024-02-01');
    const weeks = timelineDivisions(dateStamp('2024-02-01'), dateStamp('2024-03-01'));
    expect(weeks.detail).toBe('week');
    expect(weeks.ticks.map(tick => tick.date)).toEqual(['2024-02-05', '2024-02-12', '2024-02-19', '2024-02-26']);
    const days = timelineDivisions(dateStamp('2024-02-27'), dateStamp('2024-03-02'));
    expect(days.detail).toBe('day');
    expect(days.ticks.map(tick => tick.date)).toContain('2024-02-29');
  });
  it('snaps courses by semester and editable deadlines by zoom granularity', () => {
    expect(snapGraduateDeadline(dateStamp('2025-02-15'), 1000 * DAY, true)).toBe('2025-04-30');
    expect(snapGraduateDeadline(dateStamp('2025-07-15'), 7 * DAY, true)).toBe('2025-08-31');
    expect(snapGraduateDeadline(dateStamp('2026-10-21'), 1000 * DAY, false)).toBe('2026-10-19');
    expect(snapGraduateDeadline(dateStamp('2026-10-21'), 21 * DAY, false)).toBe('2026-10-21');
  });
  it('preserves chapter window length and protects fixed schedules from dragging', () => {
    const tasks = data.sections.flatMap(section => section.tasks);
    const chapter = tasks.find(task => task.key === 'chapter:results')!;
    const shifted = shiftedGraduateTask(chapter, '2026-07-07');
    expect(dateStamp(shifted.dueDate!) - dateStamp(shifted.startsOn!)).toBe(dateStamp(chapter.dueDate!) - dateStamp(chapter.startsOn!));
    expect(canDragGraduateTask(chapter)).toBe(true);
    expect(canDragGraduateTask(tasks.find(task => task.key === 'oral-exam')!)).toBe(true);
    expect(canDragGraduateTask(tasks.find(task => task.key.startsWith('report:'))!)).toBe(false);
    expect(shiftedGraduateTask(tasks.find(task => task.key === 'course:1')!, '2025-08-31').startsOn).toBe('2025-05-01');
  });
});
