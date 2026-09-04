import { describe, expect, it } from 'vitest';
import {
  createCsv,
  dashboardMetrics,
  effectiveSubmission,
  gradeMetrics,
  parseGradeCsv,
  parseTargetCsv,
  stageVisualStatus,
  trackerSummary,
} from '../src/lib/domain';
import type { Stage, Tracker } from '../src/lib/types';

const tracker: Tracker = {
  id: 't', title: 'Test', type: 'general', category: 'Academic', description: '', createdAt: '2026-01-01',
  stages: [
    { id: 's1', title: 'Done', description: '', dueDate: '2026-01-01', isRequired: true, status: 'completed', sortOrder: 1, documents: [] },
    { id: 's2', title: 'Late', description: '', dueDate: '2026-01-02', isRequired: true, status: 'pending', sortOrder: 2, documents: [] },
    { id: 's3', title: 'Optional', description: '', dueDate: '2026-01-03', isRequired: false, status: 'skipped', sortOrder: 3, documents: [] },
  ],
};

const csvFile = (text: string, name = 'grades.csv') => new File([text], name, { type: 'text/csv' });

describe('tracker calculations', () => {
  it('derives mandatory progress and attention state', () => {
    expect(trackerSummary(tracker, new Date('2026-02-01T17:00:00Z'))).toEqual({ completed: 1, required: 2, progress: 50, status: 'Attention Required' });
  });

  it('counts only incomplete deadlines in the next 14 Toronto calendar days', () => {
    const stages: Stage[] = [
      { id: 'a', title: 'Today', description: '', dueDate: '2026-02-01', isRequired: true, status: 'pending', sortOrder: 1, documents: [] },
      { id: 'b', title: 'Boundary', description: '', dueDate: '2026-02-15', isRequired: true, status: 'pending', sortOrder: 2, documents: [] },
      { id: 'c', title: 'Too far', description: '', dueDate: '2026-02-16', isRequired: true, status: 'pending', sortOrder: 3, documents: [] },
      { id: 'd', title: 'Complete', description: '', dueDate: '2026-02-02', isRequired: true, status: 'completed', sortOrder: 4, documents: [] },
    ];
    expect(dashboardMetrics([{ ...tracker, stages }], new Date('2026-02-01T17:00:00Z')).upcoming).toBe(2);
  });

  it('uses America/Toronto when deciding whether a date is overdue', () => {
    const stage = { ...tracker.stages[1], dueDate: '2026-02-01' };
    expect(stageVisualStatus(stage, new Date('2026-02-02T04:30:00Z'))).toBe('pending');
    expect(stageVisualStatus(stage, new Date('2026-02-02T05:30:00Z'))).toBe('overdue');
  });
});

describe('grade calculations and CSV privacy gate', () => {
  it('calculates grade-band boundaries and handles an empty set', () => {
    expect(gradeMetrics([80, 70, 60, 50, 49])).toEqual({ average: 61.8, passRate: 80, enrolled: 5, distribution: { A: 1, B: 1, C: 1, D: 1, F: 1 } });
    expect(gradeMetrics([])).toEqual({ average: 0, passRate: 0, enrolled: 0, distribution: { A: 0, B: 0, C: 0, D: 0, F: 0 } });
  });

  it('parses quoted fields, permits extra columns, and returns ordered numeric grades', async () => {
    const result = await parseGradeCsv(csvFile('StudentID,Name,FinalGrade,Section\n1001,"Doe, Jane",92.5,A\n1002,John Roe,71,B'));
    expect(result.errors).toEqual([]);
    expect(result.grades).toEqual([92.5, 71]);
    expect(result.preview[0]).toMatchObject({ studentId: '1001', name: 'Doe, Jane', grade: 92.5 });
  });

  it('rejects missing headers, duplicate IDs, blanks, non-numeric values, and invalid grades', async () => {
    const missing = await parseGradeCsv(csvFile('StudentID,Name\n1,Jane'));
    expect(missing.errors).toContain('Missing required header: FinalGrade');
    const invalid = await parseGradeCsv(csvFile('StudentID,Name,FinalGrade\n1,Jane,101\n1,,abc\n2,John,'));
    expect(invalid.errors.join(' ')).toMatch(/duplicate StudentID/);
    expect(invalid.errors.join(' ')).toMatch(/Name is required/);
    expect(invalid.errors.filter((message) => message.includes('FinalGrade'))).toHaveLength(3);
  });
});

describe('submissions and exports', () => {
  it('gives a current manual status precedence over upload state', () => {
    expect(effectiveSubmission(true, { value: 'outstanding', reason: 'Review', createdAt: '', createdBy: '' })).toBe('outstanding');
    expect(effectiveSubmission(true)).toBe('submitted');
  });

  it('validates and normalizes target-list CSVs', async () => {
    const result = await parseTargetCsv(csvFile('CourseCode,CourseTitle,Instructor,Department,InstructorEmail\ninft 1000u,Intro,Dr. Ada,IT,ada@example.test', 'targets.csv'));
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ CourseCode: 'INFT 1000U', InstructorEmail: 'ada@example.test' });
  });

  it('creates UTF-8 CSV with every field quoted and escaped', () => {
    expect(createCsv([{ Course: 'BUSI 1000U', Title: 'Leadership, Ethics', Instructor: 'Dr. "Ada"' }])).toBe('\ufeff"Course","Title","Instructor"\r\n"BUSI 1000U","Leadership, Ethics","Dr. ""Ada"""');
  });
});
