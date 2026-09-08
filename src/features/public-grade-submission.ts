import { courseCodesMatch, findCourseByCode, inferCourseCode } from '../lib/domain';
import { demoCourses, demoProfiles } from '../lib/demo-data';
import { demoMode, supabase } from '../lib/supabase';

export interface PublicGradeSubmissionInput {
  courseCode: string;
  fileCourseCode: string;
  fileCourseTitle?: string;
  fileTermCode: string;
  facultyName: string;
  facultyEmail: string;
  grades: number[];
}

export interface PublicGradeSubmissionReceipt {
  receiptId?: string;
  courseCode: string;
  courseTitle: string;
  termCode: string;
  enrolledCount: number;
  duplicate: boolean;
  createdCourse: boolean;
}

const demoSubmissions = new Set<string>();

function normalizedName(value: string) {
  return value.trim().toLowerCase().replace(/^(dr|prof|professor|mr|ms|mrs)\.?\s+/, '').replace(/[^a-z0-9]/g, '');
}

export async function submitPublicGradeUpload(input: PublicGradeSubmissionInput): Promise<PublicGradeSubmissionReceipt> {
  if (!courseCodesMatch(input.courseCode, input.fileCourseCode)) throw new Error('The entered course code does not match the uploaded file.');

  if (demoMode) {
    const existing = findCourseByCode(input.courseCode, demoCourses);
    const faculty = demoProfiles.find((item) => item.isActive && item.email.toLowerCase() === input.facultyEmail.trim().toLowerCase() && normalizedName(item.fullName) === normalizedName(input.facultyName));
    const expectedName = existing?.instructor;
    if (!faculty || (existing && (existing.instructorEmail?.toLowerCase() !== input.facultyEmail.trim().toLowerCase() || !expectedName || normalizedName(expectedName) !== normalizedName(input.facultyName)))) {
      throw new Error('Course or faculty details could not be verified.');
    }
    const inferred = inferCourseCode(input.courseCode)!;
    const course = existing ?? { id:inferred.canonical,code:inferred.canonical,title:input.fileCourseTitle||inferred.canonical,instructor:faculty.fullName };
    const key = `${course.id}|${input.fileTermCode}|${input.grades.join(',')}`;
    const duplicate = demoSubmissions.has(key);
    demoSubmissions.add(key);
    return {
      receiptId: duplicate ? undefined : `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      courseCode: course.code,
      courseTitle: course.title,
      termCode: input.fileTermCode,
      enrolledCount: input.grades.length,
      duplicate,
      createdCourse: !existing,
    };
  }

  const { data, error } = await supabase.rpc('submit_public_grade_upload', {
    p_course_code: input.courseCode,
    p_file_course_code: input.fileCourseCode,
    p_course_title: input.fileCourseTitle ?? '',
    p_term_code: input.fileTermCode,
    p_faculty_name: input.facultyName,
    p_faculty_email: input.facultyEmail,
    p_grades: input.grades,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The server did not return a submission receipt.');

  return {
    receiptId: typeof data.receipt_id === 'string' ? data.receipt_id : undefined,
    courseCode: String(data.course_code),
    courseTitle: String(data.course_title),
    termCode: String(data.term_code),
    enrolledCount: Number(data.enrolled_count),
    duplicate: Boolean(data.duplicate),
    createdCourse: Boolean(data.created_course),
  };
}
