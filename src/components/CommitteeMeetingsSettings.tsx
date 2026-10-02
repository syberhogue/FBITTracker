import { CommitteeCalendarForm } from './CommitteeCalendarForm';
import { useAuth } from '../features/auth';
import { useCurriculum } from '../features/curriculum';
import { academicYear, canEditCalendar, curriculumError } from '../lib/curriculum';
import { todayDate } from '../lib/graduate';

export function CommitteeMeetingsSettings() {
  const { profile } = useAuth(); const data = useCurriculum();
  if (!canEditCalendar(profile)) return null;
  return <section aria-label="Committee meetings" className="mt-10"><div className="mb-4"><h2 className="text-sm font-extrabold text-slate-900">Committee meetings</h2><p className="mt-1 text-xs text-slate-500">Generate and manage the UEC, Faculty Council, USC, Academic Council and ARC meeting dates used by curriculum timelines.</p></div><div className="card p-5 md:p-6">{data.isLoading ? <p role="status" className="text-sm text-slate-500">Loading committee calendar…</p> : data.error ? <div role="alert" className="text-sm text-red-700">Could not load committee meetings: {curriculumError(data.error)} <button className="btn-ghost" onClick={() => void data.refetch()}>Retry</button></div> : <CommitteeCalendarForm initialYear={academicYear(todayDate())} meetingsForYear={data.meetingsForYear} versionForYear={year => data.calendars.find(calendar => calendar.academic_year === year)?.version} onSave={(year, meetings, version) => data.saveCalendar.mutateAsync({ year, meetings, version })}/>}</div></section>;
}
