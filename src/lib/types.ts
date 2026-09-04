export type AppRole = 'dean' | 'academic_director' | 'chair' | 'program_lead' | 'instructor' | 'research_lead' | 'graduate_supervisor';
export type TrackerType = 'general' | 'grade-submission';
export type TrackerCategory = 'Administrative' | 'Academic' | 'Research' | 'Other';
export type StageStatus = 'pending' | 'in-progress' | 'completed' | 'skipped';
export type SubmissionStatus = 'submitted' | 'outstanding';

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

export interface Stage {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  isRequired: boolean;
  status: StageStatus;
  sortOrder: number;
  documents: StageDocument[];
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

export interface TermMetrics {
  average: number;
  passRate: number;
  enrolled: number;
  distribution: Record<'A' | 'B' | 'C' | 'D' | 'F', number>;
  uploadVersion?: number;
  uploadedAt?: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  department: string;
  instructor: string;
  instructorEmail?: string;
  terms: Record<string, TermMetrics | undefined>;
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
  StudentID: string;
  Name: string;
  FinalGrade: string | number;
  [key: string]: unknown;
}

export interface GradeCsvResult {
  grades: number[];
  preview: Array<{ row: number; studentId: string; name: string; grade: number }>;
  errors: string[];
}

export interface TargetCsvRow {
  CourseCode: string;
  CourseTitle: string;
  Instructor: string;
  Department: string;
  InstructorEmail?: string;
}
