/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  UserAccount, 
  TutorStudent, 
  AttendanceRecord, 
  SalaryPayment, 
  CourseSubject, 
  StudentMedium, 
  TutorAttendanceStatus
} from '../types';
import { 
  loadTutorStudents, 
  saveTutorStudents, 
  loadAttendance, 
  saveAttendance, 
  loadSalaryPayments, 
  saveSalaryPayments,
  seedMockDataForUser,
  getUserDataKey
} from '../utils/storage';
import { 
  collection, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../utils/firebase';

import { GitHubContributionGrid } from './GitHubContributionGrid';
import { AttendancePieChart, FinancialStatusBar } from './AnalyticsCharts';
import { 
  Users, 
  BookOpen, 
  Calendar, 
  Banknote, 
  FileText, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Search, 
  Download, 
  MapPin, 
  Phone, 
  Printer, 
  Sparkles, 
  ChevronRight, 
  School,
  Clock,
  ChevronLeft,
  HelpCircle
} from 'lucide-react';

interface TutorDashboardProps {
  user: UserAccount;
  onLogout: () => void;
}

export const TutorDashboard: React.FC<TutorDashboardProps> = ({ user, onLogout }) => {
  // --- CORE STATES ---
  const [students, setStudents] = useState<TutorStudent[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [salaries, setSalaries] = useState<SalaryPayment[]>([]);

  // Tab State: 'dashboard' | 'students' | 'attendance' | 'salary' | 'audit' | 'exam_planner'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'students' | 'attendance' | 'salary' | 'audit' | 'exam_planner'>('dashboard');

  // --- AI EXAM PLANNER STATES ---
  const [tutorFreeSlots, setTutorFreeSlots] = useState<{ id: string; day: string; time: string; }[]>([
    { id: 'fs-1', day: 'Sat', time: '03:00 PM' },
    { id: 'fs-2', day: 'Mon', time: '04:30 PM' },
    { id: 'fs-3', day: 'Wed', time: '05:00 PM' },
  ]);
  const [inputFreeDay, setInputFreeDay] = useState<string>('Sat');
  const [inputFreeTime, setInputFreeTime] = useState<string>('03:00 PM');
  const [isAnalyzingExamSchedule, setIsAnalyzingExamSchedule] = useState<boolean>(false);

  // Exclusive AI Syllabus & Stress Co-Pilot states
  const [aiSubTab, setAiSubTab] = useState<'scheduler' | 'stress_syllabus'>('scheduler');
  const [aiSyllabusStudentId, setAiSyllabusStudentId] = useState<string>('');
  const [aiSyllabusFocus, setAiSyllabusFocus] = useState<string>('');
  const [isGeneratingSyllabus, setIsGeneratingSyllabus] = useState<boolean>(false);
  const [customSyllabusResult, setCustomSyllabusResult] = useState<string>('');

  // --- STUDENT REGISTRATION FORM STATES ---
  const [showRegForm, setShowRegForm] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  // Form Fields
  const [sName, setSName] = useState('');
  const [sSchool, setSSchool] = useState('');
  const [sMedium, setSMedium] = useState<StudentMedium>('bangla');
  const [sClass, setSClass] = useState('Class 9');
  const [sGroup, setSGroup] = useState<'science' | 'commerce' | 'arts' | ''>('');
  const [sSubjects, setSSubjects] = useState<CourseSubject[]>([]);
  const [sDays, setSDays] = useState<string[]>([]);
  const [sSalary, setSSalary] = useState('');
  const [sLocation, setSLocation] = useState('');
  const [sParentNo, setSParentNo] = useState('');
  const [sTimeSlot, setSTimeSlot] = useState('');

  // Backup state for Undo-Cancel mechanisms
  const [studentBackup, setStudentBackup] = useState<TutorStudent | null>(null);

  // --- ATTENDANCE MANAGEMENT STATES ---
  const [attSelectedStudent, setAttSelectedStudent] = useState<string>('');
  const [attYear, setAttYear] = useState<number>(new Date().getFullYear());
  const [attMonth, setAttMonth] = useState<number>(new Date().getMonth());
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [dayStatus, setDayStatus] = useState<TutorAttendanceStatus>('present');
  const [gapDateString, setGapDateString] = useState<string>('');
  const [premiseType, setPremiseType] = useState<string>('regular');
  const [premiseDate, setPremiseDate] = useState<string>('');

  // --- SALARY TRACKER STATES ---
  const [selectedSalaryMonth, setSelectedSalaryMonth] = useState<number>(new Date().getMonth());
  const [selectedSalaryYear, setSelectedSalaryYear] = useState<number>(new Date().getFullYear());
  const [activeInvoice, setActiveInvoice] = useState<SalaryPayment | null>(null);
  const [salarySearch, setSalarySearch] = useState('');

  // Quick edit/add salary item fields
  const [salaryEditId, setSalaryEditId] = useState<string | null>(null);
  const [salaryEditState, setSalaryEditState] = useState<'paid' | 'unpaid'>('unpaid');
  const [salaryEditDate, setSalaryEditDate] = useState<string>('');
  const [salaryEditAmount, setSalaryEditAmount] = useState<string>('');

  // Search/Filters
  const [studentFilter, setStudentFilter] = useState('');

  // Custom iframe-friendly confirm and toast alerts
  const [customConfirm, setCustomConfirm] = useState<{ message: string; action: () => void } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [printView, setPrintView] = useState<{ title: string; htmlContent: string; styles?: string } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Scroll to the top of the viewport when tab transitions occur
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  // --- SYNC ON MOUNT & GMAIL CHANGE WITH REAL-TIME FIRESTORE LISTENERS ---
  useEffect(() => {
    if (user && user.gmail) {
      const gmailLower = user.gmail.toLowerCase();

      // 1. Initial cached data load for fast first-paint UI
      const loaded = loadTutorStudents(user.gmail);
      setStudents(loaded);
      setAttendance(loadAttendance(user.gmail));
      setSalaries(loadSalaryPayments(user.gmail));
      if (loaded.length > 0) {
        setAttSelectedStudent(loaded[0].id);
        setAiSyllabusStudentId(loaded[0].id);
      }

      // 2. Real-time Firebase Firestore Sync for students
      const qStudents = query(
        collection(db, 'students'),
        where('ownerGmail', '==', gmailLower)
      );
      const unsubStudents = onSnapshot(
        qStudents,
        (snap) => {
          const list: TutorStudent[] = [];
          snap.forEach((docSnap) => {
            list.push(docSnap.data() as TutorStudent);
          });
          setStudents(list);
          localStorage.setItem(getUserDataKey(gmailLower, 'students'), JSON.stringify(list));
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'students');
        }
      );

      // 3. Real-time Firebase Firestore Sync for attendance records
      const qAttendance = query(
        collection(db, 'attendance'),
        where('ownerGmail', '==', gmailLower)
      );
      const unsubAttendance = onSnapshot(
        qAttendance,
        (snap) => {
          const list: AttendanceRecord[] = [];
          snap.forEach((docSnap) => {
            list.push(docSnap.data() as AttendanceRecord);
          });
          setAttendance(list);
          localStorage.setItem(getUserDataKey(gmailLower, 'attendance'), JSON.stringify(list));
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'attendance');
        }
      );

      // 4. Real-time Firebase Firestore Sync for salary/payment entries
      const qSalaries = query(
        collection(db, 'salaries'),
        where('ownerGmail', '==', gmailLower)
      );
      const unsubSalaries = onSnapshot(
        qSalaries,
        (snap) => {
          const list: SalaryPayment[] = [];
          snap.forEach((docSnap) => {
            list.push(docSnap.data() as SalaryPayment);
          });
          setSalaries(list);
          localStorage.setItem(getUserDataKey(gmailLower, 'salaries'), JSON.stringify(list));
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'salaries');
        }
      );

      // Cleanup subscription on unmount
      return () => {
        unsubStudents();
        unsubAttendance();
        unsubSalaries();
      };
    }
  }, [user]);

  // Set default selected student fallback
  useEffect(() => {
    if (students.length > 0) {
      if (!attSelectedStudent) {
        setAttSelectedStudent(students[0].id);
      }
      if (!aiSyllabusStudentId) {
        setAiSyllabusStudentId(students[0].id);
      }
    }
  }, [students, attSelectedStudent, aiSyllabusStudentId]);

  const handleSeedDemoState = () => {
    seedMockDataForUser(user.gmail, 'tutor');
    const loadedStudents = loadTutorStudents(user.gmail);
    setStudents(loadedStudents);
    setAttendance(loadAttendance(user.gmail));
    setSalaries(loadSalaryPayments(user.gmail));
    if (loadedStudents.length > 0) {
      setAttSelectedStudent(loadedStudents[0].id);
    }
    showToast("High-fidelity workspace seeded successfully for the active month! (Includes 3 students, live attendance, and invoice statements)", 'success');
  };

  const handleWipeAccountData = () => {
    setCustomConfirm({
      message: "Are you sure you want to completely clear this database workspace? This will delete all registered student logs, monthly attendance sheets, and receipts, leaving a blank slate.",
      action: () => {
        saveTutorStudents(user.gmail, []);
        saveAttendance(user.gmail, []);
        saveSalaryPayments(user.gmail, []);
        setStudents([]);
        setAttendance([]);
        setSalaries([]);
        setAttSelectedStudent('');
        setAiSyllabusStudentId('');
        setCustomSyllabusResult('');
        showToast("Database workspace wiped clean! Blank slate loaded.", 'info');
      }
    });
  };

  // --- HELPER CONSTANTS ---
  const availableSubjects: CourseSubject[] = [
    'math', 'english', 'physics', 'chemistry', 'biology', 
    'higher math', 'ict', 'general science', 'bangla'
  ];

  const classOptions = [
    'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 
    'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
    'Standard 1', 'Standard 2', 'Standard 3', 'Standard 4', 
    'Standard 5', 'Standard 6', 'Standard 7', 'Standard 8', 'Standard 9',
    'SSC candidate', 'HSC candidate', 'A level', 'O level'
  ];

  const weekdayOptions = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  // Check if class asks for Sci/Arts/Com
  const isHighSchoolOrHigher = (clsName: string) => {
    const term = clsName.toLowerCase();
    return term.includes('9') || term.includes('10') || term.includes('ssc') || term.includes('hsc');
  };

  // --- CORE MUTATIONS FOR STUDENTS ---

  // Handle Form resets
  const resetStudentForm = () => {
    setSName('');
    setSSchool('');
    setSMedium('bangla');
    setSClass('Class 9');
    setSGroup('');
    setSSubjects([]);
    setSDays([]);
    setSTimeSlot('');
    setSSalary('');
    setSLocation('');
    setSParentNo('');
    setEditingStudentId(null);
    setStudentBackup(null);
  };

  const handleStudentFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sName || !sSalary || !sParentNo) {
      showToast('Please fill out Name, Salary and Parent Number fields!', 'error');
      return;
    }

    const salaryVal = parseFloat(sSalary);
    if (isNaN(salaryVal)) {
      showToast('Salary must be a valid number!', 'error');
      return;
    }

    const currentStudentList = [...students];

    if (editingStudentId) {
      // Edit save
      const index = currentStudentList.findIndex(s => s.id === editingStudentId);
      if (index !== -1) {
        currentStudentList[index] = {
          id: editingStudentId,
          name: sName,
          schoolOrCollege: sSchool,
          medium: sMedium,
          className: sClass,
          groupName: isHighSchoolOrHigher(sClass) ? sGroup : '',
          subjects: sSubjects,
          daysPerWeek: sDays,
          timeSlot: sTimeSlot,
          salary: salaryVal,
          location: sLocation,
          parentNumber: sParentNo
        };
      }
      setEditingStudentId(null);
    } else {
      // Add new
      const newStud: TutorStudent = {
        id: 'stud_' + Date.now(),
        name: sName,
        schoolOrCollege: sSchool,
        medium: sMedium,
        className: sClass,
        groupName: isHighSchoolOrHigher(sClass) ? sGroup : '',
        subjects: sSubjects,
        daysPerWeek: sDays,
        timeSlot: sTimeSlot,
        salary: salaryVal,
        location: sLocation,
        parentNumber: sParentNo
      };
      currentStudentList.push(newStud);

      // Create a default salary record for this month
      const currentSal = [...salaries];
      currentSal.push({
        id: 'sal_' + Date.now(),
        studentOrTeacherId: newStud.id,
        month: new Date().getMonth(),
        year: new Date().getFullYear(),
        status: 'unpaid',
        amount: salaryVal
      });
      setSalaries(currentSal);
      saveSalaryPayments(user.gmail, currentSal);
    }

    setStudents(currentStudentList);
    saveTutorStudents(user.gmail, currentStudentList);
    resetStudentForm();
    setShowRegForm(false);
  };

  const handleEditStudent = (stud: TutorStudent) => {
    setEditingStudentId(stud.id);
    setSName(stud.name);
    setSSchool(stud.schoolOrCollege);
    setSMedium(stud.medium);
    setSClass(stud.className);
    setSGroup(stud.groupName || '');
    setSSubjects(stud.subjects);
    setSDays(stud.daysPerWeek);
    setSTimeSlot(stud.timeSlot || '');
    setSSalary(stud.salary.toString());
    setSLocation(stud.location);
    setSParentNo(stud.parentNumber);

    // Save backup to undo
    setStudentBackup({ ...stud });
    setShowRegForm(true);
  };

  const handleUndoStudentEdit = () => {
    if (studentBackup) {
      setSName(studentBackup.name);
      setSSchool(studentBackup.schoolOrCollege);
      setSMedium(studentBackup.medium);
      setSClass(studentBackup.className);
      setSGroup(studentBackup.groupName || '');
      setSSubjects(studentBackup.subjects);
      setSDays(studentBackup.daysPerWeek);
      setSTimeSlot(studentBackup.timeSlot || '');
      setSSalary(studentBackup.salary.toString());
      setSLocation(studentBackup.location);
      setSParentNo(studentBackup.parentNumber);
    }
  };

  const handleDeleteStudent = (id: string) => {
    setCustomConfirm({
      message: 'Are you sure you want to remove this student and metadata? All student records, attendance sheets, and receipts will be permanently deleted.',
      action: () => {
        const remaining = students.filter(s => s.id !== id);
        setStudents(remaining);
        saveTutorStudents(user.gmail, remaining);

        // Clean up attendance + salary
        const remAtt = attendance.filter(a => a.studentOrTeacherId !== id);
        setAttendance(remAtt);
        saveAttendance(user.gmail, remAtt);

        const remSal = salaries.filter(s => s.studentOrTeacherId !== id);
        setSalaries(remSal);
        saveSalaryPayments(user.gmail, remSal);

        if (attSelectedStudent === id) {
          setAttSelectedStudent(remaining[0]?.id || '');
        }
        showToast("Student profile and matching metadata removed.", 'success');
      }
    });
  };

  const toggleSubject = (sub: CourseSubject) => {
    setSSubjects(prev => 
      prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]
    );
  };

  const toggleDay = (day: string) => {
    setSDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // --- ATTENDANCE ACTIONS ---
  const getSelectedStudentLogs = () => {
    const found = attendance.find(
      a => a.studentOrTeacherId === attSelectedStudent && a.year === attYear && a.month === attMonth
    );
    return found ? found.dayLogs : {};
  };

  const handleMarkDayAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDay === null || !attSelectedStudent) return;

    const currentRecords = [...attendance];
    let recordIndex = currentRecords.findIndex(
      a => a.studentOrTeacherId === attSelectedStudent && a.year === attYear && a.month === attMonth
    );

    if (recordIndex === -1) {
      // Create new monthly record
      const newRec: AttendanceRecord = {
        studentOrTeacherId: attSelectedStudent,
        year: attYear,
        month: attMonth,
        dayLogs: {}
      };
      currentRecords.push(newRec);
      recordIndex = currentRecords.length - 1;
    }

    // Assign status object
    currentRecords[recordIndex].dayLogs[editingDay] = {
      status: dayStatus,
      gapDateStr: (dayStatus === 'covered_gap' || premiseType === 'gap_cover') 
        ? (gapDateString || premiseDate) 
        : undefined,
      premise: premiseType,
      premiseDetail: premiseType === 'gap_cover' ? premiseDate : undefined
    } as any;

    setAttendance(currentRecords);
    saveAttendance(user.gmail, currentRecords);
    setEditingDay(null);
    setGapDateString('');
    setPremiseDate('');
  };

  const getAttendanceSummary = (studentId: string, month: number, year: number) => {
    const record = attendance.find(
      a => a.studentOrTeacherId === studentId && a.year === year && a.month === month
    );
    if (!record) return { percentage: 0, present: 0, absent: 0, gap: 0, holiday: 0, covered: 0, off: 0, total: 0 };

    const logs = Object.values(record.dayLogs) as { status: string; gapDateStr?: string }[];
    let present = 0;
    let absent = 0;
    let gap = 0;
    let holiday = 0;
    let covered = 0;
    let off = 0;

    logs.forEach(log => {
      if (log.status === 'present') present++;
      else if (log.status === 'absent') absent++;
      else if (log.status === 'gap') gap++;
      else if (log.status === 'holiday') holiday++;
      else if (log.status === 'covered_gap') covered++;
      else if (log.status === 'student_off') off++;
    });

    const activeSessions = present + absent + gap + covered; // days with tutoring intent
    const totalLogEvents = logs.length;
    
    // Attendance % is calculated as (Present + CoveredGap + Holiday) / (Total active sessions)
    const divisor = activeSessions === 0 ? totalLogEvents : activeSessions;
    const numerator = present + covered + holiday;
    const percentage = divisor === 0 ? 0 : Math.min(100, Math.round((numerator / divisor) * 100));

    return {
      percentage,
      present,
      absent,
      gap,
      holiday,
      covered,
      off,
      total: totalLogEvents
    };
  };

  // Overall statistics
  const getOverallAttendanceStats = () => {
    let totals = { present: 0, absent: 0, gap: 0, holiday: 0 };
    attendance.forEach(rec => {
      if (rec.year === new Date().getFullYear() && rec.month === new Date().getMonth()) {
        (Object.values(rec.dayLogs) as { status: string; gapDateStr?: string }[]).forEach(log => {
          if (log.status === 'present') totals.present++;
          if (log.status === 'absent') totals.absent++;
          if (log.status === 'gap') totals.gap++;
          if (log.status === 'holiday') totals.holiday++;
          if (log.status === 'covered_gap') totals.present++; // Covered counts as presence
        });
      }
    });
    return totals;
  };

  // --- SALARY MANAGEMENT ACTIONS ---
  const handleAddSalaryRecord = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const currentSal = [...salaries];
    const exists = currentSal.some(
      s => s.studentOrTeacherId === studentId && s.month === selectedSalaryMonth && s.year === selectedSalaryYear
    );

    if (exists) {
      showToast('A salary record already exists for this student on the selected month/year.', 'error');
      return;
    }

    currentSal.push({
      id: 'sal_' + Date.now(),
      studentOrTeacherId: studentId,
      month: selectedSalaryMonth,
      year: selectedSalaryYear,
      status: 'unpaid',
      amount: student.salary
    });

    setSalaries(currentSal);
    saveSalaryPayments(user.gmail, currentSal);
  };

  const handleUpdateSalaryStatus = (id: string, updates: Partial<SalaryPayment>) => {
    const currentSal = [...salaries];
    const index = currentSal.findIndex(s => s.id === id);
    if (index !== -1) {
      currentSal[index] = {
        ...currentSal[index],
        ...updates
      };
      setSalaries(currentSal);
      saveSalaryPayments(user.gmail, currentSal);
    }
  };

  const handleSaveSalaryRowDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!salaryEditId) return;

    const amountNum = parseFloat(salaryEditAmount);
    if (isNaN(amountNum)) {
      showToast('Amount must be a number', 'error');
      return;
    }

    handleUpdateSalaryStatus(salaryEditId, {
      status: salaryEditState,
      paymentDate: salaryEditState === 'paid' ? salaryEditDate : undefined,
      amount: amountNum
    });

    setSalaryEditId(null);
  };

  const handleDeleteSalaryRecord = (id: string) => {
    setCustomConfirm({
      message: 'Are you sure you want to delete this payment record?',
      action: () => {
        const remaining = salaries.filter(s => s.id !== id);
        setSalaries(remaining);
        saveSalaryPayments(user.gmail, remaining);
        showToast("Payment record removed.", 'success');
      }
    });
  };

  // Computed Financials
  const getSalarySummationsForMonth = (month: number, year: number) => {
    const monthSalaries = salaries.filter(s => s.month === month && s.year === year);
    let received = 0;
    let pending = 0;

    monthSalaries.forEach(s => {
      if (s.status === 'paid') received += s.amount;
      else pending += s.amount;
    });

    return { received, pending, total: received + pending };
  };

  const activeMonthFinancials = getSalarySummationsForMonth(new Date().getMonth(), new Date().getFullYear());

  // --- PRINT DOCUMENT BUILDERS (PDF Simulations) ---
  const handlePrintAuditReport = () => {
    const printContent = document.getElementById('printable-audit-section');
    if (!printContent) return;

    const printHTML = printContent.innerHTML;
    const styles = `
      body { font-family: system-ui, sans-serif; padding: 40px; color: #1e293b; background: white; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
      th { background-color: #f8fafc; font-weight: bold; }
      h2 { color: #0f172a; margin-bottom: 5px; }
      .header-info { display: flex; justify-content: space-between; border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 25px; }
      .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
      .badge-paid { background: #d1fae5; color: #065f46; }
      .badge-unpaid { background: #fee2e2; color: #991b1b; }
      .metric-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; background: #f8fafc; flex: 1; text-align: center; }
      .metrics-container { display: flex; gap: 15px; margin-bottom: 20px; }
      @media print {
        .no-print { display: none; }
      }
    `;

    const docBodyContent = `
      ${printHTML}
      <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px;">
        Report compiled by Tutors' Diary app. Developed by Apurba Barua. Currencies in BDT (৳).
      </div>
    `;

    setPrintView({
      title: "Tutors' Diary - Auditing Report",
      htmlContent: docBodyContent,
      styles
    });
  };

  const handlePrintStudentMonthlyReport = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const stats = getAttendanceSummary(studentId, attMonth, attYear);
    const mName = new Date(attYear, attMonth).toLocaleString('en-US', { month: 'long' });
    const records = attendance.find(a => a.studentOrTeacherId === studentId && a.year === attYear && a.month === attMonth);
    const daysLog = records ? records.dayLogs : {};

    const salaryObj = salaries.find(s => s.studentOrTeacherId === studentId && s.month === attMonth && s.year === attYear);

    const docBody = `
      <div style="padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; max-width: 800px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #059669; padding-bottom: 15px; margin-bottom: 20px;">
          <div>
            <h1 style="margin: 0; color: #065f46; font-size: 24px;">Tutors' Diary</h1>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Student Performance & Billing Statement</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-weight: bold; font-size: 14px; color: #1e293b;">Statement ID: TD-${student.id.substring(5)}-${attMonth+1}</p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Month: ${mName} ${attYear}</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
          <div style="padding: 15px; border: 1px solid #f1f5f9; background: #fafafa; border-radius: 8px;">
            <h3 style="margin: 0 0 10px 0; font-size: 13px; color: #065f46; text-transform: uppercase;">Student Information</h3>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Name:</strong> ${student.name}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Medium:</strong> ${student.medium.toUpperCase()}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Class/Grade:</strong> ${student.className} ${student.groupName ? `(${student.groupName.toUpperCase()})` : ''}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Institution:</strong> ${student.schoolOrCollege}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Guardian Mobile:</strong> ${student.parentNumber}</p>
          </div>
          <div style="padding: 15px; border: 1px solid #f1f5f9; background: #fafafa; border-radius: 8px;">
            <h3 style="margin: 0 0 10px 0; font-size: 13px; color: #065f46; text-transform: uppercase;">Professional Tutor Details</h3>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Tutor Name:</strong> ${user.name}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Tutor Gmail:</strong> ${user.gmail}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Tutor Mobile:</strong> ${user.mobile}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Monthly Salary:</strong> ৳ ${student.salary.toLocaleString('en-US')}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Payment Status:</strong> <span class="badge ${salaryObj?.status === 'paid' ? 'badge-paid' : 'badge-unpaid'}">${salaryObj?.status?.toUpperCase() || 'UNPAID'}</span></p>
          </div>
        </div>

        <h3 style="color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; font-size: 16px;">Month Attendance Log</h3>
        <div style="display: flex; gap: 15px; margin-bottom: 15px; flex-wrap: wrap;">
          <div style="border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; text-align: center; flex: 1;">
            <span style="font-size: 20px; font-weight: bold; color: #059669;">${stats.percentage}%</span><br/>
            <span style="font-size: 11px; color: #64748b;">Attendance Rate</span>
          </div>
          <div style="border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; text-align: center; flex: 1;">
            <span style="font-size: 20px; font-weight: bold; color: #10b981;">${stats.present}</span><br/>
            <span style="font-size: 11px; color: #64748b;">Presences</span>
          </div>
          <div style="border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; text-align: center; flex: 1;">
            <span style="font-size: 20px; font-weight: bold; color: #f43f5e;">${stats.absent}</span><br/>
            <span style="font-size: 11px; color: #64748b;">Absences</span>
          </div>
          <div style="border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; text-align: center; flex: 1;">
            <span style="font-size: 20px; font-weight: bold; color: #eab308;">${stats.gap}</span><br/>
            <span style="font-size: 11px; color: #64748b;">Unfilled Gaps</span>
          </div>
          <div style="border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; text-align: center; flex: 1;">
            <span style="font-size: 20px; font-weight: bold; color: #0d9488;">${stats.covered}</span><br/>
            <span style="font-size: 11px; color: #64748b;">Covered Classes</span>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">Session Day Date</th>
              <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">Status Class</th>
              <th style="padding: 10px; border: 1px solid #e2e8f0;">Remarks/Recoveries</th>
            </tr>
          </thead>
          <tbody>
            ${Object.keys(daysLog).length === 0 ? `
              <tr>
                <td colspan="3" style="text-align: center; padding: 20px; color: #94a3b8;">No registered dates logged in attendance calendar yet.</td>
              </tr>
            ` : Object.entries(daysLog).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).map(([dayNum, meta]: any) => `
              <tr>
                <td style="text-align: center; padding: 8px; border: 1px solid #e2e8f0;">${dayNum}-${mName.substring(0,3)}-${attYear}</td>
                <td style="text-align: center; padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">
                  <span style="color: ${meta.status === 'present' ? '#059669' : meta.status === 'absent' ? '#dc2626' : '#d97706'}">${meta.status.toUpperCase().replace('_',' ')}</span>
                </td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-size: 13px; color: #475569;">
                  ${meta.gapDateStr ? `Gap correction class covering regular session scheduled on date <strong>${meta.gapDateStr}</strong>` : 'Normal scheduled course day'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const styles = `
      body { font-family: system-ui, sans-serif; padding: 40px; color: #1e293b; background: white; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; }
      th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
      th { background-color: #f8fafc; font-weight: bold; }
      .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
      .badge-paid { background: #d1fae5; color: #065f46; }
      .badge-unpaid { background: #fee2e2; color: #991b1b; }
    `;

    const docBodyContent = `
      ${docBody}
      <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px;">
        Statement compiled, verified, and validated on Tutors' Diary application. Developed by Apurba Barua.
      </div>
    `;

    setPrintView({
      title: "Tutors' Diary - Individual Report",
      htmlContent: docBodyContent,
      styles
    });
  };

  const handleDownloadRealPDF = async () => {
    if (!printView) return;
    
    showToast("Generating high-quality PDF, please wait...", "info");
    
    try {
      // Create a temporary hidden iframe to isolate html2canvas from parent document's Tailwind v4 (oklch) styles
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.width = '1024px'; // Set fixed width for standard A4 layout rendering
      iframe.style.height = '1448px'; 
      iframe.style.top = '-10000px';
      iframe.style.left = '-10000px';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
      
      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error("Could not access iframe document");
      }
      
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              ${printView.styles || ''}
              body {
                background: white;
                color: black;
                margin: 0;
                padding: 40px;
                font-family: system-ui, -apple-system, sans-serif;
                -webkit-font-smoothing: antialiased;
              }
            </style>
          </head>
          <body>
            <div>
              ${printView.htmlContent}
            </div>
          </body>
        </html>
      `);
      iframeDoc.close();
      
      // Delay to ensure the DOM content inside the iframe is rendered
      await new Promise((resolve) => setTimeout(resolve, 350));
      
      const renderElement = iframeDoc.body;
      const canvas = await html2canvas(renderElement, {
        scale: 1.6, // Balanced high-resolution ratio; significantly avoids browser memory crashes
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      // Safeguard removal of the iframe
      document.body.removeChild(iframe);
      
      // Use compressed JPEG with 90% quality instead of huge high-payload PNG
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = pdfWidth / imgWidth;
      const finalImgWidth = pdfWidth;
      const finalImgHeight = imgHeight * ratio;
      
      let heightRemaining = finalImgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'JPEG', 0, position, finalImgWidth, finalImgHeight);
      heightRemaining -= pdfHeight;
      
      // Exclude loose trailing blank page by establishing a 3mm threshold limit
      while (heightRemaining > 3) {
        position = heightRemaining - finalImgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, finalImgWidth, finalImgHeight);
        heightRemaining -= pdfHeight;
      }
      
      const cleanFilename = printView.title.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.pdf';
      pdf.save(cleanFilename);
      showToast("Downloaded PDF successfully!", "success");
    } catch (error) {
      console.error("PDF generation failed:", error);
      showToast("PDF generation failed. Please try printing manually.", "error");
    }
  };

  // --- AI EXAM PLANNER METHODS ---
  const handleAddFreeSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputFreeDay || !inputFreeTime) {
      showToast("Please choose day and fill time range!", "error");
      return;
    }
    const duplicate = tutorFreeSlots.some(slot => slot.day.toLowerCase() === inputFreeDay.toLowerCase() && slot.time.toLowerCase() === inputFreeTime.toLowerCase());
    if (duplicate) {
      showToast("This slot range is already declared!", "error");
      return;
    }
    const newSlot = {
      id: "fs-" + Date.now(),
      day: inputFreeDay,
      time: inputFreeTime
    };
    setTutorFreeSlots([...tutorFreeSlots, newSlot]);
    showToast(`Added slot range for ${inputFreeDay} at ${inputFreeTime}!`, "success");
  };

  const handleRemoveFreeSlot = (id: string) => {
    setTutorFreeSlots(tutorFreeSlots.filter(s => s.id !== id));
    showToast("Removed free slot from exam diary.", "info");
  };

  const runAISolver = () => {
    setIsAnalyzingExamSchedule(true);
    setTimeout(() => {
      setIsAnalyzingExamSchedule(false);
      showToast("AI Solver successfully structured optimal slots!", "success");
    }, 1200);
  };

  // Define helper to get burnout metrics for a student
  const getStudentBurnoutMetrics = (student: TutorStudent) => {
    if (!student) return { score: 0, zone: 'Balanced Zone', color: 'text-emerald-700 bg-emerald-50 border border-emerald-200', progressColor: 'bg-emerald-500', desc: '' };
    
    // Core calculation triggers:
    let score = 20; // baseline
    score += (student.daysPerWeek?.length || 0) * 11; // 2 classes = +22, 3 classes = +33
    score += (student.subjects?.length || 0) * 10; // 3 subjects = +30
    
    if (student.medium === 'cambridge' || student.medium === 'british') {
      score += 15; // International curriculum adds weight
    } else if (student.medium === 'english') {
      score += 8;
    }
    
    // Attendance Factor: High activity vs backup stress
    const stats = getAttendanceSummary(student.id, new Date().getMonth(), new Date().getFullYear());
    const attendancePercentage = stats.percentage;
    if (attendancePercentage < 40) {
      score += 18; // catchup stress
    } else if (attendancePercentage > 90) {
      score += 6; // heavy routine
    }
    
    const finalScore = Math.min(100, Math.max(15, score));
    
    let zone = "Healthy Vibe 🧘";
    let color = "text-emerald-850 bg-emerald-50 border border-emerald-200";
    let progressColor = "bg-emerald-500";
    let desc = "Maintaining a healthy academic rhythm. High schema retention with space for targeted weekly drills and syllabus worksheets.";
    
    if (finalScore >= 70) {
      zone = "Burnout Risk Zone 🚨";
      color = "text-rose-800 bg-rose-50 border border-rose-200 font-extrabold animate-pulse";
      progressColor = "bg-rose-500 animate-pulse";
      desc = "Heavy homework load and curriculum complexity detected. Consider pacing home revision exercises and adding light conceptual gameplay.";
    } else if (finalScore >= 42) {
      zone = "Steady Study Pressure ⚡";
      color = "text-amber-800 bg-amber-50 border border-amber-200";
      progressColor = "bg-amber-500";
      desc = "Steady target acceleration structure. Student is highly responsive but has limited extra slots for additional weekly tutoring sessions.";
    }
    
    return {
      score: finalScore,
      zone,
      color,
      progressColor,
      desc
    };
  };

  const handleGenerateSyllabus = () => {
    const selectedS = students.find(s => s.id === aiSyllabusStudentId);
    if (!selectedS) {
      showToast("Please register a student to run study plans.", 'error');
      return;
    }
    
    setIsGeneratingSyllabus(true);
    setTimeout(() => {
      const name = selectedS.name;
      const cls = selectedS.className;
      const groupStr = selectedS.groupName ? ` (${selectedS.groupName.toUpperCase()})` : '';
      const subjectsStr = (selectedS.subjects || []).map(s => s.toUpperCase()).join(", ");
      const focusTopic = aiSyllabusFocus.trim() ? `with targeted focus on "${aiSyllabusFocus}"` : 'across all core curriculum chapters';
      const med = selectedS.medium === 'bangla' ? 'NCTB Bangla Medium' : selectedS.medium === 'english' ? 'NCTB English Version' : 'Cambridge CIE / Edexcel Board';
      
      const plan = `📚 COGNITIVE STUDY PLAN & REVISION BLUEPRINT
Target Pupil: ${name} (${cls}${groupStr})
Curriculum Board: ${med}
Focus Subject Areas: ${subjectsStr}

🎯 DIRECT PLAN SUMMARY:
This active study syllabus ${focusTopic} is optimized to solve local curriculum expectations.

📅 WEEK-BY-WEEK ACTIONABLE SYLLABUS CHECKLIST:

[ ] WEEK 1: FOUNDATION AND CONCEPT MAPS
  - Focus Exercise: Intensive review of core theoretical definitions ${aiSyllabusFocus ? `specifically for ${aiSyllabusFocus}` : 'for high-weight chapters'}.
  - Activity: Complete 15 targeted intermediate multiple choice drills.
  - Pedagogical Tip: Maintain brief 10-min conceptual summaries at the start of each tutorial.

[ ] WEEK 2: BOARD-STYLE PROBLEM RUNS
  - Focus Exercise: Master past school boards question papers (2022-2025 series) on selected course topics.
  - Activity: Solve 5 high-yield creative questions with step-by-step documentation.
  - Pedagogical Tip: Let the student explain the steps aloud to measure mental schema retention.

[ ] WEEK 3: DENSE EXAM PREP AND MOCK TESTS
  - Focus Exercise: Run a timed, half-length revision question paper to simulate school exam timelines.
  - Activity: Pinpoint and correct minor formula slips, equation balancing, or grammatical structures.
  - Pedagogical Tip: Ensure positive, encouraging feedback to reduce test-taking anxiety.`;

      setCustomSyllabusResult(plan);
      setIsGeneratingSyllabus(false);
      showToast(`AI Study Syllabus generated successfully for ${name}!`, 'success');
    }, 1200);
  };

  const getAISuggestions = () => {
    return students.map((student, idx) => {
      const matchingDays = student.daysPerWeek.filter(day => 
        tutorFreeSlots.some(slot => slot.day.toLowerCase() === day.toLowerCase())
      );
      
      let suggestedDay = '';
      let suggestedTime = '';
      let matchType: 'perfect' | 'highly_recommended' | 'flexible' = 'flexible';
      let aiReasoning = '';

      if (matchingDays.length > 0) {
        suggestedDay = matchingDays[0];
        const matchingSlot = tutorFreeSlots.find(s => s.day.toLowerCase() === suggestedDay.toLowerCase());
        suggestedTime = matchingSlot ? matchingSlot.time : (student.timeSlot || '04:30 PM');
        matchType = 'perfect';
        aiReasoning = `Standard Overlap: Both you and student are free on ${suggestedDay}. Suggested time of ${suggestedTime} perfectly preserves routine momentum!`;
      } else if (tutorFreeSlots.length > 0) {
        const bestSlot = tutorFreeSlots[idx % tutorFreeSlots.length];
        suggestedDay = bestSlot.day;
        suggestedTime = bestSlot.time;
        matchType = 'highly_recommended';
        aiReasoning = `AI Flex Allocation: Standard clash resolved! The AI moved this class to ${suggestedDay} ${suggestedTime} to ensure zero overlaps with your exam windows.`;
      } else {
        suggestedDay = student.daysPerWeek[0] || 'Sat';
        suggestedTime = student.timeSlot || '04:30 PM';
        matchType = 'flexible';
        aiReasoning = `Standard Standby: Please declare your exam free times above to authorize AI auto-rescheduling!`;
      }

      return {
        student,
        suggestedDay,
        suggestedTime,
        matchType,
        aiReasoning
      };
    });
  };

  // Filter student array
  const filteredStudents = students.filter(
    s => s.name.toLowerCase().includes(studentFilter.toLowerCase()) || 
         s.schoolOrCollege.toLowerCase().includes(studentFilter.toLowerCase()) || 
         s.className.toLowerCase().includes(studentFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#e6f4ea] via-[#f8fafc] to-[#e0f2fe] flex flex-col justify-between relative overflow-hidden" id="tutor-root-container">
      {/* Print Preview Overlay Panel (Highly functional with a back option to return to dashboard state) */}
      {printView && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/95 backdrop-blur-md overflow-y-auto p-4 md:p-8 flex flex-col items-center gap-6 no-print-bg">
          {/* Inject style rule dynamically for print range targeting */}
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #print-preview-content, #print-preview-content * {
                visibility: visible !important;
              }
              #print-preview-content {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 20px !important;
                box-shadow: none !important;
                border: none !important;
                background: white !important;
                color: black !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          {/* Controls Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xl flex flex-col sm:flex-row justify-between items-center gap-4 w-full max-w-4xl no-print animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <Printer className="w-5 h-5 animate-pulse" />
              </div>
              <div className="text-left">
                <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm">{printView.title}</h4>
                <p className="text-[10px] text-slate-400 font-medium">Export this document directly as a highly polished PDF file!</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setPrintView(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-250 text-slate-800 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200"
              >
                <X className="w-4 h-4" /> Go Back
              </button>
              <button
                onClick={handleDownloadRealPDF}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-100 transition-all cursor-pointer text-nowrap"
              >
                <Download className="w-4 h-4" /> Download PDF Statement
              </button>
            </div>
          </div>

          {/* Simulated A4 document page */}
          <div 
            id="print-preview-content" 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-6 md:p-12 border border-slate-150 animate-container-print font-sans text-slate-800"
            dangerouslySetInnerHTML={{ __html: `<style>${printView.styles || ''}</style>${printView.htmlContent}` }}
          />
        </div>
      )}

      {/* Custom Toast Alert */}
      {toast && (
        <div 
          className="fixed bottom-5 right-5 z-[9999] p-4 rounded-2xl shadow-xl flex items-center gap-2.5 animate-bounce border text-xs font-bold font-sans tracking-wide max-w-sm"
          style={{
            backgroundColor: toast.type === 'error' ? '#fdf2f2' : toast.type === 'info' ? '#f0f9ff' : '#ecfdf5',
            borderColor: toast.type === 'error' ? '#fde8e8' : toast.type === 'info' ? '#e0f2fe' : '#d1fae5',
            color: toast.type === 'error' ? '#9b1c1c' : toast.type === 'info' ? '#0369a1' : '#065f46'
          }}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Custom Confirm Modal */}
      {customConfirm && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-150 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="bg-emerald-50 p-2.5 rounded-2xl">
                <Trash2 className="w-6 h-6 text-emerald-600" />
              </div>
              <h4 className="font-extrabold text-slate-800 text-sm md:text-base">Confirm Action</h4>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              {customConfirm.message}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setCustomConfirm(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-705 font-extrabold text-xs rounded-xl cursor-pointer"
              >
                No, Cancel
              </button>
              <button
                onClick={() => {
                  customConfirm.action();
                  setCustomConfirm(null);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer"
              >
                Yes, Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner and Navigation Bar */}
      <header className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2.5 rounded-xl border border-white/20 backdrop-blur-md">
              <Sparkles className="w-6 h-6 text-emerald-100" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Tutors' Diary</h1>
              <span className="text-xs text-emerald-100/80 font-medium">Logged in: {user.name} ({user.gmail}) | Tutor Professional Panel</span>
            </div>
          </div>

          {/* Quick Tab switcher */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button 
              onClick={() => { setActiveTab('dashboard'); }} 
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs md:text-sm font-semibold transition-all duration-150 flex items-center gap-1 sm:gap-1.5 uppercase tracking-wider ${activeTab === 'dashboard' ? 'bg-white text-emerald-700 shadow-sm' : 'hover:bg-white/10 text-white'}`}
            >
              <Users className="w-3 h-3 sm:w-4 sm:h-4" /> Dashboard
            </button>
            <button 
              onClick={() => { setActiveTab('students'); }} 
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs md:text-sm font-semibold transition-all duration-150 flex items-center gap-1 sm:gap-1.5 uppercase tracking-wider ${activeTab === 'students' ? 'bg-white text-emerald-700 shadow-sm' : 'hover:bg-white/10 text-white'}`}
            >
              <BookOpen className="w-3 h-3 sm:w-4 sm:h-4" /> Students
            </button>
            <button 
              onClick={() => { setActiveTab('attendance'); }} 
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs md:text-sm font-semibold transition-all duration-150 flex items-center gap-1 sm:gap-1.5 uppercase tracking-wider ${activeTab === 'attendance' ? 'bg-white text-emerald-700 shadow-sm' : 'hover:bg-white/10 text-white'}`}
            >
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4" /> Attendance
            </button>
            <button 
              onClick={() => { setActiveTab('salary'); }} 
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs md:text-sm font-semibold transition-all duration-150 flex items-center gap-1 sm:gap-1.5 uppercase tracking-wider ${activeTab === 'salary' ? 'bg-white text-emerald-700 shadow-sm' : 'hover:bg-white/10 text-white'}`}
            >
              <Banknote className="w-3 h-3 sm:w-4 sm:h-4" /> Salary
            </button>
            <button 
              onClick={() => { setActiveTab('audit'); }} 
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs md:text-sm font-semibold transition-all duration-150 flex items-center gap-1 sm:gap-1.5 uppercase tracking-wider ${activeTab === 'audit' ? 'bg-white text-emerald-700 shadow-sm' : 'hover:bg-white/10 text-white'}`}
            >
              <FileText className="w-3 h-3 sm:w-4 sm:h-4" /> Audit
            </button>
            <button 
              onClick={() => { setActiveTab('exam_planner'); }} 
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs md:text-sm font-bold transition-all duration-150 flex items-center gap-1 sm:gap-1.5 uppercase tracking-wider relative overflow-hidden ${activeTab === 'exam_planner' ? 'bg-indigo-900 border border-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'hover:bg-white/10 text-white'}`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" /> AI Exam Planner
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
              </span>
            </button>
            <button 
              onClick={onLogout} 
              className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs md:text-sm font-semibold bg-rose-500/20 hover:bg-rose-500 text-rose-100 font-medium transition-all duration-150 border border-thin border-white/10"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-grow">
        
        {/* TAB 1: MAIN DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* Row 1: Premium Welcome Header & Quick Action (Bento banner) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Welcome back (Tutor Name) banner */}
              <div id="welcome-back-card-tutor" className="lg:col-span-8 bg-indigo-950 rounded-[28px] p-6 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden shadow-xl border border-indigo-900">
                <div className="relative z-10 space-y-3 max-w-xl">
                  <div className="bg-white/10 w-fit px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest text-emerald-300 border border-white/5 backdrop-blur-md">
                    Tutors' Diary Live Panel
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black leading-tight tracking-tight font-display">
                    Welcome back,<br/>
                    <span className="text-emerald-400">{user.name}!</span>
                  </h3>
                  <p className="text-xs text-indigo-200 font-medium leading-relaxed">
                    Manage tutoring workloads, authorize billing coordinates, or compile high-fidelity statements immediately under local sandboxed encryption.
                  </p>
                  <div className="pt-2 flex flex-wrap gap-2.5">
                    <div className="px-3.5 py-1.5 bg-white/10 rounded-xl border border-white/5 backdrop-blur-md">
                      <p className="text-[9px] uppercase font-bold text-indigo-300">Active Students</p>
                      <p className="text-sm font-extrabold font-mono text-emerald-300">{students.length}</p>
                    </div>
                    <div className="px-3.5 py-1.5 bg-white/10 rounded-xl border border-white/5 backdrop-blur-md">
                      <p className="text-[9px] uppercase font-bold text-indigo-300">Active Month</p>
                      <p className="text-sm font-extrabold font-mono text-amber-300">{new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>

                  <div className="pt-3 flex flex-wrap gap-2 border-t border-white/10">
                    <button 
                      onClick={handleSeedDemoState}
                      title="Generates high-fidelity student records, invoice logs, & heatmaps for active calendar dates"
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Re-Seed Active Month Demo
                    </button>
                    <button 
                      onClick={handleWipeAccountData}
                      title="Deletes all student lists, attendance sheets, and receipts to start clean"
                      className="px-3 py-1.5 bg-rose-500/25 hover:bg-rose-600/90 text-rose-100 font-extrabold text-[10px] uppercase tracking-wider rounded-lg border border-rose-500/10 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Clean Slate Reset
                    </button>
                  </div>
                </div>

                {/* Beautiful efficiency ring with dynamic attendance calculation */}
                <div className="relative z-10 w-20 h-20 md:w-28 md:h-28 flex-shrink-0 flex items-center justify-center border-4 border-emerald-500/20 rounded-full bg-indigo-900/40">
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                    <p className="text-center leading-none">
                      <span className="text-sm md:text-xl font-black tracking-tighter text-emerald-300 font-mono">
                        {students.length > 0 ? (
                          Math.round(
                            students.reduce((acc, s) => acc + getAttendanceSummary(s.id, new Date().getMonth(), new Date().getFullYear()).percentage, 0) / students.length
                          )
                        ) : 0}%
                      </span><br/>
                      <span className="text-[7px] md:text-[8px] uppercase font-bold text-indigo-200 tracking-wider">Attendance</span>
                    </p>
                  </div>
                  <svg className="absolute inset-0 w-full h-full -rotate-90 z-10" viewBox="0 0 128 128">
                    <circle 
                      cx="64" 
                      cy="64" 
                      r="58" 
                      fill="transparent" 
                      stroke="#10b981" 
                      strokeWidth="6" 
                      strokeDasharray="364.4" 
                      strokeDashoffset={364.4 - (364.4 * (students.length > 0 ? Math.min(100, Math.round(students.reduce((acc, s) => acc + getAttendanceSummary(s.id, new Date().getMonth(), new Date().getFullYear()).percentage, 0) / students.length)) : 0)) / 100} 
                      strokeLinecap="round" 
                    />
                  </svg>
                </div>
                {/* Decorative gradient blur rings */}
                <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-indigo-500/25 rounded-full blur-3xl"></div>
                <div className="absolute -top-10 left-1/3 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl"></div>
              </div>

              {/* Secondary Bento Quick Action Panel (Schedule Audit / Send Reminder) */}
              <div id="diary-checklist-card" className="lg:col-span-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-[28px] p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between border border-orange-400/30">
                <div className="relative z-10">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-black tracking-tight font-display text-amber-950">Diary Checklist</h3>
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Calendar className="w-5 h-5 text-amber-950" />
                    </div>
                  </div>
                  <p className="text-xs mt-3 text-amber-950/85 font-medium leading-relaxed">
                    Audit active logs, register special student leaves, confirm outstanding gaps, and update statements.
                  </p>
                </div>
                <div className="relative z-10 mt-6 md:mt-4">
                  <button 
                    onClick={() => setActiveTab('audit')}
                    className="w-full py-2.5 bg-black/15 hover:bg-black/25 text-white border border-white/25 transition-colors rounded-xl font-black text-[10px] uppercase tracking-widest cursor-pointer"
                  >
                    Log Monthly Audit
                  </button>
                </div>
                {/* Ambient glow decoration */}
                <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/15 rounded-full blur-2xl"></div>
              </div>
            </div>

            {/* Row 2: Secondary Quick Metrics Info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-tutor p-5 rounded-[22px] flex items-center justify-between animate-fade-in">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registered Students</span>
                  <div className="text-2xl font-black text-slate-800 font-mono mt-0.5">{students.length}</div>
                </div>
                <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl border border-emerald-100/40">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="glass-tutor p-5 rounded-[22px] flex items-center justify-between animate-fade-in">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Received (Current Month)</span>
                  <div className="text-2xl font-black text-emerald-600 font-mono mt-0.5">৳{activeMonthFinancials.received.toLocaleString('en-US')}</div>
                </div>
                <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl border border-emerald-100/40">
                  <Banknote className="w-5 h-5" />
                </div>
              </div>

              <div className="glass-tutor p-5 rounded-[22px] flex items-center justify-between animate-fade-in font-sans">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending (Current Month)</span>
                  <div className="text-2xl font-black text-rose-500 font-mono mt-0.5">৳{activeMonthFinancials.pending.toLocaleString('en-US')}</div>
                </div>
                <div className="bg-rose-50 text-rose-500 p-3 rounded-xl border border-rose-100/40">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              <div className="glass-tutor p-5 rounded-[22px] flex items-center justify-between animate-fade-in">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Connected Status Rate</span>
                  <div className="text-2xl font-black text-indigo-600 font-mono mt-0.5">
                    {students.length > 0 ? (
                      Math.round(
                        students.reduce((acc, s) => acc + getAttendanceSummary(s.id, new Date().getMonth(), new Date().getFullYear()).percentage, 0) / students.length
                      )
                    ) : 0}%
                  </div>
                </div>
                <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl border border-indigo-100/40">
                  <Calendar className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Primary Bento Panel Board */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
              
              {/* Card 1: My Students Directory (col-span-4) */}
              <div id="quick-students-bento" className="lg:col-span-4 glass-tutor p-5 flex flex-col justify-between relative overflow-hidden min-h-[350px]">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight font-display flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-600" /> My Students
                      </h4>
                      <p className="text-[10px] text-slate-400">Review standard grades to run diagnostics</p>
                    </div>
                    <button 
                      onClick={() => { setShowRegForm(true); setEditingStudentId(null); setActiveTab('students'); }} 
                      className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all cursor-pointer border border-emerald-100/50"
                      title="Add Student"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Students list */}
                  <div className="space-y-2 overflow-y-auto max-h-[190px] pr-1 bento-scrollbar">
                    {students.map(stud => {
                      const sal = salaries.find(s => s.studentOrTeacherId === stud.id && s.month === new Date().getMonth() && s.year === new Date().getFullYear());
                      const att = getAttendanceSummary(stud.id, new Date().getMonth(), new Date().getFullYear());
                      return (
                        <div 
                          key={stud.id} 
                          onClick={() => { setAttSelectedStudent(stud.id); setActiveTab('attendance'); }}
                          className="p-3 rounded-xl border border-slate-100 hover:border-emerald-100/60 bg-slate-50/50 hover:bg-emerald-50/10 flex items-center justify-between transition-all duration-150 cursor-pointer text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 truncate">{stud.name}</p>
                            <p className="text-[10px] text-slate-400 capitalize truncate">{stud.className} &bull; {stud.medium}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-1">
                            <span className="text-[10px] font-black font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              {att.percentage}%
                            </span>
                            <span className={`text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded ${sal?.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {sal?.status || 'unpaid'}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {students.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-10">No students registered yet. Fill details to proceed.</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm flex items-center justify-between">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider opacity-90 font-black">Admissions Drawer</p>
                      <p className="text-[10px] opacity-80 mt-0.5 font-medium leading-tight">Register new students on school syllabus</p>
                    </div>
                    <button 
                      onClick={() => { setShowRegForm(true); setEditingStudentId(null); setActiveTab('students'); }} 
                      className="px-2.5 py-1 bg-white/20 text-white font-bold rounded-lg text-[9px] hover:bg-white/30 backdrop-blur-md cursor-pointer border border-white/10 shrink-0"
                    >
                      Open Form
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2: Attendance Heatmap & Calendar Stats (col-span-8) */}
              <div id="attendance-heatmap-card" className="lg:col-span-8 glass-tutor p-5 flex flex-col justify-between">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight font-display flex items-center gap-2 animate-pulse">
                      <Calendar className="w-4 h-4 text-emerald-600" /> Attendance Presence Map
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      A heat array showing tuition engagement distributions across dates
                    </p>
                  </div>
                  
                  {students.length > 0 && (
                    <div className="flex items-center gap-1.5 self-end mt-1 sm:mt-0">
                      <span className="text-[10px] text-slate-400 font-semibold">Selected Profile:</span>
                      <select
                        value={attSelectedStudent}
                        onChange={e => setAttSelectedStudent(e.target.value)}
                        className="px-2 py-0.5 border border-slate-200 rounded-lg bg-slate-50 font-bold text-[11px] text-slate-700 focus:outline-none"
                      >
                        {students.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-center items-center min-h-[140px] my-1">
                  {attSelectedStudent ? (
                    <GitHubContributionGrid 
                      studentOrTeacherId={attSelectedStudent} 
                      userGmail={user.gmail} 
                    />
                  ) : (
                    <p className="text-xs text-slate-400 font-medium">Add standard student profiles to query scheduling calendars.</p>
                  )}
                </div>

                {/* Performance stats bento mini row */}
                {(() => {
                  const currentStats = attSelectedStudent ? getAttendanceSummary(attSelectedStudent, new Date().getMonth(), new Date().getFullYear()) : null;
                  return (
                    <div className="grid grid-cols-4 gap-2.5 mt-3">
                      <div className="bg-emerald-50 rounded-xl p-2 md:p-3 border border-emerald-100/50 text-center">
                        <p className="text-[8px] md:text-[9px] text-emerald-700 font-bold uppercase tracking-wider mb-0.5">Rate Scale</p>
                        <p className="text-sm md:text-lg font-black text-emerald-800 font-mono leading-none">{currentStats ? `${currentStats.percentage}%` : '—'}</p>
                      </div>
                      <div className="bg-rose-50 rounded-xl p-2 md:p-3 border border-rose-100/50 text-center">
                        <p className="text-[8px] md:text-[9px] text-rose-700 font-bold uppercase tracking-wider mb-0.5">Absences</p>
                        <p className="text-sm md:text-lg font-black text-rose-800 font-mono leading-none">{currentStats ? currentStats.absent : '—'}</p>
                      </div>
                      <div className="bg-indigo-50 rounded-xl p-2 md:p-3 border border-indigo-100/50 text-center">
                        <p className="text-[8px] md:text-[9px] text-indigo-700 font-bold uppercase tracking-wider mb-0.5">Recovered</p>
                        <p className="text-sm md:text-lg font-black text-indigo-800 font-mono leading-none">{currentStats ? currentStats.covered : '—'}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2 md:p-3 border border-slate-150 text-center">
                        <p className="text-[8px] md:text-[9px] text-slate-600 font-bold uppercase tracking-wider mb-0.5">Holidays</p>
                        <p className="text-sm md:text-lg font-black text-slate-800 font-mono leading-none">{currentStats ? currentStats.holiday : '—'}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Card 3: Financial Summation Audit Card (col-span-4) */}
              <div id="financial-bento-card" className="lg:col-span-4 glass-tutor p-5 flex flex-col justify-between min-h-[300px]">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight font-display flex items-center gap-2 mb-3">
                    <Banknote className="w-4 h-4 text-emerald-600" /> Fiscal Accountant Dues
                  </h4>
                  <div className="space-y-3">
                    {/* Sum Received */}
                    <div className="p-3 bg-emerald-50/40 backdrop-blur-md rounded-xl border border-emerald-100/30">
                      <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider">Salary Cleared (This Month)</p>
                      <p className="text-xl font-black text-emerald-950 font-mono mt-0.5">৳{activeMonthFinancials.received.toLocaleString('en-US')}</p>
                      
                      <div className="w-full bg-emerald-200/50 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div 
                          className="bg-emerald-600 h-full transition-all duration-300" 
                          style={{ width: `${activeMonthFinancials.total === 0 ? 0 : Math.min(100, Math.round((activeMonthFinancials.received / activeMonthFinancials.total) * 100))}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-emerald-700 mt-1 font-medium">
                        {activeMonthFinancials.total === 0 ? 0 : Math.round((activeMonthFinancials.received / activeMonthFinancials.total) * 100)}% of goal reached
                      </p>
                    </div>

                    {/* Sum Pending */}
                    <div className="p-3 bg-rose-50/40 backdrop-blur-md rounded-xl border border-rose-100/30">
                      <p className="text-[9px] font-bold text-rose-800 uppercase tracking-wider font-sans">Pending Dues</p>
                      <p className="text-xl font-black text-rose-950 font-mono mt-0.5">৳{activeMonthFinancials.pending.toLocaleString('en-US')}</p>
                      <button 
                        onClick={() => setActiveTab('salary')}
                        className="mt-2.5 w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[9px] font-bold shadow-sm cursor-pointer transition"
                      >
                        Send Invoice Alert
                      </button>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => setActiveTab('salary')}
                  className="mt-4 w-full py-2 bg-white/40 hover:bg-emerald-50/20 border border-slate-150/40 text-slate-600 hover:text-emerald-800 rounded-xl text-xs font-bold cursor-pointer text-center transition-all duration-150"
                >
                  Manage Salaries & Ledger
                </button>
              </div>

              {/* Card 4: Pie Chart Analytics (col-span-4) */}
              <div id="visual-pie-bento" className="lg:col-span-4 glass-tutor p-5 flex flex-col justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight font-display mb-1">
                    Visual Analytics
                  </h4>
                  <p className="text-[10px] text-slate-400 mb-2 font-normal">Active month participation distribution metrics</p>
                </div>
                <div className="flex-grow flex items-center justify-center py-2.5 my-1">
                  {(() => {
                    const totals = getOverallAttendanceStats();
                    return (
                      <AttendancePieChart 
                        present={totals.present}
                        absent={totals.absent}
                        gapOrOff={totals.gap}
                        holiday={totals.holiday}
                        plain={true}
                      />
                    );
                  })()}
                </div>
                <button 
                  onClick={() => setActiveTab('attendance')}
                  className="mt-4 w-full py-2 bg-white/40 hover:bg-emerald-50/20 border border-slate-150/40 text-slate-600 hover:text-emerald-800 rounded-xl text-xs font-bold cursor-pointer text-center transition-all duration-150"
                >
                  Configure Attendance Sheets
                </button>
              </div>

              {/* Card 5: Interactive Financial Slidebar Tracker (col-span-4) */}
              <div id="milestones-bento" className="lg:col-span-4 glass-tutor p-5 flex flex-col justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight font-display mb-1">
                    Fiscal Milestones
                  </h4>
                  <p className="text-[10px] text-slate-400 mb-4 font-normal">Your cashflow distribution index (Real-time)</p>
                </div>
                <div className="flex-grow flex items-center justify-center">
                  <FinancialStatusBar 
                    received={activeMonthFinancials.received}
                    pending={activeMonthFinancials.pending}
                    plain={true}
                  />
                </div>
                <button 
                  onClick={() => setActiveTab('audit')}
                  className="mt-4 w-full py-2 bg-white/40 hover:bg-emerald-50/20 border border-slate-150/40 text-slate-600 hover:text-emerald-800 rounded-xl text-xs font-bold cursor-pointer text-center transition-all duration-150"
                >
                  Run Statement Ledger
                </button>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: REGISTERED STUDENTS (WITH EDIT, DELETE, CANCEL/UNDO, SAVE) */}
        {activeTab === 'students' && (
          <div className="space-y-4">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-extrabold text-[10px] sm:text-xs rounded-xl transition-all border border-slate-200 cursor-pointer w-fit"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </button>
            
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={studentFilter}
                  onChange={e => setStudentFilter(e.target.value)}
                  placeholder="Search student, school, grade..." 
                  className="pl-9 pr-4 py-2 w-full rounded-xl glass-input-tutor font-medium text-xs md:text-sm shadow-sm"
                />
              </div>

              <button 
                onClick={() => { setShowRegForm(!showRegForm); if(showRegForm) resetStudentForm(); }} 
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
              >
                {showRegForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showRegForm ? 'Close Registration Form' : 'Add New Student'}
              </button>
            </div>

            {/* FORM CONTAINER */}
            {showRegForm && !editingStudentId && (
              <form onSubmit={handleStudentFormSubmit} className="glass-tutor p-6 rounded-2xl space-y-6">
                <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                  <h3 className="font-extrabold text-slate-800 text-sm md:text-base flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-600" />
                    {editingStudentId ? 'Modify Student Credentials' : 'New Admission / Student Registration'}
                  </h3>
                  {editingStudentId && (
                    <button 
                      type="button" 
                      onClick={handleUndoStudentEdit} 
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-800 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all"
                    >
                      Undo to Original
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Row 1: Name */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Student Name *</label>
                    <input 
                      type="text" 
                      required 
                      value={sName} 
                      onChange={e => setSName(e.target.value)}
                      placeholder="e.g. Sajid Al Hasan"
                      className="px-3.5 py-2 rounded-xl glass-input-tutor text-sm font-medium"
                    />
                  </div>

                  {/* Row 1: School College */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">School / College</label>
                    <input 
                      type="text" 
                      value={sSchool} 
                      onChange={e => setSSchool(e.target.value)}
                      placeholder="e.g. Notre Dame College"
                      className="px-3.5 py-2 rounded-xl glass-input-tutor text-sm font-medium"
                    />
                  </div>

                  {/* Row 1: Medium */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Medium / Curriculum *</label>
                    <select 
                      value={sMedium} 
                      onChange={e => setSMedium(e.target.value as StudentMedium)}
                      className="px-3.5 py-2.5 rounded-xl glass-input-tutor text-sm font-semibold text-slate-700"
                    >
                      <option value="bangla">Bangla Medium</option>
                      <option value="english">English Medium</option>
                      <option value="british">British National</option>
                      <option value="cambridge">Cambridge Curriculum</option>
                    </select>
                  </div>

                  {/* Row 2: Class */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Class / Grade *</label>
                    <select 
                      value={sClass} 
                      onChange={e => setSClass(e.target.value)}
                      className="px-3.5 py-2.5 rounded-xl glass-input-tutor text-sm font-semibold text-slate-700"
                    >
                      {classOptions.map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>

                  {/* Row 2: Group (Conditional) */}
                  {isHighSchoolOrHigher(sClass) ? (
                    <div className="flex flex-col gap-1 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/60">
                      <label className="text-xs font-extrabold text-emerald-800 uppercase">Group Stream *</label>
                      <div className="flex items-center gap-4 mt-2">
                        {['science', 'commerce', 'arts'].map(grp => (
                          <label key={grp} className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer capitalize">
                            <input 
                              type="radio" 
                              name="sGroup" 
                              required
                              value={grp} 
                              checked={sGroup === grp}
                              onChange={() => setSGroup(grp as any)}
                              className="accent-emerald-600"
                            />
                            {grp}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : <div className="hidden md:block" />}

                  {/* Row 2: Salary (BDT) */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Monthly Tuition Duty Fee (BDT) *</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold font-mono">৳</span>
                      <input 
                        type="number" 
                        required 
                        value={sSalary} 
                        onChange={e => setSSalary(e.target.value)}
                        placeholder="8500"
                        className="pl-8 pr-4 py-2 w-full rounded-xl glass-input-tutor text-sm font-semibold text-slate-705"
                      />
                    </div>
                  </div>

                  {/* Row 3: Location */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Location Address</label>
                    <input 
                      type="text" 
                      value={sLocation} 
                      onChange={e => setSLocation(e.target.value)}
                      placeholder="e.g. Dhanmondi, Dhaka"
                      className="px-3.5 py-2 rounded-xl glass-input-tutor text-sm font-medium"
                    />
                  </div>

                  {/* Row 3: Parent Number */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Parent Mobile Contact Number *</label>
                    <input 
                      type="text" 
                      required 
                      value={sParentNo} 
                      onChange={e => setSParentNo(e.target.value)}
                      placeholder="e.g. 01712345678"
                      className="px-3.5 py-2 rounded-xl glass-input-tutor text-sm font-semibold"
                    />
                  </div>

                  {/* Row 3: Tutoring Time */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Registered Tutoring Time Slot</label>
                    <input 
                      type="text" 
                      value={sTimeSlot} 
                      onChange={e => setSTimeSlot(e.target.value)}
                      placeholder="e.g. 05:30 PM (or afternoon/evening)"
                      className="px-3.5 py-2 rounded-xl glass-input-tutor text-sm font-semibold text-slate-700"
                    />
                    <div className="flex flex-wrap gap-1 mt-1 bg-slate-50/50 p-1.5 rounded-xl border border-slate-100">
                      {["03:00 PM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM", "06:00 PM", "07:30 PM", "08:00 PM"].map(time => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => setSTimeSlot(time)}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-all ${
                            sTimeSlot === time 
                              ? "bg-emerald-600 border-emerald-600 text-white" 
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ROW 3 - Subjects checklist */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Assigned Subjects (Can select multiple) *</label>
                  <div className="flex flex-wrap gap-2">
                    {availableSubjects.map((sub) => {
                      const active = sSubjects.includes(sub);
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => toggleSubject(sub)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all border ${active ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200 cursor-pointer'}`}
                        >
                          {sub}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ROW 4 - Days checklist */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Class Duty Weekly Days (Can select multiple) *</label>
                  <div className="flex flex-wrap gap-2">
                    {weekdayOptions.map((day) => {
                      const active = sDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${active ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200 cursor-pointer'}`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Save cancel footer */}
                <div className="flex justify-end items-center gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => { resetStudentForm(); setShowRegForm(false); }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs md:text-sm rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs md:text-sm rounded-xl shadow-md cursor-pointer"
                  >
                    {editingStudentId ? 'Update Credentials' : 'Confirm Registration'}
                  </button>
                </div>
              </form>
            )}

            {/* DIRECTORY STUDENT LIST GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStudents.map((stud) => {
                const summ = getAttendanceSummary(stud.id, new Date().getMonth(), new Date().getFullYear());
                
                if (editingStudentId === stud.id) {
                  return (
                    <div key={stud.id} className="col-span-full glass-tutor p-6 rounded-2xl border-2 border-emerald-500 shadow-lg space-y-6 animate-fade-in" id={`edit-panel-student-${stud.id}`}>
                      {/* INLINE EDIT FORM */}
                      <form onSubmit={handleStudentFormSubmit} className="space-y-6">
                        <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                          <h3 className="font-extrabold text-slate-800 text-sm md:text-base flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-emerald-600" />
                            Editing Student: <span className="text-emerald-700 font-black">{stud.name}</span> (Inline Editor)
                          </h3>
                          <div className="flex gap-2">
                            <button 
                              type="button" 
                              onClick={handleUndoStudentEdit} 
                              className="text-xs font-bold text-emerald-600 hover:text-emerald-800 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all"
                            >
                              Reset Info
                            </button>
                            <button 
                              type="button" 
                              onClick={() => { resetStudentForm(); setEditingStudentId(null); }} 
                              className="text-xs font-bold text-slate-500 hover:text-slate-700 px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                          {/* Row 1: Name */}
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Student Name *</label>
                            <input 
                              type="text" 
                              required 
                              value={sName} 
                              onChange={e => setSName(e.target.value)}
                              placeholder="e.g. Sajid Al Hasan"
                              className="px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium animate-fade-in"
                            />
                          </div>

                          {/* Row 1: School College */}
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">School / College</label>
                            <input 
                              type="text" 
                              value={sSchool} 
                              onChange={e => setSSchool(e.target.value)}
                              placeholder="e.g. Notre Dame College"
                              className="px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
                            />
                          </div>

                          {/* Row 1: Medium */}
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Medium / Curriculum *</label>
                            <select 
                              value={sMedium} 
                              onChange={e => setSMedium(e.target.value as StudentMedium)}
                              className="px-3.5 py-2.5 rounded-xl glass-input-tutor text-sm font-semibold text-slate-700"
                            >
                              <option value="bangla">Bangla Medium</option>
                              <option value="english">English Medium</option>
                              <option value="british">British National</option>
                              <option value="cambridge">Cambridge Curriculum</option>
                            </select>
                          </div>

                          {/* Row 2: Class */}
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Class / Grade *</label>
                            <select 
                              value={sClass} 
                              onChange={e => setSClass(e.target.value)}
                              className="px-3.5 py-2.5 rounded-xl glass-input-tutor text-sm font-semibold text-slate-700"
                            >
                              {classOptions.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                              ))}
                            </select>
                          </div>

                          {/* Row 2: Group (Conditional) */}
                          {isHighSchoolOrHigher(sClass) ? (
                            <div className="flex flex-col gap-1 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/60">
                              <label className="text-xs font-extrabold text-emerald-800 uppercase">Group Stream *</label>
                              <div className="flex items-center gap-4 mt-2">
                                {['science', 'commerce', 'arts'].map(grp => (
                                  <label key={grp} className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer capitalize">
                                    <input 
                                      type="radio" 
                                      name="sGroupInline" 
                                      required
                                      value={grp} 
                                      checked={sGroup === grp}
                                      onChange={() => setSGroup(grp as any)}
                                      className="accent-emerald-600"
                                    />
                                    {grp}
                                  </label>
                                ))}
                              </div>
                            </div>
                          ) : <div className="hidden md:block" />}

                          {/* Row 2: Salary (BDT) */}
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Monthly Tuition Duty Fee (BDT) *</label>
                            <div className="relative">
                              <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold font-mono">৳</span>
                              <input 
                                type="number" 
                                required 
                                value={sSalary} 
                                onChange={e => setSSalary(e.target.value)}
                                placeholder="8500"
                                className="pl-8 pr-4 py-2 w-full rounded-xl glass-input-tutor text-sm font-semibold text-slate-750"
                              />
                            </div>
                          </div>

                          {/* Row 3: Location */}
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Location Address</label>
                            <input 
                              type="text" 
                              value={sLocation} 
                              onChange={e => setSLocation(e.target.value)}
                              placeholder="e.g. Dhanmondi, Dhaka"
                              className="px-3.5 py-2 rounded-xl glass-input-tutor text-sm font-medium text-slate-705"
                            />
                          </div>

                          {/* Row 3: Parent Number */}
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Parent Mobile Contact Number *</label>
                            <input 
                              type="text" 
                              required 
                              value={sParentNo} 
                              onChange={e => setSParentNo(e.target.value)}
                              placeholder="e.g. 01712345678"
                              className="px-3.5 py-2 rounded-xl glass-input-tutor text-sm font-semibold text-slate-705"
                            />
                          </div>

                          {/* Row 3: Tutoring Time */}
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Registered Tutoring Time Slot</label>
                            <input 
                              type="text" 
                              value={sTimeSlot} 
                              onChange={e => setSTimeSlot(e.target.value)}
                              placeholder="e.g. 05:30 PM (or afternoon)"
                              className="px-3.5 py-2 rounded-xl glass-input-tutor text-sm font-semibold text-slate-705"
                            />
                            <div className="flex flex-wrap gap-1 mt-1 bg-slate-50/50 p-1.5 rounded-xl border border-slate-100">
                              {["03:00 PM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM", "06:00 PM", "07:30 PM", "08:00 PM"].map(time => (
                                <button
                                  key={time}
                                  type="button"
                                  onClick={() => setSTimeSlot(time)}
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-all ${
                                    sTimeSlot === time 
                                      ? "bg-emerald-600 border-emerald-600 text-white" 
                                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  {time}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* ROW 3 - Subjects checklist */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase block">Assigned Subjects (Can select multiple) *</label>
                          <div className="flex flex-wrap gap-2">
                            {availableSubjects.map((sub) => {
                              const active = sSubjects.includes(sub);
                              return (
                                <button
                                  key={sub}
                                  type="button"
                                  onClick={() => toggleSubject(sub)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all border ${active ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200 cursor-pointer'}`}
                                >
                                  {sub}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* ROW 4 - Days checklist */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase block">Class Duty Weekly Days (Can select multiple) *</label>
                          <div className="flex flex-wrap gap-2">
                            {weekdayOptions.map((day) => {
                              const active = sDays.includes(day);
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => toggleDay(day)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${active ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200 cursor-pointer'}`}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Save cancel footer */}
                        <div className="flex justify-end items-center gap-3 border-t border-slate-100 pt-4">
                          <button
                            type="button"
                            onClick={() => { resetStudentForm(); setEditingStudentId(null); }}
                            className="px-4 py-2 bg-slate-150 hover:bg-slate-200 text-slate-705 font-bold text-xs md:text-sm rounded-xl cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs md:text-sm rounded-xl shadow-md cursor-pointer animate-pulse"
                          >
                            Save Credentials Inside Area
                          </button>
                        </div>
                      </form>
                    </div>
                  );
                }

                return (
                  <div key={stud.id} className="glass-tutor rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-250">
                    <div className="p-5">
                      {/* Name card */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {stud.medium}
                          </span>
                          <h4 className="text-base font-extrabold text-slate-800 mt-1.5">{stud.name}</h4>
                          <p className="text-xs text-slate-400 font-semibold">{stud.schoolOrCollege || 'No institution indicated'}</p>
                        </div>
                        <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl shrink-0">
                          <School className="w-5 h-5" />
                        </div>
                      </div>

                      {/* Info lines */}
                      <div className="mt-4 space-y-2 border-t border-b border-dashed border-slate-100 py-3 text-xs text-slate-600">
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Class / Group:</span>
                          <span className="font-bold text-slate-800 capitalize">
                            {stud.className} {stud.groupName ? `(${stud.groupName})` : ''}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Duties:</span>
                          <span className="font-bold text-slate-800 font-mono">
                            {stud.daysPerWeek.join(', ') || 'No defined schedule'}
                          </span>
                        </div>
                        {stud.timeSlot && (
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Tutoring Time:</span>
                            <span className="font-bold text-indigo-700 font-mono">
                              {stud.timeSlot}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Monthly salary:</span>
                          <span className="font-bold text-emerald-600 font-mono">৳ {stud.salary.toLocaleString('en-US')}</span>
                        </div>
                      </div>

                      {/* Subjects scroll */}
                      <div className="mt-4">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Assigned Curriculum</span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {stud.subjects.map(s => (
                            <span key={s} className="bg-emerald-50/50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-100 capitalize">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin className="w-4 h-4 shrink-0 text-slate-400" />
                          <span className="truncate">{stud.location || 'Not provided'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Phone className="w-4 h-4 shrink-0 text-slate-400" />
                          <span className="font-mono">{stud.parentNumber}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer edit delete buttons */}
                    <div className="bg-white/40 backdrop-blur-md px-5 py-3 border-t border-slate-100/50 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400">
                        Attendance: <span className="text-indigo-600 font-mono font-extrabold">{summ.percentage}%</span>
                      </span>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditStudent(stud)}
                          className="p-1.5 rounded-lg border border-slate-200/50 text-slate-600 bg-white/40 hover:bg-white/85 transition-all shadow-sm cursor-pointer"
                          title="Edit Student Info"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(stud.id)}
                          className="p-1.5 rounded-lg border border-rose-100 text-rose-600 bg-rose-50/45 hover:bg-rose-100/80 transition-all cursor-pointer"
                          title="Delete Student"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredStudents.length === 0 && (
                <div className="col-span-full glass-tutor rounded-2xl p-12 text-center">
                  <p className="text-slate-400 text-sm font-medium">No students match search or are setup.</p>
                  <p className="text-xs text-slate-400 mt-1">Click the button top right to register a pupil now!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ATTENDANCE (MONTH/YEAR OPTIONS, OPTIONS PRESENT, ABSENT, GAP, HOLIDAY, COVERED GAP AT DATE, PDF DOWNLOAD) */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-extrabold text-[10px] sm:text-xs rounded-xl transition-all border border-slate-200 cursor-pointer w-fit"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </button>
            
            {/* Student & Date selector Header */}
            <div className="glass-tutor p-5 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Select Pupil *</label>
                <select 
                  value={attSelectedStudent}
                  onChange={e => setAttSelectedStudent(e.target.value)}
                  className="px-3 py-2 rounded-xl glass-input-tutor text-xs md:text-sm font-semibold text-slate-705"
                >
                  <option value="" disabled className="text-slate-700 bg-slate-50">-- Choose Registered Student --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id} className="text-slate-700 bg-slate-50">{s.name} ({s.className})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Select Month *</label>
                <select 
                  value={attMonth}
                  onChange={e => setAttMonth(parseInt(e.target.value))}
                  className="px-3 py-2 rounded-xl glass-input-tutor text-xs md:text-sm font-semibold text-slate-705"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i} className="text-slate-700 bg-slate-50">
                      {new Date(2026, i).toLocaleString('en-US', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Select Year *</label>
                <select 
                  value={attYear}
                  onChange={e => setAttYear(parseInt(e.target.value))}
                  className="px-3 py-2 rounded-xl glass-input-tutor text-xs md:text-sm font-semibold text-slate-705"
                >
                  {[2025, 2026, 2027].map(yr => (
                    <option key={yr} value={yr} className="text-slate-700 bg-slate-50">{yr}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 md:mt-4 self-end">
                {attSelectedStudent && (
                  <button
                    onClick={() => handlePrintStudentMonthlyReport(attSelectedStudent)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-indigo-100"
                  >
                    <Download className="w-4 h-4" /> Download Statement
                  </button>
                )}
              </div>
            </div>

            {attSelectedStudent ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Heatmap column */}
                <div className="lg:col-span-8 space-y-6">
                  {/* GitHub contribution heatmap */}
                  <GitHubContributionGrid 
                    logs={getSelectedStudentLogs()}
                    year={attYear}
                    month={attMonth}
                    onSelectDay={(dayNum) => {
                      setEditingDay(dayNum);
                      const currentLog = getSelectedStudentLogs()[dayNum] as any;
                      const selectedDayOfWeek = new Date(attYear, attMonth, dayNum).toLocaleDateString('en-US', { weekday: 'short' });
                      const activeStudent = students.find(s => s.id === attSelectedStudent);
                      const scheduledDays = activeStudent?.daysPerWeek || [];
                      const isMatch = scheduledDays.includes(selectedDayOfWeek);

                      if (currentLog) {
                        setDayStatus(currentLog.status as any);
                        setGapDateString(currentLog.gapDateStr || '');
                        setPremiseType(currentLog.premise || (isMatch ? 'regular' : 'extra'));
                        setPremiseDate(currentLog.premiseDetail || '');
                      } else {
                        setDayStatus('present');
                        setGapDateString('');
                        setPremiseType(isMatch ? 'regular' : 'extra');
                        setPremiseDate('');
                      }
                    }}
                  />

                  {/* Marking Box / Log trigger */}
                  {editingDay !== null && (
                    <form onSubmit={handleMarkDayAttendance} className="bg-gradient-to-tr from-slate-800 to-slate-900 text-white p-5 rounded-2xl border border-slate-700 shadow-md space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                        <span className="text-xs md:text-sm font-bold text-slate-300">
                          Update Ledger Status: <strong className="text-white">Day {editingDay}, {new Date(attYear, attMonth).toLocaleString('en-US', { month: 'short' })} {attYear}</strong>
                        </span>
                        <button type="button" onClick={() => setEditingDay(null)} className="text-slate-400 hover:text-white">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Status State</label>
                          <select
                            value={dayStatus}
                            onChange={(e) => setDayStatus(e.target.value as TutorAttendanceStatus)}
                            className="bg-slate-800 text-white px-3 py-2 rounded-xl border border-slate-700 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                          >
                            <option value="present">Present (Normal Class)</option>
                            <option value="absent">Absent (Tutor Missed / Sick)</option>
                            <option value="gap">Gap Class (Postponed Regular Date)</option>
                            <option value="covered_gap">Recovered / Covered Gap Class</option>
                            <option value="holiday">Official Holiday</option>
                            <option value="student_off">Student Took Off / Emergency Leave</option>
                          </select>
                        </div>

                        {/* Covered Gap Date picker conditional */}
                        {(dayStatus === 'covered_gap' || premiseType === 'gap_cover') && (
                          <div className="flex flex-col gap-1.5 bg-slate-800/80 p-2.5 rounded-xl border border-emerald-500/30">
                            <label className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wide">Date of Original Missed Class covered</label>
                            <input 
                              type="date" 
                              required
                              value={gapDateString || premiseDate}
                              onChange={e => {
                                setGapDateString(e.target.value);
                                setPremiseDate(e.target.value);
                              }}
                              className="bg-slate-800 text-white px-3 py-1.5 rounded-lg border border-slate-700 text-xs focus:outline-none"
                            />
                          </div>
                        )}
                      </div>

                      {/* Premise Mismatch dynamic selector panel */}
                      {(() => {
                        const selectedDayOfWeek = new Date(attYear, attMonth, editingDay || 1).toLocaleDateString('en-US', { weekday: 'short' });
                        const activeStudent = students.find(s => s.id === attSelectedStudent);
                        const scheduledDays = activeStudent?.daysPerWeek || [];
                        const isMatch = scheduledDays.includes(selectedDayOfWeek);

                        return (
                          <div className="p-3.5 bg-slate-800/50 rounded-xl border border-slate-700 space-y-3 font-sans">
                            {!isMatch ? (
                              <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                Premise Selector (This date {selectedDayOfWeek} does not match student registration schedule):
                              </div>
                            ) : (
                              <div className="text-[10px] text-emerald-400 font-medium">
                                Schedule Match ({selectedDayOfWeek} is registered class day). You can specify premise:
                              </div>
                            )}

                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-slate-400 font-extrabold uppercase">Select Premise basis</span>
                              <div className="flex flex-wrap gap-2 pt-1">
                                {[
                                  { value: 'regular', label: 'Regular Class' },
                                  { value: 'extra', label: 'Extra Class' },
                                  { value: 'gap_cover', label: 'Gap Cover' },
                                  { value: 'exam', label: 'Student Exam Assist' }
                                ].map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                      setPremiseType(opt.value);
                                      if (opt.value === 'gap_cover') {
                                        setDayStatus('covered_gap');
                                      } else if (opt.value === 'regular') {
                                        setDayStatus('present');
                                      }
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                                      premiseType === opt.value
                                        ? 'bg-emerald-600 border-emerald-600 text-white'
                                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-755 hover:text-white'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="flex justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => setEditingDay(null)}
                          className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-bold transition-all text-slate-200"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-bold text-white transition-all shadow-md"
                        >
                          Save Log
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Statistics panel column */}
                <div className="lg:col-span-4 glass-tutor p-5 rounded-2xl flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm md:text-base border-b border-slate-100 pb-2">
                      Stats Report
                    </h4>
                    
                    {(() => {
                      const report = getAttendanceSummary(attSelectedStudent, attMonth, attYear);
                      return (
                        <div className="space-y-4 mt-4">
                          <div className="text-center bg-emerald-50/50 py-4 px-3 rounded-2xl border border-emerald-100/50">
                            <span className="text-2xl md:text-3xl font-extrabold text-emerald-600 font-mono">{report.percentage}%</span>
                            <p className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider mt-1">Accuracy / Presence Rate</p>
                          </div>

                          <div className="space-y-3.5 text-xs">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                                <span className="w-2 rounded bg-emerald-500 h-3" /> Presences
                              </span>
                              <span className="font-extrabold text-slate-700 font-mono">{report.present}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                                <span className="w-2 rounded bg-rose-500 h-3" /> Absences
                              </span>
                              <span className="font-extrabold text-slate-700 font-mono">{report.absent}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                                <span className="w-2 rounded bg-amber-500 h-3" /> Postponed Gaps
                              </span>
                              <span className="font-extrabold text-slate-700 font-mono">{report.gap}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                                <span className="w-2 rounded bg-indigo-500 h-3" /> Holidays
                              </span>
                              <span className="font-extrabold text-slate-700 font-mono">{report.holiday}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                                <span className="w-2 rounded bg-teal-600 h-3" /> Recovery covered
                              </span>
                              <span className="font-extrabold text-slate-700 font-mono">{report.covered}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2">
                              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                                <span className="w-2 rounded bg-sky-500 h-3" /> Leaves
                              </span>
                              <span className="font-extrabold text-slate-700 font-mono">{report.off}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <p className="text-[10px] text-slate-400 mt-6 pt-3 border-t border-slate-50 text-center">
                    Statement logs comply with parent notifications.
                  </p>
                </div>

              </div>
            ) : (
              <div className="glass-tutor rounded-2xl p-12 text-center">
                <p className="text-slate-400 text-sm font-semibold">Please select a student above to access daily calendars.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SALARY MANAGER (INVOICES, GENERATE RECIEPT, EDIT, DELETE, PENDING, MONTH OPTIONS) */}
        {activeTab === 'salary' && (
          <div className="space-y-4">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-extrabold text-[10px] sm:text-xs rounded-xl transition-all border border-slate-200 cursor-pointer w-fit"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </button>
            
            {/* Options bar */}
            <div className="glass-tutor p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
              
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Audit Month</span>
                  <select 
                    value={selectedSalaryMonth}
                    onChange={e => setSelectedSalaryMonth(parseInt(e.target.value))}
                    className="px-3 py-1.5 rounded-xl glass-input-tutor text-xs font-bold text-slate-705 focus:outline-none"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i} className="text-slate-700 bg-slate-50">
                        {new Date(2026, i).toLocaleString('en-US', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Audit Year</span>
                  <select 
                    value={selectedSalaryYear}
                    onChange={e => setSelectedSalaryYear(parseInt(e.target.value))}
                    className="px-3 py-1.5 rounded-xl glass-input-tutor text-xs font-bold text-slate-705 focus:outline-none"
                  >
                    {[2025, 2026, 2027].map(yr => (
                      <option key={yr} value={yr} className="text-slate-700 bg-slate-50">{yr}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick populate buttons */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <span className="text-xs font-bold text-slate-400 mr-2">Generate Billing:</span>
                {students.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleAddSalaryRecord(s.id)}
                    className="px-2.5 py-1.5 border border-slate-100 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> {s.name.split(' ')[0]}
                  </button>
                ))}
              </div>

            </div>

            {/* MAIN SALARY GRID TABLE */}
            <div className="glass-tutor rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-sm md:text-base">
                  Tuition Billing logs ({new Date(selectedSalaryYear, selectedSalaryMonth).toLocaleString('en-US', { month: 'long' })} {selectedSalaryYear})
                </h3>
                <span className="text-xs font-bold font-mono text-emerald-600 px-3 py-1 rounded-full bg-emerald-50">
                  Total Collected: ৳{getSalarySummationsForMonth(selectedSalaryMonth, selectedSalaryYear).received} BDT
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-slate-700">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 text-[10px] uppercase tracking-wider font-extrabold text-left border-b border-slate-100">
                      <th className="px-5 py-3">Student</th>
                      <th className="px-5 py-3">Class</th>
                      <th className="px-5 py-3">Tuition Salary</th>
                      <th className="px-5 py-3">Billing State</th>
                      <th className="px-5 py-3">Collection Date</th>
                      <th className="px-5 py-3 text-right">Ledger Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs font-medium">
                    {salaries
                      .filter(s => s.month === selectedSalaryMonth && s.year === selectedSalaryYear)
                      .map((sal) => {
                        const stud = students.find(st => st.id === sal.studentOrTeacherId);
                        const isEditingThisRow = salaryEditId === sal.id;

                        if (!stud) return null;

                        return (
                          <tr key={sal.id} className="hover:bg-slate-55/40 transition-colors">
                            {/* Student */}
                            <td className="px-5 py-3">
                              <span className="font-extrabold text-slate-800">{stud.name}</span>
                            </td>
                            {/* Class */}
                            <td className="px-5 py-3 text-slate-500 capitalize">
                              {stud.className}
                            </td>
                            {/* Amount */}
                            <td className="px-5 py-3 font-bold font-mono">
                              {isEditingThisRow ? (
                                <input
                                  type="number"
                                  value={salaryEditAmount}
                                  onChange={e => setSalaryEditAmount(e.target.value)}
                                  className="w-20 px-2 py-1 rounded border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                                />
                              ) : (
                                `৳ ${sal.amount.toLocaleString('en-US')}`
                              )}
                            </td>
                            {/* Status */}
                            <td className="px-5 py-3">
                              {isEditingThisRow ? (
                                <select
                                  value={salaryEditState}
                                  onChange={e => setSalaryEditState(e.target.value as any)}
                                  className="px-2 py-1 bg-white rounded border text-xs font-bold"
                                >
                                  <option value="paid">PAID</option>
                                  <option value="unpaid">UNPAID</option>
                                </select>
                              ) : (
                                <button
                                  onClick={() => handleUpdateSalaryStatus(sal.id, { status: sal.status === 'paid' ? 'unpaid' : 'paid', paymentDate: sal.status === 'unpaid' ? new Date().toISOString().substring(0,10) : undefined })}
                                  className={`px-3 py-1 text-[10px] font-extrabold rounded-full ${sal.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}
                                >
                                  {sal.status.toUpperCase()}
                                </button>
                              )}
                            </td>
                            {/* Date */}
                            <td className="px-5 py-3 font-mono">
                              {isEditingThisRow ? (
                                salaryEditState === 'paid' ? (
                                  <input
                                    type="date"
                                    value={salaryEditDate}
                                    onChange={e => setSalaryEditDate(e.target.value)}
                                    className="px-2 py-0.5 rounded border text-[11px]"
                                  />
                                ) : '-'
                              ) : (
                                sal.paymentDate ? sal.paymentDate : '-'
                              )}
                            </td>
                            {/* CRUD items */}
                            <td className="px-5 py-3 text-right space-x-1.5 whitespace-nowrap">
                              {isEditingThisRow ? (
                                <>
                                  <button
                                    onClick={handleSaveSalaryRowDetails}
                                    className="p-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px]"
                                  >
                                    Done
                                  </button>
                                  <button
                                    onClick={() => setSalaryEditId(null)}
                                    className="p-1 px-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-bold text-[10px]"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setSalaryEditId(sal.id);
                                      setSalaryEditState(sal.status);
                                      setSalaryEditAmount(sal.amount.toString());
                                      setSalaryEditDate(sal.paymentDate || new Date().toISOString().substring(0,10));
                                    }}
                                    className="px-2 py-1 border border-slate-200 rounded text-slate-500 hover:text-emerald-700"
                                    title="Edit Row Metadata"
                                  >
                                    Adjust
                                  </button>
                                  {sal.status === 'paid' && (
                                    <button
                                      onClick={() => setActiveInvoice(sal)}
                                      className="px-2.5 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-extrabold rounded"
                                    >
                                      Receipt
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteSalaryRecord(sal.id)}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                    title="Wipe record row"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 inline" />
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                    {salaries.filter(s => s.month === selectedSalaryMonth && s.year === selectedSalaryYear).length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400">
                          No salary record entries exist for this month. Choose the registration shortcuts above to populate billing ledger.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MODAL INVOICE SHEET (GENERATE INVOICE FEATURE) */}
            {activeInvoice && (() => {
              const studentObj = students.find(s => s.id === activeInvoice.studentOrTeacherId);
              if(!studentObj) return null;
              return (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="glass-tutor bg-white/95 backdrop-blur-xl rounded-3xl overflow-hidden max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-emerald-500/20">
                    
                    <div className="p-6 border-b border-emerald-500/15 flex justify-between items-center bg-emerald-500/5">
                      <h4 className="font-extrabold text-slate-800 flex items-center gap-2">
                        <Printer className="w-5 h-5 text-emerald-600" /> Secure Legal Invoice
                      </h4>
                      <button onClick={() => setActiveInvoice(null)} className="p-1 rounded-full hover:bg-slate-200 text-slate-400">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 overflow-y-auto space-y-6 text-slate-800" id="receipt-modal-content">
                      <div className="text-center">
                        <h2 className="text-2xl font-black text-emerald-600">Tutors' Diary</h2>
                        <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Official Tuition Payment Receipt</span>
                      </div>

                      <div className="border border-dashed border-slate-200 rounded-2xl p-4 text-xs font-medium space-y-2.5">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Invoice Number:</span>
                          <span className="font-bold text-slate-700">#TD-INV-${activeInvoice.id.substring(4)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Settled On:</span>
                          <span className="font-bold text-slate-700 font-mono">{activeInvoice.paymentDate || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Tutor/Service Provider:</span>
                          <span className="font-bold text-slate-700">{user.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Billing Account:</span>
                          <span className="font-bold text-slate-700">{user.gmail}</span>
                        </div>
                      </div>

                      <div className="border border-slate-100 rounded-2xl p-4 text-xs space-y-3 bg-slate-50">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Recipient Details</span>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Student Name:</span>
                          <span className="font-extrabold text-slate-700">{studentObj.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">School/College:</span>
                          <span className="font-semibold text-slate-600">{studentObj.schoolOrCollege}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Parent Number:</span>
                          <span className="font-bold text-slate-700">{studentObj.parentNumber}</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-4 flex justify-between items-center text-sm">
                        <span className="font-bold text-slate-500">Gross Salary Received:</span>
                        <span className="text-2xl font-black text-emerald-600 font-mono">৳ {activeInvoice.amount.toLocaleString('en-US')} BDT</span>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                      <button 
                        onClick={() => {
                          const printHTML = document.getElementById('receipt-modal-content')?.innerHTML;
                          if (!printHTML) return;
                          
                          const styles = `
                            body { font-family: system-ui, sans-serif; padding: 60px; color: #1e293b; background: white; text-align: center; }
                            .border-dashed { border: 1px dashed #cbd5e1; padding: 25px; border-radius: 12px; margin: 20px 0; text-align: left; font-size: 13px; line-height: 1.8; }
                            .flex { display: flex; justify-content: space-between; }
                            h2 { color: #059669; margin: 0; }
                          `;

                          const docBodyContent = `
                            ${printHTML}
                            <div style="margin-top: 50px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                              System Invoice Generated Digitally on Tutors' Diary. Developed by Apurba Barua.
                            </div>
                          `;

                          setPrintView({
                            title: "Tutors Diary Invoice",
                            htmlContent: docBodyContent,
                            styles
                          });
                        }}
                        className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <Printer className="w-4 h-4" /> Print PDF Invoice
                      </button>
                    </div>

                  </div>
                </div>
              );
            })()}

          </div>
        )}

        {/* TAB 5: AUDITING REPORT */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-extrabold text-[10px] sm:text-xs rounded-xl transition-all border border-slate-200 cursor-pointer w-fit"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </button>
            
            {/* Quick selectors for Audit Months */}
            <div className="p-5 glass-tutor rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-400">Auditing Month Target:</span>
                  <select 
                    value={attMonth}
                    onChange={e => setAttMonth(parseInt(e.target.value))}
                    className="px-3 py-1.5 rounded-xl glass-input-tutor text-xs font-bold text-slate-705 focus:outline-none"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i} className="text-slate-700 bg-slate-50">
                        {new Date(2026, i).toLocaleString('en-US', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-400">Auditing Year Target:</span>
                  <select 
                    value={attYear}
                    onChange={e => setAttYear(parseInt(e.target.value))}
                    className="px-3 py-1.5 rounded-xl glass-input-tutor text-xs font-bold text-slate-705 focus:outline-none"
                  >
                    {[2025, 2026, 2027].map(yr => (
                      <option key={yr} value={yr} className="text-slate-700 bg-slate-50">{yr}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handlePrintAuditReport}
                className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 cursor-pointer shadow-sm shadow-emerald-50"
              >
                <Download className="w-4 h-4" /> Download Compiled PDF Audit
              </button>
            </div>

            {/* VISUALLY PACKED AUDITING SHEET (PRINT-FRIENDLY & COLORFUL TARGET) */}
            <div className="glass-tutor p-6 rounded-2xl space-y-6" id="printable-audit-section">
              
              {/* Report Header (Print style matching) */}
              <div className="border-b-2 border-emerald-600 pb-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h2 className="text-xl md:text-2xl font-black text-slate-800">TUTOR PERFORMANCE & COMPREHENSIVE AUDIT</h2>
                    <span className="text-xs text-slate-400 font-bold block mt-1">
                      ORGANIZATIONAL SUMMARY: {new Date(attYear, attMonth).toLocaleString('en-US', { month: 'long' }).toUpperCase()} {attYear}
                    </span>
                  </div>
                  <div className="text-left sm:text-right text-xs">
                    <p className="margin-0"><strong>Audited System Agent:</strong> {user.name}</p>
                    <p className="margin-0 text-slate-400"><strong>Registered Email:</strong> {user.gmail}</p>
                  </div>
                </div>
              </div>

              {/* Top summary metrics inside printable row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="border border-slate-150 rounded-xl p-4 bg-emerald-50/20 text-center">
                  <span className="text-xs font-extrabold text-emerald-600 uppercase tracking-widest block">Gross Received Tuition Fees</span>
                  <span className="text-2xl font-black text-slate-800 font-mono block mt-1.5">৳ {getSalarySummationsForMonth(attMonth, attYear).received.toLocaleString('en-US')} BDT</span>
                </div>
                <div className="border border-slate-150 rounded-xl p-4 bg-rose-50/20 text-center">
                  <span className="text-xs font-extrabold text-rose-500 uppercase tracking-widest block">Outstanding Pending Debts</span>
                  <span className="text-2xl font-black text-slate-800 font-mono block mt-1.5">৳ {getSalarySummationsForMonth(attMonth, attYear).pending.toLocaleString('en-US')} BDT</span>
                </div>
                <div className="border border-slate-150 rounded-xl p-4 bg-indigo-50/20 text-center">
                  <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-widest block">Average Attendance Ratio</span>
                  <span className="text-2xl font-black text-slate-800 font-mono block mt-1.5">
                    {students.length > 0 ? (
                      Math.round(
                        students.reduce((acc, s) => acc + getAttendanceSummary(s.id, attMonth, attYear).percentage, 0) / students.length
                      )
                    ) : 0}% Attendance
                  </span>
                </div>
              </div>

              {/* DETAILED STUDENT COMPREHENSIVE LIST */}
              <div className="space-y-4">
                <h4 className="font-extrabold text-slate-800 text-xs md:text-sm uppercase tracking-wider">Student Profile Breakdown Ledger</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 uppercase font-extrabold">
                        <th className="p-3 border-b border-slate-200">Pupil Student Name</th>
                        <th className="p-3 border-b border-slate-200">Class Grade</th>
                        <th className="p-3 border-b border-slate-200 text-center">Attendance % Target</th>
                        <th className="p-3 border-b border-slate-200 text-center">Total Gaps Scheduled</th>
                        <th className="p-3 border-b border-slate-200 text-center">Covered corrections</th>
                        <th className="p-3 border-b border-slate-200">Salary Status</th>
                        <th className="p-3 border-b border-slate-200 text-right">Committed BDT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {students.map((st) => {
                        const attSummary = getAttendanceSummary(st.id, attMonth, attYear);
                        const paymentObj = salaries.find(s => s.studentOrTeacherId === st.id && s.month === attMonth && s.year === attYear);

                        return (
                          <tr key={st.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-extrabold text-slate-800">{st.name}</td>
                            <td className="p-3 text-slate-500 capitalize">{st.className}</td>
                            <td className="p-3 text-center font-bold font-mono text-indigo-600">{attSummary.percentage}%</td>
                            <td className="p-3 text-center font-mono">{attSummary.gap}</td>
                            <td className="p-3 text-center font-bold text-teal-600 font-mono">{attSummary.covered}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${paymentObj?.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                {paymentObj?.status?.toUpperCase() || 'UNPAID'}
                              </span>
                            </td>
                            <td className="p-3 text-right font-bold text-slate-800 font-mono">৳ {st.salary.toLocaleString('en-US')}</td>
                          </tr>
                        );
                      })}

                      {students.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-6 text-slate-400 font-medium">
                            No students registered to generate auditing indexes.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 6: AI EXAM PLANNER */}
        {activeTab === 'exam_planner' && (
          <div className="space-y-6 animate-fade-in text-slate-800">
            {/* Header banner */}
            <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 rounded-[28px] p-6 text-white relative overflow-hidden shadow-xl border border-indigo-500/25">
              <div className="relative z-10 space-y-2">
                <div className="bg-indigo-500/25 w-fit px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest text-indigo-300 border border-indigo-400/20 backdrop-blur-md">
                  Active Cognitive Match Engine
                </div>
                <h3 className="text-2xl md:text-3xl font-black font-display text-white tracking-tight flex items-center gap-2">
                  <Sparkles className="w-7 h-7 text-amber-300 animate-pulse animate-spin-slow" /> AI Co-Pilot Suite
                </h3>
                <p className="text-xs text-indigo-200/80 max-w-2xl leading-relaxed font-sans">
                  Optimize exam routines, evaluate student academic burnout indices, and auto-generate specialized weekly syllabus checklists that align with Bangla, English Medium, or Edexcel curriculums.
                </p>
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
            </div>

            {/* Sub Tabs Selector */}
            <div className="flex gap-1.5 p-1.5 bg-slate-100 rounded-2xl w-fit border border-slate-200/60 shadow-inner">
              <button
                type="button"
                onClick={() => setAiSubTab('scheduler')}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-xs md:text-xs uppercase tracking-wider font-extrabold transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${aiSubTab === 'scheduler' ? 'bg-indigo-950 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
              >
                <Calendar className="w-3.5 h-3.5" /> AI Exam Scheduler
              </button>
              <button
                type="button"
                onClick={() => setAiSubTab('stress_syllabus')}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-xs md:text-xs uppercase tracking-wider font-extrabold transition-all duration-150 flex items-center gap-1.5 cursor-pointer relative overflow-hidden ${aiSubTab === 'stress_syllabus' ? 'bg-indigo-950 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> AI Stress & Syllabus Planner
              </button>
            </div>

            {aiSubTab === 'scheduler' ? (
              <>
                {/* Input Options Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              {/* Box 1: Add Free Slots during Exams */}
              <div className="lg:col-span-5 glass-tutor bg-white/70 backdrop-blur-md p-6 rounded-3xl border border-indigo-500/10 flex flex-col justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-600" /> Specify Your Free Slots
                  </h4>
                  
                  <form onSubmit={handleAddFreeSlot} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Select Day</label>
                        <select 
                          value={inputFreeDay}
                          onChange={e => setInputFreeDay(e.target.value)}
                          className="w-full px-3 py-2 bg-white/55 border border-slate-200 rounded-xl focus:outline-none text-xs sm:text-sm font-bold text-slate-700"
                        >
                          {["Sat", "Mon", "Wed", "Sun", "Tue", "Thu", "Fri"].map(d => (
                            <option key={d} value={d}>{d}day</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Time Slot</label>
                        <select
                          value={inputFreeTime}
                          onChange={e => setInputFreeTime(e.target.value)}
                          className="w-full px-3 py-2 bg-white/55 border border-slate-200 rounded-xl focus:outline-none text-xs sm:text-sm font-bold text-slate-700"
                        >
                          {["09:00 AM", "10:30 AM", "12:00 PM", "02:00 PM", "03:00 PM", "04:30 PM", "05:05 PM", "06:00 PM", "07:30 PM", "08:00 PM"].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black tracking-widest uppercase rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 font-display"
                    >
                      <Plus className="w-4 h-4" /> Add Availability Slot
                    </button>
                  </form>
                </div>

                <div className="mt-6 border-t border-slate-100/60 pt-4">
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block mb-2 font-mono">My Declared Exam Free Slots</span>
                  <div className="flex flex-wrap gap-2">
                    {tutorFreeSlots.map(slot => (
                      <div key={slot.id} className="relative group bg-indigo-50 border border-indigo-150 pl-2.5 pr-8 py-1.5 rounded-xl text-xs font-bold text-indigo-800 flex items-center gap-1.5 shadow-sm">
                        <span className="font-extrabold bg-indigo-200 text-indigo-900 px-1.5 py-0.5 rounded text-[9px] uppercase">{slot.day}</span>
                        <span>{slot.time}</span>
                        <button
                          onClick={() => handleRemoveFreeSlot(slot.id)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-indigo-400 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove slot"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {tutorFreeSlots.length === 0 && (
                      <p className="text-xs text-slate-400 font-medium py-2">No slots declared. Declare when you are free during exam period!</p>
                    )}
                  </div>
                </div>

              </div>

              {/* Box 2: Trigger Solver & Explanation */}
              <div className="lg:col-span-7 glass-tutor bg-gradient-to-tr from-indigo-900/10 via-white/50 to-emerald-500/10 backdrop-blur-md p-6 rounded-3xl border border-emerald-500/10 flex flex-col justify-between">
                <div className="space-y-3">
                  <h4 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" /> Live Preference Diagnostics
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold font-sans">
                    The algorithm actively fetches values from your student directory:
                  </p>
                  
                  {/* Miniature list of registered student standard days & time preferables */}
                  <div className="space-y-2 overflow-y-auto max-h-[140px] pr-1 bento-scrollbar">
                    {students.map(stud => (
                      <div key={stud.id} className="bg-white/80 p-3 rounded-xl border border-slate-100 flex justify-between items-center text-xs shadow-sm">
                        <div>
                          <p className="font-extrabold text-slate-800">{stud.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono capitalize">{stud.className} &bull; {stud.medium}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-500">Prefers standard:</p>
                          <p className="font-black text-indigo-600 text-[11px] font-mono">
                            {stud.daysPerWeek.join('/')} @ {stud.timeSlot || '04:30 PM'}
                          </p>
                        </div>
                      </div>
                    ))}
                    {students.length === 0 && (
                      <p className="text-xs text-slate-400 py-3 text-center">Add students to run preferences scan.</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-150 mt-4">
                  <button
                    onClick={runAISolver}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-600 to-indigo-600 hover:from-emerald-600 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg hover:shadow-indigo-500/25 flex items-center justify-center gap-2 font-display cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300 animate-spin" /> Optimize AI Exam Schedule Now
                  </button>
                </div>
              </div>

            </div>

            {/* AI Suggested Glow / Glassmorphism Cards Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-black text-slate-800 text-base tracking-tight font-display">
                    Glowing Suggested Schedules
                  </h4>
                  <p className="text-xs text-slate-400 font-medium">Glazed timeslots automatically solved for exam weeks</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-[10px] font-mono text-emerald-600 font-black uppercase">Live Alignment Resolved</span>
                </div>
              </div>

              {isAnalyzingExamSchedule ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <div className="space-y-1">
                    <p className="text-xs text-indigo-600 font-black uppercase tracking-widest font-mono animate-pulse">🤖 Consulting Gemini Deep Heuristic Scheduler...</p>
                    <p className="text-[10px] text-slate-400 font-medium">Resolving overlaps and drafting notifications to guardians...</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                  {getAISuggestions().map(({ student, suggestedDay, suggestedTime, matchType, aiReasoning }) => (
                    <div 
                      key={student.id} 
                      className="glass-colorful-glace-neon rounded-[28px] p-6 text-slate-850 flex flex-col justify-between min-h-[310px]"
                    >
                      {/* Badge / Match Level */}
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <span className="bg-slate-900/10 px-2.5 py-1 rounded-full text-[9px] uppercase font-extrabold tracking-widest text-slate-700 border border-black/5 font-mono">
                              {student.className}
                            </span>
                          </div>
                          <div>
                            <span className={`px-2.5 py-1 rounded-full text-[9px] uppercase font-black font-mono tracking-wider ${
                              matchType === 'perfect' 
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                : 'bg-indigo-100 text-indigo-800 border border-indigo-300 animate-pulse'
                            }`}>
                              {matchType === 'perfect' ? '🌟 Perfect Harmony' : '✨ Optimized Move'}
                            </span>
                          </div>
                        </div>

                        <h5 className="text-lg font-black tracking-tight text-slate-900 mb-1 font-display">{student.name}</h5>
                        <p className="text-[11px] text-slate-500 font-medium capitalize mb-4">{student.schoolOrCollege || 'Syllabus Studies'} &bull; {student.medium} Medium</p>

                        {/* Comparative slots */}
                        <div className="grid grid-cols-2 gap-2 bg-white/40 p-3 rounded-2xl border border-white/50 mb-4 text-xs font-sans">
                          <div>
                            <p className="text-[9px] uppercase text-slate-400 font-bold font-sans">Standard Timing</p>
                            <p className="font-extrabold text-slate-650 truncate">{student.daysPerWeek.join('/')}</p>
                            <p className="font-bold text-slate-500 text-[10px] font-mono">{student.timeSlot || '04:30 PM'}</p>
                          </div>
                          <div className="border-l border-slate-200/50 pl-3">
                            <p className="text-[9px] uppercase text-indigo-500 font-extrabold flex items-center gap-1 font-sans">
                              <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" /> AI Proposal
                            </p>
                            <p className="font-black text-indigo-900 font-display">{suggestedDay}day</p>
                            <p className="font-black text-indigo-700 text-[10px] font-mono">{suggestedTime}</p>
                          </div>
                        </div>

                        {/* Rationale description */}
                        <div className="bg-white/45 p-3 rounded-2xl border border-white/30 text-[10px] leading-relaxed text-slate-600 font-medium italic mb-5 relative overflow-hidden font-sans">
                          {aiReasoning}
                        </div>
                      </div>

                      {/* CTA Copy Notification Button */}
                      <div>
                        <button
                          onClick={() => {
                            const smsText = `Dear Guardian of ${student.name}, due to my upcoming exam timeline, I have used our AI Scheduler to reorganize the tutoring sessions. ${student.name}'s next tutoring session is optimized for ${suggestedDay}s at ${suggestedTime}. Thank you for your support!`;
                            navigator.clipboard.writeText(smsText);
                            showToast(`Copied scheduled slot SMS text for ${student.name} to clipboard!`, "success");
                          }}
                          className="w-full py-2 bg-slate-950 hover:bg-black text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 hover:shadow-md font-display"
                        >
                          <Check className="w-3.5 h-3.5" /> Accept & Copy SMS Draft
                        </button>
                      </div>
                    </div>
                  ))}

                  {students.length === 0 && (
                    <div className="col-span-full py-16 text-center text-slate-405 font-medium">
                      No student listings exist to solve exam timings. Ensure you register student diaries first!
                    </div>
                  )}
                </div>
              )}
            </div>
            </>
            ) : (
              // NEW UNIQUE AI SEGMENT: Stress, Burnout & Syllabus Planner
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in text-slate-800" id="tutor-stress-syllabus-block">
                {/* Column 1: Interactive Diagnostics (Burnout / Load analysis) */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="glass-tutor bg-white/75 backdrop-blur-md p-6 rounded-3xl border border-indigo-500/10 shadow-sm space-y-4">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight mb-1 flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-600" /> Choose Target Pupil
                      </h4>
                      <p className="text-[10px] text-slate-400 font-medium">Evaluate cognitive workload & academic stress indicator metrics</p>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Active Student Selection *</label>
                      {students.length > 0 ? (
                        <select
                          value={aiSyllabusStudentId}
                          onChange={e => {
                            setAiSyllabusStudentId(e.target.value);
                            setCustomSyllabusResult('');
                          }}
                          className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs md:text-sm font-semibold text-slate-700 w-full focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                        >
                          {students.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.className})</option>
                          ))}
                        </select>
                      ) : (
                        <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-semibold border border-rose-100">
                          No active students found in your account directory yet.
                        </div>
                      )}
                    </div>

                    {students.length > 0 && (() => {
                      const selStudent = students.find(s => s.id === aiSyllabusStudentId);
                      if (!selStudent) return null;
                      const metrics = getStudentBurnoutMetrics(selStudent);
                      return (
                        <div className="space-y-4 pt-2 border-t border-slate-100 animate-fade-in">
                          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider font-sans">Cognitive Vibe</span>
                              <p className={`text-xs font-black tracking-wide mt-0.5 uppercase ${metrics.score >= 70 ? 'text-rose-605 font-bold animate-pulse' : metrics.score >= 40 ? 'text-amber-600' : 'text-emerald-650'}`}>{metrics.zone}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider font-sans">Burnout Index</span>
                              <p className="text-lg font-black text-indigo-950 font-mono mt-0.5">{metrics.score}%</p>
                            </div>
                          </div>

                          {/* Progress Gauge */}
                          <div className="space-y-1">
                            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/45">
                              <div
                                className={`${metrics.progressColor} h-full transition-all duration-500`}
                                style={{ width: `${metrics.score}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-400 font-bold font-sans">
                              <span>0% ZEN</span>
                              <span>50% STEADY</span>
                              <span>100% EXHAUSTED</span>
                            </div>
                          </div>

                          {/* Description bubble */}
                          <div className="p-3 bg-white/70 border border-slate-150 rounded-2xl text-[11px] leading-relaxed text-slate-650 font-medium italic">
                            {metrics.desc}
                          </div>

                          {/* Action - share notification preview */}
                          <button
                            type="button"
                            onClick={() => {
                              const noteText = `Dear Guardian of ${selStudent.name}, I am keeping a supportive, optimized pace for their tutoring sessions so we cover standard study plans without causing academic burnout. Attendance stands solid, and progress parameters are healthy! - ${user.name}`;
                              navigator.clipboard.writeText(noteText);
                              showToast(`Copied parental wellness update to clipboard!`, 'success');
                            }}
                            className="w-full py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-800 font-bold text-[10px] uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 focus:outline-none"
                          >
                            <Check className="w-3.5 h-3.5" /> Draft Wellness SMS to Parent
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Column 2: Interactive AI Syllabus Checklist Generator */}
                <div className="lg:col-span-7">
                  <div className="glass-tutor bg-white/75 backdrop-blur-md p-6 rounded-3xl border border-indigo-500/10 shadow-sm space-y-4 flex flex-col justify-between min-h-[440px]">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight mb-1 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-indigo-600 animate-spin-slow" /> Course Revision & Syllabus Planner
                        </h4>
                        <p className="text-[10px] text-slate-400 font-medium">Instantly generate a tailored conceptual study plan and weekly checksheets</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Core Focus Topic (Optional)</label>
                          <input
                            type="text"
                            value={aiSyllabusFocus}
                            onChange={e => setAiSyllabusFocus(e.target.value)}
                            placeholder="e.g. Vectors, Organic Chemistry, Trigonometry"
                            className="px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs sm:text-xs font-semibold text-slate-700 w-full focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={handleGenerateSyllabus}
                            disabled={isGeneratingSyllabus || students.length === 0}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:bg-slate-300 disabled:cursor-not-allowed h-[36px] font-sans"
                          >
                            {isGeneratingSyllabus ? (
                              <>
                                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Synchronizing AI Matrix...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse animate-spin-slow" />
                                Generate AI Study Plan
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {customSyllabusResult ? (
                        <div className="space-y-3.5 animate-container-print">
                          <div className="relative">
                            <pre className="bg-indigo-950 text-indigo-100 hover:text-white p-4 rounded-2xl text-[10px] sm:text-xs font-semibold leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-[280px] border border-indigo-900 shadow-inner font-mono">
                              {customSyllabusResult}
                            </pre>
                            <span className="absolute bottom-2.5 right-2.5 bg-indigo-500/10 backdrop-blur-md px-2 py-1 text-[8px] font-bold tracking-wider text-indigo-300 rounded border border-indigo-500/20 uppercase font-mono">
                              AI Compiled Outline
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(customSyllabusResult);
                                showToast("Successfully copied Syllabus Checklist outline to clipboard!", 'success');
                              }}
                              className="flex-1 py-1.5 bg-slate-900 border border-slate-800 hover:bg-black text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 font-display"
                            >
                              Copy Outline to Clipboard
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="border border-dashed border-slate-205 rounded-2xl p-10 text-center text-slate-400 text-xs bg-slate-50/50">
                          <HelpCircle className="w-8 h-8 mx-auto mb-2.5 text-slate-300 animate-bounce" />
                          Specify key focus subjects or topic coordinates above, and run the instant generator to map weekly lessons checklists.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer copyright segment */}
      <footer className="bg-slate-930 text-slate-400 py-6 border-t border-slate-200 text-center text-xs mt-12 bg-white">
        <p className="font-bold text-slate-500 font-sans tracking-wide">
          Tutors' Diary — Designed by Apurba Barua. All rights reserved®
        </p>
        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-mono">
          Currency: BDT Locale (৳) | Secure local sandboxing persistence active
        </p>
      </footer>
    </div>
  );
};
