import { useState } from 'react';
import { availableCourseRequirements, displayDate, graduateError, semesterEnd, semesterForDate, type GraduateStudent, type GraduateTaskRecord } from '../lib/graduate';
import { Modal } from './ui';

export function GraduateCourseEditor({ student, start, records, onSave, onClose }: { student: GraduateStudent; start: string; records: GraduateTaskRecord[]; onSave(record: GraduateTaskRecord): Promise<void>; onClose(): void }) {
  const available = availableCourseRequirements(student.id, records);
  const [requirement, setRequirement] = useState(String(available[0] ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const due = semesterEnd(start);
  return <Modal title="Add semester course" onClose={() => { if (!busy) onClose(); }}><form className="space-y-4 p-6" onSubmit={async event => {
    event.preventDefault(); if (!available.includes(Number(requirement))) { setError('This requirement is already assigned. Choose another.'); return; }
    setBusy(true); setError('');
    const previous = records.find(record => record.student_id === student.id && record.task_key === `course:${requirement}`);
    try { await onSave({ notes: '', ...previous, is_deleted: false, completed_on: previous?.is_deleted ? null : previous?.completed_on ?? null, student_id: student.id, task_key: `course:${requirement}`, course_semester_start: start, expected_on: due }); onClose(); } catch (reason) { setError(graduateError(reason)); setBusy(false); }
  }}>
    <p className="font-extrabold text-[#003C71]">{semesterForDate(start)} {start.slice(0, 4)}</p><p className="text-sm text-slate-600">Full-semester course: {displayDate(start)} to {displayDate(due)}. The deadline is semester end.</p>
    {available.length ? <label className="block"><span className="label">Course requirement</span><select aria-label="Course requirement" className="field" required value={requirement} onChange={event => setRequirement(event.target.value)}>{available.map(number => <option key={number} value={number}>Requirement {number}</option>)}</select></label> : <p role="status" className="text-sm text-slate-600">All five course requirements are already assigned. Select an existing course in the timeline to reschedule it.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn-ghost" disabled={busy} onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !available.length}>Assign course</button></div>
  </form></Modal>;
}
