import Papa from 'papaparse';
import type { GradeCsvResult, GradeCsvRow, ImportantDate, ImportantDateDraft, ImportantDateSemester, ImportantDatesParseResult, Stage, SubmissionOverride, SubmissionStatus, TargetCsvRow, TermMetrics, Tracker } from './types';

const TORONTO_TIME_ZONE = 'America/Toronto';

export const GRADE_CSV_HEADERS = [
  'Semester ID',
  'Course Code',
  'Last Name',
  'First Name',
  'Student ID',
  'Final Grade (%)',
  'Final Letter Grade',
] as const;

const GRADE_CSV_DATA_HEADERS = [
  'Semester ID',
  'Course Code',
  'Last Name',
  'First Name',
  'Section',
  'Student ID',
  'Final Grade (%)',
  'Final Letter Grade',
] as const;

const EMPTY_GRADE_RESULT: GradeCsvResult = { grades: [], preview: [], errors: [] };

function normalizeGradeHeader(value: unknown) {
  return String(value ?? '').replace(/^\ufeff/, '').trim().replace(/\s+/g, ' ');
}

export interface InferredCourseCode {
  canonical: string;
  department: string;
  number: string;
  level: 'U' | 'G';
  title?: string;
}

export function inferCourseCode(value: string): InferredCourseCode | undefined {
  const source = String(value ?? '').trim();
  const match = /(^|[^A-Z0-9])([A-Z]{4})[\s-]*([0-9]{4})(?:[\s-]*([UG])(?=$|[^A-Z0-9]))?(?=$|[^A-Z0-9])/i.exec(source);
  if (!match) return undefined;
  const department = match[2].toUpperCase();
  const number = match[3];
  const level = (match[4]?.toUpperCase() || 'U') as 'U' | 'G';
  const title = source.slice((match.index ?? 0) + match[0].length).replace(/^[\s\-–—:|]+/, '').trim();
  return { canonical: `${department} ${number}${level}`, department, number, level, title: title || undefined };
}

export function normalizeCourseCode(value: string) {
  return inferCourseCode(value)?.canonical.replace(' ', '') ?? '';
}

export function inferAcademicTerm(value: unknown): string | undefined {
  const compact = String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const numericId = /^(\d{4})(\d{2})$/.exec(compact);
  if (numericId) {
    const month = Number(numericId[2]);
    const semester = month >= 1 && month <= 4 ? 'W' : month >= 5 && month <= 8 ? 'S' : month >= 9 && month <= 12 ? 'F' : undefined;
    return semester ? `${semester}${numericId[1].slice(-2)}` : undefined;
  }

  const namedTerm = /^(W|WINTER|F|FALL|AUTUMN|S|SPRING|SUMMER|SPRINGSUMMER)(\d{2}|\d{4})$/.exec(compact);
  if (!namedTerm) return undefined;
  const year = namedTerm[2];
  if (year.length === 4 && !year.startsWith('20')) return undefined;
  const semester = namedTerm[1] === 'W' || namedTerm[1] === 'WINTER'
    ? 'W'
    : namedTerm[1] === 'F' || namedTerm[1] === 'FALL' || namedTerm[1] === 'AUTUMN'
      ? 'F'
      : 'S';
  return `${semester}${year.slice(-2)}`;
}

export function importantDatesForTerm(dates: ImportantDate[], termCode: string) {
  const match = /^([FWS])(\d{2})$/.exec(termCode.trim().toUpperCase());
  if (!match) return [];

  const calendarYear = 2000 + Number(match[2]);
  const academicYearStart = match[1] === 'F' ? calendarYear : calendarYear - 1;
  const academicYear = `${academicYearStart}-${String((academicYearStart + 1) % 100).padStart(2, '0')}`;
  const semester: ImportantDateSemester = match[1] === 'F' ? 'Fall' : match[1] === 'W' ? 'Winter' : 'Spring/Summer';

  return dates
    .filter((date) => date.academicYear === academicYear && date.semester === semester)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.sortOrder - b.sortOrder || a.shortName.localeCompare(b.shortName));
}

export function normalizeStageLinkUrl(value: string) {
  const raw = value.trim();
  if (!raw) throw new Error('Enter a URL.');
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new Error('Enter a valid URL including https:// or http://.'); }
  if (!['https:','http:'].includes(parsed.protocol)) throw new Error('Only http:// and https:// links are supported.');
  if (parsed.username || parsed.password) throw new Error('Links containing embedded usernames or passwords are not supported.');
  if (parsed.href.length > 2048) throw new Error('The URL cannot exceed 2,048 characters.');
  return parsed.href;
}

