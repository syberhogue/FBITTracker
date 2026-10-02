import { addDays, addYears, format, parseISO } from 'date-fns';
import type { Profile } from './types';

export const curriculumTypes = ['Major Program Modifications', 'Minor Program Adjustments', 'Minor Curriculum Changes', 'New Programs', 'New Specializations', 'New Courses', 'New Pathway'] as const;
export type CurriculumType = typeof curriculumTypes[number];
export type ApprovalProcess = 'Standard' | 'V1' | 'V2';
export const committees = ['UEC', 'FC', 'USC', 'AC', 'ARC'] as const;
export type Committee = typeof committees[number];
export const committeeInfo: Record<Committee, { name: string; level: 'Faculty' | 'University'; color: string; cadence: string }> = {
  UEC: { name: 'Undergraduate Education Committee (FBIT)', level: 'Faculty', color: '#2563eb', cadence: 'Second Tuesday monthly; agenda 3–5 days before (default 5).' },
  FC: { name: 'Faculty Council (FBIT)', level: 'Faculty', color: '#7c3aed', cadence: 'First Tuesday monthly; agenda one week before.' },
  USC: { name: 'Undergraduate Studies Committee', level: 'University', color: '#0d9488', cadence: 'Monthly on the supplied dates; edit as needed.' },
  AC: { name: 'Academic Council', level: 'University', color: '#b45309', cadence: 'Some sessions are for information/discussion only.' },
  ARC: { name: 'Academic Resource Committee', level: 'University', color: '#475569', cadence: 'Meets quarterly; enter confirmed dates.' },
};
export interface CurriculumLink { title: string; url: string }
export interface CurriculumStage {
  id: string; title: string; committee: Committee | null; purpose: 'Approval' | 'Information' | 'Development';
  due_date: string | null; agenda_date: string | null; completed_on: string | null;
  outcome: 'pending' | 'in-progress' | 'approved' | 'reported' | 'completed' | 'rejected'; notes: string; links: CurriculumLink[];
}
export interface CurriculumChange {
  id: string; title: string; change_type: CurriculumType; approval_process: ApprovalProcess;
  organization_unit_id: string | null; start_date: string; implementation_year: number;
  description: string; stages: CurriculumStage[]; created_by: string; created_at: string; version: number;
}
export type CurriculumDraft = Omit<CurriculumChange, 'id' | 'created_by' | 'created_at' | 'version'>;
export interface CommitteeMeeting { id: string; academic_year: number; committee: Committee; meeting_date: string; voting: boolean; agenda_lead_days: number }
export const curriculumError = (error: unknown) => error instanceof Error ? error.message : error && typeof error === 'object' && 'message' in error ? String(error.message) : 'The change could not be saved.';
export const dateShift = (date: string, days: number) => format(addDays(parseISO(date), days), 'yyyy-MM-dd');
export const academicYear = (date: string) => Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 9 ? 1 : 0);
export const isMinorCurriculum = (type: CurriculumType) => ['Minor Curriculum Changes', 'New Courses'].includes(type);
export const classification = (type: CurriculumType) => type === 'New Programs' ? 'New program' : isMinorCurriculum(type) ? 'Minor change' : type === 'Minor Program Adjustments' ? 'Minor program adjustment' : 'Major change';
export const canCreateCurriculum = (profile: Profile | null) => Boolean(profile?.isActive && profile.role !== 'instructor');
export const canEditCalendar = (profile: Profile | null) => Boolean(profile?.isActive && ['dean', 'academic_director', 'chair', 'program_lead'].includes(profile.role));
export const isStageComplete = (stage: CurriculumStage) => Boolean(stage.completed_on && ['approved', 'reported', 'completed'].includes(stage.outcome));
export const isChangeComplete = (change: CurriculumChange) => change.stages.length > 0 && change.stages.every(isStageComplete);
const root = 'https://sites.ontariotechu.ca/ciqe/curriculum-changes/';
export const iqapLink = { title: 'Institutional Quality Assurance Process Policy (IQAP)', url: 'https://ontariotechu.ca/policy/policy-library/policies/academic/program-quality-assurance-policy.php#IQAP' };
export function resourcesFor(type: CurriculumType): CurriculumLink[] {
  return [{ title: isMinorCurriculum(type) ? 'Minor curricular changes: forms and procedures' : type === 'Minor Program Adjustments' ? 'Minor program adjustments: forms and procedures' : type === 'New Programs' ? 'New programs: forms and procedures' : 'Major program modifications: forms and procedures', url: type === 'New Programs' ? 'https://sites.ontariotechu.ca/ciqe/new-programs/index.php' : `${root}${isMinorCurriculum(type) ? 'minor-curricular-changes.php#minor%20curriculum%20changes' : type === 'Minor Program Adjustments' ? 'minor-program-adjustments.php' : 'major-program-modifications.php'}` }, iqapLink];
}
export const minorDefinition = ['Minor changes to course sequencing', 'Course titles, descriptions, numbers, credit weighting and contact hours', 'Prerequisites, corequisites, cross-listings and credit restrictions', 'Individual course design, instructional methods, learning outcomes and assessment', 'Course deletion and new courses'];
export const majorDefinition = ['Requirements that differ significantly from the previous cyclical program review', 'Significant changes to program learning outcomes', 'Significant changes to faculty, essential physical resources or modes of delivery', 'A new field in an existing graduate program'];
export const adjustmentDefinition = ['New or deleted elective courses', 'Course titles, descriptions, numbers, elective credits and contact hours', 'Prerequisites, corequisites, cross-listings, credit restrictions or exclusions', 'Individual course design, delivery, learning outcomes and assessment', 'Experiential learning components within course delivery', 'Other course changes that do not affect overall program requirements'];

