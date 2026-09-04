import Papa from 'papaparse';
import type { GradeCsvResult, GradeCsvRow, Stage, SubmissionOverride, SubmissionStatus, TargetCsvRow, Tracker } from './types';

const TORONTO_TIME_ZONE = 'America/Toronto';

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

export function parseGradeCsv(file: File): Promise<GradeCsvResult> {
  return new Promise((resolve) => {
    if (file.size > 5 * 1024 * 1024) return resolve({ grades: [], preview: [], errors: ['File exceeds the 5 MB limit.'] });
    Papa.parse<GradeCsvRow>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: ({ data, meta, errors: parserErrors }) => {
        const errors = parserErrors.map((error) => `Row ${error.row ?? '?'}: ${error.message}`);
        const required = ['StudentID', 'Name', 'FinalGrade'];
        required.forEach((header) => { if (!meta.fields?.includes(header)) errors.push(`Missing required header: ${header}`); });
        if (data.length > 5000) errors.push('File exceeds the 5,000-row limit.');
        const seen = new Set<string>();
        const preview: GradeCsvResult['preview'] = [];
        const grades: number[] = [];
        data.slice(0, 5000).forEach((row, index) => {
          const rowNumber = index + 2;
          const studentId = String(row.StudentID ?? '').trim();
          const name = String(row.Name ?? '').trim();
          const gradeText = String(row.FinalGrade ?? '').trim();
          const grade = Number(gradeText);
          if (!studentId) errors.push(`Row ${rowNumber}: StudentID is required.`);
          else if (seen.has(studentId)) errors.push(`Row ${rowNumber}: duplicate StudentID.`);
          else seen.add(studentId);
          if (!name) errors.push(`Row ${rowNumber}: Name is required.`);
          if (!gradeText || !Number.isFinite(grade) || grade < 0 || grade > 100) errors.push(`Row ${rowNumber}: FinalGrade must be between 0 and 100.`);
          else {
            grades.push(grade);
            if (preview.length < 8) preview.push({ row: rowNumber, studentId, name, grade });
          }
        });
        resolve({ grades, preview, errors: [...new Set(errors)] });
      },
      error: (error) => resolve({ grades: [], preview: [], errors: [error.message] }),
    });
  });
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

export function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  const url = URL.createObjectURL(new Blob([createCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
