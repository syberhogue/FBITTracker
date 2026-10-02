import { describe, expect, it } from 'vitest';
import { defaultMeetings, scheduleStages, templateStages, type CommitteeMeeting, type CurriculumChange } from '../src/lib/curriculum';
import { moveCurriculumStage } from '../src/lib/curriculumTimeline';

const meetings = defaultMeetings(2026);
const proposal = (type: CurriculumChange['change_type'] = 'Major Program Modifications', process: CurriculumChange['approval_process'] = 'Standard'): CurriculumChange => ({ id: 'drag', title: 'Proposal', change_type: type, approval_process: process, organization_unit_id: null, start_date: '2026-09-01', implementation_year: 2027, description: '', stages: scheduleStages(templateStages(type, process), '2026-09-01', meetings, type === 'New Programs'), created_by: 'owner', created_at: '', version: 1 });

describe('curriculum timeline moves', () => {
  it('snaps UEC and cascades all dependent committees and agendas atomically', () => {
    const change = proposal();
    const original = structuredClone(change);
    change.stages[1].notes = 'Keep consultation notes';
    change.stages[1].links = [{ title: 'Proposal', url: 'https://example.test/proposal' }];
    const stages = moveCurriculumStage(change, 'uec-approval', '2026-10-10', meetings);
    expect(stages.map(stage => stage.due_date)).toEqual(['2026-10-13', '2026-11-03', '2026-12-15', '2027-01-26']);
    expect(stages.map(stage => stage.agenda_date)).toEqual(['2026-10-08', '2026-10-27', '2026-12-15', '2027-01-26']);
    expect(stages[1]).toMatchObject({ notes: change.stages[1].notes, links: change.stages[1].links, outcome: 'pending' });
    expect(change.stages.map(stage => stage.due_date)).toEqual(original.stages.map(stage => stage.due_date));
  });
  it('uses edited meeting dates and lead times and never snaps approvals to nonvoting sessions', () => {
    const change = proposal();
    const edited = meetings.map(meeting => meeting.committee === 'AC' && meeting.meeting_date === '2026-11-24' ? { ...meeting, meeting_date: '2026-11-25', agenda_lead_days: 8 } : meeting);
    expect(moveCurriculumStage(change, 'ac-approval', '2026-10-21', edited).at(-1)).toMatchObject({ due_date: '2026-11-25', agenda_date: '2026-11-17' });
    change.stages[3].purpose = 'Information';
    expect(moveCurriculumStage(change, 'ac-approval', '2026-10-21', edited).at(-1)?.due_date).toBe('2026-10-27');
  });
  it('bounds earlier moves by prerequisite dates and allows earlier valid dependent schedules', () => {
    const change = proposal();
    expect(moveCurriculumStage(change, 'fc-approval', '2026-09-01', meetings)[1].due_date).toBe('2026-10-06');
    change.stages = moveCurriculumStage(change, 'uec-approval', '2026-10-10', meetings);
    expect(moveCurriculumStage(change, 'uec-approval', '2026-09-02', meetings).map(stage => stage.due_date)).toEqual(['2026-09-08', '2026-10-06', '2026-10-20', '2026-11-24']);
  });
  it('preserves completed history and rejects moves across a completed boundary', () => {
    const change = proposal();
    change.stages[0] = { ...change.stages[0], completed_on: '2026-09-08', outcome: 'approved', notes: 'Actual approval' };
    expect(moveCurriculumStage(change, 'fc-approval', '2026-11-01', meetings)[0]).toEqual(change.stages[0]);
    expect(() => moveCurriculumStage(change, 'uec-approval', '2026-10-01', meetings)).toThrow('Completed stages');
    change.stages[0].completed_on = null; change.stages[0].outcome = 'pending';
    change.stages[1] = { ...change.stages[1], completed_on: '2026-10-06', outcome: 'approved' };
    expect(() => moveCurriculumStage(change, 'uec-approval', '2026-10-01', meetings)).toThrow('recorded completion');
  });
  it('rejects a missing downstream calendar without changing any saved stage', () => {
    const change = proposal();
    const snapshot = structuredClone(change);
    expect(() => moveCurriculumStage(change, 'uec-approval', '2026-10-10', meetings.filter(meeting => meeting.committee !== 'USC'))).toThrow('No available USC voting meeting');
    expect(change).toEqual(snapshot);
    expect(() => moveCurriculumStage(change, 'uec-approval', '2028-01-01', meetings)).toThrow('Settings');
  });
  it('preserves the V2 information-before-approval route', () => {
    const change = proposal('New Courses', 'V2');
    const stages = moveCurriculumStage(change, 'uec-information', '2026-09-09', meetings);
    expect(stages.slice(0, 4).map(stage => stage.due_date)).toEqual(['2026-10-13', '2026-11-03', '2026-11-10', '2026-12-01']);
    stages.slice(1).forEach((stage, index) => expect(stage.agenda_date! > stages[index].due_date!).toBe(true));
  });
  it('shifts manual milestones with their prerequisite while retaining undated extras', () => {
    const change = proposal('New Courses');
    change.stages.push({ ...change.stages[2], id: 'consultation', title: 'Consultation', committee: null, purpose: 'Development', due_date: '2026-10-30', agenda_date: '2026-10-28' });
    change.stages.push({ ...change.stages[3], id: 'undated', due_date: null, agenda_date: null });
    const stages = moveCurriculumStage(change, 'uec-approval', '2026-10-10', meetings);
    expect(stages[3]).toMatchObject({ due_date: '2026-12-25', agenda_date: '2026-12-23' });
    expect(stages[4]).toEqual(change.stages[4]);
    expect(moveCurriculumStage(change, 'consultation', '2026-09-01', meetings)[3].due_date).toBe('2026-10-21');
  });
  it('shifts planned NOI publication with ARC but requires actual publication for governance', () => {
    const change = proposal('New Programs');
    const arc: CommitteeMeeting = { id: 'arc', academic_year: 2026, committee: 'ARC', meeting_date: '2026-10-15', voting: true, agenda_lead_days: 0 };
    change.stages[1].due_date = '2026-09-15';
    change.stages[2].due_date = '2026-09-20';
    const stages = moveCurriculumStage(change, 'arc-approval', '2026-10-01', [...meetings, arc]);
    expect(stages[2].due_date).toBe('2026-10-20');
    expect(stages.slice(3).every(stage => stage.due_date === null)).toBe(true);
    expect(() => moveCurriculumStage(change, 'uec-approval', '2026-10-01', meetings)).toThrow('actual NOI publication');
  });
  it('uses actual publication as a fixed prerequisite and enforces NOI expiry', () => {
    const change = proposal('New Programs');
    change.stages[0] = { ...change.stages[0], due_date: '2026-09-01', completed_on: '2026-09-01', outcome: 'completed' };
    change.stages[1] = { ...change.stages[1], due_date: '2026-09-18', completed_on: '2026-09-18', outcome: 'approved' };
    change.stages[2] = { ...change.stages[2], due_date: '2026-09-20', completed_on: '2026-09-20', outcome: 'reported' };
    const stages = moveCurriculumStage(change, 'uec-approval', '2026-10-01', meetings);
    expect(stages.slice(0, 3)).toEqual(change.stages.slice(0, 3));
    const late = meetings.map(meeting => ({ ...meeting, meeting_date: `${Number(meeting.meeting_date.slice(0, 4)) + 2}${meeting.meeting_date.slice(4)}` }));
    expect(() => moveCurriculumStage(change, 'uec-approval', '2028-09-01', late)).toThrow('two-year NOI deadline');
  });
  it('requires known prerequisites and refuses removed stage keys', () => {
    const change = proposal(); change.stages[0].due_date = null;
    expect(() => moveCurriculumStage(change, 'fc-approval', '2026-10-01', meetings)).toThrow('Set a date for UEC');
    expect(() => moveCurriculumStage(change, 'removed', '2026-10-01', meetings)).toThrow('no longer exists');
  });
});