/** Only faculty recurrence rules are generated for future years. University dates are supplied for 2026–27. */
export function defaultMeetings(year: number): CommitteeMeeting[] {
  const result: CommitteeMeeting[] = [];
  const push = (committee: Committee, date: string, voting = true, lead = 0) => result.push({ id: crypto.randomUUID(), academic_year: year, committee, meeting_date: date, voting, agenda_lead_days: lead });
  for (let offset = 0; offset < 12; offset++) {
    const month = (8 + offset) % 12;
    const calendarYear = year + (offset >= 4 ? 1 : 0);
    const first = new Date(Date.UTC(calendarYear, month, 1));
    const firstTuesday = 1 + (2 - first.getUTCDay() + 7) % 7;
    const day = (number: number) => `${calendarYear}-${String(month + 1).padStart(2, '0')}-${String(number).padStart(2, '0')}`;
    push('FC', day(firstTuesday), true, 7);
    push('UEC', day(firstTuesday + 7), true, 5);
  }
  if (year === 2026) {
    ['2026-09-16', '2026-10-20', '2026-12-15', '2027-01-19', '2027-02-16', '2027-03-16', '2027-04-20', '2027-05-18', '2027-06-15'].forEach(date => push('USC', date));
    ['2026-09-22', '2026-10-27', '2026-11-24', '2027-01-26', '2027-02-23', '2027-03-23', '2027-04-27', '2027-05-25', '2027-06-15'].forEach(date => push('AC', date, !['2026-10-27', '2027-02-23', '2027-04-27'].includes(date)));
  }
  return result.sort((a, b) => a.meeting_date.localeCompare(b.meeting_date) || a.committee.localeCompare(b.committee));
}

export function templateStages(type: CurriculumType, process: ApprovalProcess): CurriculumStage[] {
  const stage = (id: string, committee: Committee | null, purpose: CurriculumStage['purpose'], title = `${committee} (${purpose})`): CurriculumStage => ({ id, title, committee, purpose, due_date: null, agenda_date: null, completed_on: null, outcome: 'pending', notes: '', links: resourcesFor(type) });
  const standard = (['UEC', 'FC', 'USC', ...(process === 'Standard' && isMinorCurriculum(type) ? [] : ['AC'])] as Committee[]).map(committee => stage(`${committee.toLowerCase()}-approval`, committee, process === 'Standard' && isMinorCurriculum(type) && committee === 'USC' ? 'Information' : 'Approval'));
  const governance = process === 'V2' ? [stage('uec-information', 'UEC', 'Information'), stage('fc-information', 'FC', 'Information'), ...standard] : standard;
  return type === 'New Programs' ? [stage('noi-development', null, 'Development', 'NOI Development'), stage('arc-approval', 'ARC', 'Approval'), stage('noi-publication', null, 'Information', 'NOI made public'), ...governance] : governance;
}

/** Replanning preserves outcomes, actual dates, notes, links and completed-stage schedules. */
export function scheduleStages(stages: CurriculumStage[], anchor: string, meetings: CommitteeMeeting[], newProgram = false): CurriculumStage[] {
  let cursor: string | null = anchor;
  const publication = stages.find(stage => stage.id === 'noi-publication');
  return stages.map(stage => {
    if (newProgram && stage.id === 'noi-publication') { cursor = publication?.completed_on ?? null; return stage; }
    if (stage.id === 'noi-development') return { ...stage, due_date: stage.due_date ?? anchor };
    if (isStageComplete(stage)) { if (stage.committee && stage.id !== 'arc-approval') cursor = dateShift(stage.completed_on!, 1); return stage; }
    if (!stage.committee) return stage;
    const meeting = cursor ? [...meetings].sort((a, b) => a.meeting_date.localeCompare(b.meeting_date)).find(item => item.committee === stage.committee && (stage.purpose !== 'Approval' || item.voting) && dateShift(item.meeting_date, -item.agenda_lead_days) >= cursor!) : undefined;
    cursor = meeting ? dateShift(meeting.meeting_date, 1) : null;
    return { ...stage, due_date: meeting?.meeting_date ?? null, agenda_date: meeting ? dateShift(meeting.meeting_date, -meeting.agenda_lead_days) : null };
  });
}