export function courseCodesMatch(left: string, right: string) {
  const leftCode = normalizeCourseCode(left);
  const rightCode = normalizeCourseCode(right);
  return Boolean(leftCode && rightCode && leftCode === rightCode);
}

export function findCourseByCode<T extends { code: string }>(uploadedCode: string, courses: T[]): T | undefined {
  const normalized = normalizeCourseCode(uploadedCode);
  const matches = courses.filter((course) => normalizeCourseCode(course.code) === normalized);
  return matches.length === 1 ? matches[0] : undefined;
}

function parseGradeRows(headers: string[], rows: Array<{ row: number; values: Record<string, unknown> }>, initialErrors: string[] = []): GradeCsvResult {
  const errors = [...initialErrors];
  const fields = new Set(headers.map(normalizeGradeHeader));
  GRADE_CSV_HEADERS.filter((header) => header !== 'First Name').forEach((header) => {
    if (!fields.has(header)) errors.push(`Missing required header: ${header}`);
  });
  if (!fields.has('First Name') && !fields.has('Section')) errors.push('Missing required header: First Name or Section');

  const populatedRows = rows.filter(({ values }) => GRADE_CSV_DATA_HEADERS.some((header) => String(values[header] ?? '').trim()));
  if (!populatedRows.length) errors.push('No grade rows were found.');
  if (populatedRows.length > 5000) errors.push('File exceeds the 5,000-row limit.');

  const seen = new Set<string>();
  const courseCodes = new Map<string, string>();
  const semesterIds = new Map<string, string>();
  const preview: GradeCsvResult['preview'] = [];
  const grades: number[] = [];
  populatedRows.slice(0, 5000).forEach(({ row: rowNumber, values }) => {
    const semesterId = String(values['Semester ID'] ?? '').trim();
    const courseCode = String(values['Course Code'] ?? '').trim().replace(/\s+/g, ' ');
    const studentId = String(values['Student ID'] ?? '').trim();
    const name = String(values['Last Name'] ?? '').trim();
    const gradeText = String(values['Final Grade (%)'] ?? '').trim();
    const grade = Number(gradeText);
    const inferredTerm = inferAcademicTerm(semesterId);
    if (!semesterId) errors.push(`Row ${rowNumber}: Semester ID is required.`);
    else if (!inferredTerm) errors.push(`Row ${rowNumber}: Semester ID must identify Fall, Winter, or Spring/Summer and a two- or four-digit year.`);
    else semesterIds.set(inferredTerm, inferredTerm);
    const inferredCourse = inferCourseCode(courseCode);
    if (!courseCode) errors.push(`Row ${rowNumber}: Course Code is required.`);
    else if (!inferredCourse) errors.push(`Row ${rowNumber}: Course Code must contain four letters followed by four numbers and an optional U or G.`);
    else courseCodes.set(inferredCourse.canonical, courseCode);
    if (!studentId) errors.push(`Row ${rowNumber}: Student ID is required.`);
    else if (seen.has(studentId)) errors.push(`Row ${rowNumber}: duplicate Student ID.`);
    else seen.add(studentId);
    if (!name) errors.push(`Row ${rowNumber}: Last Name is required.`);
    if (!gradeText || !Number.isFinite(grade) || grade < 0 || grade > 100) errors.push(`Row ${rowNumber}: Final Grade (%) must be between 0 and 100.`);
    else {
      grades.push(grade);
      if (preview.length < 8) preview.push({ row: rowNumber, studentId, name, grade });
    }
  });

  if (courseCodes.size > 1) errors.push('The grade file contains multiple Course Code values. Upload one course per file.');
  if (semesterIds.size > 1) errors.push('The grade file contains multiple Semester ID values. Upload one semester per file.');

  return {
    grades,
    preview,
    errors: [...new Set(errors)],
    courseCode: courseCodes.size === 1 ? [...courseCodes.keys()][0] : undefined,
    courseTitle: courseCodes.size === 1 ? inferCourseCode([...courseCodes.values()][0])?.title : undefined,
    semesterId: semesterIds.size === 1 ? [...semesterIds.values()][0] : undefined,
  };
}

