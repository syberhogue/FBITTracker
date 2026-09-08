import { describe, expect, it } from 'vitest';
import {
  createCsv,
  courseCodesMatch,
  dashboardMetrics,
  effectiveSubmission,
  failureRate,
  findCourseByCode,
  gradeMetrics,
  gradeTemplateRows,
  importantDatesForTerm,
  inferAcademicTerm,
  inferCourseCode,
  normalizeStageLinkUrl,
  parseGradeCsv,
  parseGradeFile,
  parseGradeWorksheet,
  parseImportantDatesWorksheet,
  parseTargetCsv,
  stageVisualStatus,
  trackerSummary,
} from '../src/lib/domain';
import type { ImportantDate, Stage, Tracker } from '../src/lib/types';

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

  it('calculates the percentage of enrolled students with an F', () => {
    expect(failureRate({ enrolled: 40, distribution: { A: 10, B: 10, C: 8, D: 7, F: 5 } })).toBe(12.5);
    expect(failureRate({ enrolled: 0, distribution: { A: 0, B: 0, C: 0, D: 0, F: 0 } })).toBe(0);
  });

  it('parses quoted fields, permits extra columns, and returns ordered numeric grades', async () => {
    const result = await parseGradeCsv(csvFile('Semester ID,Course Code,Last Name,First Name,Student ID,Final Grade (%),Final Letter Grade,Comment\n202609,INFT 1000U,"Doe, Jane",Alex,1001,92.5,A+,Excellent\n202609,INFT 1000U,Roe,Jordan,1002,71,B-,Good'));
    expect(result.errors).toEqual([]);
    expect(result.grades).toEqual([92.5, 71]);
    expect(result.courseCode).toBe('INFT 1000U');
    expect(result.semesterId).toBe('F26');
    expect(result.preview[0]).toMatchObject({ studentId: '1001', name: 'Doe, Jane', grade: 92.5 });
  });

  it('rejects missing headers, duplicate IDs, blanks, non-numeric values, and invalid grades', async () => {
    const missing = await parseGradeCsv(csvFile('Semester ID,Course Code,Last Name,First Name,Student ID\n202609,INFT 1000U,Doe,Alex,1'));
    expect(missing.errors).toContain('Missing required header: Final Grade (%)');
    expect(missing.errors).toContain('Missing required header: Final Letter Grade');
    const invalid = await parseGradeCsv(csvFile('Semester ID,Course Code,Last Name,Section,Student ID,Final Grade (%),Final Letter Grade\n202609,INFT 1000U,Jane,001,1,101,A\n202609,INFT 1000U,,001,1,abc,F\n202609,INFT 1000U,John,001,2,,F'));
    expect(invalid.errors.join(' ')).toMatch(/duplicate Student ID/);
    expect(invalid.errors.join(' ')).toMatch(/Last Name is required/);
    expect(invalid.errors.filter((message) => message.includes('Final Grade (%)'))).toHaveLength(3);
  });

  it('normalizes surrounding and repeated whitespace in template headers', async () => {
    const result = await parseGradeCsv(csvFile('\ufeff Semester   ID , Course Code , Last Name , Section , Student ID , Final Grade (%) , Final Letter   Grade \n202609,INFT 1000U,Doe,001,1001,88,A'));
    expect(result.errors).toEqual([]);
    expect(result.grades).toEqual([88]);
  });

  it('parses the attached instructor-workbook shape from the first worksheet and ignores chart-helper rows', () => {
    const result = parseGradeWorksheet([
      ['Semester ID', 'Course Code', 'Last Name', 'First Name', 'Student ID', 'Final Grade (%)', 'Final Letter Grade', null, null, null, null],
      [202609, 'INFT 1000U', 'Doe', 'Alex', 1001, 88, 'A', null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null, 'A+'],
    ]);
    expect(result.errors).toEqual([]);
    expect(result.grades).toEqual([88]);
  });

  it('rejects unsupported grade file types before parsing', async () => {
    const result = await parseGradeFile(csvFile('data', 'grades.xls'));
    expect(result.errors).toEqual(['Only .csv and .xlsx grade files are supported.']);
  });

  it('rejects files containing more than one course code', async () => {
    const result = await parseGradeCsv(csvFile('Semester ID,Course Code,Last Name,First Name,Student ID,Final Grade (%),Final Letter Grade\n202609,INFT 1000U,Doe,Alex,1001,88,A\n202609,BUSI 1100U,Roe,Jordan,1002,77,B+'));
    expect(result.errors).toContain('The grade file contains multiple Course Code values. Upload one course per file.');
    expect(result.courseCode).toBeUndefined();
  });

  it('matches normalized or title-qualified file course codes to exactly one course', () => {
    const courses = [{ code: 'INFT 1020U' }, { code: 'BUSI 1100U' }];
    expect(findCourseByCode('inft-1020u', courses)).toBe(courses[0]);
    expect(findCourseByCode('INFT 1020U - Intro to Data Structures', courses)).toBe(courses[0]);
    expect(findCourseByCode('MATH 1000U', courses)).toBeUndefined();
    expect(courseCodesMatch('INFT-1020U', 'INFT 1020U - Intro to Data Structures')).toBe(true);
    expect(courseCodesMatch('INFT 1020U', 'BUSI 1100U')).toBe(false);
  });

  it('infers canonical undergraduate and graduate course codes across spacing variants', () => {
    expect(inferCourseCode('BUSI1100')).toMatchObject({ canonical:'BUSI 1100U',department:'BUSI',number:'1100',level:'U' });
    expect(inferCourseCode('INFR 1100U')).toMatchObject({ canonical:'INFR 1100U',level:'U' });
    expect(inferCourseCode('BUSI4543G - Strategic Leadership')).toEqual({ canonical:'BUSI 4543G',department:'BUSI',number:'4543',level:'G',title:'Strategic Leadership' });
    expect(courseCodesMatch('BUSI1100','BUSI 1100U')).toBe(true);
    expect(courseCodesMatch('BUSI4543G','BUSI 4543U')).toBe(false);
    expect(inferCourseCode('BUS 1100')).toBeUndefined();
  });

  it('treats equivalent course-code variants as one course in a grade file', async () => {
    const result=await parseGradeCsv(csvFile('Semester ID,Course Code,Last Name,Section,Student ID,Final Grade (%),Final Letter Grade\n202609,BUSI1100,Doe,1,1001,88,A\n202609,BUSI 1100U,Roe,1,1002,77,B+'));
    expect(result.errors).toEqual([]);
    expect(result.courseCode).toBe('BUSI 1100U');
  });

  it('infers canonical academic terms from common semester labels and numeric IDs', () => {
    for (const value of ['W26', 'W2026', 'Winter 2026', 'W 26', 'W 2026', 202601]) expect(inferAcademicTerm(value)).toBe('W26');
    for (const value of ['F26', 'F2026', 'Fall 2026', 'Autumn-2026', 202609]) expect(inferAcademicTerm(value)).toBe('F26');
    for (const value of ['S26', 'Spring 2026', 'Summer 2026', 'Spring/Summer 2026', 202605]) expect(inferAcademicTerm(value)).toBe('S26');
    expect(inferAcademicTerm('Academic year 2026')).toBeUndefined();
    expect(inferAcademicTerm('F1999')).toBeUndefined();
    expect(inferAcademicTerm(202613)).toBeUndefined();
  });

  it('treats equivalent semester labels as one term and rejects unrecognized terms', async () => {
    const equivalent = await parseGradeCsv(csvFile('Semester ID,Course Code,Last Name,Section,Student ID,Final Grade (%),Final Letter Grade\nW2026,BUSI1100,Doe,1,1001,88,A\nWinter 2026,BUSI 1100U,Roe,1,1002,77,B+'));
    expect(equivalent.errors).toEqual([]);
    expect(equivalent.semesterId).toBe('W26');

    const invalid = await parseGradeCsv(csvFile('Semester ID,Course Code,Last Name,Section,Student ID,Final Grade (%),Final Letter Grade\nAcademic 2026,BUSI1100,Doe,1,1001,88,A'));
    expect(invalid.errors).toContain('Row 2: Semester ID must identify Fall, Winter, or Spring/Summer and a two- or four-digit year.');
    expect(invalid.semesterId).toBeUndefined();
  });
});

