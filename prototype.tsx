import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ListTodo, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Plus, 
  X, 
  ChevronRight, 
  Edit, 
  Trash2, 
  CalendarDays,
  ArrowLeft,
  Settings,
  AlertTriangle,
  Upload,
  FileSpreadsheet,
  BarChart2,
  Check,
  FileText,
  Search,
  Filter,
  Layers,
  SlidersHorizontal,
  GraduationCap,
  Download,
  FileCheck,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';

const INITIAL_COURSES_DB = [
  {
    code: 'INFT 1020U',
    title: 'Intro to Data Structures & Algorithms',
    department: 'Information Technology',
    instructor: 'Dr. Alex Mercer',
    terms: {
      'F24': { average: 71.2, passRate: 83.5, enrolled: 110, distribution: { A: 22, B: 35, C: 28, D: 10, F: 15 } },
      'W25': { average: 73.8, passRate: 86.0, enrolled: 98,  distribution: { A: 25, B: 32, C: 27, D: 11, F: 13 } },
      'S25': { average: 76.5, passRate: 90.2, enrolled: 45,  distribution: { A: 15, B: 18, C: 8,  D: 2,  F: 2 } },
      'F25': { average: 72.4, passRate: 84.1, enrolled: 125, distribution: { A: 28, B: 38, C: 32, D: 12, F: 15 } },
      'W26': { average: 75.1, passRate: 88.3, enrolled: 105, distribution: { A: 30, B: 36, C: 26, D: 8,  F: 5 } },
      'F26': { average: 76.8, passRate: 89.5, enrolled: 118, distribution: { A: 34, B: 40, C: 25, D: 11, F: 8 } }
    }
  },
  {
    code: 'BUSI 1100U',
    title: 'Introduction to Business Operations',
    department: 'Business Administration',
    instructor: 'Prof. Karen Vance',
    terms: {
      'F24': { average: 76.0, passRate: 91.0, enrolled: 210, distribution: { A: 50, B: 80, C: 52, D: 18, F: 10 } },
      'W25': { average: 77.5, passRate: 92.5, enrolled: 195, distribution: { A: 55, B: 75, C: 45, D: 12, F: 8 } },
      'S25': { average: 79.1, passRate: 94.0, enrolled: 80,  distribution: { A: 28, B: 32, C: 15, D: 3,  F: 2 } },
      'F25': { average: 75.8, passRate: 89.8, enrolled: 225, distribution: { A: 52, B: 82, C: 58, D: 19, F: 14 } },
      'W26': { average: 78.2, passRate: 93.1, enrolled: 200, distribution: { A: 60, B: 78, C: 48, D: 8,  F: 6 } },
      'F26': { average: 79.0, passRate: 94.2, enrolled: 230, distribution: { A: 68, B: 85, C: 55, D: 15, F: 7 } }
    }
  },
  {
    code: 'INFT 2020U',
    title: 'Database Systems & SQL',
    department: 'Information Technology',
    instructor: 'Dr. Samantha Wu',
    terms: {
      'F24': { average: 68.5, passRate: 79.2, enrolled: 95,  distribution: { A: 14, B: 28, C: 30, D: 12, F: 11 } },
      'W25': { average: 71.0, passRate: 82.5, enrolled: 88,  distribution: { A: 18, B: 29, C: 26, D: 9,  F: 6 } },
      'S25': { average: 74.2, passRate: 87.0, enrolled: 38,  distribution: { A: 10, B: 15, C: 8,  D: 3,  F: 2 } },
      'F25': { average: 69.8, passRate: 80.6, enrolled: 102, distribution: { A: 18, B: 31, C: 33, D: 12, F: 8 } },
      'W26': { average: 73.4, passRate: 86.8, enrolled: 92,  distribution: { A: 22, B: 34, C: 24, D: 8,  F: 4 } },
      'F26': { average: 72.1, passRate: 83.9, enrolled: 110, distribution: { A: 20, B: 38, C: 32, D: 11, F: 9 } }
    }
  },
  {
    code: 'BUSI 2400U',
    title: 'Corporate Finance & Valuation',
    department: 'Business Administration',
    instructor: 'Dr. Michael Chang',
    terms: {
      'F24': { average: 65.4, passRate: 74.0, enrolled: 140, distribution: { A: 18, B: 32, C: 44, D: 22, F: 24 } },
      'W25': { average: 67.1, passRate: 76.5, enrolled: 135, distribution: { A: 20, B: 35, C: 40, D: 21, F: 19 } },
      'S25': { average: 70.0, passRate: 82.0, enrolled: 50,  distribution: { A: 10, B: 18, C: 13, D: 5,  F: 4 } },
      'F25': { average: 66.2, passRate: 75.1, enrolled: 150, distribution: { A: 21, B: 34, C: 48, D: 25, F: 22 } },
      'W26': { average: 69.5, passRate: 80.2, enrolled: 128, distribution: { A: 24, B: 38, C: 35, D: 18, F: 13 } },
      'F26': { average: 68.0, passRate: 78.5, enrolled: 145, distribution: { A: 22, B: 36, C: 42, D: 22, F: 13 } }
    }
  },
  {
    code: 'INFT 4000U',
    title: 'Senior IT Capstone Project',
    department: 'Information Technology',
    instructor: 'Prof. David Miller',
    terms: {
      'F24': { average: 82.1, passRate: 96.5, enrolled: 70,  distribution: { A: 32, B: 25, C: 10, D: 1,  F: 2 } },
      'W25': { average: 84.0, passRate: 98.0, enrolled: 65,  distribution: { A: 34, B: 22, C: 8,  D: 0,  F: 1 } },
      'S25': { average: 85.5, passRate: 100.0, enrolled: 20, distribution: { A: 12, B: 6,  C: 2,  D: 0,  F: 0 } },
      'F25': { average: 81.8, passRate: 95.8, enrolled: 75,  distribution: { A: 33, B: 26, C: 12, D: 1,  F: 3 } },
      'W26': { average: 83.5, passRate: 97.2, enrolled: 68,  distribution: { A: 32, B: 24, C: 10, D: 0,  F: 2 } },
      'F26': { average: 84.2, passRate: 97.5, enrolled: 80,  distribution: { A: 40, B: 28, C: 8,  D: 2,  F: 2 } }
    }
  }
];