export const noiExpiry = (change: CurriculumChange) => {
  const publicDate = change.stages.find(stage => stage.id === 'noi-publication' && isStageComplete(stage))?.completed_on;
  return publicDate ? format(addYears(parseISO(publicDate), 2), 'yyyy-MM-dd') : null;
};
export const calendarCutoff = (implementationYear: number) => `${implementationYear}-01-31`;
export function curriculumWarnings(change: CurriculumChange, meetings: CommitteeMeeting[], today: string): string[] {
  const warnings: string[] = [];
  const usc = change.stages.find(stage => stage.committee === 'USC');
  const uscReceipt = usc?.agenda_date ?? usc?.due_date;
  if (usc && (!uscReceipt || uscReceipt > calendarCutoff(change.implementation_year))) warnings.push(`For the ${change.implementation_year}–${change.implementation_year + 1} academic calendar, proposals must reach USC/GSC by January 31, ${change.implementation_year}.`);
  const expiry = noiExpiry(change);
  if (change.change_type === 'New Programs' && !expiry) warnings.push('ARC approval and actual NOI publication must be recorded before governance completion. Enter confirmed quarterly ARC dates in the committee calendar.');
  if (expiry && !isChangeComplete(change) && (today > expiry || change.stages.some(stage => stage.due_date && stage.due_date > expiry))) warnings.push(`The NOI two-year governance window ends ${expiry}.`);
  let previous: string | null = null;
  change.stages.forEach(stage => {
    if (stage.due_date && previous && stage.due_date < previous) warnings.push(`${stage.title} is scheduled before the preceding stage.`);
    if (stage.due_date) previous = stage.due_date;
    if (stage.agenda_date && !isStageComplete(stage) && stage.agenda_date < today) warnings.push(`${stage.title}: agenda deadline has passed (${stage.agenda_date}).`);
    if (stage.committee && stage.due_date && !isStageComplete(stage)) {
      const meeting = meetings.find(item => item.committee === stage.committee && item.meeting_date === stage.due_date);
      if (!meeting) warnings.push(`${stage.title}: ${stage.due_date} is not a confirmed committee meeting.`);
      else if (stage.purpose === 'Approval' && !meeting.voting) warnings.push(`${stage.title}: this session does not permit voting.`);
    }
    if (stage.outcome === 'rejected') warnings.push(`${stage.title} was rejected; revise the proposal before proceeding.`);
  });
  return warnings;
}
export function validateStage(stage: CurriculumStage, change: CurriculumChange, meetings: CommitteeMeeting[], today: string) {
  if (!stage.title.trim()) throw new Error('A stage title is required.');
  if (change.change_type === 'New Programs') {
    const required: Record<string, { purpose: CurriculumStage['purpose']; committee: Committee | null }> = { 'noi-development': { purpose: 'Development', committee: null }, 'arc-approval': { purpose: 'Approval', committee: 'ARC' }, 'noi-publication': { purpose: 'Information', committee: null } };
    const role = required[stage.id];
    if (role && (role.purpose !== stage.purpose || role.committee !== stage.committee)) throw new Error('Keep the required NOI development, ARC approval and publication stage purposes.');
  }
  const expected = stage.purpose === 'Approval' ? 'approved' : stage.purpose === 'Information' ? 'reported' : 'completed';
  if (['approved', 'reported', 'completed'].includes(stage.outcome) && (!stage.completed_on || stage.outcome !== expected)) throw new Error('Choose the appropriate outcome and record an actual completion date.');
  if (!['approved', 'reported', 'completed'].includes(stage.outcome) && stage.completed_on) throw new Error('Actual completion dates require a successful outcome.');
  if (stage.completed_on && (stage.completed_on > today || stage.completed_on < change.start_date)) throw new Error('Actual completion must be between the start date and today.');
  if (stage.agenda_date && (!stage.due_date || stage.agenda_date > stage.due_date)) throw new Error('The agenda deadline must be on or before the meeting/deadline date.');
  if (stage.purpose === 'Approval' && meetings.some(meeting => meeting.committee === stage.committee && [stage.completed_on, stage.due_date].includes(meeting.meeting_date) && !meeting.voting)) throw new Error('Approval stages cannot use an information-only committee session.');
  if (change.change_type === 'New Programs' && stage.completed_on && stage.id !== 'noi-development' && stage.id !== 'arc-approval') {
    const arc = change.stages.find(item => item.id === 'arc-approval');
    if (!arc || !isStageComplete(arc) || arc.completed_on! > stage.completed_on) throw new Error('Record ARC approval before publication or governance completion.');
    if (stage.id !== 'noi-publication') {
      const publicDate = change.stages.find(item => item.id === 'noi-publication' && isStageComplete(item))?.completed_on;
      if (!publicDate || publicDate > stage.completed_on) throw new Error('Record NOI publication before governance completion.');
      if (stage.completed_on > format(addYears(parseISO(publicDate), 2), 'yyyy-MM-dd')) throw new Error('Governance must complete within two years of NOI publication.');
    }
  }
  stage.links.forEach(link => { const url = new URL(link.url); if (!link.title.trim() || !['http:', 'https:'].includes(url.protocol)) throw new Error('Resources need a title and an HTTP/HTTPS URL.'); });
}
