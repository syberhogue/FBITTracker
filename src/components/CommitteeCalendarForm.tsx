import { useId, useState, type ReactNode } from 'react';
import { CalendarDays, Plus, Save, Trash2 } from 'lucide-react';
import { committees, committeeInfo, curriculumError, defaultMeetings, type Committee, type CommitteeMeeting } from '../lib/curriculum';
import { defaultRecurrence, generateCommitteeMeetings, meetingFrequencies, validateCommitteeCalendar, weekdayNames, type CommitteeRecurrence } from '../lib/committeeSchedule';

export interface CommitteeCalendarFormProps {
  initialYear: number;
  meetingsForYear(year: number): CommitteeMeeting[];
  versionForYear(year: number): number | undefined;
  onSave(year: number, meetings: CommitteeMeeting[], version?: number): Promise<void>;
  onClose?(): void;
}
interface CalendarDraft { meetings: CommitteeMeeting[]; version?: number; rules: Partial<Record<Committee, CommitteeRecurrence>> }
function Field({ label, children }: { label: string; children(id: string): ReactNode }) {
  const id = useId();
  return <div><label htmlFor={id} className="label">{label}</label>{children(id)}</div>;
}

export function CommitteeCalendarForm({ initialYear, meetingsForYear, versionForYear, onSave, onClose }: CommitteeCalendarFormProps) {
  const load = (year: number): CalendarDraft => ({ meetings: meetingsForYear(year), version: versionForYear(year), rules: {} });
  const [year, setYear] = useState(initialYear);
  const [drafts, setDrafts] = useState<Record<number, CalendarDraft>>(() => ({ [initialYear]: load(initialYear) }));
  const [committee, setCommittee] = useState<Committee>('UEC');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const validYear = Number.isInteger(year) && year >= 2000 && year <= 2100;
  const calendar = drafts[year] ?? { meetings: [], version: undefined, rules: {} };
  const rule = calendar.rules[committee] ?? defaultRecurrence(validYear ? year : initialYear, committee, calendar.meetings);
  const visible = calendar.meetings.filter(meeting => meeting.committee === committee);
  function updateDraft(update: (draft: CalendarDraft) => CalendarDraft) {
    setDrafts(previous => ({ ...previous, [year]: update(previous[year] ?? load(year)) }));
    setMessage('');
  }
  function updateRule(changes: Partial<CommitteeRecurrence>) {
    const next = { ...rule, ...changes };
    setError('');
    try {
      const generated = generateCommitteeMeetings(year, committee, next, calendar.meetings);
      updateDraft(draft => ({ ...draft, rules: { ...draft.rules, [committee]: next }, meetings: [...draft.meetings.filter(meeting => meeting.committee !== committee), ...generated] }));
    } catch (reason) {
      updateDraft(draft => ({ ...draft, rules: { ...draft.rules, [committee]: next } }));
      setError(curriculumError(reason));
    }
  }
  function patchMeeting(id: string, changes: Partial<CommitteeMeeting>) {
    updateDraft(draft => ({ ...draft, meetings: draft.meetings.map(meeting => meeting.id === id ? { ...meeting, ...changes } : meeting) }));
  }
  return <form className="space-y-5" onSubmit={async event => {
    event.preventDefault(); setError(''); setMessage(''); setBusy(true);
    try {
      validateCommitteeCalendar(year, calendar.meetings);
      const sorted = [...calendar.meetings].sort((a, b) => a.meeting_date.localeCompare(b.meeting_date) || a.committee.localeCompare(b.committee));
      await onSave(year, sorted, calendar.version);
      setDrafts(previous => ({ ...previous, [year]: { ...calendar, meetings: sorted, version: (calendar.version ?? 0) + 1 } }));
      setMessage(`Committee calendar saved for ${year}–${year + 1}.`);
      onClose?.();
    } catch (reason) { setError(curriculumError(reason)); } finally { setBusy(false); }
  }}>
    <fieldset disabled={busy} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Calendar academic year">{id => <input id={id} className="field" type="number" min="2000" max="2100" required value={year || ''} onChange={event => {
        const next = Number(event.target.value); setYear(next); setError(''); setMessage('');
        if (Number.isInteger(next) && next >= 2000 && next <= 2100) setDrafts(previous => previous[next] ? previous : { ...previous, [next]: load(next) });
      }}/>}</Field><Field label="Calendar committee">{id => <select id={id} className="field" value={committee} onChange={event => { setCommittee(event.target.value as Committee); setError(''); setMessage(''); }}>{committees.map(value => <option key={value} value={value}>{value} — {committeeInfo[value].name}</option>)}</select>}</Field></div>
      <p className="text-xs text-slate-500">September {year}–August {year + 1}. This calendar is shared with active staff. Saving applies to new schedules; use <b>Reschedule pending stages</b> in the curriculum tracker to update existing plans.</p>
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        <Field label="Meeting frequency">{id => <select id={id} className="field" disabled={!validYear} value={rule.frequency} onChange={event => updateRule({ frequency: event.target.value as CommitteeRecurrence['frequency'] })}>{meetingFrequencies.map(frequency => <option key={frequency.value} value={frequency.value}>{frequency.label}</option>)}</select>}</Field>
        <p className="mt-2 text-xs text-slate-500">Choose a frequency to auto-fill this committee’s list. Changing the recurrence replaces its draft dates. Then override individual dates or delete meetings below before saving.</p>
        {rule.frequency !== 'custom' && <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2"><Field label={rule.frequency === 'yearly' ? 'Yearly meeting date' : 'Schedule starts'}>{id => <input id={id} className="field" type="date" required min={`${year}-09-01`} max={`${year + 1}-08-31`} value={rule.starts_on} onChange={event => updateRule({ starts_on: event.target.value })}/>}</Field><Field label="Schedule ends">{id => <input id={id} className="field" type="date" required min={rule.starts_on || `${year}-09-01`} max={`${year + 1}-08-31`} value={rule.ends_on} onChange={event => updateRule({ ends_on: event.target.value })}/>}</Field></div>
          {['monthly', 'quarterly'].includes(rule.frequency) && <Field label="Repeat pattern">{id => <select id={id} className="field" value={rule.monthly_pattern} onChange={event => updateRule({ monthly_pattern: event.target.value as CommitteeRecurrence['monthly_pattern'] })}><option value="weekday">Week and weekday (e.g. second Tuesday)</option><option value="month-day">Day of month (e.g. the 15th)</option></select>}</Field>}
          {rule.frequency !== 'yearly' && (['weekly', 'fortnightly'].includes(rule.frequency) || rule.monthly_pattern === 'weekday') && <div className="grid gap-3 sm:grid-cols-2">{['monthly', 'quarterly'].includes(rule.frequency) && <Field label="Week of month">{id => <select id={id} className="field" value={rule.week_of_month} onChange={event => updateRule({ week_of_month: Number(event.target.value) })}>{[[1, 'First'], [2, 'Second'], [3, 'Third'], [4, 'Fourth'], [5, 'Fifth (when present)'], [-1, 'Last']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}</Field>}<Field label="Day of week">{id => <select id={id} className="field" value={rule.weekday} onChange={event => updateRule({ weekday: Number(event.target.value) })}>{weekdayNames.map((name, index) => <option key={name} value={index}>{name}</option>)}</select>}</Field></div>}
          {['monthly', 'quarterly'].includes(rule.frequency) && rule.monthly_pattern === 'month-day' && <Field label="Day of month">{id => <input id={id} className="field max-w-36" type="number" min="1" max="31" required value={rule.day_of_month} onChange={event => updateRule({ day_of_month: Number(event.target.value) })}/>}</Field>}
          <p className="text-xs text-slate-500">{rule.monthly_pattern === 'month-day' && ['monthly', 'quarterly'].includes(rule.frequency) ? 'Shorter months use their last day.' : rule.frequency === 'quarterly' ? 'Quarterly meetings repeat every three months from the starting month.' : 'Generated dates stay within the selected date range.'}</p>
        </div>}
      </div>
      <div><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-extrabold text-[#003C71]"><CalendarDays size={17}/>{committee} meetings ({visible.length})</h3><button type="button" className="btn-ghost gap-1" disabled={!validYear} onClick={() => {
        const used = new Set(visible.map(meeting => meeting.meeting_date));
        let day = new Date(`${year}-09-01T00:00:00Z`);
        while (used.has(day.toISOString().slice(0, 10))) day = new Date(day.getTime() + 86400000);
        updateDraft(draft => ({ ...draft, meetings: [...draft.meetings, { id: crypto.randomUUID(), academic_year: year, committee, meeting_date: day.toISOString().slice(0, 10), voting: true, agenda_lead_days: committee === 'UEC' ? 5 : committee === 'FC' ? 7 : 0 }] }));
      }}><Plus size={14}/>Add meeting</button></div>
      {visible.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 p-4 text-xs text-slate-500">No meetings listed. Select a frequency or add a meeting.</p> : <div aria-label={`${committee} meeting list`} className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">{visible.map((meeting, index) => <div key={meeting.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_100px_auto]"><Field label={`${committee} meeting ${index + 1}`}>{id => <input id={id} className="field" required type="date" min={`${year}-09-01`} max={`${year + 1}-08-31`} value={meeting.meeting_date} onChange={event => patchMeeting(meeting.id, { meeting_date: event.target.value })}/>}</Field><Field label={`Agenda lead days ${index + 1}`}>{id => <input id={id} className="field" required type="number" min="0" max="60" value={meeting.agenda_lead_days} onChange={event => patchMeeting(meeting.id, { agenda_lead_days: Number(event.target.value) })}/>}</Field><button type="button" className="btn-ghost text-red-700" aria-label={`Delete ${committee} meeting ${index + 1}`} onClick={() => updateDraft(draft => ({ ...draft, meetings: draft.meetings.filter(item => item.id !== meeting.id) }))}><Trash2 size={16}/><span className="ml-1 sm:sr-only">Delete</span></button></div><label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={meeting.voting} onChange={event => patchMeeting(meeting.id, { voting: event.target.checked })}/>Voting permitted {index + 1}</label></div>)}</div>}
      <p className="mt-3 text-xs text-slate-500">Agenda lead days count backwards from each meeting. Zero means no advance agenda deadline is specified. Information-only meetings cannot be used for approval stages.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" className="btn-ghost" disabled={!validYear} onClick={() => updateDraft(draft => ({ ...draft, rules: { ...draft.rules, [committee]: undefined }, meetings: [...draft.meetings.filter(meeting => meeting.committee !== committee), ...defaultMeetings(year).filter(meeting => meeting.committee === committee)] }))}>Restore {committee} defaults</button><button type="button" className="btn-ghost" disabled={!validYear} onClick={() => { setDrafts(previous => ({ ...previous, [year]: load(year) })); setError(''); setMessage(''); }}>Reset unsaved changes</button></div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      <div className="flex flex-wrap justify-end gap-2">{onClose && <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>}<button className="btn-orange gap-2" disabled={!validYear}><Save size={15}/>{busy ? 'Saving…' : 'Save committee calendar'}</button></div>
    </fieldset>
  </form>;
}