const INITIAL_TRACKERS = [
  {
    id: 't-1',
    title: 'Fall 2026 Grade Submission Portal',
    type: 'grade-submission',
    category: 'Administrative',
    description: 'Faculty-wide portal to upload, compare, and analyze Fall 2026 course grade submissions against historical standards.',
    createdAt: '2026-08-15',
    stages: [
      { id: 's-1-1', title: 'Initial Reminder Email', description: 'Send email to all instructors detailing grade submission process.', dueDate: '2026-11-20', isRequired: true, status: 'completed' },
      { id: 's-1-2', title: 'Final Exams End', description: 'End of official examination period.', dueDate: '2026-12-15', isRequired: true, status: 'pending' },
      { id: 's-1-3', title: 'Follow-up Email (Optional)', description: 'Send targeted email to instructors who haven\'t submitted.', dueDate: '2026-12-18', isRequired: false, status: 'pending' },
      { id: 's-1-4', title: 'Grades Due to Registrar', description: 'Hard deadline to push grades to MyCampus.', dueDate: '2026-12-20', isRequired: true, status: 'pending' },
      { id: 's-1-5', title: 'Dean\'s Review', description: 'Review of grade distributions and anomaly flagging.', dueDate: '2026-12-22', isRequired: true, status: 'pending' }
    ]
  },
  {
    id: 't-2',
    title: 'Jane Doe - MSc Defense Tracker',
    type: 'general',
    category: 'Academic',
    description: 'Scheduling and tracking milestones for Jane Doe\'s Master\'s thesis defense in Information Technology.',
    createdAt: '2026-08-20',
    stages: [
      { id: 's-2-1', title: 'Submit Draft to Supervisor', description: 'Full thesis draft required for preliminary review.', dueDate: '2026-09-10', isRequired: true, status: 'in-progress' },
      { id: 's-2-2', title: 'Submit Form 1.2', description: 'Submit defense scheduling form to Grad Studies (4 weeks prior).', dueDate: '2026-09-25', isRequired: true, status: 'pending' },
      { id: 's-2-3', title: 'Thesis to Committee', description: 'Send finalized thesis copy to examining committee (3 weeks prior).', dueDate: '2026-10-02', isRequired: true, status: 'pending' },
      { id: 's-2-4', title: 'Oral Defense', description: 'Live oral thesis presentation and examination.', dueDate: '2026-10-23', isRequired: true, status: 'pending' },
      { id: 's-2-5', title: 'Submit Final Revisions', description: 'Post-defense corrections uploaded to thesis repository.', dueDate: '2026-11-06', isRequired: false, status: 'pending' }
    ]
  },
  {
    id: 't-3',
    title: 'ACM CHI 2027 Research Paper',
    type: 'general',
    category: 'Research',
    description: 'Timeline for FBIT HCI lab paper submission to ACM CHI 2027.',
    createdAt: '2026-08-25',
    stages: [
      { id: 's-3-1', title: 'Abstract Registration', description: 'Mandatory abstract metadata registration on PCS system.', dueDate: '2026-09-08', isRequired: true, status: 'pending' },
      { id: 's-3-2', title: 'First Full Draft', description: 'Complete paper draft for internal lab review.', dueDate: '2026-09-01', isRequired: true, status: 'overdue' },
      { id: 's-3-3', title: 'Internal Peer Review', description: 'Lab members and co-authors review draft.', dueDate: '2026-09-05', isRequired: false, status: 'pending' },
      { id: 's-3-4', title: 'Final Submission Deadline', description: 'PCS upload closes strictly at 5:00 PM EST.', dueDate: '2026-09-15', isRequired: true, status: 'pending' }
    ]
  }
];

