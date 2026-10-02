import { addDays, addMonths, addYears, format, parseISO } from 'date-fns';
import type { Profile } from './types';

export type Semester = 'Fall' | 'Winter' | 'Summer';
export type TaskOwner = 'Student / Supervisor' | 'Program Office / GPA' | 'SGPS';
export const graduateItemTypes = ['Form', 'Report', 'Research Paper', 'Thesis', 'Meeting', 'Course', 'Milestone'] as const;
export type GraduateItemType = typeof graduateItemTypes[number];
export interface GraduateStudent {
  id: string;
  student_number: string;
  student_name: string;
  email: string;
  supervisor_name: string;
  supervisor_id: string | null;
  co_supervisor_id?: string | null;
  co_supervisor_name?: string;
  organization_unit_id: string | null;
  start_date: string;
  defence_date: string | null;
  thesis_submission_date?: string | null;
  committee_members?: string[];
  committee_chair?: string;
  university_examiner?: string;
  revision_type: 'minor' | 'major';
  completed_on: string | null;
  notes: string;
  created_by: string;
}
export type GraduateDraft = Omit<GraduateStudent, 'id' | 'created_by'>;
export interface GraduateTaskRecord {
  is_deleted?: boolean;
  student_id: string;
  task_key: string;
  completed_on: string | null;
  notes: string;
  expected_on?: string | null;
  is_draft?: boolean;
  planned_start_on?: string | null;
  item_type?: GraduateItemType | null;
  course_semester_start?: string | null;
}
export interface GraduateCategory {
  is_deleted?: boolean;
  student_id: string;
  key: string;
  name: string;
  color: string;
  sort_order: number;
}
export interface GraduateDeadline {
  is_deleted?: boolean;
  funding_kind?: 'GRA' | 'RA' | null;
  grant_name?: string | null;
  amount?: number | null;
  starts_on?: string | null;
  id: string;
  student_id: string;
  category_key: string;
  title: string;
  due_date: string;
  item_type?: GraduateItemType;
}
export interface GraduateTrackerLink { student_id: string; tracker_id: string }
export const defaultGraduateCategories = (studentId: string): GraduateCategory[] => [
  { key: 'reports', name: 'Semester research progress reports', color: '#2563eb' },
  { key: 'courses', name: 'Coursework', color: '#7c3aed' },
  { key: 'thesis-planning', name: 'Thesis/Defence planning', color: '#0d9488' },
  { key: 'committee', name: 'Supervisory Committee', color: '#b45309' },
  { key: 'funding', name: 'Funding', color: '#15803d' },
].map((category, index) => ({ ...category, student_id: studentId, sort_order: index }));