function dateKeyInToronto(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TORONTO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function calendarDay(value: string) {
  return Date.parse(`${value.slice(0, 10)}T00:00:00Z`) / 86_400_000;
}

function differenceInTorontoCalendarDays(date: string, today: Date) {
  return calendarDay(date) - calendarDay(dateKeyInToronto(today));
}

export function stageVisualStatus(stage: Stage, today = new Date()): Stage['status'] | 'overdue' {
  if (stage.status === 'completed' || stage.status === 'skipped') return stage.status;
  return differenceInTorontoCalendarDays(stage.dueDate, today) < 0 ? 'overdue' : stage.status;
}

export function trackerSummary(tracker: Tracker, today = new Date()) {
  const required = tracker.stages.filter((stage) => stage.isRequired);
  const completed = required.filter((stage) => stage.status === 'completed').length;
  const overdue = required.some((stage) => stageVisualStatus(stage, today) === 'overdue');
  return {
    completed,
    required: required.length,
    progress: required.length ? Math.round((completed / required.length) * 100) : 0,
    status: completed === required.length ? 'Completed' : overdue ? 'Attention Required' : 'In Progress',
  } as const;
}

export function dashboardMetrics(trackers: Tracker[], today = new Date()) {
  const stages = trackers.flatMap((tracker) => tracker.stages);
  return {
    active: trackers.filter((tracker) => trackerSummary(tracker, today).status !== 'Completed').length,
    overdue: stages.filter((stage) => stageVisualStatus(stage, today) === 'overdue').length,
    upcoming: stages.filter((stage) => {
      const days = differenceInTorontoCalendarDays(stage.dueDate, today);
      return days >= 0 && days <= 14 && !['completed', 'skipped'].includes(stage.status);
    }).length,
    completed: stages.filter((stage) => stage.status === 'completed').length,
  };
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export function gradeMetrics(grades: number[]) {
  const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  let passed = 0;
  let sum = 0;
  grades.forEach((grade) => {
    sum += grade;
    if (grade >= 50) passed += 1;
    if (grade >= 80) distribution.A += 1;
    else if (grade >= 70) distribution.B += 1;
    else if (grade >= 60) distribution.C += 1;
    else if (grade >= 50) distribution.D += 1;
    else distribution.F += 1;
  });
  if (!grades.length) return { average: 0, passRate: 0, enrolled: 0, distribution };
  return {
    average: Number((sum / grades.length).toFixed(1)),
    passRate: Number(((passed / grades.length) * 100).toFixed(1)),
    enrolled: grades.length,
    distribution,
  };
}

export function failureRate(metrics: Pick<TermMetrics, 'enrolled' | 'distribution'>) {
  if (!metrics.enrolled) return 0;
  return Number(((metrics.distribution.F / metrics.enrolled) * 100).toFixed(1));
}

export function parseGradeCsv(file: File): Promise<GradeCsvResult> {
  return new Promise((resolve) => {
    if (file.size > 5 * 1024 * 1024) return resolve({ grades: [], preview: [], errors: ['File exceeds the 5 MB limit.'] });
    Papa.parse<GradeCsvRow>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: normalizeGradeHeader,
      complete: ({ data, meta, errors: parserErrors }) => {
        const errors = parserErrors.map((error) => `Row ${error.row ?? '?'}: ${error.message}`);
        resolve(parseGradeRows(meta.fields ?? [], data.map((values, index) => ({ row: index + 2, values })), errors));
      },
      error: (error) => resolve({ grades: [], preview: [], errors: [error.message] }),
    });
  });
}

export function parseGradeWorksheet(rows: unknown[][]): GradeCsvResult {
  if (!rows.length) return { ...EMPTY_GRADE_RESULT, errors: ['The first worksheet is empty.'] };
  const headers = rows[0].map(normalizeGradeHeader);
  const data = rows.slice(1).map((row, index) => ({
    row: index + 2,
    values: Object.fromEntries(headers.map((header, column) => [header, row[column]])),
  }));
  return parseGradeRows(headers, data);
}

export async function parseGradeFile(file: File): Promise<GradeCsvResult> {
  if (file.size > 5 * 1024 * 1024) return { ...EMPTY_GRADE_RESULT, errors: ['File exceeds the 5 MB limit.'] };
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension === 'csv') return parseGradeCsv(file);
  if (extension !== 'xlsx') return { ...EMPTY_GRADE_RESULT, errors: ['Only .csv and .xlsx grade files are supported.'] };

  try {
    const { readSheet } = await import('read-excel-file/browser');
    return parseGradeWorksheet(await readSheet(file) as unknown[][]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown workbook error';
    return { ...EMPTY_GRADE_RESULT, errors: [`Could not read Excel file: ${message}`] };
  }
}