const Badge = ({ children, color }) => {
  const colors = {
    blue: 'bg-blue-100 text-[#003C71]',
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
    gray: 'bg-gray-100 text-gray-700',
    orange: 'bg-orange-100 text-[#EA7600]'
  };
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${colors[color] || colors.gray}`}>
      {children}
    </span>
  );
};

const getStatusColor = (status, dueDate) => {
  if (status === 'completed') return 'green';
  if (status === 'skipped') return 'gray';
  
  const isOverdue = new Date(dueDate) < new Date('2026-09-01') && status !== 'completed';
  if (isOverdue) return 'red';
  if (status === 'in-progress') return 'blue';
  return 'yellow';
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function App() {
  const [trackers, setTrackers] = useState(INITIAL_TRACKERS);
  const [coursesDb, setCoursesDb] = useState(INITIAL_COURSES_DB);
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedTrackerId, setSelectedTrackerId] = useState(null);
  const [activeTab, setActiveTab] = useState('timeline');

  // Analytics Specific State
  const [analyticsMode, setAnalyticsMode] = useState('single-course');
  const [selectedCourseCode, setSelectedCourseCode] = useState('INFT 1020U');
  const [courseSearchTerm, setCourseSearchTerm] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('F26');
  const [multiSelectedCourses, setMultiSelectedCourses] = useState(['INFT 1020U', 'BUSI 1100U', 'INFT 2020U', 'BUSI 2400U', 'INFT 4000U']);

  // Course Submission Checklist State
  const [trackedCourseCodes, setTrackedCourseCodes] = useState(['INFT 1020U', 'BUSI 1100U', 'INFT 2020U', 'BUSI 2400U', 'INFT 4000U']);
  const [submissionFilter, setSubmissionFilter] = useState('all'); // 'all', 'submitted', 'outstanding'
  const [submissionSearchTerm, setSubmissionSearchTerm] = useState('');
  const [manualSubmissionOverrides, setManualSubmissionOverrides] = useState({});

  // Modals & Notifications
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [isTrackerModalOpen, setIsTrackerModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const activeTracker = useMemo(() => 
    trackers.find(t => t.id === selectedTrackerId), 
  [trackers, selectedTrackerId]);

  const analytics = useMemo(() => {
    let totalStages = 0;
    let completedStages = 0;
    let overdueStages = 0;
    let upcomingDeadlines = 0;

    const today = new Date('2026-09-01');
    const twoWeeksFromNow = new Date(today);
    twoWeeksFromNow.setDate(today.getDate() + 14);

    trackers.forEach(tracker => {
      tracker.stages.forEach(stage => {
        totalStages++;
        if (stage.status === 'completed') completedStages++;
        
        const dueDate = new Date(stage.dueDate);
        if (dueDate < today && stage.status !== 'completed' && stage.status !== 'skipped') {
          overdueStages++;
        }
        
        if (dueDate >= today && dueDate <= twoWeeksFromNow && stage.status !== 'completed' && stage.status !== 'skipped') {
          upcomingDeadlines++;
        }
      });
    });

    const activeTrackersCount = trackers.filter(t => 
      !t.stages.every(s => s.status === 'completed' || s.status === 'skipped')
    ).length;

    return { totalStages, completedStages, overdueStages, upcomingDeadlines, activeTrackers: activeTrackersCount, totalTrackers: trackers.length };
  }, [trackers]);

  const handleSaveStage = (stageData) => {
    if (!activeTracker) return;

    const updatedTrackers = trackers.map(tracker => {
      if (tracker.id !== activeTracker.id) return tracker;
      
      let newStages = [...tracker.stages];
      if (editingStage) {
        newStages = newStages.map(s => s.id === stageData.id ? stageData : s);
      } else {
        newStages.push({ ...stageData, id: `s-${Date.now()}` });
      }
      return { ...tracker, stages: newStages };
    });

    setTrackers(updatedTrackers);
    setIsStageModalOpen(false);
    setEditingStage(null);
    showNotification(`Stage "${stageData.title}" updated successfully.`);
  };

  const handleDeleteStage = (stageId) => {
    const updatedTrackers = trackers.map(tracker => {
      if (tracker.id !== activeTracker.id) return tracker;
      return { ...tracker, stages: tracker.stages.filter(s => s.id !== stageId) };
    });
    setTrackers(updatedTrackers);
    setIsStageModalOpen(false);
    setEditingStage(null);
    setDeleteConfirmation(null);
    showNotification("Stage removed.");
  };

  const handleSaveTracker = (trackerData) => {
    if (trackerData.id) {
      setTrackers(trackers.map(t => t.id === trackerData.id ? { ...t, ...trackerData } : t));
    } else {
      const newTracker = {
        ...trackerData,
        id: `t-${Date.now()}`,
        createdAt: new Date().toISOString().split('T')[0],
        stages: trackerData.type === 'grade-submission' ? [
          { id: `s-${Date.now()}-1`, title: 'Course Syllabus & Grading Scheme Finalized', description: 'Instructor posts syllabus.', dueDate: '2026-09-05', isRequired: true, status: 'completed' },
          { id: `s-${Date.now()}-2`, title: 'Midterm Grade Upload Deadline', description: 'Early warning grades submitted.', dueDate: '2026-10-20', isRequired: false, status: 'pending' },
          { id: `s-${Date.now()}-3`, title: 'Final CSV Upload to FBIT Portal', description: 'Upload final student marks for Dean review.', dueDate: '2026-12-18', isRequired: true, status: 'pending' }
        ] : []
      };
      setTrackers([...trackers, newTracker]);
    }
    setIsTrackerModalOpen(false);
    showNotification("Tracker created successfully.");
  };

  const handleDeleteTracker = (trackerId) => {
    setTrackers(trackers.filter(t => t.id !== trackerId));
    setActiveView('dashboard');
    setDeleteConfirmation(null);
    showNotification("Tracker deleted.");
  };

  const openTracker = (id) => {
    setSelectedTrackerId(id);
    setActiveView('tracker-detail');
    setActiveTab('timeline');
  };

  const Sidebar = () => (
    <div className="w-64 bg-[#003C71] text-white flex flex-col h-full hidden md:flex border-r border-blue-900 shadow-xl">
      <div className="p-6 border-b border-blue-800/80">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-[#EA7600] flex items-center justify-center font-black text-white text-lg shadow-sm">
            OT
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white leading-none">OntarioTech</h1>
            <div className="text-[11px] font-bold text-[#EA7600] tracking-wider uppercase mt-0.5">FBIT Tracker</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        <button 
          onClick={() => setActiveView('dashboard')}
          className={`w-full flex items-center px-6 py-3 text-sm font-semibold transition-colors ${activeView === 'dashboard' ? 'bg-blue-800/90 border-r-4 border-[#EA7600] text-white' : 'text-blue-200 hover:bg-blue-900/60 hover:text-white'}`}
        >
          <LayoutDashboard className="w-5 h-5 mr-3 text-[#EA7600]" />
          Dashboard Overview
        </button>
        
        <div className="px-6 py-4 mt-2">
          <div className="text-[10px] uppercase text-blue-300 font-extrabold tracking-widest mb-3">Active Process Trackers</div>
          <div className="space-y-1">
            {trackers.map(t => (
              <button 
                key={t.id}
                onClick={() => openTracker(t.id)}
                className={`w-full flex items-center px-3 py-2.5 text-xs font-medium rounded-lg transition-colors text-left truncate ${selectedTrackerId === t.id && activeView === 'tracker-detail' ? 'bg-blue-800 text-white shadow-inner font-bold' : 'text-blue-100 hover:bg-blue-900/50 hover:text-white'}`}
              >
                {t.type === 'grade-submission' ? (
                  <FileSpreadsheet className="w-4 h-4 mr-2 flex-shrink-0 text-[#EA7600]" />
                ) : (
                  <ListTodo className="w-4 h-4 mr-2 flex-shrink-0 text-blue-300" />
                )}
                <span className="truncate">{t.title}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>
      <div className="p-4 border-t border-blue-800/80 bg-blue-950/40">
        <button 
          onClick={() => setIsTrackerModalOpen(true)}
          className="w-full bg-[#EA7600] hover:bg-orange-600 text-white py-2.5 px-4 rounded-lg flex items-center justify-center transition-all text-xs font-bold shadow-md hover:shadow-lg active:scale-98"
        >
          <Plus className="w-4 h-4 mr-2" /> Create New Tracker
        </button>
      </div>
    </div>
  );

  const Dashboard = () => (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#EA7600]">Faculty of Business and Information Technology</span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">Process Dashboard</h2>
          <p className="text-xs md:text-sm text-gray-500 mt-1">Track deadlines, grade submissions, defense milestones, and academic processes.</p>
        </div>
        <button 
          onClick={() => setIsTrackerModalOpen(true)}
          className="bg-[#003C71] hover:bg-blue-900 text-white px-4 py-2.5 rounded-lg text-xs font-bold flex items-center shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Add New Tracker
        </button>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 flex items-center">
          <div className="bg-blue-50 p-3.5 rounded-xl mr-4"><ListTodo className="w-6 h-6 text-[#003C71]" /></div>
          <div>
            <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">Active Trackers</div>
            <div className="text-2xl font-black text-gray-900">{analytics.activeTrackers} <span className="text-xs font-normal text-gray-400">/ {analytics.totalTrackers}</span></div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 flex items-center">
          <div className="bg-red-50 p-3.5 rounded-xl mr-4"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
          <div>
            <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">Overdue Stages</div>
            <div className="text-2xl font-black text-red-600">{analytics.overdueStages}</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 flex items-center">
          <div className="bg-orange-50 p-3.5 rounded-xl mr-4"><CalendarDays className="w-6 h-6 text-[#EA7600]" /></div>
          <div>
            <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">Upcoming (14 Days)</div>
            <div className="text-2xl font-black text-gray-900">{analytics.upcomingDeadlines}</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 flex items-center">
          <div className="bg-green-50 p-3.5 rounded-xl mr-4"><CheckCircle2 className="w-6 h-6 text-green-600" /></div>
          <div>
            <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">Completed Stages</div>
            <div className="text-2xl font-black text-gray-900">{analytics.completedStages} <span className="text-xs font-normal text-gray-400">/ {analytics.totalStages}</span></div>
          </div>
        </div>
      </div>

      {/* Trackers List Table */}
      <h3 className="text-base font-bold text-gray-900 mb-4">All Managed Process Trackers</h3>
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3.5">Tracker Name & Description</th>
                <th className="px-6 py-3.5">Type & Category</th>
                <th className="px-6 py-3.5">Mandatory Progress</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {trackers.map(tracker => {
                const reqStages = tracker.stages.filter(s => s.isRequired);
                const completedReq = reqStages.filter(s => s.status === 'completed').length;
                const percent = reqStages.length > 0 ? Math.round((completedReq / reqStages.length) * 100) : 0;
                
                const hasOverdue = tracker.stages.some(s => new Date(s.dueDate) < new Date('2026-09-01') && s.status !== 'completed' && s.status !== 'skipped');

                return (
                  <tr key={tracker.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openTracker(tracker.id)}>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900 text-sm">{tracker.title}</div>
                      <div className="text-gray-500 text-xs line-clamp-1 mt-0.5">{tracker.description}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        {tracker.type === 'grade-submission' ? (
                          <span className="px-2 py-0.5 bg-orange-100 text-[#EA7600] rounded text-[10px] font-bold">Grade Analytics</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-bold">General Workflow</span>
                        )}
                        <Badge color="blue">{tracker.category}</Badge>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3 max-w-[180px]">
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div className="bg-[#003C71] h-2 rounded-full transition-all duration-300" style={{ width: `${percent}%` }}></div>
                        </div>
                        <span className="font-bold text-gray-700">{percent}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {percent === 100 ? (
                        <Badge color="green">Completed</Badge>
                      ) : hasOverdue ? (
                        <Badge color="red">Attention Required</Badge>
                      ) : (
                        <Badge color="blue">In Progress</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={(e) => { e.stopPropagation(); openTracker(tracker.id); }}
                        className="text-[#003C71] hover:text-[#EA7600] font-bold text-xs inline-flex items-center"
                      >
                        Inspect <ChevronRight className="w-4 h-4 ml-0.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const TrackerDetail = () => {
    if (!activeTracker) return null;

    const sortedStages = [...activeTracker.stages].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const reqStages = activeTracker.stages.filter(s => s.isRequired);
    const completedReq = reqStages.filter(s => s.status === 'completed').length;
    const progressPercent = reqStages.length > 0 ? Math.round((completedReq / reqStages.length) * 100) : 0;

    const [fileName, setFileName] = useState('');

    const filteredCourses = useMemo(() => {
      return coursesDb.filter(c => 
        c.code.toLowerCase().includes(courseSearchTerm.toLowerCase()) || 
        c.title.toLowerCase().includes(courseSearchTerm.toLowerCase()) ||
        c.instructor.toLowerCase().includes(courseSearchTerm.toLowerCase())
      );
    }, [coursesDb, courseSearchTerm]);

    const selectedCourseObj = useMemo(() => {
      return coursesDb.find(c => c.code === selectedCourseCode) || coursesDb[0];
    }, [coursesDb, selectedCourseCode]);

    const singleCourseHistoricalChartData = useMemo(() => {
      if (!selectedCourseObj) return [];
      return Object.entries(selectedCourseObj.terms).map(([termKey, termData]) => ({
        term: termKey,
        average: termData.average,
        passRate: termData.passRate,
        enrolled: termData.enrolled
      }));
    }, [selectedCourseObj]);

    const multiCoursePeriodData = useMemo(() => {
      return multiSelectedCourses.map(code => {
        const course = coursesDb.find(c => c.code === code);
        if (!course) return null;
        const termInfo = course.terms[selectedTerm] || { average: 0, passRate: 0, enrolled: 0 };
        return {
          code: course.code,
          shortTitle: course.code,
          fullTitle: course.title,
          instructor: course.instructor,
          department: course.department,
          average: termInfo.average,
          passRate: termInfo.passRate,
          enrolled: termInfo.enrolled,
          distribution: termInfo.distribution || { A: 0, B: 0, C: 0, D: 0, F: 0 }
        };
      }).filter(Boolean);
    }, [coursesDb, multiSelectedCourses, selectedTerm]);

    const handleFileUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        processCSV(text);
      };
      reader.readAsText(file);
    };

    const processCSV = (text) => {
      const lines = text.split('\n');
      const grades = [];
      
      lines.forEach(line => {
        const columns = line.split(',');
        for (let col of columns) {
           const num = parseFloat(col.trim());
           if (!isNaN(num) && num >= 0 && num <= 100) {
             grades.push(num);
             break;
           }
        }
      });

      if (grades.length === 0) {
        showNotification("No numeric grades (0-100) found in CSV file.");
        return;
      }

      const totalStudents = grades.length;
      let sum = 0;
      let passed = 0;
      let dist = { A: 0, B: 0, C: 0, D: 0, F: 0 };

      grades.forEach(g => {
        sum += g;
        if (g >= 50) passed++;
        
        if (g >= 80) dist.A++;
        else if (g >= 70) dist.B++;
        else if (g >= 60) dist.C++;
        else if (g >= 50) dist.D++;
        else dist.F++;
      });

      const average = parseFloat((sum / totalStudents).toFixed(1));
      const passRate = parseFloat(((passed / totalStudents) * 100).toFixed(1));

      const updatedDb = coursesDb.map(course => {
        if (course.code !== selectedCourseCode) return course;
        return {
          ...course,
          terms: {
            ...course.terms,
            [selectedTerm]: {
              average,
              passRate,
              enrolled: totalStudents,
              distribution: dist
            }
          }
        };
      });

      setCoursesDb(updatedDb);
      showNotification(`Updated ${selectedCourseCode} (${selectedTerm}) with ${totalStudents} grades (Avg: ${average}%, Pass: ${passRate}%)`);
    };

    const downloadSampleCSV = () => {
      const headers = "StudentID,Name,FinalGrade\n";
      let data = headers;
      for (let i = 1; i <= 100; i++) {
        let grade = Math.floor(Math.random() * 40) + 50; 
        if (Math.random() > 0.8) grade += 8;
        if (Math.random() > 0.9) grade -= 18;
        grade = Math.max(0, Math.min(100, grade));
        data += `100${i},Student ${i},${grade}\n`;
      }
      
      const blob = new Blob([data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sample_Grades_${selectedCourseCode.replace(/\s+/g, '_')}_${selectedTerm}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    };

    const toggleCourseMultiSelect = (code) => {
      if (multiSelectedCourses.includes(code)) {
        if (multiSelectedCourses.length <= 1) {
          showNotification("Select at least one course for comparison.");
          return;
        }
        setMultiSelectedCourses(multiSelectedCourses.filter(c => c !== code));
      } else {
        setMultiSelectedCourses([...multiSelectedCourses, code]);
      }
    };

    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-300">
        <div className="mb-6">
          <button onClick={() => setActiveView('dashboard')} className="inline-flex items-center text-xs font-bold text-[#003C71] hover:text-[#EA7600] mb-3 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
          </button>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center space-x-3 mb-1">
                <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">{activeTracker.title}</h2>
                <Badge color="blue">{activeTracker.category}</Badge>
              </div>
              <p className="text-xs md:text-sm text-gray-600">{activeTracker.description}</p>
            </div>
            
            <button 
              onClick={() => setDeleteConfirmation({ type: 'tracker', id: activeTracker.id, title: activeTracker.title })}
              className="p-2 text-gray-400 hover:text-red-600 border border-gray-200 rounded-lg bg-white hover:bg-red-50 transition-colors"
              title="Delete Tracker"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mt-6 flex items-center bg-white p-4 rounded-xl shadow-xs border border-gray-200">
            <div className="mr-6">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Mandatory Milestone Completion</div>
              <div className="text-2xl font-black text-[#003C71]">{progressPercent}%</div>
            </div>
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div className="bg-[#EA7600] h-3 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {activeTracker.type === 'grade-submission' && (
          <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
            <button 
              onClick={() => setActiveTab('timeline')}
              className={`pb-3 px-4 font-bold text-xs uppercase tracking-wider transition-colors border-b-2 flex items-center whitespace-nowrap ${activeTab === 'timeline' ? 'border-[#EA7600] text-[#EA7600]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            >
              <Calendar className="w-4 h-4 mr-2" /> Timeline & Stages
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`pb-3 px-4 font-bold text-xs uppercase tracking-wider transition-colors border-b-2 flex items-center whitespace-nowrap ${activeTab === 'analytics' ? 'border-[#EA7600] text-[#EA7600]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            >
              <BarChart2 className="w-4 h-4 mr-2" /> Course Grade Analytics & Benchmarking
            </button>
            <button 
              onClick={() => setActiveTab('submissions')}
              className={`pb-3 px-4 font-bold text-xs uppercase tracking-wider transition-colors border-b-2 flex items-center whitespace-nowrap ${activeTab === 'submissions' ? 'border-[#EA7600] text-[#EA7600]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            >
              <FileCheck className="w-4 h-4 mr-2" /> Submissions Status Checklist
            </button>
          </div>
        )}

        {/* TAB 1: TIMELINE & STAGES */}
        {(activeTab === 'timeline' || activeTracker.type !== 'grade-submission') && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-gray-900">Process Milestones Visualizer</h3>
              <button 
                onClick={() => { setEditingStage(null); setIsStageModalOpen(true); }}
                className="bg-[#003C71] hover:bg-blue-900 text-white py-2 px-3 rounded-lg flex items-center transition-colors text-xs font-bold shadow-xs"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add New Stage
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 mb-8 overflow-x-auto">
              <div className="min-w-[700px] flex items-start pt-4 pb-6 relative">
                <div className="absolute top-[32px] left-8 right-8 h-1 bg-gray-200 z-0"></div>
                
                {sortedStages.length === 0 ? (
                  <div className="w-full text-center text-gray-400 py-6 italic relative z-10 bg-white text-xs">No stages defined yet.</div>
                ) : (
                  sortedStages.map((stage, index) => {
                    const sColor = getStatusColor(stage.status, stage.dueDate);
                    const isOverdue = sColor === 'red';
                    
                    const nodeColors = {
                      green: 'bg-green-600 text-white border-green-700',
                      red: 'bg-red-600 text-white border-red-700',
                      blue: 'bg-[#003C71] text-white border-blue-900',
                      yellow: 'bg-white text-gray-500 border-gray-300',
                      gray: 'bg-gray-200 text-gray-500 border-gray-400'
                    };
                    
                    const isPastLine = index < sortedStages.length - 1 && (stage.status === 'completed' || stage.status === 'skipped');

                    return (
                      <div key={stage.id} className="relative flex-1 flex flex-col items-center group cursor-pointer" onClick={() => { setEditingStage(stage); setIsStageModalOpen(true); }}>
                        {isPastLine && (
                          <div className="absolute top-[28px] left-[50%] right-[-50%] h-1 bg-green-600 z-0"></div>
                        )}
                        
                        <div className="relative z-10 mb-3 flex flex-col items-center">
                          <div className="text-[11px] font-bold text-gray-500 mb-2">
                            {formatDate(stage.dueDate)}
                          </div>
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform group-hover:scale-110 shadow-xs ${nodeColors[sColor] || nodeColors.yellow}`}>
                            {stage.status === 'completed' ? <Check className="w-4 h-4 stroke-[3]" /> : 
                             isOverdue ? <AlertCircle className="w-4 h-4" /> : 
                             <div className="w-2.5 h-2.5 rounded-full bg-current"></div>}
                          </div>
                        </div>
                        
                        <div className="text-center px-2 z-10 bg-white group-hover:bg-blue-50/50 p-2 rounded-lg transition-colors w-full">
                          <div className={`text-xs font-bold truncate ${isOverdue ? 'text-red-600' : 'text-gray-900'}`} title={stage.title}>
                            {stage.title}
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1">
                            {!stage.isRequired && <span className="text-gray-400 border border-gray-200 px-1 rounded mr-1">Optional</span>}
                            <Badge color={sColor}>{stage.status}</Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden mb-8">
              <div className="p-4 bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Detailed Stage Milestone Checklist
              </div>
              <ul className="divide-y divide-gray-100">
                {sortedStages.map(stage => {
                  const sColor = getStatusColor(stage.status, stage.dueDate);
                  return (
                    <li key={stage.id} className="p-4 hover:bg-gray-50 transition-colors flex items-start sm:items-center flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-gray-900">{stage.title}</h4>
                          {!stage.isRequired && <Badge color="gray">Optional</Badge>}
                          {sColor === 'red' && <Badge color="red">Overdue</Badge>}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{stage.description || 'No description provided.'}</p>
                      </div>
                      
                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-xs font-medium text-gray-500 flex items-center">
                          <Calendar className="w-3.5 h-3.5 mr-1 text-gray-400" />
                          {formatDate(stage.dueDate)}
                        </div>
                        <Badge color={sColor}>{stage.status}</Badge>
                        <button 
                          onClick={() => { setEditingStage(stage); setIsStageModalOpen(true); }}
                          className="text-gray-400 hover:text-[#003C71] p-1.5 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}

        {/* TAB 2: GRADE ANALYTICS & MULTI-COURSE COMPARISON */}
        {activeTab === 'analytics' && activeTracker.type === 'grade-submission' && (
          <div className="space-y-8">
            
            <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setAnalyticsMode('single-course')}
                  className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center ${analyticsMode === 'single-course' ? 'bg-white text-[#003C71] shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  <GraduationCap className="w-4 h-4 mr-1.5" /> Single Course vs History
                </button>
                <button
                  onClick={() => setAnalyticsMode('multi-course')}
                  className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center ${analyticsMode === 'multi-course' ? 'bg-white text-[#EA7600] shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  <Layers className="w-4 h-4 mr-1.5" /> Multi-Course Time Period Benchmarking
                </button>
              </div>

              <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Term:</label>
                <select 
                  value={selectedTerm} 
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-xs font-bold rounded-lg p-2 focus:ring-[#003C71] focus:border-[#003C71]"
                >
                  <option value="F26">Fall 2026 (Current)</option>
                  <option value="W26">Winter 2026</option>
                  <option value="F25">Fall 2025</option>
                  <option value="S25">Spring/Summer 2025</option>
                  <option value="W25">Winter 2025</option>
                  <option value="F24">Fall 2024</option>
                </select>
              </div>
            </div>

            {/* MODE A: SINGLE COURSE HISTORICAL COMPARISON */}
            {analyticsMode === 'single-course' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 flex flex-col h-full">
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center">
                    <Search className="w-4 h-4 mr-2 text-[#003C71]" /> Course Database Search
                  </h3>
                  
                  <div className="relative mb-4">
                    <input 
                      type="text"
                      placeholder="Search code, title, instructor..."
                      value={courseSearchTerm}
                      onChange={(e) => setCourseSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003C71] outline-none"
                    />
                    <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                  </div>

                  <div className="space-y-2 overflow-y-auto max-h-[400px] pr-1 flex-1">
                    {filteredCourses.map(course => (
                      <button
                        key={course.code}
                        onClick={() => setSelectedCourseCode(course.code)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${selectedCourseCode === course.code ? 'border-[#003C71] bg-blue-50/60 shadow-2xs' : 'border-gray-100 hover:bg-gray-50'}`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-xs text-[#003C71]">{course.code}</span>
                          <span className="text-[10px] text-gray-400">{course.department.split(' ')[0]}</span>
                        </div>
                        <div className="text-xs font-semibold text-gray-800 line-clamp-1 mt-0.5">{course.title}</div>
                        <div className="text-[11px] text-gray-500 mt-1">{course.instructor}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  
                  <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-100 mb-6 gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 text-[#003C71] rounded">{selectedCourseObj?.code}</span>
                          <span className="text-xs text-gray-500">{selectedCourseObj?.department}</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mt-1">{selectedCourseObj?.title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Instructor: <span className="font-semibold text-gray-700">{selectedCourseObj?.instructor}</span></p>
                      </div>

                      <div className="flex flex-col items-end space-y-2">
                        <div className="flex items-center space-x-2">
                          <button onClick={downloadSampleCSV} className="text-xs font-bold text-[#003C71] underline hover:text-[#EA7600]">
                            Sample CSV
                          </button>
                          <label className="bg-[#003C71] hover:bg-blue-900 text-white py-2 px-3 rounded-lg shadow-xs cursor-pointer transition-colors text-xs font-bold flex items-center">
                            <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Grades for {selectedTerm}
                            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                          </label>
                        </div>
                      </div>
                    </div>

                    {selectedCourseObj?.terms[selectedTerm] ? (
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-center">
                          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{selectedTerm} Class Avg</div>
                          <div className="text-2xl font-black text-[#003C71] mt-0.5">{selectedCourseObj.terms[selectedTerm].average}%</div>
                        </div>
                        <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-center">
                          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{selectedTerm} Pass Rate</div>
                          <div className="text-2xl font-black text-green-600 mt-0.5">{selectedCourseObj.terms[selectedTerm].passRate}%</div>
                        </div>
                        <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-center">
                          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Enrolled</div>
                          <div className="text-2xl font-black text-gray-800 mt-0.5">{selectedCourseObj.terms[selectedTerm].enrolled}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs rounded-lg mb-6">
                        No grade submission uploaded for <strong>{selectedCourseCode}</strong> in term <strong>{selectedTerm}</strong>. Upload CSV to generate report.
                      </div>
                    )}

                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Historical Course Trend Across Terms</h4>
                    <div className="w-full h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={singleCourseHistoricalChartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="term" tick={{ fontSize: 11 }} />
                          <YAxis domain={[50, 100]} tick={{ fontSize: 11 }} />
                          <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Line type="monotone" dataKey="average" stroke="#003C71" strokeWidth={3} name="Class Average (%)" activeDot={{ r: 6 }} />
                          <Line type="monotone" dataKey="passRate" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" name="Pass Rate (%)" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {selectedCourseObj?.terms[selectedTerm] && (
                    <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6">
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-4">Grade Distribution Breakdown ({selectedCourseCode} - {selectedTerm})</h4>
                      <div className="w-full h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[
                            { grade: 'A (80-100)', count: selectedCourseObj.terms[selectedTerm].distribution?.A || 0 },
                            { grade: 'B (70-79)', count: selectedCourseObj.terms[selectedTerm].distribution?.B || 0 },
                            { grade: 'C (60-69)', count: selectedCourseObj.terms[selectedTerm].distribution?.C || 0 },
                            { grade: 'D (50-59)', count: selectedCourseObj.terms[selectedTerm].distribution?.D || 0 },
                            { grade: 'F (<50)', count: selectedCourseObj.terms[selectedTerm].distribution?.F || 0 }
                          ]} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="grade" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="count" fill="#EA7600" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* MODE B: MULTI-COURSE TIME PERIOD COMPARISON */}
            {analyticsMode === 'multi-course' && (
              <div className="space-y-6">
                
                <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">Select Courses to Compare for {selectedTerm}</h3>
                      <p className="text-xs text-gray-500">Check courses from database to plot in comparative period analysis.</p>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => setMultiSelectedCourses(coursesDb.map(c => c.code))}
                        className="text-xs font-bold text-[#003C71] hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-gray-300">|</span>
                      <button 
                        onClick={() => setMultiSelectedCourses([coursesDb[0]?.code])}
                        className="text-xs font-bold text-gray-500 hover:underline"
                      >
                        Reset Selection
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {coursesDb.map(c => {
                      const isSelected = multiSelectedCourses.includes(c.code);
                      return (
                        <button
                          key={c.code}
                          onClick={() => toggleCourseMultiSelect(c.code)}
                          className={`p-3 rounded-lg border text-left transition-all ${isSelected ? 'border-[#EA7600] bg-orange-50/50 text-gray-900 shadow-2xs' : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300'}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-extrabold text-xs">{c.code}</span>
                            <div className={`w-4 h-4 rounded flex items-center justify-center text-white ${isSelected ? 'bg-[#EA7600]' : 'border border-gray-300 bg-white'}`}>
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>
                          <div className="text-[10px] text-gray-500 truncate">{c.instructor}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6">
                  <h3 className="text-base font-bold text-gray-900 mb-1">Class Average & Pass Rate Comparison ({selectedTerm})</h3>
                  <p className="text-xs text-gray-500 mb-6">Cross-course benchmarks for faculty review and quality management.</p>
                  
                  <div className="w-full h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={multiCoursePeriodData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="shortTitle" tick={{ fontSize: 12, fontWeight: 'bold' }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <RechartsTooltip 
                          formatter={(value, name) => [`${value}%`, name]}
                          labelFormatter={(label) => {
                            const found = multiCoursePeriodData.find(d => d.shortTitle === label);
                            return found ? `${found.code} - ${found.fullTitle} (${found.instructor})` : label;
                          }}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="average" name="Class Average (%)" fill="#003C71" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="passRate" name="Pass Rate (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-700 uppercase tracking-wider flex justify-between items-center">
                    <span>FBIT Course Benchmarking Breakdown ({selectedTerm})</span>
                    <span className="text-gray-400 font-normal">{multiCoursePeriodData.length} Courses Selected</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider bg-gray-50/50">
                          <th className="px-6 py-3">Course Code & Title</th>
                          <th className="px-6 py-3">Instructor</th>
                          <th className="px-6 py-3">Enrolled</th>
                          <th className="px-6 py-3">Class Average</th>
                          <th className="px-6 py-3">Pass Rate</th>
                          <th className="px-6 py-3 text-right">Status Flag</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {multiCoursePeriodData.map(course => {
                          const isLowAverage = course.average < 70;
                          const isLowPass = course.passRate < 80;

                          return (
                            <tr key={course.code} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-bold text-gray-900">{course.code}</div>
                                <div className="text-gray-500 text-[11px]">{course.fullTitle}</div>
                              </td>
                              <td className="px-6 py-4 text-gray-700 font-medium">{course.instructor}</td>
                              <td className="px-6 py-4 text-gray-600">{course.enrolled} students</td>
                              <td className="px-6 py-4">
                                <span className={`font-extrabold ${isLowAverage ? 'text-red-600' : 'text-[#003C71]'}`}>
                                  {course.average}%
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`font-extrabold ${isLowPass ? 'text-orange-600' : 'text-green-600'}`}>
                                  {course.passRate}%
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                {isLowAverage || isLowPass ? (
                                  <Badge color="red">Requires Attention</Badge>
                                ) : (
                                  <Badge color="green">Normal Range</Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {}
        {/* TAB 3: COURSE SUBMISSIONS STATUS CHECKLIST */}
        {activeTab === 'submissions' && activeTracker.type === 'grade-submission' && (() => {
          // Process target tracked courses submission status
          const trackedCoursesList = trackedCourseCodes.map(code => {
            const courseObj = coursesDb.find(c => c.code === code) || {
              code,
              title: 'Custom Tracked Course',
              instructor: 'Unassigned',
              department: 'FBIT',
              terms: {}
            };

            const termData = courseObj.terms?.[selectedTerm];
            const autoIsSubmitted = Boolean(termData && (termData.enrolled > 0 || termData.average > 0));
            const isManualOverride = manualSubmissionOverrides[`${code}_${selectedTerm}`];
            const isSubmitted = isManualOverride !== undefined ? isManualOverride : autoIsSubmitted;

            return {
              ...courseObj,
              termData,
              isSubmitted,
              autoIsSubmitted
            };
          });

          const totalTracked = trackedCoursesList.length;
          const submittedCount = trackedCoursesList.filter(c => c.isSubmitted).length;
          const outstandingCount = totalTracked - submittedCount;
          const submissionPercent = totalTracked > 0 ? Math.round((submittedCount / totalTracked) * 100) : 0;

          const filteredTrackedList = trackedCoursesList.filter(c => {
            const matchesFilter = submissionFilter === 'all' ? true :
                                 submissionFilter === 'submitted' ? c.isSubmitted :
                                 !c.isSubmitted;
            const matchesSearch = c.code.toLowerCase().includes(submissionSearchTerm.toLowerCase()) ||
                                  c.title.toLowerCase().includes(submissionSearchTerm.toLowerCase()) ||
                                  c.instructor.toLowerCase().includes(submissionSearchTerm.toLowerCase());
            return matchesFilter && matchesSearch;
          });

          const handleTrackedCoursesCSVUpload = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
              const text = event.target.result;
              const lines = text.split('\n');
              const newCodes = [];

              lines.forEach((line, index) => {
                if (!line.trim() || index === 0 && line.toLowerCase().includes('course')) return; // Skip header/empty
                const parts = line.split(',');
                const codeCandidate = parts[0]?.trim()?.toUpperCase();
                if (codeCandidate && codeCandidate.length >= 4) {
                  newCodes.push(codeCandidate);
                  
                  // Ensure course exists in DB if new
                  if (!coursesDb.some(c => c.code === codeCandidate)) {
                    coursesDb.push({
                      code: codeCandidate,
                      title: parts[1]?.trim() || `Course ${codeCandidate}`,
                      department: parts[3]?.trim() || 'Faculty of Business and IT',
                      instructor: parts[2]?.trim() || 'TBD Instructor',
                      terms: {}
                    });
                  }
                }
              });

              if (newCodes.length > 0) {
                const uniqueCodes = Array.from(new Set(newCodes));
                setTrackedCourseCodes(uniqueCodes);
                showNotification(`Loaded ${uniqueCodes.length} target courses to track for ${selectedTerm}.`);
              } else {
                showNotification("Could not parse valid course codes from CSV.");
              }
            };
            reader.readAsText(file);
          };

          const downloadOutstandingReport = () => {
            const outstandingList = trackedCoursesList.filter(c => !c.isSubmitted);
            let csv = `Course Code,Course Title,Instructor,Department,Status,Term\n`;
            outstandingList.forEach(c => {
              csv += `"${c.code}","${c.title}","${c.instructor}","${c.department}","Outstanding","${selectedTerm}"\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Outstanding_Grade_Submissions_${selectedTerm}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
            showNotification(`Exported ${outstandingList.length} outstanding courses report.`);
          };

          const downloadSampleTargetListCSV = () => {
            let csv = `CourseCode,CourseTitle,Instructor,Department\n`;
            csv += `INFT 1020U,Intro to Data Structures & Algorithms,Dr. Alex Mercer,Information Technology\n`;
            csv += `BUSI 1100U,Introduction to Business Operations,Prof. Karen Vance,Business Administration\n`;
            csv += `INFT 2020U,Database Systems & SQL,Dr. Samantha Wu,Information Technology\n`;
            csv += `BUSI 2400U,Corporate Finance & Valuation,Dr. Michael Chang,Business Administration\n`;
            csv += `INFT 4000U,Senior IT Capstone Project,Prof. David Miller,Information Technology\n`;

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Sample_Target_Tracked_Courses.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
          };

          const toggleManualStatus = (code) => {
            const key = `${code}_${selectedTerm}`;
            const currentOverride = manualSubmissionOverrides[key];
            const courseObj = trackedCoursesList.find(c => c.code === code);
            const defaultStatus = courseObj?.autoIsSubmitted;

            let nextVal;
            if (currentOverride === undefined) {
              nextVal = !defaultStatus;
            } else {
              nextVal = !currentOverride;
            }

            setManualSubmissionOverrides({ ...manualSubmissionOverrides, [key]: nextVal });
            showNotification(`Updated ${code} status to ${nextVal ? 'Submitted' : 'Outstanding'}.`);
          };

          return (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Top Controls & Setup Bar */}
              <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-extrabold text-gray-900">Faculty Grade Submission Checklist</h3>
                    <Badge color="blue">{selectedTerm}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Courses auto-check off as "Submitted" when final grades are uploaded in Course Analytics.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button 
                    onClick={downloadSampleTargetListCSV}
                    className="text-xs font-bold text-[#003C71] hover:text-[#EA7600] underline px-2 py-1"
                  >
                    Sample Target CSV
                  </button>

                  <label className="bg-[#003C71] hover:bg-blue-900 text-white py-2 px-3 rounded-lg text-xs font-bold flex items-center shadow-xs cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Target Course List (.csv)
                    <input type="file" accept=".csv" className="hidden" onChange={handleTrackedCoursesCSVUpload} />
                  </label>

                  <button 
                    onClick={downloadOutstandingReport}
                    className="bg-orange-100 hover:bg-orange-200 text-[#EA7600] py-2 px-3 rounded-lg text-xs font-bold flex items-center transition-colors border border-orange-200"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Export Outstanding Report
                  </button>
                </div>
              </div>

              {/* Stat Progress Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-5">
                  <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">Target Tracked Courses</div>
                  <div className="text-3xl font-black text-gray-900 mt-1">{totalTracked}</div>
                  <div className="text-[11px] text-gray-400 mt-1">Active list for {selectedTerm}</div>
                </div>

                <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-5">
                  <div className="text-xs text-green-700 font-bold uppercase tracking-wider flex justify-between items-center">
                    <span>Grades Submitted</span>
                    <span className="font-extrabold">{submissionPercent}%</span>
                  </div>
                  <div className="text-3xl font-black text-green-600 mt-1">{submittedCount} <span className="text-xs font-normal text-gray-400">/ {totalTracked}</span></div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-3 overflow-hidden">
                    <div className="bg-green-600 h-2 rounded-full transition-all duration-500" style={{ width: `${submissionPercent}%` }}></div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-5">
                  <div className="text-xs text-red-600 font-bold uppercase tracking-wider">Outstanding / Pending</div>
                  <div className="text-3xl font-black text-red-600 mt-1">{outstandingCount}</div>
                  <div className="text-[11px] text-gray-400 mt-1">Awaiting instructor grade upload</div>
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg w-full sm:w-auto">
                  <button 
                    onClick={() => setSubmissionFilter('all')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition-all ${submissionFilter === 'all' ? 'bg-white text-[#003C71] shadow-2xs' : 'text-gray-600'}`}
                  >
                    All ({totalTracked})
                  </button>
                  <button 
                    onClick={() => setSubmissionFilter('submitted')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition-all ${submissionFilter === 'submitted' ? 'bg-white text-green-700 shadow-2xs' : 'text-gray-600'}`}
                  >
                    Submitted ({submittedCount})
                  </button>
                  <button 
                    onClick={() => setSubmissionFilter('outstanding')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition-all ${submissionFilter === 'outstanding' ? 'bg-white text-red-600 shadow-2xs' : 'text-gray-600'}`}
                  >
                    Outstanding ({outstandingCount})
                  </button>
                </div>

                <div className="relative w-full sm:w-72">
                  <input 
                    type="text" 
                    placeholder="Search code, title, instructor..."
                    value={submissionSearchTerm}
                    onChange={(e) => setSubmissionSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003C71] outline-none"
                  />
                  <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2" />
                </div>
              </div>

              {/* Submissions Checklist Table */}
              <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        <th className="px-6 py-3.5">Submission Status</th>
                        <th className="px-6 py-3.5">Course Code & Name</th>
                        <th className="px-6 py-3.5">Instructor & Dept</th>
                        <th className="px-6 py-3.5">Term Metrics</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {filteredTrackedList.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-6 py-8 text-center text-gray-400 italic">
                            No courses match the current filter or search query.
                          </td>
                        </tr>
                      ) : (
                        filteredTrackedList.map(course => (
                          <tr key={course.code} className={`hover:bg-gray-50 transition-colors ${course.isSubmitted ? 'bg-green-50/20' : ''}`}>
                            
                            <td className="px-6 py-4">
                              {course.isSubmitted ? (
                                <div className="inline-flex items-center text-green-700 bg-green-100 px-2.5 py-1 rounded-md font-bold text-xs">
                                  <CheckCircle className="w-4 h-4 mr-1.5 fill-green-600 text-white" /> Submitted
                                </div>
                              ) : (
                                <div className="inline-flex items-center text-red-700 bg-red-100 px-2.5 py-1 rounded-md font-bold text-xs">
                                  <XCircle className="w-4 h-4 mr-1.5 fill-red-600 text-white" /> Outstanding
                                </div>
                              )}
                            </td>

                            <td className="px-6 py-4">
                              <div className="font-extrabold text-gray-900 text-sm">{course.code}</div>
                              <div className="text-gray-600 text-xs mt-0.5 line-clamp-1">{course.title}</div>
                            </td>

                            <td className="px-6 py-4">
                              <div className="font-semibold text-gray-800">{course.instructor}</div>
                              <div className="text-gray-400 text-[11px]">{course.department}</div>
                            </td>

                            <td className="px-6 py-4">
                              {course.termData ? (
                                <div className="space-y-0.5">
                                  <div className="text-gray-800 font-bold">Class Avg: <span className="text-[#003C71]">{course.termData.average}%</span></div>
                                  <div className="text-gray-500 text-[11px]">Enrolled: {course.termData.enrolled} | Pass: {course.termData.passRate}%</div>
                                </div>
                              ) : (
                                <span className="text-gray-400 italic text-[11px]">No CSV grade data uploaded</span>
                              )}
                            </td>

                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={() => {
                                    setSelectedCourseCode(course.code);
                                    setActiveTab('analytics');
                                    setAnalyticsMode('single-course');
                                  }}
                                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#003C71] font-bold rounded-md transition-colors text-xs inline-flex items-center"
                                  title="Upload or Inspect Grade CSV in Analytics"
                                >
                                  <Upload className="w-3.5 h-3.5 mr-1" />
                                  {course.isSubmitted ? 'View Data' : 'Upload CSV'}
                                </button>

                                <button
                                  onClick={() => toggleManualStatus(course.code)}
                                  className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                                  title="Toggle status manually"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>

                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          );
        })()}
      </div>
    );
  };

  const StageModal = () => {
    if (!isStageModalOpen) return null;
    
    const [formData, setFormData] = useState(
      editingStage || {
        title: '',
        description: '',
        dueDate: new Date().toISOString().split('T')[0],
        isRequired: true,
        status: 'pending'
      }
    );

    const handleSubmit = (e) => {
      e.preventDefault();
      handleSaveStage(formData);
    };

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
          <div className="px-6 py-4 bg-[#003C71] text-white flex justify-between items-center">
            <h3 className="text-base font-bold">{editingStage ? 'Edit Milestone Stage' : 'Add New Milestone Stage'}</h3>
            <button onClick={() => setIsStageModalOpen(false)} className="text-blue-200 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Stage Title</label>
              <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} 
                className="w-full p-2.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#EA7600] outline-none" 
                placeholder="e.g., Send Grade Reminder Email" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Description</label>
              <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} 
                className="w-full p-2.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#EA7600] outline-none" 
                rows="3" placeholder="Additional details or guidelines..." />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Deadline Date</label>
              <input required type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} 
                className="w-full p-2.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#EA7600] outline-none" />
            </div>

            <div className="flex items-center justify-between border-t border-b border-gray-100 py-3">
              <span className="text-xs font-bold text-gray-700">Is this milestone mandatory?</span>
              <input type="checkbox" checked={formData.isRequired} onChange={e => setFormData({...formData, isRequired: e.target.checked})} className="w-4 h-4 accent-[#EA7600]" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Status</label>
              <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}
                className="w-full p-2.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#EA7600] outline-none bg-white font-semibold">
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="skipped">Skipped / N/A</option>
              </select>
            </div>

            <div className="pt-4 flex justify-between items-center">
              {editingStage ? (
                <button type="button" onClick={() => setDeleteConfirmation({ type: 'stage', id: editingStage.id, title: editingStage.title })} className="text-red-600 hover:text-red-800 text-xs font-bold flex items-center">
                  <Trash2 className="w-4 h-4 mr-1" /> Delete Stage
                </button>
              ) : <div />}
              
              <div className="space-x-2">
                <button type="button" onClick={() => setIsStageModalOpen(false)} className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[#EA7600] hover:bg-orange-600 text-white text-xs font-bold rounded-lg shadow-xs transition-colors">Save Stage</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const TrackerModal = () => {
    if (!isTrackerModalOpen) return null;
    
    const [formData, setFormData] = useState({
      title: '',
      type: 'general',
      category: 'Administrative',
      description: ''
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      handleSaveTracker(formData);
    };

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
          <div className="px-6 py-4 bg-[#003C71] text-white flex justify-between items-center">
            <h3 className="text-base font-bold">Create New Process Tracker</h3>
            <button onClick={() => setIsTrackerModalOpen(false)} className="text-blue-200 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tracker Title</label>
              <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} 
                className="w-full p-2.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003C71] outline-none" 
                placeholder="e.g., Winter 2027 Grade Submission" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tracker Functionality Type</label>
              <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}
                className="w-full p-2.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003C71] outline-none bg-white font-semibold">
                <option value="general">Standard Process & Stage Tracker</option>
                <option value="grade-submission">Grade Submission & Course Benchmarking Analytics</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Category</label>
              <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full p-2.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003C71] outline-none bg-white font-semibold">
                <option value="Administrative">Administrative</option>
                <option value="Academic">Academic</option>
                <option value="Research">Research</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Description</label>
              <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} 
                className="w-full p-2.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003C71] outline-none" 
                rows="3" placeholder="Describe the workflow goals and requirements..." />
            </div>

            <div className="pt-4 flex justify-end space-x-2">
              <button type="button" onClick={() => setIsTrackerModalOpen(false)} className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-[#003C71] hover:bg-blue-900 text-white text-xs font-bold rounded-lg shadow-xs transition-colors">Create Tracker</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const DeleteConfirmModal = () => {
    if (!deleteConfirmation) return null;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
          <div className="flex items-center space-x-3 text-red-600 mb-3">
            <AlertTriangle className="w-6 h-6" />
            <h3 className="text-base font-bold">Confirm Deletion</h3>
          </div>
          <p className="text-xs text-gray-600 mb-6">
            Are you sure you want to delete <strong>"{deleteConfirmation.title}"</strong>? This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-2">
            <button onClick={() => setDeleteConfirmation(null)} className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800">Cancel</button>
            <button 
              onClick={() => {
                if (deleteConfirmation.type === 'tracker') handleDeleteTracker(deleteConfirmation.id);
                else if (deleteConfirmation.type === 'stage') handleDeleteStage(deleteConfirmation.id);
              }} 
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      <Sidebar />
      
      {/* Mobile Top Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#003C71] text-white flex items-center px-4 justify-between z-20 shadow-md">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded bg-[#EA7600] flex items-center justify-center font-black text-white text-sm">OT</div>
          <span className="font-bold text-sm text-white">FBIT Tracker</span>
        </div>
        <button onClick={() => setActiveView('dashboard')} className="p-1 text-blue-200">
          <LayoutDashboard className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto mt-14 md:mt-0 relative">
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-xl text-xs font-semibold flex items-center space-x-2 border border-gray-700 animate-in fade-in slide-in-from-bottom-5">
            <Check className="w-4 h-4 text-green-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {activeView === 'dashboard' ? <Dashboard /> : <TrackerDetail />}
      </div>

      <StageModal />
      <TrackerModal />
      <DeleteConfirmModal />
    </div>
  );
}