describe('important dates workbook parsing',()=>{
  it('selects and orders the important dates belonging to an academic term',()=>{
    const date=(id:string,academicYear:string,semester:ImportantDate['semester'],startsOn:string,sortOrder:number):ImportantDate=>({
      id,academicYear,semester,startsOn,endsOn:startsOn,sortOrder,shortName:id,description:id,sourceFileName:'dates.xlsx',updatedAt:'2026-09-01',
    });
    const dates=[
      date('winter-2027','2026-27','Winter','2027-01-05',1),
      date('fall-later','2026-27','Fall','2026-10-01',2),
      date('fall-earlier','2026-27','Fall','2026-09-01',3),
      date('spring-2027','2026-27','Spring/Summer','2027-05-01',1),
      date('winter-2026','2025-26','Winter','2026-01-05',1),
    ];

    expect(importantDatesForTerm(dates,'F26').map(item=>item.id)).toEqual(['fall-earlier','fall-later']);
    expect(importantDatesForTerm(dates,'W27').map(item=>item.id)).toEqual(['winter-2027']);
    expect(importantDatesForTerm(dates,'S27').map(item=>item.id)).toEqual(['spring-2027']);
    expect(importantDatesForTerm(dates,'W26').map(item=>item.id)).toEqual(['winter-2026']);
    expect(importantDatesForTerm(dates,'Fall 2026')).toEqual([]);
  });

  it('changes semesters, parses ranges, and applies the preceding date to continuation rows',()=>{
    const result=parseImportantDatesWorksheet([
      ['Fall semester',null],
      [new Date('2026-09-08T00:00:00.000Z'),'Lectures begin for all programs, fall semester.'],
      [null,'Fall semester fees due.'],
      ['October 13 to 18, 2026','Fall study week, no scheduled academic activities.'],
      ['Winter semester',null],
      ['December 24, 2026 to January 1, 2027','University closed.'],
    ]);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(4);
    expect(result.rows[1]).toMatchObject({semester:'Fall',startsOn:'2026-09-08',endsOn:'2026-09-08',shortName:'Fall Fees Due'});
    expect(result.rows[2]).toMatchObject({startsOn:'2026-10-13',endsOn:'2026-10-18',shortName:'Fall Study Week'});
    expect(result.rows[3]).toMatchObject({semester:'Winter',startsOn:'2026-12-24',endsOn:'2027-01-01',shortName:'University Closed'});
  });

  it('reports malformed rows instead of silently importing them',()=>{
    const result=parseImportantDatesWorksheet([['Fall semester',null],['not a date','Description'],[null,'Continuation without a valid date']]);
    expect(result.rows).toEqual([]);
    expect(result.errors.join(' ')).toMatch(/could not read date/);
    expect(result.errors.join(' ')).toMatch(/preceding date/);
  });
});

describe('submissions and exports', () => {
  it('builds the official grade template with the selected term pre-filled', () => {
    expect(gradeTemplateRows('W27')).toEqual([{
      'Semester ID': 'W27',
      'Course Code': '',
      'Last Name': '',
      Section: '',
      'Student ID': '',
      'Final Grade (%)': '',
      'Final Letter Grade': '',
    }]);
  });

  it('accepts only safe HTTP stage links and normalizes them', () => {
    expect(normalizeStageLinkUrl(' https://example.test/guide ')).toBe('https://example.test/guide');
    expect(() => normalizeStageLinkUrl('javascript:alert(1)')).toThrow('Only http:// and https://');
    expect(() => normalizeStageLinkUrl('https://user:secret@example.test')).toThrow('embedded usernames or passwords');
  });

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
