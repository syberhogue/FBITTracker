import { describe, expect, it } from 'vitest';
import { defaultMeetings } from '../src/lib/curriculum';
import { defaultRecurrence, generateCommitteeMeetings, validateCommitteeCalendar } from '../src/lib/committeeSchedule';

describe('committee recurrence dates', () => {
  const meetings = defaultMeetings(2026);
  const rule = defaultRecurrence(2026, 'UEC', meetings);
  it('generates the first and second Tuesdays throughout an academic year', () => {
    expect(generateCommitteeMeetings(2026, 'UEC', { ...rule, frequency: 'monthly' }, meetings).map(meeting => meeting.meeting_date)).toEqual(meetings.filter(meeting => meeting.committee === 'UEC').map(meeting => meeting.meeting_date));
    expect(generateCommitteeMeetings(2026, 'FC', { ...defaultRecurrence(2026, 'FC', meetings), frequency: 'monthly' }, meetings)[4].meeting_date).toBe('2027-01-05');
  });
  it('handles last weekdays and skips months with no fifth weekday', () => {
    expect(generateCommitteeMeetings(2026, 'UEC', { ...rule, frequency: 'quarterly', week_of_month: -1 }, []).map(meeting => meeting.meeting_date)).toEqual(['2026-09-29', '2026-12-29', '2027-03-30', '2027-06-29']);
    expect(generateCommitteeMeetings(2026, 'UEC', { ...rule, frequency: 'monthly', week_of_month: 5, ends_on: '2026-12-31' }, []).map(meeting => meeting.meeting_date)).toEqual(['2026-09-29', '2026-12-29']);
  });
  it('clamps fixed days in shorter months without shifting later months', () => {
    const dates = generateCommitteeMeetings(2026, 'ARC', { ...rule, frequency: 'monthly', monthly_pattern: 'month-day', day_of_month: 31 }, []).map(meeting => meeting.meeting_date);
    expect(dates.slice(0, 3)).toEqual(['2026-09-30', '2026-10-31', '2026-11-30']);
    expect(dates.slice(5, 7)).toEqual(['2027-02-28', '2027-03-31']);
    const leapRule = { ...rule, frequency: 'monthly' as const, starts_on: '2027-09-01', ends_on: '2028-08-31', monthly_pattern: 'month-day' as const, day_of_month: 31 };
    expect(generateCommitteeMeetings(2027, 'ARC', leapRule, [])[5].meeting_date).toBe('2028-02-29');
  });
  it('anchors weekly and fortnightly dates to the chosen weekday and stays in range', () => {
    expect(generateCommitteeMeetings(2026, 'USC', { ...rule, frequency: 'weekly', starts_on: '2026-09-03', ends_on: '2026-09-30' }, []).map(meeting => meeting.meeting_date)).toEqual(['2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29']);
    expect(generateCommitteeMeetings(2026, 'USC', { ...rule, frequency: 'fortnightly', starts_on: '2026-12-29', ends_on: '2027-01-31' }, []).map(meeting => meeting.meeting_date)).toEqual(['2026-12-29', '2027-01-12', '2027-01-26']);
    expect(generateCommitteeMeetings(2026, 'USC', { ...rule, frequency: 'yearly', starts_on: '2026-11-04' }, []).map(meeting => meeting.meeting_date)).toEqual(['2026-11-04']);
  });
  it('retains information-only flags, agenda leads and IDs on matching dates', () => {
    const generated = generateCommitteeMeetings(2026, 'AC', { ...defaultRecurrence(2026, 'AC', meetings), frequency: 'monthly' }, meetings);
    const original = meetings.find(meeting => meeting.committee === 'AC' && meeting.meeting_date === '2026-10-27');
    expect(generated.find(meeting => meeting.meeting_date === '2026-10-27')).toEqual(original);
    expect(generated.find(meeting => meeting.meeting_date === '2027-02-23')?.voting).toBe(false);
    expect(generated.find(meeting => meeting.meeting_date === '2027-04-27')?.voting).toBe(false);
  });
  it('leaves custom dates and exclusions intact instead of filling missing meetings', () => {
    const customised = meetings.filter(meeting => meeting.committee === 'UEC' && meeting.meeting_date !== '2026-10-13').map((meeting, index) => index === 0 ? { ...meeting, meeting_date: '2026-09-10' } : meeting);
    expect(generateCommitteeMeetings(2026, 'UEC', rule, customised)).toEqual(customised);
    expect(() => validateCommitteeCalendar(2026, customised)).not.toThrow();
  });
  it('rejects invalid ranges, impossible dates and duplicate meetings', () => {
    expect(() => generateCommitteeMeetings(2026, 'UEC', { ...rule, frequency: 'monthly', starts_on: '2027-09-01' }, [])).toThrow('selected academic year');
    expect(() => generateCommitteeMeetings(2026, 'UEC', { ...rule, frequency: 'monthly', ends_on: '2027-02-30' }, [])).toThrow('valid schedule dates');
    expect(() => generateCommitteeMeetings(2026, 'UEC', { ...rule, frequency: 'monthly', starts_on: '2027-01-01', ends_on: '2026-12-31' }, [])).toThrow('end on or after');
    expect(() => validateCommitteeCalendar(2026, [meetings[0], { ...meetings[0], id: 'different' }])).toThrow('duplicate');
    expect(() => defaultRecurrence(2026, 'UEC', [{ ...meetings[0], committee: 'UEC', meeting_date: '' }])).not.toThrow();
  });
});