const IMPORTANT_DATE_SEMESTERS: Record<string, ImportantDateSemester> = {
  'fall semester': 'Fall',
  'winter semester': 'Winter',
  'spring/summer semester': 'Spring/Summer',
};

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function isoDate(year: number, month: number, day: number) {
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() !== month - 1 || value.getUTCDate() !== day) return undefined;
  return value.toISOString().slice(0, 10);
}

function parseImportantDateRange(value: unknown): { startsOn: string; endsOn: string } | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const date = value.toISOString().slice(0, 10);
    return { startsOn: date, endsOn: date };
  }
  const text = String(value ?? '').trim().replace(/[–—]/g, ' to ').replace(/\s+/g, ' ');
  let match = /^([A-Za-z]+) (\d{1,2}) to (\d{1,2}), (\d{4})$/.exec(text);
  if (match) {
    const month = MONTHS[match[1].toLowerCase()];
    const startsOn = month && isoDate(Number(match[4]), month, Number(match[2]));
    const endsOn = month && isoDate(Number(match[4]), month, Number(match[3]));
    return startsOn && endsOn ? { startsOn, endsOn } : undefined;
  }
  match = /^([A-Za-z]+) (\d{1,2}), (\d{4}) to ([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(text);
  if (match) {
    const firstMonth = MONTHS[match[1].toLowerCase()];
    const secondMonth = MONTHS[match[4].toLowerCase()];
    const startsOn = firstMonth && isoDate(Number(match[3]), firstMonth, Number(match[2]));
    const endsOn = secondMonth && isoDate(Number(match[6]), secondMonth, Number(match[5]));
    return startsOn && endsOn ? { startsOn, endsOn } : undefined;
  }
  match = /^([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(text);
  if (match) {
    const month = MONTHS[match[1].toLowerCase()];
    const date = month && isoDate(Number(match[3]), month, Number(match[2]));
    return date ? { startsOn: date, endsOn: date } : undefined;
  }
  return undefined;
}

function sessionLabel(description: string, fallback: ImportantDateSemester) {
  const value = description.toLowerCase();
  if (value.includes('six-week spring')) return 'Spring Six-Week';
  if (value.includes('six-week summer')) return 'Summer Six-Week';
  if (value.includes('12-week summer')) return 'Summer 12-Week';
  if (value.includes('bachelor of education')) return 'BEd';
  if (value.includes('fall')) return 'Fall';
  if (value.includes('winter')) return 'Winter';
  if (value.includes('spring')) return 'Spring';
  if (value.includes('summer')) return 'Summer';
  return fallback;
}

export function makeImportantDateShortName(description: string, semester: ImportantDateSemester): string {
  const text = description.trim();
  const lower = text.toLowerCase();
  const session = sessionLabel(text, semester);
  if (lower.includes('readmission or change of program')) return 'Readmission / Program Change Deadline';
  if (lower.includes('application for graduation')) return `${session} Graduation Application Deadline`;
  if (lower.includes('academic standing released')) return `${session} Academic Standing Released`;
  if (lower.includes('grades released')) return `${session} Grades Released`;
  if (lower.includes('final examination period')) return `${session} Final Examinations`;
  if (lower.includes('orientation')) return `${session} Orientation`;
  if (lower.includes('convocation')) return `${session} Convocation`;
  if (lower.includes('100 per cent refund')) return `${session} 100% Refund Deadline`;
  if (lower.includes('50 per cent refund')) return `${session} 50% Refund Deadline`;
  if (lower.includes('without academic consequences')) return `${session} Withdrawal Without Penalty`;
  if (lower.startsWith('last day to withdraw')) return `${session} Withdrawal Deadline`;
  if (lower.includes('last day to add') || lower.includes('regular registration period')) return `${session} Course Add Deadline`;
  if (lower.includes('fees due')) return `${session} Fees Due`;
  if (lower.includes('lectures begin')) return `${session} Lectures Begin`;
  if (lower.includes('lectures resume')) return `${session} Lectures Resume`;
  if (lower.includes('lectures end')) return `${session} Lectures End`;
  if (lower.includes('study week')) return `${session} Study Week`;
  if (lower.includes('study break')) return `${session} Study Break`;
  if (lower.includes('university closed')) return 'University Closed';
  if (lower.includes('university reopens')) return 'University Reopens';
  const firstClause = text.split(/[.;]/)[0].replace(/^(last day to|start date,?)\s*/i, '').trim();
  const words = firstClause.split(/\s+/).slice(0, 7).join(' ');
  return words.length > 64 ? `${words.slice(0, 61).trim()}…` : words;
}

export function parseImportantDatesWorksheet(rows: unknown[][]): ImportantDatesParseResult {
  const parsed: ImportantDateDraft[] = [];
  const errors: string[] = [];
  let semester: ImportantDateSemester | undefined;
  let currentRange: { startsOn: string; endsOn: string } | undefined;
  rows.forEach((row, index) => {
    const first = row[0];
    const description = String(row[1] ?? '').trim().replace(/\s+/g, ' ');
    const heading = IMPORTANT_DATE_SEMESTERS[String(first ?? '').trim().toLowerCase()];
    if (heading && !description) { semester = heading; currentRange = undefined; return; }
    if (!description && !String(first ?? '').trim()) return;
    if (!semester) { errors.push(`Row ${index + 1}: add a semester heading before important dates.`); return; }
    if (first !== null && first !== undefined && String(first).trim()) {
      const range = parseImportantDateRange(first);
      if (!range) { errors.push(`Row ${index + 1}: could not read date or date range "${String(first).trim()}".`); return; }
      currentRange = range;
    }
    if (!description) { errors.push(`Row ${index + 1}: description is required.`); return; }
    if (!currentRange) { errors.push(`Row ${index + 1}: a continuation row needs a preceding date.`); return; }
    parsed.push({ semester, ...currentRange, shortName: makeImportantDateShortName(description, semester), description, sortOrder: parsed.length + 1 });
  });
  if (!parsed.length) errors.push('No important dates were found on the first worksheet.');
  return { rows: parsed, errors: [...new Set(errors)] };
}

export async function parseImportantDatesFile(file: File): Promise<ImportantDatesParseResult> {
  if (file.size > 5 * 1024 * 1024) return { rows: [], errors: ['File exceeds the 5 MB limit.'] };
  if (!file.name.toLowerCase().endsWith('.xlsx')) return { rows: [], errors: ['Only .xlsx important-date files are supported.'] };
  try {
    const { readSheet } = await import('read-excel-file/browser');
    return parseImportantDatesWorksheet(await readSheet(file) as unknown[][]);
  } catch (error) {
    return { rows: [], errors: [`Could not read Excel file: ${error instanceof Error ? error.message : 'Unknown workbook error'}`] };
  }
}

export function parseTargetCsv(file: File): Promise<{ rows: TargetCsvRow[]; errors: string[] }> {
  return new Promise((resolve) => {
    if (file.size > 2 * 1024 * 1024) return resolve({ rows: [], errors: ['File exceeds the 2 MB target-list limit.'] });
    Papa.parse<TargetCsvRow>(file, { header: true, skipEmptyLines: 'greedy', complete: ({ data, meta, errors }) => {
      const required = ['CourseCode', 'CourseTitle', 'Instructor', 'Department'];
      const messages = errors.map((e) => e.message);
      required.forEach((header) => { if (!meta.fields?.includes(header)) messages.push(`Missing required header: ${header}`); });
      const rows = data.map((row) => ({ ...row, CourseCode: String(row.CourseCode ?? '').trim().toUpperCase() })).filter((row) => row.CourseCode);
      if (!rows.length) messages.push('No target courses were found.');
      resolve({ rows, errors: [...new Set(messages)] });
    }, error: (error) => resolve({ rows: [], errors: [error.message] }) });
  });
}

export function effectiveSubmission(autoSubmitted: boolean, override?: SubmissionOverride): SubmissionStatus {
  return override?.value ?? (autoSubmitted ? 'submitted' : 'outstanding');
}

export function createCsv(rows: Array<Record<string, string | number>>) {
  return `\ufeff${Papa.unparse(rows, { quotes: true })}`;
}

export function gradeTemplateRows(termCode: string) {
  return [{
    'Semester ID': termCode,
    'Course Code': '',
    'Last Name': '',
    Section: '',
    'Student ID': '',
    'Final Grade (%)': '',
    'Final Letter Grade': '',
  }];
}

export function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  const url = URL.createObjectURL(new Blob([createCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
