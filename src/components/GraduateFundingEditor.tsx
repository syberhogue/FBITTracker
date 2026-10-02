import { useState } from 'react';
import { displayDate, fundingDates, fundingSemesterCount, graduateError, semesterForDate, semesterStart, type GraduateDeadline, type GraduateItemType, type GraduateStudent, type Semester } from '../lib/graduate';
import { ItemTypeField } from './GraduatePlanningEditors';
import { Modal } from './ui';

export function GraduateFundingEditor({ student, deadline, onClose, onSave }: { student: GraduateStudent; deadline?: GraduateDeadline; onClose(): void; onSave(value: GraduateDeadline): Promise<void> }) {
  const initial = deadline?.starts_on ?? student.start_date;
  const [kind, setKind] = useState<'GRA' | 'RA'>(deadline?.funding_kind ?? 'GRA');
  const [grant, setGrant] = useState(deadline?.grant_name ?? '');
  const [amount, setAmount] = useState(String(deadline?.amount ?? ''));
  const [semester, setSemester] = useState<Semester>(semesterForDate(initial));
  const [year, setYear] = useState(Number(initial.slice(0, 4)));
  const [semesters, setSemesters] = useState(deadline?.starts_on ? fundingSemesterCount(deadline.starts_on, deadline.due_date) : 1);
  const [type, setType] = useState<GraduateItemType>(deadline?.item_type ?? 'Milestone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const start = semesterStart(semester, year >= 1000 && year <= 9998 ? year : Number(initial.slice(0, 4)));
  const dates = fundingDates(start, semesters);
  return <Modal title={deadline ? 'Edit funding' : 'Add funding'} onClose={() => { if (!busy) onClose(); }}><form className="space-y-4 p-6" onSubmit={async event => {
    event.preventDefault(); setError('');
    if (start < student.start_date) { setError('Funding cannot start before the program start.'); return; }
    if (!grant.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) { setError('Enter a grant and a positive total amount.'); return; }
    setBusy(true);
    try {
      await onSave({ ...deadline, id: deadline?.id ?? crypto.randomUUID(), student_id: student.id, category_key: deadline?.category_key ?? 'funding', title: `${kind}: ${grant.trim()}`, item_type: type, funding_kind: kind, grant_name: grant.trim(), amount: Number(amount), starts_on: start, due_date: dates.end });
      onClose();
    } catch (reason) { setError(graduateError(reason)); setBusy(false); }
  }}>
    <div className="grid grid-cols-2 gap-3"><label><span className="label">Funding type</span><select className="field" value={kind} onChange={event => setKind(event.target.value as 'GRA' | 'RA')}><option>GRA</option><option>RA</option></select></label><label><span className="label">Total amount (CAD)</span><input className="field" type="number" min="0.01" max="9999999999.99" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)}/></label></div>
    <label className="block"><span className="label">Grant / funding source</span><input className="field" required maxLength={195} value={grant} onChange={event => setGrant(event.target.value)}/></label>
    <div className="grid grid-cols-2 gap-3"><label><span className="label">Funding start semester</span><select className="field" value={semester} onChange={event => setSemester(event.target.value as Semester)}>{['Fall', 'Winter', 'Summer'].map(term => <option key={term}>{term}</option>)}</select></label><label><span className="label">Funding start year</span><input className="field" type="number" min={Number(student.start_date.slice(0, 4))} max="9998" required value={year || ''} onChange={event => setYear(Number(event.target.value))}/></label></div>
    <label className="block"><span className="label">Funding duration</span><select className="field" value={semesters} onChange={event => setSemesters(Number(event.target.value))}><option value={1}>1 semester (4 months)</option><option value={2}>2 semesters (8 months)</option><option value={3}>3 semesters (1 year maximum)</option></select></label>
    <div className="rounded-lg bg-green-50 p-3 text-sm text-green-900"><p>Active: <b>{displayDate(start)} – {displayDate(dates.end)}</b></p><p className="mt-1">{kind} form due: <b>{displayDate(dates.form)}</b></p><p className="mt-1 text-xs">Submit the form one month before the starting semester. The amount covers the entire funding period.</p></div>
    <ItemTypeField value={type} onChange={setType}/>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn-ghost" disabled={busy} onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>Save funding</button></div>
  </form></Modal>;
}
