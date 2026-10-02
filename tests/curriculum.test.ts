import { describe, expect, it } from 'vitest';
import { academicYear, calendarCutoff, classification, curriculumTypes, curriculumWarnings, defaultMeetings, isChangeComplete, noiExpiry, scheduleStages, templateStages, validateStage, type CurriculumChange, type CurriculumStage } from '../src/lib/curriculum';

const makeChange = (stages = templateStages('New Programs', 'Standard')): CurriculumChange => ({ id: 'test', title: 'Program', change_type: 'New Programs', approval_process: 'Standard', organization_unit_id: null, start_date: '2026-09-01', implementation_year: 2027, description: '', stages, created_by: 'owner', created_at: '', version: 1 });
describe('curriculum governance and scheduling', () => {
  it('classifies all requested templates and applies distinct standard routes', () => {
    expect(curriculumTypes).toHaveLength(7);
    expect(classification('New Courses')).toBe('Minor change');
    expect(classification('New Specializations')).toBe('Major change');
    expect(classification('New Pathway')).toBe('Major change');
    expect(templateStages('New Courses', 'Standard').map(stage => [stage.committee, stage.purpose])).toEqual([['UEC', 'Approval'], ['FC', 'Approval'], ['USC', 'Information']]);
    for (const type of ['Minor Program Adjustments', 'Major Program Modifications'] as const) expect(templateStages(type, 'Standard').map(stage => stage.committee)).toEqual(['UEC', 'FC', 'USC', 'AC']);
  });
  it('V1 and V2 are explicit overrides even for minor curricular changes', () => {
    expect(templateStages('New Courses', 'V1').map(stage => stage.purpose)).toEqual(Array(4).fill('Approval'));
    expect(templateStages('New Courses', 'V2').map(stage => [stage.committee, stage.purpose])).toEqual([['UEC', 'Information'], ['FC', 'Information'], ['UEC', 'Approval'], ['FC', 'Approval'], ['USC', 'Approval'], ['AC', 'Approval']]);
  });
  it('builds faculty Tuesday calendars across year boundaries with editable lead times', () => {
    const meetings = defaultMeetings(2026);
    expect(meetings.filter(meeting => meeting.committee === 'UEC')).toHaveLength(12);
    expect(meetings.find(meeting => meeting.committee === 'UEC' && meeting.meeting_date.startsWith('2026-10'))).toMatchObject({ meeting_date: '2026-10-13', agenda_lead_days: 5 });
    expect(meetings.find(meeting => meeting.committee === 'FC' && meeting.meeting_date.startsWith('2027-01'))?.meeting_date).toBe('2027-01-05');
    expect(meetings.filter(meeting => meeting.committee === 'ARC')).toHaveLength(0);
    expect(defaultMeetings(2027).filter(meeting => ['AC', 'USC'].includes(meeting.committee))).toHaveLength(0);
  });
  it('schedules sequential meetings and agenda deadlines, skipping nonvoting AC sessions', () => {
    const stages = scheduleStages(templateStages('Major Program Modifications', 'V1'), '2026-09-01', defaultMeetings(2026));
    expect(stages.map(stage => stage.due_date)).toEqual(['2026-09-08', '2026-10-06', '2026-10-20', '2026-11-24']);
    expect(stages.map(stage => stage.agenda_date)).toEqual(['2026-09-03', '2026-09-29', '2026-10-20', '2026-11-24']);
    const late = scheduleStages(templateStages('New Courses', 'Standard'), '2026-10-10', defaultMeetings(2026));
    expect(late[0].due_date).toBe('2026-11-10');
  });
  it('uses changed meeting dates and lead times, and leaves missing downstream meetings unscheduled', () => {
    const meetings = defaultMeetings(2026).map(meeting => meeting.committee === 'UEC' && meeting.meeting_date === '2026-10-13' ? { ...meeting, meeting_date: '2026-10-15', agenda_lead_days: 3 } : meeting).filter(meeting => meeting.committee !== 'USC');
    const stages = scheduleStages(templateStages('New Courses', 'V1'), '2026-10-01', meetings);
    expect(stages[0]).toMatchObject({ due_date: '2026-10-15', agenda_date: '2026-10-12' });
    expect(stages.slice(2).map(stage => stage.due_date)).toEqual([null, null]);
  });
  it('preserves completed records and resource links when replanning', () => {
    const original = templateStages('New Courses', 'Standard');
    original[0] = { ...original[0], outcome: 'approved', completed_on: '2026-09-08', due_date: '2026-09-08', notes: 'Approved unanimously', links: [{ title: 'Proposal', url: 'https://example.test/proposal' }] };
    const scheduled = scheduleStages(original, '2026-10-01', defaultMeetings(2026));
    expect(scheduled[0]).toEqual(original[0]);
    expect(scheduled[1].due_date).toBe('2026-10-06');
  });
  it('requires ARC approval and actual publication before new program governance completion', () => {
    const change = makeChange();
    const scheduled = scheduleStages(change.stages, change.start_date, defaultMeetings(2026), true);
    expect(scheduled[0].due_date).toBe('2026-09-01');
    expect(scheduled.slice(1).every(stage => stage.due_date === null)).toBe(true);
    const publicStage = { ...change.stages[2], outcome: 'reported', completed_on: '2026-09-20' } as CurriculumStage;
    expect(() => validateStage(publicStage, change, [], '2026-10-01')).toThrow('ARC approval');
    change.stages[1] = { ...change.stages[1], outcome: 'approved', completed_on: '2026-09-18' };
    expect(() => validateStage(publicStage, change, [], '2026-10-01')).not.toThrow();
    change.stages[2] = publicStage;
    expect(noiExpiry(change)).toBe('2028-09-20');
    expect(scheduleStages(change.stages, change.start_date, defaultMeetings(2026), true)[3].due_date).toBe('2026-10-13');
    expect(() => validateStage({ ...change.stages[3], outcome: 'approved', completed_on: '2028-09-21' }, change, [], '2028-10-01')).toThrow('two years');
  });
  it('schedules ARC only from user supplied quarterly meeting dates', () => {
    const change = makeChange();
    const meetings = [...defaultMeetings(2026), { id: 'arc', academic_year: 2026, committee: 'ARC' as const, meeting_date: '2026-10-15', agenda_lead_days: 0, voting: true }];
    expect(scheduleStages(change.stages, change.start_date, meetings, true)[1].due_date).toBe('2026-10-15');
  });
  it('preserves manually planned consultation stages on reschedule', () => {
    const original = templateStages('New Courses', 'Standard');
    const consultation = { ...original[0], id: 'consultation', title: 'Consultation', committee: null, purpose: 'Development' as const, due_date: '2026-11-01' };
    expect(scheduleStages([...original, consultation], '2026-09-01', defaultMeetings(2026)).at(-1)).toEqual(consultation);
  });
  it('rejects false completions, unsafe links, future actuals and nonvoting sessions', () => {
    const change = makeChange(templateStages('New Programs', 'V1'));
    expect(() => validateStage({ ...change.stages[0], outcome: 'completed', completed_on: null }, change, [], '2026-10-01')).toThrow('completion date');
    expect(() => validateStage({ ...change.stages[0], outcome: 'completed', completed_on: '2026-10-02' }, change, [], '2026-10-01')).toThrow('today');
    expect(() => validateStage({ ...change.stages[0], links: [{ title: 'Unsafe', url: 'javascript:alert(1)' }] }, change, [], '2026-10-01')).toThrow('HTTP/HTTPS');
    expect(() => validateStage({ ...change.stages[6], due_date: '2026-10-27' }, change, defaultMeetings(2026), '2026-10-01')).toThrow('information-only');
  });
  it('identifies the January cutoff in the year the next academic calendar starts', () => {
    expect(calendarCutoff(2027)).toBe('2027-01-31');
    expect(academicYear('2027-01-31')).toBe(2026);
    const change = { ...makeChange(scheduleStages(templateStages('New Courses', 'Standard'), '2026-10-01', defaultMeetings(2026))), change_type: 'New Courses' as const };
    expect(curriculumWarnings(change, defaultMeetings(2026), '2026-10-01')).toEqual([]);
    change.stages[2].due_date = '2027-02-16';
    change.stages[2].agenda_date = '2027-02-16';
    expect(curriculumWarnings(change, defaultMeetings(2026), '2026-10-01').join(' ')).toContain('January 31, 2027');
    change.stages[2].agenda_date = '2027-01-31';
    expect(curriculumWarnings(change, defaultMeetings(2026), '2026-10-01').join(' ')).not.toContain('January 31, 2027');
    expect(isChangeComplete(change)).toBe(false);
  });
});
