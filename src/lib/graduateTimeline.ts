import { addDays, addMonths, differenceInCalendarDays, parseISO } from 'date-fns';
import { isoDate, semesterEnd, semesterForDate, semesterStart, type GraduateTask } from './graduate';

export const DAY = 86400000;
export const dateStamp = (date: string) => Date.parse(`${date}T00:00:00Z`);
export const stampDate = (stamp: number) => new Date(stamp).toISOString().slice(0, 10);
export interface TimelineRange { low: number; high: number }
export function fitTimelineRange(today: string, dates: string[]): TimelineRange {
  const low = dateStamp(today);
  const high = Math.max(low, ...dates.map(dateStamp));
  // Keep Today and the last stage clear of the edges, including short or empty plans.
  const padding = Math.max(4 * DAY, Math.ceil((high - low) * 0.05 / DAY) * DAY);
  return { low: low - padding, high: high + padding };
}

export function zoomTimelineRange(bounds: TimelineRange, current: TimelineRange, factor: number, anchor = 0.5): TimelineRange {
  const full = bounds.high - bounds.low;
  const span = Math.max(Math.min(full, 7 * DAY), Math.min(full, (current.high - current.low) * factor));
  const fraction = Math.max(0, Math.min(1, anchor));
  const pivot = current.low + (current.high - current.low) * fraction;
  const low = Math.max(bounds.low, Math.min(bounds.high - span, pivot - span * fraction));
  return { low, high: low + span };
}

export const timelineDetail = (span: number) => span > 550 * DAY ? 'semester' : span > 120 * DAY ? 'month' : span > 21 * DAY ? 'week' : 'day';
export function timelineDivisions(low: number, high: number) {
  const detail = timelineDetail(high - low);
  const ticks: Array<{ date: string; label: string }> = [];
  if (detail === 'semester') return { detail, ticks };
  const date = new Date(low);
  date.setUTCHours(0, 0, 0, 0);
  if (detail === 'month') date.setUTCDate(1);
  if (detail === 'week') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  while (date.getTime() <= high) {
    if (date.getTime() >= low) ticks.push({ date: stampDate(date.getTime()), label: detail === 'month' ? date.toLocaleDateString('en-CA', { month: 'short', year: '2-digit', timeZone: 'UTC' }) : detail === 'week' ? `Wk ${date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' })}` : date.toLocaleDateString('en-CA', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }) });
    if (detail === 'month') date.setUTCMonth(date.getUTCMonth() + 1); else date.setUTCDate(date.getUTCDate() + (detail === 'week' ? 7 : 1));
  }
  return { detail, ticks };
}

export function canDragGraduateTask(task: GraduateTask) {
  return Boolean(task.dueDate && (task.editableDate || task.key.startsWith('custom:') || ['oral-exam', 'thesis-office', 'planning:submission'].includes(task.key)));
}
export function snapGraduateDeadline(stamp: number, span: number, course: boolean) {
  if (course) { const date = stampDate(stamp); return semesterEnd(semesterStart(semesterForDate(date), Number(date.slice(0, 4)))); }
  // Coarse views snap to Mondays; close views use exact calendar days.
  const unit = span > 120 * DAY ? 7 * DAY : DAY;
  const origin = unit === DAY ? 0 : dateStamp('1970-01-05');
  return stampDate(origin + Math.round((stamp - origin) / unit) * unit);
}
export function shiftedGraduateTask(task: GraduateTask, dueDate: string): GraduateTask {
  const termStart = semesterStart(semesterForDate(dueDate), Number(dueDate.slice(0, 4)));
  const startsOn = task.fundingSemesters ? isoDate(addMonths(parseISO(termStart), -(task.fundingSemesters - 1) * 4)) : task.key.startsWith('course:') ? termStart : task.isChapter && task.startsOn && task.dueDate ? isoDate(addDays(parseISO(task.startsOn), differenceInCalendarDays(parseISO(dueDate), parseISO(task.dueDate)))) : task.startsOn;
  return { ...task, dueDate, startsOn };
}
