export type AppRole = 'dean' | 'academic_director' | 'chair' | 'program_lead' | 'instructor' | 'research_lead' | 'graduate_supervisor';
export type TrackerType = 'general' | 'grade-submission';
export type TrackerCategory = 'Administrative' | 'Academic' | 'Research' | 'Other';
export type StageStatus = 'pending' | 'in-progress' | 'completed' | 'skipped';
export type SubmissionStatus = 'submitted' | 'outstanding';
export type TrackerTemplateScope = 'personal' | 'faculty';
export type ImportantDateSemester = 'Fall' | 'Winter' | 'Spring/Summer';

export interface AcademicTermDraft {
  code: string;
  name: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
}

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  organizationUnitId?: string;
  organizationUnit?: string;
  isActive: boolean;
}

export interface StageDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface StageLink {
  id: string;
  title: string;
  url: string;
  createdAt: string;
}

export interface Stage {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  isRequired: boolean;
  status: StageStatus;
  sortOrder: number;
  documents: StageDocument[];
  links?: StageLink[];
}

export interface Tracker {
  id: string;
  title: string;
  type: TrackerType;
  category: TrackerCategory;
  description: string;
  organizationUnitId?: string;
  createdAt: string;
  stages: Stage[];
  averageThreshold?: number;
  passRateThreshold?: number;
}

export interface TrackerTemplateStage {
  id: string;
  title: string;
  description: string;
  dueOffsetDays: number;
  isRequired: boolean;
  sortOrder: number;
}

export interface TrackerTemplate {
  id: string;
  name: string;
  description: string;
  type: TrackerType;
  category: TrackerCategory;
  scope: TrackerTemplateScope;
  ownerId: string;
  ownerName?: string;
  createdAt: string;
  stages: TrackerTemplateStage[];
}

export interface TrackerTemplateDraft {
  id?: string;
  name: string;
  description: string;
  type: TrackerType;
  category: TrackerCategory;
  scope: TrackerTemplateScope;
  stages: Array<Omit<TrackerTemplateStage, 'id'>>;
}

export interface TermMetrics {
  average: number;
  passRate: number;
  enrolled: number;
  distribution: Record<'A' | 'B' | 'C' | 'D' | 'F', number>;
  uploadVersion?: number;
  uploadedAt?: string;
  gradeFingerprint?: string;
}

export interface CourseTermDetails {
  section: string;
  instructorId?: string;
  instructor: string;
  instructorEmail?: string;
}

export interface CourseEditDraft {
  code: string;
  title: string;
  department: string;
  section: string;
  instructorId?: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  department: string;
  instructor: string;
  instructorEmail?: string;
  terms: Record<string, TermMetrics | undefined>;
  termDetails?: Record<string, CourseTermDetails | undefined>;
}

export interface SubmissionOverride {
  value: SubmissionStatus;
  reason: string;
  createdAt: string;
  createdBy: string;
}

export interface AppSettings {
  averageThreshold: number;
  passRateThreshold: number;
}

export interface GradeCsvRow {
  'Semester ID': string;
  'Course Code': string;
  'Last Name': string;
  'First Name'?: string;
  Section?: string;
  'Student ID': string;
  'Final Grade (%)': string | number;
  'Final Letter Grade': string;
  [key: string]: unknown;
}

export interface GradeCsvResult {
  grades: number[];
  preview: Array<{ row: number; studentId: string; name: string; grade: number }>;
  errors: string[];
  warnings: string[];
  ignoredRows: number;
  courseCode?: string;
  courseTitle?: string;
  semesterId?: string;
}

export interface ImportantDateDraft {
  semester: ImportantDateSemester;
  startsOn: string;
  endsOn: string;
  shortName: string;
  description: string;
  sortOrder: number;
}

export interface ImportantDate extends ImportantDateDraft {
  id: string;
  academicYear: string;
  sourceFileName: string;
  updatedAt: string;
}

export interface ImportantDatesParseResult {
  rows: ImportantDateDraft[];
  errors: string[];
}

export interface TargetCsvRow {
  CourseCode: string;
  CourseTitle: string;
  Instructor: string;
  Department: string;
  InstructorEmail?: string;
}
