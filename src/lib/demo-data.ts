import type { Course, Profile, Tracker } from './types';

const term = (average: number, passRate: number, enrolled: number, distribution: [number, number, number, number, number]) => ({
  average, passRate, enrolled,
  distribution: { A: distribution[0], B: distribution[1], C: distribution[2], D: distribution[3], F: distribution[4] },
  uploadVersion: 1,
});

export const demoProfile: Profile = {
  id: '00000000-0000-0000-0000-000000000001',
  fullName: 'Dr. Morgan Ellis',
  email: 'morgan.ellis@ontariotechu.ca',
  role: 'dean',
  organizationUnit: 'Faculty of Business and Information Technology',
  isActive: true,
};

export const demoCourses: Course[] = [
  { id: 'c1', code: 'INFT 1020U', title: 'Intro to Data Structures & Algorithms', department: 'Information Technology', instructor: 'Dr. Alex Mercer', instructorEmail: 'alex.mercer@ontariotechu.ca', terms: { F24: term(71.2,83.5,110,[22,35,28,10,15]), W25: term(73.8,86,98,[25,32,27,11,13]), S25: term(76.5,90.2,45,[15,18,8,2,2]), F25: term(72.4,84.1,125,[28,38,32,12,15]), W26: term(75.1,88.3,105,[30,36,26,8,5]), F26: term(76.8,89.5,118,[34,40,25,11,8]) } },
  { id: 'c2', code: 'BUSI 1100U', title: 'Introduction to Business Operations', department: 'Business Administration', instructor: 'Prof. Karen Vance', instructorEmail: 'karen.vance@ontariotechu.ca', terms: { F24: term(76,91,210,[50,80,52,18,10]), W25: term(77.5,92.5,195,[55,75,45,12,8]), S25: term(79.1,94,80,[28,32,15,3,2]), F25: term(75.8,89.8,225,[52,82,58,19,14]), W26: term(78.2,93.1,200,[60,78,48,8,6]), F26: term(79,94.2,230,[68,85,55,15,7]) } },
  { id: 'c3', code: 'INFT 2020U', title: 'Database Systems & SQL', department: 'Information Technology', instructor: 'Dr. Samantha Wu', instructorEmail: 'samantha.wu@ontariotechu.ca', terms: { F24: term(68.5,79.2,95,[14,28,30,12,11]), W25: term(71,82.5,88,[18,29,26,9,6]), S25: term(74.2,87,38,[10,15,8,3,2]), F25: term(69.8,80.6,102,[18,31,33,12,8]), W26: term(73.4,86.8,92,[22,34,24,8,4]), F26: term(72.1,83.9,110,[20,38,32,11,9]) } },
  { id: 'c4', code: 'BUSI 2400U', title: 'Corporate Finance & Valuation', department: 'Business Administration', instructor: 'Dr. Michael Chang', instructorEmail: 'michael.chang@ontariotechu.ca', terms: { F24: term(65.4,74,140,[18,32,44,22,24]), W25: term(67.1,76.5,135,[20,35,40,21,19]), S25: term(70,82,50,[10,18,13,5,4]), F25: term(66.2,75.1,150,[21,34,48,25,22]), W26: term(69.5,80.2,128,[24,38,35,18,13]), F26: term(68,78.5,145,[22,36,42,22,13]) } },
  { id: 'c5', code: 'INFT 4000U', title: 'Senior IT Capstone Project', department: 'Information Technology', instructor: 'Prof. David Miller', instructorEmail: 'david.miller@ontariotechu.ca', terms: { F24: term(82.1,96.5,70,[32,25,10,1,2]), W25: term(84,98,65,[34,22,8,0,1]), S25: term(85.5,100,20,[12,6,2,0,0]), F25: term(81.8,95.8,75,[33,26,12,1,3]), W26: term(83.5,97.2,68,[32,24,10,0,2]), F26: term(84.2,97.5,80,[40,28,8,2,2]) } },
];

export const demoTrackers: Tracker[] = [
  { id: 't1', title: 'Fall 2026 Grade Submission Portal', type: 'grade-submission', category: 'Administrative', description: 'Faculty-wide portal to upload, compare, and analyze Fall 2026 course grade submissions against historical standards.', createdAt: '2026-08-15', stages: [
    { id:'s11', title:'Initial Reminder Email', description:'Send instructions to all instructors.', dueDate:'2026-11-20', isRequired:true, status:'completed', sortOrder:1, documents:[] },
    { id:'s12', title:'Final Exams End', description:'End of the official examination period.', dueDate:'2026-12-15', isRequired:true, status:'pending', sortOrder:2, documents:[] },
    { id:'s13', title:'Follow-up Email', description:'Target instructors with outstanding submissions.', dueDate:'2026-12-18', isRequired:false, status:'pending', sortOrder:3, documents:[] },
    { id:'s14', title:'Grades Due to Registrar', description:'Hard deadline to push grades to MyCampus.', dueDate:'2026-12-20', isRequired:true, status:'pending', sortOrder:4, documents:[] },
    { id:'s15', title:"Dean's Review", description:'Review distributions and anomaly flags.', dueDate:'2026-12-22', isRequired:true, status:'pending', sortOrder:5, documents:[] },
  ]},
  { id: 't2', title: 'Jane Doe - MSc Defense Tracker', type: 'general', category: 'Academic', description: "Scheduling and tracking milestones for a Master's thesis defense.", createdAt: '2026-08-20', stages: [
    { id:'s21', title:'Submit Draft to Supervisor', description:'Full thesis draft for preliminary review.', dueDate:'2026-09-10', isRequired:true, status:'in-progress', sortOrder:1, documents:[] },
    { id:'s22', title:'Submit Form 1.2', description:'Submit scheduling form to Graduate Studies.', dueDate:'2026-09-25', isRequired:true, status:'pending', sortOrder:2, documents:[] },
    { id:'s23', title:'Oral Defense', description:'Live oral thesis presentation and examination.', dueDate:'2026-10-23', isRequired:true, status:'pending', sortOrder:3, documents:[] },
  ]},
  { id: 't3', title: 'ACM CHI 2027 Research Paper', type: 'general', category: 'Research', description: 'Timeline for the FBIT HCI lab paper submission.', createdAt: '2026-08-25', stages: [
    { id:'s31', title:'Abstract Registration', description:'Register metadata in the submission system.', dueDate:'2026-09-08', isRequired:true, status:'pending', sortOrder:1, documents:[] },
    { id:'s32', title:'First Full Draft', description:'Complete paper draft for internal review.', dueDate:'2026-09-01', isRequired:true, status:'pending', sortOrder:2, documents:[] },
    { id:'s33', title:'Final Submission', description:'Upload the camera-ready paper.', dueDate:'2026-09-15', isRequired:true, status:'pending', sortOrder:3, documents:[] },
  ]},
];

export const demoProfiles: Profile[] = [demoProfile,
  { id:'p2', fullName:'Dr. Alex Mercer', email:'alex.mercer@ontariotechu.ca', role:'instructor', organizationUnit:'Information Technology', isActive:true },
  { id:'p3', fullName:'Prof. Karen Vance', email:'karen.vance@ontariotechu.ca', role:'chair', organizationUnit:'Business Administration', isActive:true },
  { id:'p4', fullName:'Dr. Samantha Wu', email:'samantha.wu@ontariotechu.ca', role:'research_lead', organizationUnit:'Information Technology', isActive:true },
];
