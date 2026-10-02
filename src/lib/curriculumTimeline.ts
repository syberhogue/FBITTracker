import { dateShift, noiExpiry, type CommitteeMeeting, type CurriculumChange, type CurriculumStage } from './curriculum';

// The stage array is the governance sequence. Actual dates are fixed boundaries;
// pending committee stages must leave time for their agenda submissions.
export function moveCurriculumStage(change: CurriculumChange, stageId: string, requestedDate: string, meetings: CommitteeMeeting[]): CurriculumStage[] {
  const index = change.stages.findIndex(stage => stage.id === stageId);
  if (index < 0) throw new Error('This stage no longer exists. Refresh the proposal.');
  const selected = change.stages[index];
  if (selected.completed_on) throw new Error('Completed stages cannot be dragged. Edit the recorded outcome to correct history.');
  const publicationIndex = change.stages.findIndex(stage => stage.id === 'noi-publication');
  const newProgram = change.change_type === 'New Programs';
  const publication = change.stages[publicationIndex];
  if (newProgram && index > publicationIndex && !publication?.completed_on) throw new Error('Record actual NOI publication before dragging governance stages.');
  const calendar = [...meetings].sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
  const expiry = noiExpiry(change);
  let previousDate: string | undefined;
  let previousStage: CurriculumStage | undefined;
  let shift = 0;
  return change.stages.map((stage, position) => {
    const earliest = previousDate ? dateShift(previousDate, newProgram && (stage.id === 'noi-publication' || previousStage?.id === 'noi-publication') ? 0 : 1) : change.start_date;
    if (position < index) {
      if (!stage.completed_on && !stage.due_date) throw new Error(`Set a date for ${stage.title} before moving dependent stages.`);
      previousDate = stage.completed_on ?? stage.due_date!;
      previousStage = stage;
      return stage;
    }
    if (stage.completed_on) {
      if (stage.completed_on < earliest) throw new Error(`This move would place a prerequisite after the recorded completion of ${stage.title}.`);
      previousDate = stage.completed_on;
      previousStage = stage;
      shift = 0;
      return stage;
    }
    // Pending NOI governance remains unscheduled until publication is recorded.
    if (newProgram && position > publicationIndex && !publication?.completed_on) return { ...stage, due_date: null, agenda_date: null };
    if (!stage.committee && !stage.due_date && position !== index) return stage;
    let due: string;
    let agenda: string | null;
    if (stage.committee) {
      const meeting = calendar.find(meeting => meeting.committee === stage.committee && (stage.purpose !== 'Approval' || meeting.voting) && meeting.meeting_date >= (position === index ? requestedDate : earliest) && dateShift(meeting.meeting_date, -meeting.agenda_lead_days) >= earliest);
      if (!meeting) throw new Error(`No available ${stage.committee}${stage.purpose === 'Approval' ? ' voting' : ''} meeting for ${stage.title}. Add meeting dates in Settings before moving this stage.`);
      due = meeting.meeting_date;
      agenda = dateShift(due, -meeting.agenda_lead_days);
    } else {
      // Preserve the spacing of manual deadlines relative to the preceding move.
      due = position === index ? requestedDate : stage.due_date ? dateShift(stage.due_date, shift) : earliest;
      if (due < earliest) due = earliest;
      const days = stage.due_date ? dayDifference(due, stage.due_date) : 0;
      agenda = stage.agenda_date ? dateShift(stage.agenda_date, days) : null;
    }
    if (newProgram && position > publicationIndex && expiry && due > expiry) throw new Error('This move would put governance beyond the two-year NOI deadline.');
    shift = stage.due_date ? dayDifference(due, stage.due_date) : shift;
    previousDate = due;
    previousStage = stage;
    return { ...stage, due_date: due, agenda_date: agenda };
  });
}

const dayDifference = (later: string, earlier: string) => Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86400000);