export interface GraduateSection extends GraduateCategory { tasks: GraduateTask[] }
export interface GraduateTask {
  key: string;
  title: string;
  owner: TaskOwner;
  dueDate: string | null;
  startsOn?: string;
  timing: string;
  categoryKey?: string;
  suggestedDate?: string;
  editableDate?: boolean;
  isChapter?: boolean;
  fundingSemesters?: number;
  itemType?: GraduateItemType;
}
export function graduateItemType(task: GraduateTask): GraduateItemType {
  if (task.itemType) return task.itemType;
  if (task.key.startsWith('form-')) return 'Form';
  if (task.key.startsWith('report:') || task.key.endsWith('-report')) return 'Report';
  if (task.isChapter || ['thesis-office', 'final-thesis', 'planning:submission'].includes(task.key)) return 'Thesis';
  if (task.key.startsWith('committee:') || ['oral-exam', 'planning:defence'].includes(task.key)) return 'Meeting';
  if (task.key.startsWith('course:')) return 'Course';
  return 'Milestone';
}
export const graduateSectionId = (studentId: string, key: string) => `graduate-${studentId}-${key}`;
export const graduateShortName = (section: GraduateCategory) => ({ reports: 'Reports', courses: 'Courses', 'thesis-planning': 'Thesis/Defence', committee: 'Committee' }[section.key] ?? section.name);
export const isoDate = (date: Date) => format(date, 'yyyy-MM-dd');
export const todayDate = () => isoDate(new Date());
export const graduateError = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String(error.message) : 'The change could not be saved.';
export const displayDate = (date: string) => format(parseISO(date), 'MMM d, yyyy');
export const semesterForDate = (date: string): Semester => Number(date.slice(5, 7)) >= 9 ? 'Fall' : Number(date.slice(5, 7)) >= 5 ? 'Summer' : 'Winter';
export const semesterStart = (semester: Semester, year: number) => `${year}-${semester === 'Fall' ? '09' : semester === 'Winter' ? '01' : '05'}-01`;
export const completionDates = (start: string) => ({ target: isoDate(addYears(parseISO(start), 2)), maximum: isoDate(addYears(parseISO(start), 3)) });
export const suggestedDefenceDate = (start: string) => isoDate(addMonths(parseISO(start), 23));
export const thesisSubmissionDate = (student: GraduateStudent) => student.thesis_submission_date ?? (student.defence_date ? isoDate(addDays(parseISO(student.defence_date), -35)) : null);
export const semesterEnd = (start: string) => isoDate(addDays(addMonths(parseISO(start), 4), -1));
export const availableCourseRequirements = (studentId: string, records: GraduateTaskRecord[]) => [1, 2, 3, 4, 5].filter(number => !records.some(record => !record.is_deleted && record.student_id === studentId && record.task_key === `course:${number}` && (record.course_semester_start || record.expected_on || record.completed_on)));
export const fundingDates = (start: string, semesters: number) => ({ end: isoDate(addDays(addMonths(parseISO(start), semesters * 4), -1)), form: isoDate(addMonths(parseISO(start), -1)) });
export const fundingSemesterCount = (start: string, end: string) => Math.round(((Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(end.slice(5, 7)) - Number(start.slice(5, 7)) + 1) / 4);
export const committeeNames = (student: GraduateStudent) => [student.supervisor_name, student.co_supervisor_name, ...(student.committee_members ?? [])].filter((name): name is string => Boolean(name?.trim()));
export function committeeReadiness(student: GraduateStudent) {
  const supervisors = [student.supervisor_name, student.co_supervisor_name].filter(Boolean).map(name => name!.trim().toLowerCase());
  const hasAdditionalMember = (student.committee_members ?? []).some(name => name.trim() && !supervisors.includes(name.trim().toLowerCase()));
  return { hasAdditionalMember, hasChair: Boolean(student.committee_chair && committeeNames(student).includes(student.committee_chair)), hasExaminer: Boolean(student.university_examiner?.trim()) };
}
export const canCreateGraduate = (profile: Profile | null) => Boolean(profile?.isActive && ['dean', 'academic_director', 'chair', 'program_lead', 'graduate_supervisor', 'research_lead'].includes(profile.role));

// Report keys use semester dates, so defence rescheduling never changes report history.
export function researchReports(student: GraduateStudent, today = todayDate()): GraduateTask[] {
  const start = parseISO(student.start_date);
  const maximum = completionDates(student.start_date).maximum;
  const end = student.completed_on ?? (today >= maximum ? today : isoDate(addDays(parseISO(maximum), -1)));
  const reports: GraduateTask[] = [];
  for (let index = 0; ; index++) {
    const term = addMonths(start, index * 4);
    const startsOn = isoDate(term);
    if (startsOn > end) break;
    reports.push({ key: `report:${startsOn}`, title: `${semesterForDate(startsOn)} ${term.getFullYear()}`, owner: 'Student / Supervisor', startsOn, dueDate: isoDate(addDays(addMonths(term, 4), -1)), timing: 'Required by semester end' });
  }
  return reports;
}

export function defenceTasks(student: GraduateStudent): GraduateTask[] {
  const due = (days: number) => student.defence_date ? isoDate(addDays(parseISO(student.defence_date), days)) : null;
  return [
    { key: 'form-office', title: 'Submit Form 2.2M to program office', owner: 'Student / Supervisor', dueDate: due(-42), timing: '6 weeks before defence' },
    { key: 'form-sgps', title: 'Submit Form 2.2M to SGPS with confirmed defence date', owner: 'Program Office / GPA', dueDate: due(-35), timing: '5 weeks before defence' },
    { key: 'thesis-office', title: 'Submit thesis to program office', owner: 'Student / Supervisor', dueDate: thesisSubmissionDate(student), timing: student.thesis_submission_date ? 'Manually scheduled submission' : '5 weeks before defence' },
    { key: 'distribute-thesis', title: 'Distribute thesis to examining committee and SGPS', owner: 'Program Office / GPA', dueDate: due(-28), timing: '4 weeks before defence' },
    { key: 'examiner-report', title: 'Approve and distribute examiner’s report to examining committee', owner: 'SGPS', dueDate: due(-7), timing: '1 week before defence' },
    { key: 'oral-exam', title: 'Oral examination', owner: 'Student / Supervisor', dueDate: due(0), timing: 'Defence date' },
    { key: 'chair-report', title: 'Chair’s report due', owner: 'Program Office / GPA', dueDate: due(7), timing: '1 week after defence' },
    { key: 'final-thesis', title: 'Submit final thesis package to SGPS', owner: 'Student / Supervisor', dueDate: student.revision_type === 'major' && student.defence_date ? isoDate(addMonths(parseISO(student.defence_date), 6)) : due(28), timing: student.revision_type === 'major' ? 'Within 6 calendar months · major revisions' : 'Within 4 weeks · minor revisions' },
  ];
}

export function taskStatus(task: GraduateTask, record?: GraduateTaskRecord, today = todayDate()) {
  if (record?.completed_on) return task.dueDate && record.completed_on > task.dueDate ? 'Completed late' : 'Completed';
  if (record?.is_draft) return task.dueDate && task.dueDate < today ? 'Draft · overdue' : 'Draft';
  if (!task.dueDate) return task.key.startsWith('course:') ? 'Not scheduled' : 'Awaiting defence date';
  if (task.dueDate < today) return 'Overdue';
  if (task.dueDate === today) return 'Due today';
  if (task.dueDate <= isoDate(addDays(parseISO(today), 30))) return 'Due soon';
  return 'Upcoming';
}

export function graduateSections(student: GraduateStudent, categories: GraduateCategory[], deadlines: GraduateDeadline[], records: GraduateTaskRecord[], today = todayDate()): GraduateSection[] {
  const saved = categories.filter(category => category.student_id === student.id && !['student', 'office', 'sgps'].includes(category.key));
  const defaults = defaultGraduateCategories(student.id);
  const definitions = [...defaults.map(category => saved.find(item => item.key === category.key) ?? category), ...saved.filter(category => !defaults.some(item => item.key === category.key))];
  const courses: GraduateTask[] = Array.from({ length: 5 }, (_, index) => {
    const key = `course:${index + 1}`;
    const record = records.find(record => record.student_id === student.id && record.task_key === key);
    const startsOn = record?.course_semester_start ?? undefined;
    return { key, title: `Course requirement ${index + 1}`, owner: 'Student / Supervisor', startsOn, dueDate: startsOn ? semesterEnd(startsOn) : record?.expected_on ?? null, editableDate: true, timing: startsOn ? `${semesterForDate(startsOn)} ${startsOn.slice(0, 4)} · Full semester` : 'Assign a semester to plan this course' };
  });
  const defence = defenceTasks(student);
  return definitions.filter(category => !category.is_deleted).sort((a, b) => a.sort_order - b.sort_order).map(category => {
    const builtIn = category.key === 'reports' ? researchReports(student, today) : category.key === 'courses' ? courses : category.key === 'thesis-planning' ? [...thesisPlanningTasks(student, records), ...defence.filter(task => task.owner === 'Student / Supervisor')] : category.key === 'committee' ? committeeTasks(student, today) : [];
    const custom = deadlines.filter(deadline => !deadline.is_deleted && deadline.student_id === student.id && (deadline.category_key === category.key || deadline.category_key === 'student' && category.key === 'thesis-planning')).flatMap((deadline): GraduateTask[] => {
      const funding = Boolean(deadline.funding_kind && deadline.starts_on);
      const main: GraduateTask = { key: `custom:${deadline.id}`, title: deadline.title, owner: 'Student / Supervisor', dueDate: deadline.due_date, itemType: deadline.item_type ?? 'Milestone', timing: funding ? `${deadline.funding_kind} · ${deadline.grant_name} · ${new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(deadline.amount ?? 0)} CAD total` : 'Custom deadline', ...(funding ? { startsOn: deadline.starts_on!, fundingSemesters: fundingSemesterCount(deadline.starts_on!, deadline.due_date) } : {}) };
      return funding ? [main, { key: `funding-form:${deadline.id}`, title: `Submit ${deadline.funding_kind} form: ${deadline.grant_name}`, owner: 'Student / Supervisor', dueDate: fundingDates(deadline.starts_on!, 1).form, itemType: 'Form', timing: 'Required one month before funding starts' }] : [main];
    });
    return { ...category, tasks: [...builtIn, ...custom].filter(task => !records.some(record => record.student_id === student.id && record.task_key === task.key && record.is_deleted)).map(task => ({ ...task, categoryKey: category.key, itemType: records.find(record => record.student_id === student.id && record.task_key === task.key)?.item_type ?? task.itemType ?? graduateItemType(task) })) };
  });
}

export function thesisPlanningTasks(student: GraduateStudent, records: GraduateTaskRecord[] = []): GraduateTask[] {
  const start = parseISO(student.start_date);
  const defence = parseISO(student.defence_date ?? suggestedDefenceDate(student.start_date));
  const submission = student.thesis_submission_date ? parseISO(student.thesis_submission_date) : addDays(defence, -35);
  const chapter = (key: string, title: string, suggested: Date, timing: string): GraduateTask => {
    const record = records.find(record => record.student_id === student.id && record.task_key === key);
    const dueDate = record?.expected_on ?? isoDate(suggested);
    return { key, title, owner: 'Student / Supervisor', dueDate, startsOn: record?.planned_start_on ?? isoDate(addMonths(parseISO(dueDate), -1)), suggestedDate: isoDate(suggested), editableDate: true, isChapter: true, timing };
  };
  return [
    chapter('chapter:literature', 'Literature Review', addDays(addMonths(start, 4), -1), 'Suggested draft by end of semester one · 1 month writing'),
    chapter('chapter:introduction', 'Introduction', addYears(start, 1), 'Suggested draft by start of year two · 1 month writing'),
    chapter('chapter:methodology', 'Methodology', addMonths(submission, -2), 'Suggested draft before Results · 1 month writing'),
    chapter('chapter:results', 'Results', addMonths(submission, -1), 'Suggested draft after Methodology; dates may overlap · 1 month writing'),
    chapter('chapter:discussion', 'Discussion/Conclusions', submission, 'Final month before thesis submission · 1 month writing'),
    { key: 'planning:defence', title: 'Plan defence date and examining committee with supervisor', owner: 'Student / Supervisor', dueDate: isoDate(addDays(defence, -56)), timing: 'Suggested · 8 weeks before defence' },
    { key: 'planning:submission', title: 'Thesis ready for submission', owner: 'Student / Supervisor', dueDate: isoDate(submission), timing: student.thesis_submission_date ? 'Planning checkpoint · updated submission date' : 'Planning checkpoint · 5 weeks before defence' },
  ];
}

export function committeeTasks(student: GraduateStudent, today = todayDate()): GraduateTask[] {
  return [
    { key: 'committee:formation', title: 'Forming Supervisory Committee', owner: 'Student / Supervisor', dueDate: isoDate(addMonths(parseISO(student.start_date), 8)), timing: 'Required within the first 8 months' },
    ...researchReports(student, today).map(report => ({ ...report, key: report.key.replace('report:', 'committee:meeting:'), title: `${report.title} committee meeting`, timing: 'Required each semester · suggested meeting at semester end' })),
  ];
}

export function timelineSemesters(from: string, to: string) {
  const blocks: Array<{ start: string; end: string; name: string; semester: Semester }> = [];
  let date = parseISO(semesterStart(semesterForDate(from), Number(from.slice(0, 4))));
  while (isoDate(date) < to) {
    const next = addMonths(date, 4);
    const semester = semesterForDate(isoDate(date));
    blocks.push({ start: isoDate(date), end: isoDate(next), name: `${semester} ${date.getFullYear()}`, semester });
    date = next;
  }
  return blocks;
}

export function coursesCompleted(records: GraduateTaskRecord[], studentId: string) {
  return new Set(records.filter(record => !record.is_deleted && record.student_id === studentId && /^course:[1-5]$/.test(record.task_key) && record.completed_on).map(record => record.task_key)).size;
}

export function programmeStatus(student: GraduateStudent, today = todayDate()) {
  if (student.completed_on) return 'Completed';
  const { target, maximum } = completionDates(student.start_date);
  if (today > maximum) return 'Past maximum';
  if (today === maximum) return 'Maximum due today';
  if (today > target) return 'Past target';
  if (today === target) return 'Target due today';
  if (today < student.start_date) return 'Not started';
  return 'Within target';
}
