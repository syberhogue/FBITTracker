import { academicYear, type Committee, type CommitteeMeeting } from './curriculum';

export const meetingFrequencies = [
  { value: 'custom', label: 'Custom / saved dates' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Every two weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly (every three months)' },
  { value: 'yearly', label: 'Yearly' },
] as const;
export type MeetingFrequency = typeof meetingFrequencies[number]['value'];
export const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export interface CommitteeRecurrence {
  frequency: MeetingFrequency;
  starts_on: string;
  ends_on: string;
  monthly_pattern: 'weekday' | 'month-day';
  weekday: number;
  week_of_month: number; // 1–5, or -1 for the last occurrence.
  day_of_month: number;
}
const iso = (date: Date) => date.toISOString().slice(0, 10);
function parseDay(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || iso(date) !== value) throw new Error('Enter valid schedule dates.');
  return date;
}
export function defaultRecurrence(year: number, committee: Committee, meetings: CommitteeMeeting[]): CommitteeRecurrence {
  const first = meetings.filter(meeting => {
    if (meeting.committee !== committee) return false;
    try { parseDay(meeting.meeting_date); return true; } catch { return false; }
  }).sort((a, b) => a.meeting_date.localeCompare(b.meeting_date))[0];
  const day = parseDay(first?.meeting_date ?? `${year}-09-01`);
  return { frequency: 'custom', starts_on: `${year}-09-01`, ends_on: `${year + 1}-08-31`, monthly_pattern: 'weekday', weekday: day.getUTCDay(), week_of_month: Math.ceil(day.getUTCDate() / 7), day_of_month: day.getUTCDate() };
}

/** Generate a draft list only; saved overrides and exclusions are never regenerated on load or save. */
export function generateCommitteeMeetings(year: number, committee: Committee, recurrence: CommitteeRecurrence, existing: CommitteeMeeting[]): CommitteeMeeting[] {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Choose an academic year between 2000 and 2100.');
  if (recurrence.frequency === 'custom') return existing.filter(meeting => meeting.committee === committee);
  const start = parseDay(recurrence.starts_on);
  parseDay(recurrence.ends_on);
  if (academicYear(recurrence.starts_on) !== year || academicYear(recurrence.ends_on) !== year || recurrence.starts_on > recurrence.ends_on) throw new Error('The schedule must start and end within the selected academic year, with the end on or after the start.');
  if (!Number.isInteger(recurrence.weekday) || recurrence.weekday < 0 || recurrence.weekday > 6 || ![-1, 1, 2, 3, 4, 5].includes(recurrence.week_of_month) || !Number.isInteger(recurrence.day_of_month) || recurrence.day_of_month < 1 || recurrence.day_of_month > 31) throw new Error('Choose a valid weekday, week of month and day of month.');
  const dates: string[] = [];
  const append = (date: Date) => { const value = iso(date); if (value >= recurrence.starts_on && value <= recurrence.ends_on) dates.push(value); };
  if (recurrence.frequency === 'weekly' || recurrence.frequency === 'fortnightly') {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + (recurrence.weekday - date.getUTCDay() + 7) % 7);
    for (; iso(date) <= recurrence.ends_on; date.setUTCDate(date.getUTCDate() + (recurrence.frequency === 'weekly' ? 7 : 14))) append(date);
  } else if (recurrence.frequency === 'monthly' || recurrence.frequency === 'quarterly') {
    const step = recurrence.frequency === 'monthly' ? 1 : 3;
    for (let month = start.getUTCMonth(); ; month += step) {
      const first = new Date(Date.UTC(start.getUTCFullYear(), month, 1));
      if (iso(first) > recurrence.ends_on) break;
      const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
      let day = Math.min(recurrence.day_of_month, last.getUTCDate());
      if (recurrence.monthly_pattern === 'weekday') day = recurrence.week_of_month === -1 ? last.getUTCDate() - (last.getUTCDay() - recurrence.weekday + 7) % 7 : 1 + (recurrence.weekday - first.getUTCDay() + 7) % 7 + (recurrence.week_of_month - 1) * 7;
      if (day <= last.getUTCDate()) append(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), day)));
    }
  } else if (recurrence.frequency === 'yearly') append(start);
  else throw new Error('Choose a supported meeting frequency.');
  return dates.map(date => {
    const saved = existing.find(meeting => meeting.committee === committee && meeting.meeting_date === date);
    return saved ?? { id: crypto.randomUUID(), academic_year: year, committee, meeting_date: date, voting: true, agenda_lead_days: committee === 'UEC' ? 5 : committee === 'FC' ? 7 : 0 };
  });
}

export function validateCommitteeCalendar(year: number, meetings: CommitteeMeeting[]) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Choose an academic year between 2000 and 2100.');
  if (meetings.length > 200) throw new Error('An academic-year calendar can contain at most 200 meetings.');
  meetings.forEach(meeting => {
    parseDay(meeting.meeting_date);
    if (meeting.academic_year !== year || academicYear(meeting.meeting_date) !== year || !Number.isInteger(meeting.agenda_lead_days) || meeting.agenda_lead_days < 0 || meeting.agenda_lead_days > 60) throw new Error('Meeting dates must fall within this academic year; agenda lead times must be 0–60 days.');
  });
  if (new Set(meetings.map(meeting => `${meeting.committee}:${meeting.meeting_date}`)).size !== meetings.length) throw new Error('Remove duplicate committee meeting dates.');
}
