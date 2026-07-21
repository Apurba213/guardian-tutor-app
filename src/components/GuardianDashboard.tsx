/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  UserAccount, 
  GuardianTeacher, 
  AttendanceRecord, 
  SalaryPayment, 
  CourseSubject, 
  GuardianAttendanceStatus
} from '../types';
import { 
  loadGuardianTeachers, 
  saveGuardianTeachers, 
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
import { AttendancePieChart } from './AnalyticsCharts';
import { 
  Users, 
  BookOpen, 
  Calendar, 
  Wallet, 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  Edit, 
  RotateCcw, 
  Sparkles, 
  MapPin, 
  Phone, 
  Clock, 
  CheckCircle, 
  Download, 
  Heart, 
  Printer, 
  MessageCircle,
  HelpCircle,
  Search,
  X,
  ChevronLeft
} from 'lucide-react';

interface GuardianDashboardProps {
  user: UserAccount;
  onLogout: () => void;
}

export const GuardianDashboard: React.FC<GuardianDashboardProps> = ({ user, onLogout }) => {
  // --- CORE CONTEXT STATE ---
  const [teachers, setTeachers] = useState<GuardianTeacher[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [salaries, setSalaries] = useState<SalaryPayment[]>([]);

  // Tab routing: 'dashboard' | 'teachers' | 'attendance' | 'salary' | 'audit' | 'aiHub'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'teachers' | 'attendance' | 'salary' | 'audit' | 'aiHub'>('dashboard');

  // --- AI GUARDIAN COACH HUB STATE ---
  const [aiSelectedTeacherId, setAiSelectedTeacherId] = useState<string>('');
  const [aiTemplate, setAiTemplate] = useState<'correction' | 'payment' | 'feedback' | 'exam' | 'reschedule'>('feedback');
  const [aiCustomContext, setAiCustomContext] = useState<string>('');
  
  // AI Match specs
  const [aiMatchMedium, setAiMatchMedium] = useState<'bangla' | 'english' | 'cambridge'>('bangla');
  const [aiMatchGrade, setAiMatchGrade] = useState<string>('Class 8');
  const [aiMatchSubject, setAiMatchSubject] = useState<CourseSubject>('math');
  const [aiMatchBudget, setAiMatchBudget] = useState<string>('8500');

  // --- TEACHER FORM STATE ---
  const [showForm, setShowForm] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);

  const [tName, setTName] = useState('');
  const [tAddress, setTAddress] = useState('');
  const [tSubjects, setTSubjects] = useState<CourseSubject[]>([]);
  const [tSalary, setTSalary] = useState('');
  const [tMobile, setTMobile] = useState('');
  const [tWhatsapp, setTWhatsapp] = useState('');
  const [tQual, setTQual] = useState('');
  const [tDays, setTDays] = useState<string[]>([]);
  const [tTime, setTTime] = useState('');

  // Undo memory backup
  const [teacherBackup, setTeacherBackup] = useState<GuardianTeacher | null>(null);

  // --- ATTENDANCE SELECTORS ---
  const [attSelectedTeacher, setAttSelectedTeacher] = useState<string>('');
  const [attYear, setAttYear] = useState<number>(new Date().getFullYear());
  const [attMonth, setAttMonth] = useState<number>(new Date().getMonth());
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [dayStatus, setDayStatus] = useState<GuardianAttendanceStatus>('present');
  const [gapDateString, setGapDateString] = useState<string>('');
  const [premiseType, setPremiseType] = useState<string>('regular');
  const [premiseDate, setPremiseDate] = useState<string>('');

  // --- SALARY TRACKER STATES ---
  const [selectedSalaryMonth, setSelectedSalaryMonth] = useState<number>(new Date().getMonth());
  const [selectedSalaryYear, setSelectedSalaryYear] = useState<number>(new Date().getFullYear());
  const [salarySearch, setSalarySearch] = useState('');

  // Salary row editing states
  const [salaryEditId, setSalaryEditId] = useState<string | null>(null);
  const [salaryEditState, setSalaryEditState] = useState<'paid' | 'unpaid'>('unpaid');
  const [salaryEditDate, setSalaryEditDate] = useState<string>('');
  const [salaryEditAmount, setSalaryEditAmount] = useState<string>('');

  // Search/Filters
  const [teacherFilter, setTeacherFilter] = useState('');

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

  // --- LOAD LOCALDATA MOUNT WITH REAL-TIME FIRESTORE LISTENERS ---
  useEffect(() => {
    if (user && user.gmail) {
      const gmailLower = user.gmail.toLowerCase();

      // 1. Initial cached data load for fast first-paint UI
      setTeachers(loadGuardianTeachers(user.gmail));
      setAttendance(loadAttendance(user.gmail));
      setSalaries(loadSalaryPayments(user.gmail));

      // 2. Real-time Firebase Firestore Sync for teachers
      const qTeachers = query(
        collection(db, 'teachers'),
        where('ownerGmail', '==', gmailLower)
      );
      const unsubTeachers = onSnapshot(
        qTeachers,
        (snap) => {
          const list: GuardianTeacher[] = [];
          snap.forEach((docSnap) => {
            list.push(docSnap.data() as GuardianTeacher);
          });
          setTeachers(list);
          localStorage.setItem(getUserDataKey(gmailLower, 'teachers'), JSON.stringify(list));
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'teachers');
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
        unsubTeachers();
        unsubAttendance();
        unsubSalaries();
      };
    }
  }, [user]);

  const handleSeedDemoState = () => {
    seedMockDataForUser(user.gmail, 'guardian');
    const loadedTeachers = loadGuardianTeachers(user.gmail);
    setTeachers(loadedTeachers);
    setAttendance(loadAttendance(user.gmail));
    setSalaries(loadSalaryPayments(user.gmail));
    if (loadedTeachers.length > 0) {
      setAttSelectedTeacher(loadedTeachers[0].id);
      setAiSelectedTeacherId(loadedTeachers[0].id);
    }
    showToast("High-fidelity workspace seeded successfully for the active month! (Includes 2 private tutors, calendar logs, and statement ledger logs)", 'success');
  };

  const handleWipeAccountData = () => {
    setCustomConfirm({
      message: "Are you sure you want to completely clear this database workspace? This will delete all registered private tutor listings, calendar markers, and payment receipts, leaving a blank slate.",
      action: () => {
        saveGuardianTeachers(user.gmail, []);
        saveAttendance(user.gmail, []);
        saveSalaryPayments(user.gmail, []);
        setTeachers([]);
        setAttendance([]);
        setSalaries([]);
        setAttSelectedTeacher('');
        setAiSelectedTeacherId('');
        showToast("Database workspace wiped clean! Blank slate loaded.", 'info');
      }
    });
  };

  // Set default teacher
  useEffect(() => {
    if (teachers.length > 0) {
      if (!attSelectedTeacher) {
        setAttSelectedTeacher(teachers[0].id);
      }
      if (!aiSelectedTeacherId) {
        setAiSelectedTeacherId(teachers[0].id);
      }
    }
  }, [teachers, attSelectedTeacher, aiSelectedTeacherId]);

  const availableSubjects: CourseSubject[] = [
    'math', 'english', 'physics', 'chemistry', 'biology', 
    'higher math', 'ict', 'general science', 'bangla'
  ];

  const weekdayOptions = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  // --- TEACHER MUTATIONS ---
  const resetFormState = () => {
    setTName('');
    setTAddress('');
    setTSubjects([]);
    setTSalary('');
    setTMobile('');
    setTWhatsapp('');
    setTQual('');
    setTDays([]);
    setTTime('');
    setEditingTeacherId(null);
    setTeacherBackup(null);
  };

  const handleTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tName || !tSalary || !tMobile) {
      showToast('Teacher Name, Salary and Mobile number are required!', 'error');
      return;
    }

    const salaryVal = parseFloat(tSalary);
    if (isNaN(salaryVal)) {
      showToast('Salary tuition fee must be a valid number!', 'error');
      return;
    }

    const currentTeachers = [...teachers];

    if (editingTeacherId) {
      const idx = currentTeachers.findIndex(t => t.id === editingTeacherId);
      if (idx !== -1) {
        currentTeachers[idx] = {
          id: editingTeacherId,
          name: tName,
          address: tAddress,
          subjects: tSubjects,
          salary: salaryVal,
          mobile: tMobile,
          whatsapp: tWhatsapp,
          qualification: tQual,
          daysPerWeek: tDays,
          timeSlot: tTime
        };
      }
      setEditingTeacherId(null);
    } else {
      const newTeach: GuardianTeacher = {
        id: 'teach_' + Date.now(),
        name: tName,
        address: tAddress,
        subjects: tSubjects,
        salary: salaryVal,
        mobile: tMobile,
        whatsapp: tWhatsapp || tMobile,
        qualification: tQual,
        daysPerWeek: tDays,
        timeSlot: tTime
      };
      currentTeachers.push(newTeach);

      // Create a default salary record for active month
      const currentSal = [...salaries];
      currentSal.push({
        id: 'sal_' + Date.now(),
        studentOrTeacherId: newTeach.id,
        month: new Date().getMonth(),
        year: new Date().getFullYear(),
        status: 'unpaid',
        amount: salaryVal
      });
      setSalaries(currentSal);
      saveSalaryPayments(user.gmail, currentSal);
    }

    setTeachers(currentTeachers);
    saveGuardianTeachers(user.gmail, currentTeachers);
    resetFormState();
    setShowForm(false);
  };

  const handleEditTeacher = (teach: GuardianTeacher) => {
    setEditingTeacherId(teach.id);
    setTName(teach.name);
    setTAddress(teach.address);
    setTSubjects(teach.subjects);
    setTSalary(teach.salary.toString());
    setTMobile(teach.mobile);
    setTWhatsapp(teach.whatsapp);
    setTQual(teach.qualification);
    setTDays(teach.daysPerWeek);
    setTTime(teach.timeSlot);

    setTeacherBackup({ ...teach });
    setShowForm(true);
  };

  const handleUndoTeacherEdit = () => {
    if (teacherBackup) {
      setTName(teacherBackup.name);
      setTAddress(teacherBackup.address);
      setTSubjects(teacherBackup.subjects);
      setTSalary(teacherBackup.salary.toString());
      setTMobile(teacherBackup.mobile);
      setTWhatsapp(teacherBackup.whatsapp);
      setTQual(teacherBackup.qualification);
      setTDays(teacherBackup.daysPerWeek);
      setTTime(teacherBackup.timeSlot);
    }
  };

  const handleDeleteTeacher = (id: string) => {
    setCustomConfirm({
      message: 'Are you sure you want to delete this Private Tutor profile? All tutor listings, calendar attendance logs, and payment stubs will be permanently removed.',
      action: () => {
        const remaining = teachers.filter(t => t.id !== id);
        setTeachers(remaining);
        saveGuardianTeachers(user.gmail, remaining);

        const remAtt = attendance.filter(a => a.studentOrTeacherId !== id);
        setAttendance(remAtt);
        saveAttendance(user.gmail, remAtt);

        const remSal = salaries.filter(s => s.studentOrTeacherId !== id);
        setSalaries(remSal);
        saveSalaryPayments(user.gmail, remSal);

        if (attSelectedTeacher === id) {
          setAttSelectedTeacher(remaining[0]?.id || '');
        }
        showToast("Tutor listing and historical metadata wiped.", 'success');
      }
    });
  };

  const toggleSubject = (sub: CourseSubject) => {
    setTSubjects(p => p.includes(sub) ? p.filter(x => x !== sub) : [...p, sub]);
  };

  const toggleDay = (day: string) => {
    setTDays(p => p.includes(day) ? p.filter(x => x !== day) : [...p, day]);
  };

  // --- ATTENDANCE FUNCTIONS ---
  const getSelectedTeacherLogs = () => {
    const found = attendance.find(
      a => a.studentOrTeacherId === attSelectedTeacher && a.year === attYear && a.month === attMonth
    );
    return found ? found.dayLogs : {};
  };

  const handleMarkAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDay === null || !attSelectedTeacher) return;

    const currentRecords = [...attendance];
    let recIdx = currentRecords.findIndex(
      a => a.studentOrTeacherId === attSelectedTeacher && a.year === attYear && a.month === attMonth
    );

    if (recIdx === -1) {
      const newRec: AttendanceRecord = {
        studentOrTeacherId: attSelectedTeacher,
        year: attYear,
        month: attMonth,
        dayLogs: {}
      };
      currentRecords.push(newRec);
      recIdx = currentRecords.length - 1;
    }

    currentRecords[recIdx].dayLogs[editingDay] = {
      status: dayStatus,
      gapDateStr: (dayStatus === 'gap_covered' || premiseType === 'gap_cover') 
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

  const getAttendanceStats = (teacherId: string, month: number, year: number) => {
    const record = attendance.find(
      a => a.studentOrTeacherId === teacherId && a.year === year && a.month === month
    );
    if (!record) return { percentage: 0, present: 0, absent: 0, gapCovered: 0, holiday: 0, guardianOff: 0, total: 0 };

    const logs = Object.values(record.dayLogs) as { status: string; gapDateStr?: string }[];
    let present = 0;
    let absent = 0;
    let gapCovered = 0;
    let holiday = 0;
    let guardianOff = 0;

    logs.forEach(l => {
      const s = l.status;
      if (s === 'present') present++;
      else if (s === 'absent') absent++;
      else if (s === 'gap_covered') gapCovered++;
      else if (s === 'holiday') holiday++;
      else if (s === 'guardian_off') guardianOff++;
    });

    const activeAcademicDays = present + absent + gapCovered;
    const totalLogs = logs.length;
    const divisor = activeAcademicDays === 0 ? totalLogs : activeAcademicDays;
    const numerator = present + gapCovered + holiday;
    const percentage = divisor === 0 ? 0 : Math.min(100, Math.round((numerator / divisor) * 100));

    return {
      percentage,
      present,
      absent,
      gapCovered,
      holiday,
      guardianOff,
      total: totalLogs
    };
  };

  const getOverallAttendancePieStats = () => {
    let present = 0;
    let absent = 0;
    let gapOrOff = 0;
    let holiday = 0;

    attendance.forEach(a => {
      if (a.year === new Date().getFullYear() && a.month === new Date().getMonth()) {
        (Object.values(a.dayLogs) as { status: string; gapDateStr?: string }[]).forEach(l => {
          if (l.status === 'present') present++;
          else if (l.status === 'absent') absent++;
          else if (l.status === 'gap_covered') present++; // Count covered class as present
          else if (l.status === 'holiday') holiday++;
          else if (l.status === 'guardian_off') gapOrOff++;
        });
      }
    });

    return { present, absent, gapOrOff, holiday };
  };

  // --- SALARY MANAGEMENT ---
  const handleAddNewSalaryRecordTab = (teacherId: string) => {
    const tutor = teachers.find(t => t.id === teacherId);
    if (!tutor) return;

    const currentSal = [...salaries];
    const exists = currentSal.some(
      s => s.studentOrTeacherId === teacherId && s.month === selectedSalaryMonth && s.year === selectedSalaryYear
    );

    if (exists) {
      showToast('A salary ledger entry already exists for this tutor on the selected month.', 'error');
      return;
    }

    currentSal.push({
      id: 'sal_' + Date.now(),
      studentOrTeacherId: teacherId,
      month: selectedSalaryMonth,
      year: selectedSalaryYear,
      status: 'unpaid',
      amount: tutor.salary
    });

    setSalaries(currentSal);
    saveSalaryPayments(user.gmail, currentSal);
  };

  const handleUpdatePaymentStatus = (id: string, updates: Partial<SalaryPayment>) => {
    const currentSal = [...salaries];
    const idx = currentSal.findIndex(s => s.id === id);
    if (idx !== -1) {
      currentSal[idx] = {
        ...currentSal[idx],
        ...updates
      };
      setSalaries(currentSal);
      saveSalaryPayments(user.gmail, currentSal);
    }
  };

  const handleConfirmRowSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!salaryEditId) return;

    const parsed = parseFloat(salaryEditAmount);
    if (isNaN(parsed)) {
      showToast('Fee amount must be a number', 'error');
      return;
    }

    handleUpdatePaymentStatus(salaryEditId, {
      status: salaryEditState,
      paymentDate: salaryEditState === 'paid' ? salaryEditDate : undefined,
      amount: parsed
    });

    setSalaryEditId(null);
  };

  const handleDeleteSalaryEntry = (id: string) => {
    setCustomConfirm({
      message: 'Are you sure you want to delete this payment record?',
      action: () => {
        const remaining = salaries.filter(s => s.id !== id);
        setSalaries(remaining);
        saveSalaryPayments(user.gmail, remaining);
        showToast("Payment record deleted.", 'success');
      }
    });
  };

  const getFinancialSummationsForMonth = (month: number, year: number) => {
    const mSalaries = salaries.filter(s => s.month === month && s.year === year);
    let spent = 0;
    let pending = 0;

    mSalaries.forEach(s => {
      if (s.status === 'paid') spent += s.amount;
      else pending += s.amount;
    });

    return { spent, pending, total: spent + pending };
  };

  const activeSummations = getFinancialSummationsForMonth(new Date().getMonth(), new Date().getFullYear());

  // --- PRINT DOCUMENT BUILDERS (PDF Simulations) ---
  const triggerPrintAudit = () => {
    const printSelection = document.getElementById('parent-printable-audit-container');
    if (!printSelection) return;

    const markup = printSelection.innerHTML;
    const styles = `
      body { font-family: system-ui, sans-serif; padding: 40px; color: #1e293b; background: white; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
      th { background-color: #fcf6f5; font-weight: bold; }
      h2 { color: #881337; margin-bottom: 5px; }
      .header-info { display: flex; justify-content: space-between; border-bottom: 2px solid #f43f5e; padding-bottom: 15px; margin-bottom: 25px; }
      .badge { display: inline-block; padding: 4px 8.5px; border-radius: 4px; font-size: 11px; font-weight: bold; }
      .badge-paid { background: #d1fae5; color: #065f46; }
      .badge-unpaid { background: #fee2e2; color: #991b1b; }
    `;

    const docBodyContent = `
      ${markup}
      <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px;">
        Statement prepared on Tutors' Diary application. Developed by Apurba Barua. Base Currency: BDT (৳).
      </div>
    `;

    setPrintView({
      title: "Tutors' Diary - Parent/Guardian Audit Statement",
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

  const filteredTeachers = teachers.filter(
    t => t.name.toLowerCase().includes(teacherFilter.toLowerCase()) || 
         t.qualification.toLowerCase().includes(teacherFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#fff1f2] via-[#f8fafc] to-[#eef2ff] flex flex-col justify-between relative overflow-hidden" id="guardian-root-container">
      {/* Glossy decorative blurred mesh background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-rose-400/15 to-pink-500/15 blur-[120px] pointer-events-none select-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-tr from-violet-400/15 to-indigo-500/15 blur-[120px] pointer-events-none select-none z-0" />
      <div className="absolute top-[40%] right-[10%] w-[35%] h-[35%] rounded-full bg-gradient-to-bl from-amber-200/10 to-rose-400/10 blur-[100px] pointer-events-none select-none z-0" />
      {/* Print Preview Overlay Panel (Guardian edition - with graceful go-back options) */}
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
          <div className="glass-guardian bg-white/75 backdrop-blur-md rounded-2xl border border-rose-200 p-4 shadow-xl flex flex-col sm:flex-row justify-between items-center gap-4 w-full max-w-4xl no-print animate-fade-in font-sans">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-650 rounded-xl">
                <Printer className="w-5 h-5 animate-pulse text-rose-600" />
              </div>
              <div className="text-left">
                <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm">{printView.title}</h4>
                <p className="text-[10px] text-slate-400 font-medium">Export this document directly as a highly polished PDF file!</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setPrintView(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-850 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200"
              >
                <X className="w-4 h-4" /> Go Back
              </button>
              <button
                onClick={handleDownloadRealPDF}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-rose-100 transition-all cursor-pointer text-nowrap"
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
            backgroundColor: toast.type === 'error' ? '#fdf2f2' : toast.type === 'info' ? '#f0f9ff' : '#fdf2f2',
            borderColor: toast.type === 'error' ? '#fde8e8' : toast.type === 'info' ? '#e0f2fe' : '#fde8e8',
            color: toast.type === 'error' ? '#5a051d' : toast.type === 'info' ? '#0369a1' : '#9b1c1c'
          }}
        >
          <Sparkles className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Custom Confirm Modal */}
      {customConfirm && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9991] animate-fade-in">
          <div className="glass-guardian bg-white/80 backdrop-blur-md rounded-3xl p-6 max-w-sm w-full border border-rose-350 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="bg-rose-50 p-2.5 rounded-2xl">
                <Trash2 className="w-6 h-6 text-rose-600" />
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
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer"
              >
                Yes, Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header navbar with family friendly pastel purple / warm rose palette */}
      <header className="bg-gradient-to-r from-rose-500 via-pink-600 to-violet-600 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2.5 rounded-xl border border-white/20 backdrop-blur-md">
              <Heart className="w-6 h-6 text-rose-200 fill-rose-200" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-1.5">
                Tutors' Diary
              </h1>
              <span className="text-xs text-rose-100/80 font-medium">Logged in: {user.name} ({user.gmail}) | Parent / Guardian Dashboard</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button 
              onClick={() => setActiveTab('dashboard')} 
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs md:text-sm font-semibold transition-all duration-150 flex items-center gap-1 sm:gap-1.5 uppercase tracking-wider ${activeTab === 'dashboard' ? 'bg-rose-100/95 text-rose-900 border border-rose-300/60 shadow-inner scale-[1.03] font-bold' : 'hover:bg-white/10 text-white'}`}
            >
              <Users className="w-3 h-3 sm:w-4 sm:h-4" /> Home Panel
            </button>
            <button 
              onClick={() => setActiveTab('teachers')} 
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs md:text-sm font-semibold transition-all duration-150 flex items-center gap-1 sm:gap-1.5 uppercase tracking-wider ${activeTab === 'teachers' ? 'bg-rose-100/95 text-rose-900 border border-rose-300/60 shadow-inner scale-[1.03] font-bold' : 'hover:bg-white/10 text-white'}`}
            >
              <BookOpen className="w-3 h-3 sm:w-4 sm:h-4" /> Tutors
            </button>
            <button 
              onClick={() => setActiveTab('attendance')} 
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs md:text-sm font-semibold transition-all duration-150 flex items-center gap-1 sm:gap-1.5 uppercase tracking-wider ${activeTab === 'attendance' ? 'bg-rose-100/95 text-rose-900 border border-rose-300/60 shadow-inner scale-[1.03] font-bold' : 'hover:bg-white/10 text-white'}`}
            >
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4" /> Calendar
            </button>
            <button 
              onClick={() => setActiveTab('salary')} 
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs md:text-sm font-semibold transition-all duration-150 flex items-center gap-1 sm:gap-1.5 uppercase tracking-wider ${activeTab === 'salary' ? 'bg-rose-100/95 text-rose-900 border border-rose-300/60 shadow-inner scale-[1.03] font-bold' : 'hover:bg-white/10 text-white'}`}
            >
              <Wallet className="w-3 h-3 sm:w-4 sm:h-4" /> Fee Payments
            </button>
            <button 
              onClick={() => setActiveTab('audit')} 
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs md:text-sm font-semibold transition-all duration-150 flex items-center gap-1 sm:gap-1.5 uppercase tracking-wider ${activeTab === 'audit' ? 'bg-rose-100/95 text-rose-900 border border-rose-300/60 shadow-inner scale-[1.03] font-bold' : 'hover:bg-white/10 text-white'}`}
            >
              <FileSpreadsheet className="w-3 h-3 sm:w-4 sm:h-4" /> Audit statement
            </button>
            <button 
              onClick={() => setActiveTab('aiHub')} 
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs md:text-sm font-semibold transition-all duration-150 flex items-center gap-1 sm:gap-1.5 uppercase tracking-wider ${activeTab === 'aiHub' ? 'bg-amber-100 text-amber-950 border border-amber-300/70 shadow scale-[1.03] font-extrabold animate-pulse' : 'hover:bg-amber-400/20 text-amber-100'}`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> AI Agent
            </button>
            <button 
              onClick={onLogout} 
              className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs md:text-sm font-semibold bg-white/20 hover:bg-rose-700 text-rose-100 font-medium transition-all duration-150 border border-thin border-white/15"
            >
              Exit
            </button>
          </div>
        </div>
      </header>

      {/* Main Main container body */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-grow">
        
        {/* TAB 1: OVERVIEW HOME PANEL */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* Row 1: Premium Welcome Header & Checkboxes (Bento banner) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fade-in">
              {/* Welcome back (Guardian Name) banner */}
              <div id="welcome-back-card-guardian" className="lg:col-span-8 bg-rose-950 rounded-[28px] p-6 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden shadow-xl border border-rose-900">
                <div className="relative z-10 space-y-3 max-w-xl">
                  <div className="bg-white/10 w-fit px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest text-pink-300 border border-white/5 backdrop-blur-md">
                    Guardian Dashboard Panel
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black leading-tight tracking-tight font-display">
                    Welcome back,<br/>
                    <span className="text-pink-400">{user.name}!</span>
                  </h3>
                  <p className="text-xs text-rose-200 font-medium leading-relaxed">
                    Monitor private tuition analytics, authorize billing items, or download statements instantly under local sandboxed encryption.
                  </p>
                  <div className="pt-2 flex flex-wrap gap-2.5">
                    <div className="px-3.5 py-1.5 bg-white/10 rounded-xl border border-white/5 backdrop-blur-md">
                      <p className="text-[9px] uppercase font-bold text-rose-300">Registered Tutors</p>
                      <p className="text-sm font-extrabold font-mono text-pink-300">{teachers.length}</p>
                    </div>
                    <div className="px-3.5 py-1.5 bg-white/10 rounded-xl border border-white/5 backdrop-blur-md">
                      <p className="text-[9px] uppercase font-bold text-rose-300">Active Month</p>
                      <p className="text-sm font-extrabold font-mono text-amber-300">{new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>

                  <div className="pt-3 flex flex-wrap gap-2 border-t border-white/10">
                    <button 
                      onClick={handleSeedDemoState}
                      title="Generates high-fidelity private tutors, monthly attendance heatmaps, & payment logs for active calendar dates"
                      className="px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Re-Seed Active Month Demo
                    </button>
                    <button 
                      onClick={handleWipeAccountData}
                      title="Deletes all registered private tutors, attendance logs, and payment receipts to start clean"
                      className="px-3 py-1.5 bg-rose-500/25 hover:bg-rose-600/95 text-rose-100 font-extrabold text-[10px] uppercase tracking-wider rounded-lg border border-rose-500/10 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Clean Slate Reset
                    </button>
                  </div>
                </div>
                
                {/* Beautiful efficiency ring with dynamic attendance calculation */}
                <div className="relative z-10 w-20 h-20 md:w-28 md:h-28 flex-shrink-0 flex items-center justify-center border-4 border-pink-500/20 rounded-full bg-rose-900/40">
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                    <p className="text-center leading-none">
                      <span className="text-sm md:text-xl font-black tracking-tighter text-pink-300 font-mono">
                        {teachers.length > 0 ? (
                          Math.round(
                            teachers.reduce((acc, t) => acc + getAttendanceStats(t.id, new Date().getMonth(), new Date().getFullYear()).percentage, 0) / teachers.length
                          )
                        ) : 0}%
                      </span><br/>
                      <span className="text-[7px] md:text-[8px] uppercase font-bold text-rose-200 tracking-wider">Attendance</span>
                    </p>
                  </div>
                  <svg className="absolute inset-0 w-full h-full -rotate-90 z-10" viewBox="0 0 128 128">
                    <circle 
                      cx="64" 
                      cy="64" 
                      r="58" 
                      fill="transparent" 
                      stroke="#f43f5e" 
                      strokeWidth="6" 
                      strokeDasharray="364.4" 
                      strokeDashoffset={364.4 - (364.4 * (teachers.length > 0 ? Math.min(100, Math.round(teachers.reduce((acc, t) => acc + getAttendanceStats(t.id, new Date().getMonth(), new Date().getFullYear()).percentage, 0) / teachers.length)) : 0)) / 100} 
                      strokeLinecap="round" 
                    />
                  </svg>
                </div>
                
                {/* Decorative gradient blur rings */}
                <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-pink-500/25 rounded-full blur-3xl"></div>
                <div className="absolute -top-10 left-1/3 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl"></div>
              </div>

              {/* Secondary Bento Quick Action Panel (Schedule Audit / Send Reminder) */}
              <div id="remittance-bento-card" className="lg:col-span-4 bg-gradient-to-br from-rose-400 to-pink-500 rounded-[28px] p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between border border-pink-400/30">
                <div className="relative z-10">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-black tracking-tight font-display text-rose-950">Fee Dues Audit</h3>
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Wallet className="w-5 h-5 text-rose-950" />
                    </div>
                  </div>
                  <p className="text-xs mt-3 text-rose-950/85 font-medium leading-relaxed">
                    Audit monthly tuition hours, check bank/mobile accounts statements, and authorize due paycheque releases.
                  </p>
                </div>
                <div className="relative z-10 mt-6 md:mt-4">
                  <button 
                    onClick={() => setActiveTab('audit')}
                    className="w-full py-2.5 bg-black/15 hover:bg-black/25 text-white border border-white/25 transition-colors rounded-xl font-black text-[10px] uppercase tracking-widest cursor-pointer"
                  >
                    View Statement Sheet
                  </button>
                </div>
                {/* Ambient glow decoration */}
                <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/15 rounded-full blur-2xl"></div>
              </div>
            </div>

            {/* Row 2: Secondary Quick Metrics Info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-delayed">
              <div className="glass-guardian p-5 rounded-[22px] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Connected Tutors</span>
                  <div className="text-2xl font-black text-slate-800 font-mono mt-0.5">{teachers.length}</div>
                </div>
                <div className="bg-rose-50 text-rose-600 p-3 rounded-xl border border-rose-100/40">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="glass-guardian p-5 rounded-[22px] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Salary Paid (Cur Month)</span>
                  <div className="text-2xl font-black text-emerald-600 font-mono mt-0.5">৳{activeSummations.spent.toLocaleString('en-US')}</div>
                </div>
                <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl border border-emerald-100/40">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>

              <div className="glass-guardian p-5 rounded-[22px] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Pending Dues (Cur Month)</span>
                  <div className="text-2xl font-black text-amber-500 font-mono mt-0.5">৳{activeSummations.pending.toLocaleString('en-US')}</div>
                </div>
                <div className="bg-amber-50 text-amber-500 p-3 rounded-xl border border-amber-100/40">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              <div className="glass-guardian p-5 rounded-[22px] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tutors Attendance Rate</span>
                  <div className="text-2xl font-black text-violet-600 font-mono mt-0.5">
                    {teachers.length > 0 ? (
                      Math.round(
                        teachers.reduce((acc, t) => acc + getAttendanceStats(t.id, new Date().getMonth(), new Date().getFullYear()).percentage, 0) / teachers.length
                      )
                    ) : 0}%
                  </div>
                </div>
                <div className="bg-violet-50 text-violet-600 p-3 rounded-xl border border-violet-100/40">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Primary Bento Panel Board */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
              
              {/* Card 1: Academic Tutors list (col-span-4) */}
              <div id="guardian-tutors-bento" className="lg:col-span-4 glass-guardian rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden min-h-[350px] transition-all duration-305">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight font-display flex items-center gap-2">
                        <Users className="w-4 h-4 text-rose-600" /> Private Tutors
                      </h4>
                      <p className="text-[10px] text-slate-400">Review standard qualification credentials & logs</p>
                    </div>
                    <button 
                      onClick={() => { setShowForm(true); setEditingTeacherId(null); setActiveTab('teachers'); }} 
                      className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-all cursor-pointer border border-rose-100/50"
                      title="Register Tutor"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Tutors list */}
                  <div className="space-y-2 overflow-y-auto max-h-[190px] pr-1 bento-scrollbar">
                    {teachers.map(t => {
                      const sal = salaries.find(s => s.studentOrTeacherId === t.id && s.month === new Date().getMonth() && s.year === new Date().getFullYear());
                      const stats = getAttendanceStats(t.id, new Date().getMonth(), new Date().getFullYear());
                      return (
                        <div 
                          key={t.id} 
                          onClick={() => { setActiveTab('attendance'); }}
                          className="p-3 rounded-xl border border-slate-100 hover:border-rose-100/60 bg-slate-50/50 hover:bg-rose-50/10 flex items-center justify-between transition-all duration-150 cursor-pointer text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 truncate">{t.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{t.qualification}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-1">
                            <span className="text-[10px] font-black font-mono text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                              {stats.percentage}%
                            </span>
                            <span className={`text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded ${sal?.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {sal?.status || 'unpaid'}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {teachers.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-10">No private tutors added yet. Register details to view profiles.</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-sm flex items-center justify-between">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider opacity-90 font-black">Register Expert</p>
                      <p className="text-[10px] opacity-80 mt-0.5 font-medium leading-tight">Add professional private teacher profiles</p>
                    </div>
                    <button 
                      onClick={() => { setShowForm(true); setEditingTeacherId(null); setActiveTab('teachers'); }} 
                      className="px-2.5 py-1 bg-white/20 text-white font-bold rounded-lg text-[9px] hover:bg-white/30 backdrop-blur-md cursor-pointer border border-white/10 shrink-0"
                    >
                      Open Sheet
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2: Academic Attendance Gaps / Logs Overview (col-span-8) */}
              <div id="attendance-status-card" className="lg:col-span-8 glass-guardian rounded-3xl p-5 flex flex-col justify-between transition-all duration-305">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight font-display mb-1 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-rose-600" /> Makeup Lessons & Class Recoveries
                  </h4>
                  <p className="text-[10px] text-slate-400 mb-4 font-normal">
                    Track schedules corrected or holiday gaps verified by active teachers
                  </p>
                  
                  {/* Attendance Log summary columns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[190px] overflow-y-auto pr-1 bento-scrollbar">
                    {teachers.map(t => {
                      const stats = getAttendanceStats(t.id, new Date().getMonth(), new Date().getFullYear());
                      return (
                        <div key={t.id} className="p-3 bg-slate-50/50 rounded-xl border border-slate-150/40 flex justify-between items-center text-xs">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 truncate">{t.name}</p>
                            <p className="text-[10px] text-slate-400">Class: {t.timeSlot || 'Not configured'}</p>
                          </div>
                          <div className="text-right shrink-0 ml-1">
                            <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded text-xs font-mono">{stats.percentage}%</span>
                            <p className="text-[9px] text-slate-400 mt-1">{stats.present} Presence &bull; {stats.gapCovered} Covered</p>
                          </div>
                        </div>
                      );
                    })}
                    {teachers.length === 0 && (
                      <p className="col-span-full text-center text-xs text-slate-400 py-10">No connected tutor sheets registered under this account.</p>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => setActiveTab('attendance')}
                  className="w-full mt-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-150 rounded-xl text-xs font-bold cursor-pointer transition text-center"
                >
                  Inspect Extended Interactive Attendance Calendar
                </button>
              </div>

              {/* Card 3: Parental Salary Payments Outgoings (col-span-4) */}
              <div id="parental-salary-bento-card" className="lg:col-span-4 glass-guardian rounded-3xl p-5 flex flex-col justify-between min-h-[300px] transition-all duration-305">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight font-display flex items-center gap-2 mb-3">
                    <Wallet className="w-4 h-4 text-rose-600" /> Parental Expense Statement
                  </h4>
                  <div className="space-y-3">
                    {/* Sum Spent */}
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100/60">
                      <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider">Salary Cleared (This Month)</p>
                      <p className="text-xl font-black text-emerald-950 font-mono mt-0.5">৳{activeSummations.spent.toLocaleString('en-US')}</p>
                      
                      <div className="w-full bg-emerald-200 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div 
                          className="bg-emerald-600 h-full transition-all duration-300" 
                          style={{ width: `${activeSummations.total === 0 ? 0 : Math.min(100, Math.round((activeSummations.spent / activeSummations.total) * 100))}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-emerald-700 mt-1 font-medium">
                        {activeSummations.total === 0 ? 0 : Math.round((activeSummations.spent / activeSummations.total) * 100)}% of month dues cleared
                      </p>
                    </div>

                    {/* Sum Pending */}
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-100/60">
                      <p className="text-[9px] font-bold text-rose-800 uppercase tracking-wider">Unpaid Fee Dues</p>
                      <p className="text-xl font-black text-rose-950 font-mono mt-0.5">৳{activeSummations.pending.toLocaleString('en-US')}</p>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => setActiveTab('salary')}
                  className="mt-4 w-full py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer text-center"
                >
                  Verify Pending Payment Requests
                </button>
              </div>

              {/* Card 4: Pie Chart Analytics (col-span-4) */}
              <div id="guardian-pie-bento" className="lg:col-span-4 glass-guardian rounded-3xl p-5 flex flex-col justify-between transition-all duration-305">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight font-display mb-1">
                    Class Attendance Chart
                  </h4>
                  <p className="text-[10px] text-slate-400 mb-2">Aggregate attendance distribution metrics</p>
                </div>
                <div className="flex-grow flex items-center justify-center py-2.5 my-1">
                  {(() => {
                    const parts = getOverallAttendancePieStats();
                    return (
                      <AttendancePieChart 
                        present={parts.present}
                        absent={parts.absent}
                        gapOrOff={parts.gapOrOff}
                        holiday={parts.holiday}
                        plain={true}
                      />
                    );
                  })()}
                </div>
                <button 
                  onClick={() => setActiveTab('attendance')}
                  className="mt-4 w-full py-2 bg-slate-50 border border-slate-150 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 cursor-pointer text-center"
                >
                  Verify Dates on Logs
                </button>
              </div>

              {/* Card 5: Extended Audit statement Index (col-span-4) */}
              <div id="guardian-statement-bento" className="lg:col-span-4 glass-guardian rounded-3xl p-5 flex flex-col justify-between transition-all duration-305">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight font-display mb-1">
                    System Statement Auditing
                  </h4>
                  <p className="text-[10px] text-slate-400 mb-4">Export authenticated local billing & syllabus records</p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl flex flex-col gap-2 flex-grow justify-center">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-500">Connected tutors:</span>
                    <span className="font-black text-rose-700">{teachers.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-500">Unpaid invoices:</span>
                    <span className="font-black text-amber-600">
                      {salaries.filter(s => s.status === 'unpaid' && s.month === new Date().getMonth() && s.year === new Date().getFullYear()).length}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTab('audit')}
                  className="mt-4 w-full py-2 bg-slate-50 border border-slate-150 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 cursor-pointer text-center"
                >
                  Compile PDF Logs
                </button>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: TEACHERS REGISTRY (WITH UNDO, CANCEL, EDIT, SAVE, DELETE) */}
        {activeTab === 'teachers' && (
          <div className="space-y-4">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-extrabold text-[10px] sm:text-xs rounded-xl transition-all border border-slate-200 cursor-pointer w-fit"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </button>
            
            {/* Search filter banner */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-2.5 text-slate-400 w-4 h-4" />
                <input 
                  type="text" 
                  value={teacherFilter}
                  onChange={e => setTeacherFilter(e.target.value)}
                  placeholder="Filter teachers by name or qualification..." 
                  className="pl-9 pr-4 py-2 w-full rounded-xl border border-slate-200 bg-white text-xs md:text-sm shadow-sm"
                />
              </div>

              <button 
                onClick={() => { setShowForm(!showForm); if(showForm) resetFormState(); }}
                className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showForm ? 'Close Registration Sheet' : 'Add / Register Tutor'}
              </button>
            </div>

            {/* FORM CARD */}
            {showForm && !editingTeacherId && (
              <form onSubmit={handleTeacherSubmit} className="glass-guardian p-6 rounded-2xl space-y-6">
                
                <div className="border-b border-rose-100 pb-3 flex justify-between items-center">
                  <h3 className="font-extrabold text-slate-800 text-sm md:text-base flex items-center gap-1.5">
                    <Sparkles className="w-5 h-5 text-rose-500" />
                    {editingTeacherId ? 'Modify Tutor Profile Details' : 'Register New Tutor / Private Teacher'}
                  </h3>

                  {editingTeacherId && (
                    <button 
                      type="button" 
                      onClick={handleUndoTeacherEdit} 
                      className="text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1 rounded-lg transition-all"
                    >
                      Undo to Original
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Name */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tutor Name *</label>
                    <input 
                      type="text" 
                      required 
                      value={tName} 
                      onChange={e => setTName(e.target.value)}
                      placeholder="e.g. Abrar Tanvir"
                      className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-medium"
                    />
                  </div>

                  {/* Qualification */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Qualification *</label>
                    <input 
                      type="text" 
                      required 
                      value={tQual} 
                      onChange={e => setTQual(e.target.value)}
                      placeholder="e.g. B.Sc in ME, BUET"
                      className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-medium"
                    />
                  </div>

                  {/* Salary BDT */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Salary (BDT / Month) *</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2 text-slate-400 font-bold font-mono">৳</span>
                      <input 
                        type="number" 
                        required 
                        value={tSalary} 
                        onChange={e => setTSalary(e.target.value)}
                        placeholder="8000"
                        className="pl-8 pr-4 py-2 w-full border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-semibold"
                      />
                    </div>
                  </div>

                  {/* Mobile */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Mobile Contact Number *</label>
                    <input 
                      type="text" 
                      required 
                      value={tMobile} 
                      onChange={e => setTMobile(e.target.value)}
                      placeholder="e.g. 01911223344"
                      className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-semibold"
                    />
                  </div>

                  {/* Whatsapp */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Whatsapp Number (Join URLs)</label>
                    <input 
                      type="text" 
                      value={tWhatsapp} 
                      onChange={e => setTWhatsapp(e.target.value)}
                      placeholder="e.g. 01911223344"
                      className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-semibold"
                    />
                  </div>

                  {/* Time slot */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tutoring Time Slot</label>
                    <input 
                      type="text" 
                      value={tTime} 
                      onChange={e => setTTime(e.target.value)}
                      placeholder="e.g. 04:30 PM"
                      className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-medium"
                    />
                    <div className="flex flex-wrap gap-1 mt-1 bg-slate-50/50 p-1.5 rounded-xl border border-slate-100">
                      {["03:00 PM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM", "06:00 PM", "07:30 PM", "08:00 PM"].map(time => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => setTTime(time)}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-all ${
                            tTime === time 
                              ? "bg-rose-600 border-rose-600 text-white" 
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Address */}
                  <div className="flex flex-col gap-1 md:col-span-3">
                    <label className="text-xs font-bold text-slate-500 uppercase">Address / Home Location</label>
                    <input 
                      type="text" 
                      value={tAddress} 
                      onChange={e => setTAddress(e.target.value)}
                      placeholder="e.g. Banasree, Dhaka"
                      className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-medium"
                    />
                  </div>
                </div>

                {/* Subject checklist */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Expertise Subjects (Can select multiple) *</label>
                  <div className="flex flex-wrap gap-2">
                    {availableSubjects.map(sub => {
                      const active = tSubjects.includes(sub);
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => toggleSubject(sub)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize border transition-all ${active ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'bg-slate-55 hover:bg-slate-100 text-slate-600 border-slate-200 cursor-pointer'}`}
                        >
                          {sub}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Duty Days checklist */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Weekly Duty Days (Can select multiple) *</label>
                  <div className="flex flex-wrap gap-2">
                    {weekdayOptions.map(day => {
                      const active = tDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${active ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'bg-slate-55 hover:bg-slate-100 text-slate-600 border-slate-200 cursor-pointer'}`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Buttons footer */}
                <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => { resetFormState(); setShowForm(false); }}
                    className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs md:text-sm rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs md:text-sm rounded-xl shadow-md cursor-pointer"
                  >
                    {editingTeacherId ? 'Confirm Profile Edits' : 'Register Profile'}
                  </button>
                </div>

              </form>
            )}

            {/* DIRECTORIES CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTeachers.map(tc => {
                const stat = getAttendanceStats(tc.id, new Date().getMonth(), new Date().getFullYear());
                
                if (editingTeacherId === tc.id) {
                  return (
                    <div key={tc.id} className="col-span-full glass-guardian p-6 rounded-2xl border-2 border-rose-500 shadow-lg space-y-6 animate-fade-in" id={`edit-panel-teacher-${tc.id}`}>
                      {/* INLINE EDIT FORM */}
                      <form onSubmit={handleTeacherSubmit} className="space-y-6">
                        
                        <div className="border-b border-rose-100 pb-3 flex justify-between items-center">
                          <h3 className="font-extrabold text-slate-800 text-sm md:text-base flex items-center gap-1.5">
                            <Sparkles className="w-5 h-5 text-rose-500" />
                            Editing Tutor: <span className="text-rose-600 font-extrabold">{tc.name}</span> (Inline Editor)
                          </h3>

                          <div className="flex gap-2">
                            <button 
                              type="button" 
                              onClick={handleUndoTeacherEdit} 
                              className="text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1 rounded-lg transition-all"
                            >
                              Reset
                            </button>
                            <button 
                              type="button" 
                              onClick={() => { resetFormState(); setEditingTeacherId(null); }} 
                              className="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-lg transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                          {/* Name */}
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Tutor Name *</label>
                            <input 
                              type="text" 
                              required 
                              value={tName} 
                              onChange={e => setTName(e.target.value)}
                              placeholder="e.g. Abrar Tanvir"
                              className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-medium"
                            />
                          </div>

                          {/* Qualification */}
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Qualification *</label>
                            <input 
                              type="text" 
                              required 
                              value={tQual} 
                              onChange={e => setTQual(e.target.value)}
                              placeholder="e.g. B.Sc in ME, BUET"
                              className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-medium"
                            />
                          </div>

                          {/* Salary BDT */}
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Salary (BDT / Month) *</label>
                            <div className="relative">
                              <span className="absolute left-3.5 top-2 text-slate-400 font-bold font-mono">৳</span>
                              <input 
                                type="number" 
                                required 
                                value={tSalary} 
                                onChange={e => setTSalary(e.target.value)}
                                placeholder="8000"
                                className="pl-8 pr-4 py-2 w-full border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-semibold"
                              />
                            </div>
                          </div>

                          {/* Mobile */}
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-505 uppercase">Mobile Contact Number *</label>
                            <input 
                              type="text" 
                              required 
                              value={tMobile} 
                              onChange={e => setTMobile(e.target.value)}
                              placeholder="e.g. 01911223344"
                              className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-semibold"
                            />
                          </div>

                          {/* Whatsapp */}
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Whatsapp Number (Join URLs)</label>
                            <input 
                              type="text" 
                              value={tWhatsapp} 
                              onChange={e => setTWhatsapp(e.target.value)}
                              placeholder="e.g. 01911223344"
                              className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-semibold"
                            />
                          </div>

                          {/* Time slot */}
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Tutoring Time Slot</label>
                            <input 
                              type="text" 
                              value={tTime} 
                              onChange={e => setTTime(e.target.value)}
                              placeholder="e.g. 04:30 PM"
                              className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-medium"
                            />
                            <div className="flex flex-wrap gap-1 mt-1 bg-slate-50/50 p-1.5 rounded-xl border border-slate-100">
                              {["03:00 PM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM", "06:00 PM", "07:30 PM", "08:00 PM"].map(time => (
                                <button
                                  key={time}
                                  type="button"
                                  onClick={() => setTTime(time)}
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-all ${
                                    tTime === time 
                                      ? "bg-rose-600 border-rose-600 text-white" 
                                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  {time}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Address */}
                          <div className="flex flex-col gap-1 md:col-span-3">
                            <label className="text-xs font-bold text-slate-500 uppercase">Address / Home Location</label>
                            <input 
                              type="text" 
                              value={tAddress} 
                              onChange={e => setTAddress(e.target.value)}
                              placeholder="e.g. Banasree, Dhaka"
                              className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-medium"
                            />
                          </div>
                        </div>

                        {/* Subject checklist */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase block">Expertise Subjects (Can select multiple) *</label>
                          <div className="flex flex-wrap gap-2">
                            {availableSubjects.map(sub => {
                              const active = tSubjects.includes(sub);
                              return (
                                <button
                                  key={sub}
                                  type="button"
                                  onClick={() => toggleSubject(sub)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize border transition-all ${active ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200 cursor-pointer'}`}
                                >
                                  {sub}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Duty Days checklist */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase block">Weekly Duty Days (Can select multiple) *</label>
                          <div className="flex flex-wrap gap-2">
                            {weekdayOptions.map(day => {
                              const active = tDays.includes(day);
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => toggleDay(day)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${active ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200 cursor-pointer'}`}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Buttons footer */}
                        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                          <button
                            type="button"
                            onClick={() => { resetFormState(); setEditingTeacherId(null); }}
                            className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs md:text-sm rounded-xl cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs md:text-sm rounded-xl shadow-md cursor-pointer"
                          >
                            Save Details Inline
                          </button>
                        </div>

                      </form>
                    </div>
                  );
                }

                return (
                  <div key={tc.id} className="glass-guardian rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-250">
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <span className="text-[10px] uppercase font-extrabold tracking-widest px-2 py-0.5 rounded-full bg-rose-50 text-rose-800">
                            Professional Private Tutor
                          </span>
                          <h4 className="text-base font-black text-slate-800 mt-2">{tc.name}</h4>
                          <p className="text-xs text-rose-600 font-bold">{tc.qualification}</p>
                        </div>
                        
                        {tc.whatsapp && (
                          <a 
                            href={`https://wa.me/${tc.whatsapp.replace(/[^0-9]/g, '')}`} 
                            target="_blank" 
                            referrerPolicy="no-referrer"
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 p-2 rounded-xl transition-all"
                            title="Chat via Whatsapp"
                          >
                            <MessageCircle className="w-5 h-5" />
                          </a>
                        )}
                      </div>

                      {/* Info rows */}
                      <div className="mt-4 border-t border-b border-dashed border-slate-100 py-3 text-xs space-y-2 text-slate-600">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Regular Schedule:</span>
                          <span className="font-bold text-slate-800 font-mono">{tc.daysPerWeek.join(', ') || 'Flexible scheduling'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Tutoring Hour:</span>
                          <span className="font-bold text-slate-800 font-mono flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" /> {tc.timeSlot || 'Not setup'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Monthly Compensation:</span>
                          <span className="font-bold text-rose-600 font-mono">৳ {tc.salary.toLocaleString('en-US')}</span>
                        </div>
                      </div>

                      <div className="mt-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Assigned Subjects</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {(tc.subjects || []).map(s => (
                            <span key={s} className="px-2 py-0.5 rounded bg-violet-50 text-violet-800 text-[10px] font-bold border border-violet-100 capitalize">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 space-y-1 text-slate-500 text-xs">
                        <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0" /> {tc.address || 'Address not listed'}</p>
                        <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 shrink-0" /> {tc.mobile}</p>
                      </div>
                    </div>

                    {/* Footer edit delete */}
                    <div className="bg-slate-50/50 border-t border-slate-100 px-5 py-3.5 flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-400">
                        Tutor Attendance: <strong className="text-rose-600 font-mono">{stat.percentage}%</strong>
                      </span>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditTeacher(tc)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 transition-all cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTeacher(tc.id)}
                          className="p-1.5 rounded-lg border border-rose-100 text-rose-600 bg-rose-50/50 hover:bg-rose-100 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}

              {filteredTeachers.length === 0 && (
                <div className="col-span-full py-12 text-center glass-guardian rounded-2xl">
                  <p className="text-slate-400 text-sm font-semibold">No registered tutors found matching criteria.</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 3: CALENDAR LOG (Mark day as present, absent, gap_covered with date, holiday, guardian off) */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-extrabold text-[10px] sm:text-xs rounded-xl transition-all border border-slate-200 cursor-pointer w-fit"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </button>
            
            {/* Header select filters */}
            <div className="p-5 glass-guardian rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Select Registered Tutor *</label>
                <select
                  value={attSelectedTeacher}
                  onChange={e => setAttSelectedTeacher(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs md:text-sm font-semibold"
                >
                  <option value="" disabled>-- Choose Tutor profile --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.qualification.split(',')[0]})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Select Month *</label>
                <select
                  value={attMonth}
                  onChange={e => setAttMonth(parseInt(e.target.value))}
                  className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs md:text-sm font-semibold"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>
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
                  className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs md:text-sm font-semibold"
                >
                  {[2025, 2026, 2027].map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>

              <div className="flex self-end text-right md:mt-4">
                {attSelectedTeacher && (
                  <button
                    onClick={() => {
                      // Custom statement print
                      const teacher = teachers.find(t => t.id === attSelectedTeacher);
                      if(!teacher) return;
                      const stats = getAttendanceStats(attSelectedTeacher, attMonth, attYear);
                      const mName = new Date(attYear, attMonth).toLocaleString('en-US', { month: 'long' });
                      const currentLogs = getSelectedTeacherLogs();

                      const styles = `
                        body { font-family: system-ui, sans-serif; padding: 40px; color: #1e293b; background: white; }
                        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                        th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
                        th { background-color: #faf5f5; font-weight: bold; }
                      `;

                      const docBodyContent = `
                        <h2 style="color: #9f1239; margin-bottom: 5px;">Tutors' Diary — Attendance Log Statement</h2>
                        <p><strong>Tutor Name:</strong> ${teacher.name} (${teacher.qualification})</p>
                        <p><strong>Month Selected:</strong> ${mName} ${attYear}</p>
                        <p><strong>Presence attendance Rate:</strong> ${stats.percentage}%</p>
                        
                        <table>
                          <thead>
                            <tr>
                              <th>Scheduled Date</th>
                              <th>Marked Attendance State</th>
                              <th>Description Remark</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${Object.keys(currentLogs).length === 0 ? '<tr><td colspan="3">No logs marked yet</td></tr>' : Object.entries(currentLogs).map(([day, val]: any) => `
                              <tr>
                                <td>Day ${day} (${mName})</td>
                                <td><strong>${val.status.toUpperCase()}</strong></td>
                                <td>${val.gapDateStr ? `Alternative class recovering original regular gap dated <strong>${val.gapDateStr}</strong>` : 'Usual agenda schedule'}</td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      `;

                      setPrintView({
                        title: "Tutors Statement",
                        htmlContent: docBodyContent,
                        styles
                      });
                    }}
                    className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4 inline mr-1" /> Printable Timeline
                  </button>
                )}
              </div>

            </div>

            {attSelectedTeacher ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Heatmap */}
                <div className="lg:col-span-8 space-y-6">
                  <GitHubContributionGrid 
                    logs={getSelectedTeacherLogs()}
                    year={attYear}
                    month={attMonth}
                    onSelectDay={dayNum => {
                      setEditingDay(dayNum);
                      const current = getSelectedTeacherLogs()[dayNum] as any;

                      // Calculate schedule match
                      const selectedDayOfWeek = new Date(attYear, attMonth, dayNum).toLocaleDateString('en-US', { weekday: 'short' });
                      const activeTeacher = teachers.find(t => t.id === attSelectedTeacher);
                      const scheduledDays = activeTeacher?.daysPerWeek || [];
                      const isMatch = scheduledDays.includes(selectedDayOfWeek);

                      if (current) {
                        setDayStatus(current.status as any);
                        setGapDateString(current.gapDateStr || '');
                        setPremiseType(current.premise || (isMatch ? 'regular' : 'extra'));
                        setPremiseDate(current.premiseDetail || '');
                      } else {
                        setDayStatus('present');
                        setGapDateString('');
                        setPremiseType(isMatch ? 'regular' : 'extra');
                        setPremiseDate('');
                      }
                    }}
                  />

                  {/* Mark attendance log */}
                  {editingDay !== null && (
                    <form onSubmit={handleMarkAttendance} className="bg-slate-900 text-white p-5 rounded-2xl space-y-4 border border-slate-800">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs md:text-sm font-bold text-slate-200">
                          Parent Entry: update Day {editingDay} log for Tutor
                        </span>
                        <button type="button" onClick={() => setEditingDay(null)} className="text-slate-400 hover:text-white">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400">Class State Log</span>
                          <select
                            value={dayStatus}
                            onChange={e => setDayStatus(e.target.value as any)}
                            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs md:text-sm text-white font-semibold focus:ring-1 focus:ring-rose-500"
                          >
                            <option value="present">Present (Mark as attended class)</option>
                            <option value="absent">Absent (Tutor did not attend)</option>
                            <option value="gap_covered">Gap Covered with Date (Makeups / Recoveries)</option>
                            <option value="holiday">Official Holiday / Public Off</option>
                            <option value="guardian_off">Guardian Off / Parent postponed duty</option>
                          </select>
                        </div>

                         {/* Covered Gap Date picker conditional */}
                         {(dayStatus === 'gap_covered' || premiseType === 'gap_cover') && (
                           <div className="flex flex-col gap-1.5 bg-slate-800/80 p-2.5 rounded-xl border border-rose-500/30">
                             <label className="text-[10px] font-extrabold text-rose-300 uppercase tracking-wide">Date of Original Missed Class covered</label>
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
                         const activeTeacher = teachers.find(t => t.id === attSelectedTeacher);
                         const scheduledDays = activeTeacher?.daysPerWeek || [];
                         const isMatch = scheduledDays.includes(selectedDayOfWeek);

                         return (
                           <div className="p-3.5 bg-slate-850 rounded-xl border border-slate-800 space-y-3 font-sans">
                             {!isMatch ? (
                               <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-bold">
                                 <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                 Premise Selector (This date {selectedDayOfWeek} does not match tutor registration schedule):
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
                                         setDayStatus('gap_covered');
                                       } else if (opt.value === 'regular') {
                                         setDayStatus('present');
                                       }
                                     }}
                                     className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                                       premiseType === opt.value
                                         ? 'bg-rose-600 border-rose-600 text-white'
                                         : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750 hover:text-white'
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

                      <div className="flex justify-end gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setEditingDay(null)}
                          className="px-4 py-1.5 bg-slate-700 text-slate-200 rounded-lg font-bold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-1.5 bg-rose-600 text-white rounded-lg font-bold shadow-md hover:bg-rose-700"
                        >
                          Commit Log
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Stats */}
                <div className="lg:col-span-4 glass-guardian rounded-2xl p-5 flex flex-col justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm md:text-base border-b border-slate-50 pb-2">
                       Detailed Stats
                    </h4>

                    {(() => {
                      const stat = getAttendanceStats(attSelectedTeacher, attMonth, attYear);
                      return (
                        <div className="space-y-4 mt-4">
                          <div className="text-center bg-rose-50/50 rounded-2xl p-4 border border-rose-100">
                            <span className="text-2xl md:text-3xl font-black text-rose-600 font-mono">{stat.percentage}%</span>
                            <span className="block text-[10px] font-bold text-rose-500 uppercase mt-0.5">Reliability index</span>
                          </div>

                          <div className="space-y-2 text-xs font-medium text-slate-600">
                            <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                              <span>Attended classes</span>
                              <span className="font-bold text-slate-800 font-mono">{stat.present}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                              <span>Absences</span>
                              <span className="font-bold text-rose-600 font-mono">{stat.absent}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                              <span>Gap recoveries</span>
                              <span className="font-bold text-teal-600 font-mono">{stat.gapCovered}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                              <span>Calendar holidays</span>
                              <span className="font-bold text-slate-800 font-mono">{stat.holiday}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Guardian off</span>
                              <span className="font-bold text-amber-600 font-mono">{stat.guardianOff}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <p className="text-[10px] text-slate-400 text-center border-t border-slate-50 pt-3">
                    Verified parent log timeline.
                  </p>
                </div>

              </div>
            ) : (
              <div className="glass-guardian p-12 text-center rounded-2xl">
                <p className="text-slate-400 text-sm font-semibold">Please select a tutor profile above to access timelines.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: REMITTANCE CODES (UNDO, EDIT, DELETE, PAID DATE OPTION) */}
        {activeTab === 'salary' && (
          <div className="space-y-4">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-extrabold text-[10px] sm:text-xs rounded-xl transition-all border border-slate-200 cursor-pointer w-fit"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </button>
            
            {/* Filter banner */}
            <div className="p-5 glass-guardian rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="flex gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400">Payment Month</span>
                  <select 
                    value={selectedSalaryMonth}
                    onChange={e => setSelectedSalaryMonth(parseInt(e.target.value))}
                    className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:outline-none"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i}>
                        {new Date(2026, i).toLocaleString('en-US', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400">Payment Year</span>
                  <select 
                    value={selectedSalaryYear}
                    onChange={e => setSelectedSalaryYear(parseInt(e.target.value))}
                    className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:outline-none"
                  >
                    {[2025, 2026, 2027].map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Populate shortcuts */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-bold text-slate-400 mr-2">Create paystub:</span>
                {teachers.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleAddNewSalaryRecordTab(t.id)}
                    className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-slate-100 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* MAIN PAYSTUB GRID SHEETS */}
            <div className="glass-guardian rounded-3xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-extrabold text-slate-800 text-sm md:text-base">
                  Salary Tuition Ledger ({new Date(selectedSalaryYear, selectedSalaryMonth).toLocaleString('en-US', { month: 'long' })} {selectedSalaryYear})
                </h3>
                <span className="text-xs font-bold font-mono text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                  Total Disbursed: ৳ {getFinancialSummationsForMonth(selectedSalaryMonth, selectedSalaryYear).spent} BDT
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-slate-700">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left border-b border-slate-100">
                      <th className="px-5 py-3.5">Academic Tutor Name</th>
                      <th className="px-5 py-3.5">Subject List</th>
                      <th className="px-5 py-3.5">Compensation Fee</th>
                      <th className="px-5 py-3.5">Disbursed State</th>
                      <th className="px-5 py-3.5">Settlement Date</th>
                      <th className="px-5 py-3.5 text-right">Commit Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs font-medium">
                    {salaries
                      .filter(s => s.month === selectedSalaryMonth && s.year === selectedSalaryYear)
                      .map(sal => {
                        const tutor = teachers.find(t => t.id === sal.studentOrTeacherId);
                        const isEditingThisRow = salaryEditId === sal.id;

                        if(!tutor) return null;

                        return (
                          <tr key={sal.id} className="hover:bg-slate-55/30 transition-all">
                            {/* Tutor Name */}
                            <td className="px-5 py-3">
                              <span className="font-black text-slate-800 text-sm">{tutor.name}</span>
                              <span className="block text-[10px] text-slate-400">{tutor.qualification}</span>
                            </td>
                            {/* Subject list */}
                            <td className="px-5 py-3">
                              <span className="text-slate-500 font-semibold truncate block max-w-xs capitalize">{(tutor.subjects || []).join(', ')}</span>
                            </td>
                            {/* Amount */}
                            <td className="px-5 py-3 font-bold font-mono">
                              {isEditingThisRow ? (
                                <input
                                  type="number"
                                  value={salaryEditAmount}
                                  onChange={e => setSalaryEditAmount(e.target.value)}
                                  className="w-20 px-2 py-1 rounded border text-xs text-rose-700 font-black focus:outline-none focus:ring-1 focus:ring-rose-500"
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
                                  onClick={() => handleUpdatePaymentStatus(sal.id, { status: sal.status === 'paid' ? 'unpaid' : 'paid', paymentDate: sal.status === 'unpaid' ? new Date().toISOString().substring(0,10) : undefined })}
                                  className={`px-3 py-1 rounded-full text-[10px] font-extrabold ${sal.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}
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
                            {/* Actions with UNDO support */}
                            <td className="px-5 py-3 text-right space-x-1 whitespace-nowrap">
                              {isEditingThisRow ? (
                                <>
                                  <button
                                    onClick={handleConfirmRowSave}
                                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[10px]"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setSalaryEditId(null)}
                                    className="px-3 py-1 bg-slate-200 text-slate-700 rounded font-bold text-[10px]"
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
                                    className="px-2 py-1 border border-slate-200 rounded text-slate-500 hover:text-rose-700 hover:border-rose-200 transition-colors"
                                  >
                                    Adjust
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSalaryEntry(sal.id)}
                                    className="p-1 px-2 text-rose-600 hover:bg-rose-50 rounded"
                                    title="Wipe billing row"
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
                          No payroll logs mapped. Choose tutor pay stub generation shortcuts above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 5: AUDITING STATEMENT */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-extrabold text-[10px] sm:text-xs rounded-xl transition-all border border-slate-200 cursor-pointer w-fit"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </button>
            
            {/* Download selector header row */}
            <div className="p-5 glass-guardian rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-400 font-sans">Selector Month Target:</span>
                  <select 
                    value={attMonth}
                    onChange={e => setAttMonth(parseInt(e.target.value))}
                    className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:outline-none"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i}>
                        {new Date(2026, i).toLocaleString('en-US', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-400 font-sans">Selector Year Target:</span>
                  <select 
                    value={attYear}
                    onChange={e => setAttYear(parseInt(e.target.value))}
                    className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:outline-none"
                  >
                    {[2025, 2026, 2027].map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={triggerPrintAudit}
                className="py-2.5 px-6 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs sm:text-sm rounded-xl flex items-center gap-1.5 cursor-pointer shadow shadow-rose-100"
              >
                <Download className="w-4 h-4" /> Download Compiled Audit PDF
              </button>
            </div>

            {/* PRINT-READY CONTAINER SHEET */}
            <div className="glass-guardian p-6 rounded-3xl space-y-6" id="parent-printable-audit-container">
              
              <div className="border-b-2 border-rose-600 pb-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h2 className="text-xl md:text-2xl font-black text-slate-800">PARENT SECURED COMPILATION & TUTOR PERFORMANCE AUDIT</h2>
                    <span className="text-xs text-rose-600 font-bold uppercase tracking-wider block mt-1">
                      Billing Cycle: {new Date(attYear, attMonth).toLocaleString('en-US', { month: 'long' })} {attYear}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 text-left sm:text-right">
                    <p className="margin-0"><strong>Guardian Name:</strong> {user.name}</p>
                    <p className="margin-0 text-slate-400"><strong>Registered Gmail:</strong> {user.gmail}</p>
                  </div>
                </div>
              </div>

              {/* Stats metric boxes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="border border-rose-100/80 p-4 rounded-2xl bg-rose-50/20 text-center">
                  <span className="text-xs font-bold text-rose-500 uppercase tracking-widest block">Total Spent Compensations</span>
                  <span className="text-2xl font-black text-slate-800 font-mono block mt-1.5">৳ {getFinancialSummationsForMonth(attMonth, attYear).spent.toLocaleString('en-US')} BDT</span>
                </div>
                <div className="border border-rose-100/80 p-4 rounded-2xl bg-amber-50/20 text-center">
                  <span className="text-xs font-bold text-amber-500 uppercase tracking-widest block">Outstanding Owed Fees</span>
                  <span className="text-2xl font-black text-slate-800 font-mono block mt-1.5">৳ {getFinancialSummationsForMonth(attMonth, attYear).pending.toLocaleString('en-US')} BDT</span>
                </div>
                <div className="border border-rose-100/80 p-4 rounded-2xl bg-violet-50/20 text-center">
                  <span className="text-xs font-bold text-violet-500 uppercase tracking-widest block">Collective Tutors Attendance Ratio</span>
                  <span className="text-2xl font-black text-slate-800 font-mono block mt-1.5">
                    {teachers.length > 0 ? (
                      Math.round(
                        teachers.reduce((acc, t) => acc + getAttendanceStats(t.id, attMonth, attYear).percentage, 0) / teachers.length
                      )
                    ) : 0}% Presence
                  </span>
                </div>
              </div>

              {/* Tutors profiles grid */}
              <div className="space-y-4">
                <h4 className="font-extrabold text-slate-800 text-xs md:text-sm uppercase tracking-wider">Multi-Tutor Professional Performance Indexes</h4>
                
                {/* Desktop layout: Hidden on mobile, shown on md and larger */}
                <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-xs text-left overflow-hidden">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 uppercase font-extrabold border-b border-slate-200">
                        <th className="p-3">Private Tutor Profile</th>
                        <th className="p-3">Qualification</th>
                        <th className="p-3 text-center">Attendance % Integrity</th>
                        <th className="p-3 text-center">Absences Counted</th>
                        <th className="p-3 text-center">Recovered classes</th>
                        <th className="p-3">Payment status</th>
                        <th className="p-3 text-right">Tuition compensation BDT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {teachers.map(tc => {
                        const att = getAttendanceStats(tc.id, attMonth, attYear);
                        const pay = salaries.find(s => s.studentOrTeacherId === tc.id && s.month === attMonth && s.year === attYear);
                        return (
                          <tr key={tc.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-extrabold text-slate-800">{tc.name}</td>
                            <td className="p-3 text-slate-400 truncate max-w-xs">{tc.qualification}</td>
                            <td className="p-3 text-center font-bold font-mono text-rose-600">{att.percentage}%</td>
                            <td className="p-3 text-center font-mono">{att.absent}</td>
                            <td className="p-3 text-center font-bold text-teal-600 font-mono">{att.gapCovered}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${pay?.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                {pay?.status?.toUpperCase() || 'UNPAID'}
                              </span>
                            </td>
                            <td className="p-3 text-right font-bold text-slate-850 font-mono">৳ {tc.salary.toLocaleString('en-US')}</td>
                          </tr>
                        );
                      })}

                      {teachers.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-6 text-slate-400 font-medium">
                            No registered teachers found to compile indexes.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile / Tablet layout: Show modular cards instead, avoiding any horizontal scrollbars */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
                  {teachers.map(tc => {
                    const att = getAttendanceStats(tc.id, attMonth, attYear);
                    const pay = salaries.find(s => s.studentOrTeacherId === tc.id && s.month === attMonth && s.year === attYear);
                    return (
                      <div key={tc.id} className="p-4 bg-white rounded-2xl border border-slate-250 shadow-sm space-y-3.5">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <p className="font-extrabold text-slate-900 text-sm">{tc.name}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{tc.qualification}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 tracking-wider uppercase ${pay?.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                            {pay?.status || 'UNPAID'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 bg-slate-50/50 rounded-xl px-2.5">
                          <div className="text-center">
                            <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Integrity</span>
                            <span className="text-xs font-mono font-extrabold text-rose-600 block mt-0.5">{att.percentage}%</span>
                          </div>
                          <div className="text-center border-x border-slate-200">
                            <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Absences</span>
                            <span className="text-xs font-mono font-extrabold text-slate-800 block mt-0.5">{att.absent}</span>
                          </div>
                          <div className="text-center">
                            <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Recovered</span>
                            <span className="text-xs font-mono font-extrabold text-teal-600 block mt-0.5">{att.gapCovered}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-xs pt-1">
                          <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Tuition compensation</span>
                          <span className="font-extrabold text-slate-800 font-mono text-sm">৳ {tc.salary.toLocaleString('en-US')}</span>
                        </div>
                      </div>
                    );
                  })}

                  {teachers.length === 0 && (
                    <div className="p-8 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200 sm:col-span-2">
                       No registered teachers found to compile indexes.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {activeTab === 'aiHub' && (
          <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6 animate-fade-in z-10 relative" id="ai-guardian-hub-view">
            
            {/* Header branding block */}
            <div className="p-6 md:p-8 rounded-[32px] bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-violet-500/10 border border-amber-300/30 backdrop-blur-md relative overflow-hidden shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left z-10 max-w-2xl">
                <span className="px-3 py-1 text-[10px] font-black text-amber-800 bg-amber-100 border border-amber-300/60 uppercase rounded-full tracking-widest inline-flex items-center gap-1.5 animate-pulse">
                  <Sparkles className="w-3 h-3 text-amber-500" /> Co-Pilot intelligence
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 mt-3 tracking-tight font-display">
                  AI Guardian Assistant & Co-Pilot
                </h2>
                <p className="text-xs md:text-sm text-slate-500 mt-2 font-medium leading-relaxed">
                  Analyze active private tutors' integrity levels, auto-generate contextual bilingual WhatsApp communication templates, and query professional standard compensation rates for your child's tutoring curriculum.
                </p>
              </div>
              <div className="shrink-0 bg-white/40 p-4 rounded-3xl border border-white/60 shadow-lg z-10">
                <div className="bg-gradient-to-tr from-amber-400 to-rose-500 p-4 rounded-2xl text-white shadow">
                  <Sparkles className="w-8 h-8 animate-spin-slow" />
                </div>
              </div>
              {/* Abstract decorative accent */}
              <div className="absolute top-0 right-0 w-80 h-80 bg-rose-400/10 rounded-full blur-3xl pointer-events-none" />
            </div>

            {/* Main AI Tool Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: AI Diagnostics & Smart Message (col-span-8) */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* 1. Performance Diagnostic Block */}
                <div className="glass-guardian p-6 rounded-3xl space-y-5">
                  <div className="flex justify-between items-center border-b border-rose-150 pb-3">
                    <h3 className="font-extrabold text-slate-800 text-sm md:text-base flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-rose-500" /> Tutor Quality & Integrity Diagnostics
                    </h3>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider font-mono">Real-time Telemetry</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
                    {/* Tutor Selector */}
                    <div className="sm:col-span-5 space-y-2">
                      <label className="text-xs font-bold text-slate-500 block uppercase tracking-wider">Select Active Tutor</label>
                      <select 
                        value={aiSelectedTeacherId}
                        onChange={e => setAiSelectedTeacherId(e.target.value)}
                        className="w-full rounded-xl border border-amber-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300 shadow-sm transition"
                      >
                        {teachers.length === 0 ? (
                          <option value="">No tutors registered</option>
                        ) : (
                          teachers.map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.qualification})</option>
                          ))
                        )}
                      </select>
                      <p className="text-[10px] text-slate-400 leading-tight">Pick a registered private tutor to analyze log telemetry and draft custom briefs.</p>
                    </div>

                    {/* Score Wheel */}
                    <div className="sm:col-span-7 flex flex-col sm:flex-row items-center gap-4 bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                      {(() => {
                        const t = teachers.find(x => x.id === aiSelectedTeacherId);
                        if (!t) {
                          return (
                            <p className="text-xs font-bold text-slate-400 text-center w-full">Please register a tutor to evaluate performance scores.</p>
                          );
                        }
                        const stats = getAttendanceStats(t.id, new Date().getMonth(), new Date().getFullYear());
                        const isPaid = salaries.find(s => s.studentOrTeacherId === t.id && s.month === new Date().getMonth() && s.year === new Date().getFullYear())?.status === 'paid';
                        
                        // Scoring engine: Attendance * 0.7 + Payment factor * 0.3
                        let integrityValue = stats.percentage;
                        if (integrityValue === 0 && stats.present === 0 && stats.absent === 0) integrityValue = 100; // default for fresh logs
                        const score = Math.round(integrityValue * 0.7 + (isPaid ? 30 : 15));
                        
                        let badgeColor = "bg-rose-100 text-rose-800 border-rose-300/60 text-[10px] font-black uppercase";
                        let progressFill = "bg-rose-500";
                        let advice = "Class presence rate requires close observation. Recommend asking tutor if makeup schedule/exam prep slot is required.";
                        
                        if (score >= 85) {
                          badgeColor = "bg-emerald-100 text-emerald-800 border border-emerald-300/60 text-[10px] font-black uppercase";
                          progressFill = "bg-emerald-500";
                          advice = "Outstanding performance and pristine timeline adherence. Highly recommend sending a prompt thank-you note or a warm appreciation bonus!";
                        } else if (score >= 65) {
                          badgeColor = "bg-amber-100 text-amber-800 border border-amber-300/60 text-[10px] font-black uppercase";
                          progressFill = "bg-amber-500";
                          advice = "Good performance baseline. A makeup slot can easily bridge the small attendance gaps caused by regional holidays or exams.";
                        }

                        return (
                          <>
                            <div className="relative shrink-0 flex items-center justify-center">
                              {/* Radial Visual */}
                              <div className="w-16 h-16 rounded-full border-4 border-slate-100 flex flex-col items-center justify-center font-mono font-black text-rose-950 text-lg bg-white shadow-inner">
                                {score}
                                <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-tighter mt-[-4px]">AI score</span>
                              </div>
                            </div>
                            <div className="min-w-0 space-y-1 text-center sm:text-left">
                              <div className="flex items-center flex-wrap justify-center sm:justify-start gap-1.5">
                                <span className="text-xs font-black text-slate-800">{t.name}'s Evaluation</span>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] ${badgeColor}`}>
                                  {score >= 85 ? "Prime Tutee Match" : score >= 65 ? "Steady Support" : "Needs Review"}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                                {advice}
                              </p>
                              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden max-w-[200px]">
                                <div className={`h-full ${progressFill} transition-all duration-300`} style={{ width: `${score}%` }}></div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* 2. Communication Template Draft Generator */}
                <div className="glass-guardian p-6 rounded-3xl space-y-5">
                  <div className="flex justify-between items-center border-b border-rose-150 pb-3">
                    <h3 className="font-extrabold text-slate-800 text-sm md:text-base flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-emerald-500" /> WhatsApp & SMS Custom Draft Assistant
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[8px] font-black tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 uppercase">Dual-Language AI Generation</span>
                  </div>

                  <div className="space-y-4">
                    {/* Template Pickers */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[
                        { id: 'feedback', label: 'Lesson Feedback' },
                        { id: 'payment', label: 'Payment Receipt' },
                        { id: 'correction', label: 'Makeup Request' },
                        { id: 'reschedule', label: 'Class Reschedule' },
                        { id: 'exam', label: 'Exam Focus Prep' }
                      ].map(item => (
                        <button
                          key={item.id}
                          onClick={() => setAiTemplate(item.id as any)}
                          className={`p-2.5 rounded-xl text-[11px] font-black transition border ${aiTemplate === item.id ? 'bg-rose-600 text-white border-rose-700 shadow-sm' : 'bg-slate-50/50 hover:bg-slate-50 text-slate-700 border-slate-200/60'}`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {/* Optional Custom Context Input */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 block uppercase tracking-wider">Provide Optional Context Note (e.g. Exams scheduled on Monday / Focus Algebra Chapter 4)</label>
                      <input 
                        type="text"
                        value={aiCustomContext}
                        onChange={e => setAiCustomContext(e.target.value)}
                        placeholder="Type any specific target instruction to auto-inject in English/Bengali..."
                        className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-200 bg-white/85 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 placeholder:text-slate-400 transition"
                      />
                    </div>

                    {/* The Generated Draft Output box */}
                    {(() => {
                      const t = teachers.find(x => x.id === aiSelectedTeacherId);
                      if (!t) {
                        return (
                          <div className="p-8 text-center text-slate-400 bg-white/50 border border-dashed border-slate-200 rounded-3xl">
                            Please add professional tutor listings under your account first to compile messaging drafts.
                          </div>
                        );
                      }
                      
                      const tutorName = t.name;
                      const subjects = (t.subjects || []).map(s => s.toUpperCase()).join(", ");
                      const hourlyComp = t.salary;
                      const monthName = new Date().toLocaleString('en-US', { month: 'long' });

                      let generatedText = "";
                      if (aiTemplate === 'feedback') {
                        generatedText = `Dear ${tutorName} Sir,\nHope you are doing well. I would kindly appreciate a brief feedback updates on my student's preparation progression in ${subjects}. Please let me know if there are any critical topics they are struggling with, or if we need to schedule extra makeup classes to recover some learning gaps. Thank you so much!\n\n(সম্মানিত ${tutorName} শিক্ষক, আশা করি ভালো আছেন। আমার সন্তানের ${subjects} বিষয়ের পড়ালেখার বর্তমান অগ্রগতি নিয়ে ও কোন অধ্যায়ে বিশেষ বাড়তি যত্নের প্রয়োজন আছে কি না সে বিষয়ে আপনার মতামত ও পরামর্শ চাচ্ছিলাম। ধন্যবাদ!)`;
                      } else if (aiTemplate === 'payment') {
                        generatedText = `Dear ${tutorName} Sir,\nPleased to update you that we have cleared the monthly tuition/course fee payment of BDT ৳${hourlyComp.toLocaleString()} for the month of ${monthName}. Please verify your bank/mobile statement and let me know. We truly appreciate your continuous hard work and excellent mentorship! Best regards.\n\n(সম্মানিত ${tutorName} শিক্ষক, আপনার ${monthName} মাসের টিউশন ফি বাবদ ৳${hourlyComp.toLocaleString()} পরিশোধ করা হয়েছে। আপনার মোবাইল ওয়ালেট বা ব্যাংক অ্যাকাউন্ট চেক করে জানাবেন। আপনার চমৎকার ক্লাসের জন্য কৃতজ্ঞতা!)`;
                      } else if (aiTemplate === 'correction') {
                        generatedText = `Dear ${tutorName} Sir,\nWhile reviewing the attendance logs for ${monthName}, I noticed we missed some classes due to unexpected schedules. As school exams are approaching, could you please advise on a convenient time this weekend to coordinate a recovery/makeup lesson to bridge the syllabus gaps? Thank you!\n\n(সম্মানিত ${tutorName} শিক্ষক, ${monthName} মাসের ক্লাসের লগ হিসেব অনুযায়ী আমরা কিছু ক্লাস পুনরায় সমন্বয়ের পরিকল্পনা করছি। শিক্ষার্থীর প্রস্তুতির সুবিধার্থে চলতি সপ্তাহে কোন ছুটির দিনে একটি মেকআপ ক্লাস নেয়া যাবে কি না জানাবেন। ধন্যবাদ!)`;
                      } else if (aiTemplate === 'reschedule') {
                        generatedText = `Dear ${tutorName} Sir,\nDue to some unexpected academic school commitments of our child, we would request to reschedule our upcoming tutorial class to an alternative date/time this week. Please let me know your free hours so we can coordinate perfectly. Extremely sorry for the sudden schedule change!\n\n(সম্মানিত ${tutorName} শিক্ষক, সন্তানের আসন্ন স্কুল-পরীক্ষার কারণে এই সপ্তাহের পরবর্তী ক্লাসটি একটু পরিবর্তন করতে চাচ্ছিলাম। চলতি সপ্তাহে আপনার কোন দিন ও সময়ে অল্টারনেটিভ স্লট খালি আছে জানালে উপকৃত হব। অনাকাঙ্ক্ষিত পরিবর্তনের জন্য দুঃখিত!)`;
                      } else if (aiTemplate === 'exam') {
                        generatedText = `Dear ${tutorName} Sir,\nThe school terminal board exams are fast approaching. We want to align a special target preparation timeline during this stretch. Could you please prioritize rigorous test solving, school board chapter mock exercises, and focus on revision mock quizzes during your upcoming tutorials? Thank you!\n\n(সম্মানিত ${tutorName} শিক্ষক, সামনে চূড়ান্ত সেমিস্টার পরীক্ষা চলে এসেছে। আমরা চাচ্ছিলাম এই সেগমেন্টে বিগত বছরের প্রশ্নের সমাধান ও বিশেষ রিভিশন এর ওপর বেশি জোর দেয়া হোক। আপনার পরিকল্পনাটি জানালে উপকৃত হব। ধন্যবাদ!)`;
                      }

                      if (aiCustomContext.trim()) {
                        generatedText += `\n\n📌 Parent custom note: "${aiCustomContext}"`;
                      }

                      const handleCopyText = () => {
                        navigator.clipboard.writeText(generatedText);
                        showToast(`Copied ${tutorName}'s customized AI draft letter successfully!`, 'success');
                      };

                      return (
                        <div className="space-y-3">
                          <div className="p-4 bg-slate-900 text-emerald-400 font-mono text-[11px] sm:text-xs rounded-2xl leading-relaxed whitespace-pre-wrap border border-slate-950 focus:outline-none relative shadow-inner shadow-black/40">
                            {generatedText}
                            <span className="absolute bottom-2.5 right-2.5 text-[8px] font-black text-slate-500 uppercase tracking-widest font-sans">AI Output Box</span>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3">
                            <button
                              onClick={handleCopyText}
                              className="flex-1 py-3 bg-slate-800 hover:bg-slate-900 border border-slate-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow transition"
                            >
                              Copy Draft Plain Text
                            </button>
                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(generatedText)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow transition text-center"
                            >
                              Send Directly to WhatsApp
                            </a>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* 3. AI Academic Performance Predictor & Syllabus Recovery Tracker */}
                <div className="glass-guardian p-6 rounded-3xl space-y-5 animate-fade-in relative overflow-hidden">
                  <div className="flex justify-between items-center border-b border-rose-150 pb-3">
                    <h3 className="font-extrabold text-slate-850 text-sm md:text-base flex items-center gap-2">
                       <Sparkles className="w-5 h-5 text-rose-500 animate-pulse" /> AI Academic Performance Predictor & Syllabus Recovery Forecast
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[8px] font-black tracking-widest text-rose-700 bg-rose-50 border border-rose-200 uppercase">Predictive Brain</span>
                  </div>

                  {(() => {
                    const tutor = teachers.find(x => x.id === aiSelectedTeacherId);
                    if (!tutor) {
                      return (
                        <div className="p-8 text-center text-slate-400 bg-white/40 border border-dashed border-rose-200/50 rounded-3xl font-medium text-xs">
                          Please register an active tutor under your account to initiate predictive academic forecast profiling.
                        </div>
                      );
                    }

                    // Calculate real performance and syllabus tracking metrics using the attendance logs
                    const present = attendance.filter(a => a.studentOrTeacherId === tutor.id && a.status === 'present' && a.month === new Date().getMonth() && a.year === new Date().getFullYear()).length;
                    const absent = attendance.filter(a => a.studentOrTeacherId === tutor.id && a.status === 'absent' && a.month === new Date().getMonth() && a.year === new Date().getFullYear()).length;
                    const gap = attendance.filter(a => a.studentOrTeacherId === tutor.id && a.status === 'gap' && a.month === new Date().getMonth() && a.year === new Date().getFullYear()).length;
                    const totalScheduled = present + absent + gap;

                    // Compute current momentum factor
                    let momentumFactor = 100;
                    if (totalScheduled > 0) {
                      momentumFactor = Math.round((present / totalScheduled) * 100);
                    }

                    // Syllabus coverage index
                    let baseProgress = 60;
                    if (tutor.qualification.toLowerCase().includes('buet') || tutor.qualification.toLowerCase().includes('du') || tutor.qualification.toLowerCase().includes('medical')) {
                      baseProgress += 15;
                    }
                    if (present > 5) baseProgress += 15;
                    const syllabusCompletion = Math.min(95, Math.max(25, baseProgress - (absent * 8) - (gap * 4)));

                    // Estimate readiness
                    const readinessScore = Math.min(100, Math.max(30, Math.round(momentumFactor * 0.6 + (syllabusCompletion * 0.4))));

                    // Forecast alarms
                    let warningStatus = "Steadfast Progress";
                    let warningColor = "text-emerald-800 bg-emerald-50/40 border-emerald-200/30 backdrop-blur-md";
                    let recoveryInstruction = `${tutor.name} Sir is keeping up academic velocity. No syllabus lag detected. Student is on track for upcoming tests.`;

                    if (absent > 0 || gap > 0) {
                      if (absent >= 3) {
                        warningStatus = "Critical Syllabus Lag Alert";
                        warningColor = "text-rose-800 bg-rose-50/40 border-rose-200/30 backdrop-blur-md animate-pulse";
                        recoveryInstruction = `Urgent Recovery Advisory: ${absent} complete cancellations detected. We suggest requesting extra crash prep sessions from ${tutor.name} before the exams.`;
                      } else {
                        warningStatus = "Velocity Lag Identified";
                        warningColor = "text-amber-800 bg-amber-50/40 border-amber-200/30 backdrop-blur-md";
                        recoveryInstruction = `${absent + gap} vacant classes. Prompting a single weekend recovery session will correct scheduling deficits back to standard levels.`;
                      }
                    }

                    return (
                      <div className="space-y-5">
                        {/* Summary metrics row (Grid layout) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="p-3 bg-white/40 backdrop-blur-md rounded-2xl border border-rose-100/10">
                            <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Learning Velocity</span>
                            <p className="text-xl font-black text-rose-950 font-mono mt-0.5">{momentumFactor}%</p>
                            <span className="text-[8.5px] text-slate-400 block mt-0.5 font-medium">Monthly class completion rate</span>
                          </div>
                          
                          <div className="p-3 bg-white/40 backdrop-blur-md rounded-2xl border border-rose-100/10">
                            <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Syllabus Progress</span>
                            <p className="text-xl font-black text-rose-950 font-mono mt-0.5">{syllabusCompletion}%</p>
                            <span className="text-[8.5px] text-slate-400 block mt-0.5 font-medium">Estimated book chapter targets</span>
                          </div>

                          <div className="p-3 bg-white/40 backdrop-blur-md rounded-2xl border border-rose-100/10">
                            <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Exam Readiness score</span>
                            <p className="text-xl font-black text-rose-950 font-mono mt-0.5">{readinessScore}/100</p>
                            <span className="text-[8.5px] text-slate-400 block mt-0.5 font-medium">Forecasted final test execution</span>
                          </div>
                        </div>

                        {/* Status notification card */}
                        <div className={`p-4 rounded-2xl border ${warningColor} flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm`}>
                          <div className="space-y-1">
                            <p className="text-xs font-black uppercase tracking-wider flex items-center gap-1">
                              ⚠️ status: {warningStatus}
                            </p>
                            <p className="text-xs text-rose-950 font-medium leading-relaxed">
                              {recoveryInstruction}
                            </p>
                          </div>
                          {(absent > 0 || gap > 0) && (
                            <button 
                              onClick={() => {
                                setAiTemplate('correction');
                                showToast("Switched communication template to 'Makeup Request'. Complete the custom content above!", "info");
                              }}
                              className="shrink-0 px-3.5 py-1.5 bg-slate-900 border border-slate-950 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm hover:shadow transition-all cursor-pointer"
                            >
                              Autofill Makeup Message
                            </button>
                          )}
                        </div>

                        {/* Recommended Milestones */}
                        <div className="p-4 bg-white/30 backdrop-blur-md rounded-2xl border border-rose-100/20">
                          <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest mb-1 shadow-sm flex items-center gap-1.5 font-display">
                            💡 Dynamic Syllabus Execution Forecast & Goals
                          </h4>
                          <span className="text-[9.5px] text-slate-400 leading-tight block mb-4 font-normal">
                            Tailored path targeting core course curriculum standards registered in tutor profiles:
                          </span>

                          <div className="space-y-3">
                            {tutor.subjects && tutor.subjects.map((sub, idx) => {
                              let subjectTopic = "Syllabus Core Review Modules";
                              let recommendedAction = "Target past board mock question practices.";

                              if (sub === 'math') {
                                subjectTopic = "Algebraic Expressions & Geometry Theorems";
                                recommendedAction = "Focus on solved board exercise packets (NCTB) or past examination papers (Cambridge GCSE). Practicing speed is parameter number one.";
                              } else if (sub === 'physics') {
                                subjectTopic = "Classical Mechanics & Formulas Grid";
                                recommendedAction = "Run formula derivation practices. Practice balancing friction and velocity equations using standard sample indexes.";
                              } else if (sub === 'chemistry') {
                                subjectTopic = "Atomic Orbitals & Creative Equations";
                                recommendedAction = "Review covalent structures and balance molecular formulas. Solidify core mock test evaluations.";
                              } else if (sub === 'english') {
                                subjectTopic = "Syntax Synthesis & Composition Exercises";
                                recommendedAction = "Instruct tutor to evaluate custom drafts weekly to resolve spelling or punctuation gaps before board scoring marks.";
                              }

                              return (
                                <div key={sub} className="p-3 bg-white/60 rounded-[18px] border border-rose-100/25 flex justify-between items-start gap-4">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[9px] font-bold uppercase text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                        {sub}
                                      </span>
                                      <span className="font-extrabold text-slate-800 text-xs">{subjectTopic}</span>
                                    </div>
                                    <p className="text-[10.5px] text-slate-500 font-medium leading-relaxed">
                                      {recommendedAction}
                                    </p>
                                  </div>
                                  <span className="shrink-0 text-[8.5px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-lg font-black uppercase tracking-wider">
                                    Slot {idx + 1}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                      </div>
                    );
                  })()}
                </div>

              </div>

              {/* Right Column: AI Fee Adviser & Smart Matcher (col-span-4) */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* 3. Fee Advisor & Match Tool */}
                <div className="glass-guardian p-6 rounded-3xl space-y-5">
                  <div className="border-b border-rose-150 pb-3 flex justify-between items-center">
                    <h3 className="font-extrabold text-slate-800 text-sm md:text-base flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-rose-500" /> AI Fee Match & Syllabus Adviser
                    </h3>
                    <span className="text-[10px] bg-rose-50 border border-rose-300 text-rose-700 px-2 py-0.5 rounded uppercase font-black tracking-widest animate-pulse">Dhaka Standards</span>
                  </div>

                  <div className="space-y-4 text-xs font-semibold text-slate-700">
                    {/* Curriculum Select */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Curriculum Medium</label>
                      <select 
                        value={aiMatchMedium}
                        onChange={e => setAiMatchMedium(e.target.value as any)}
                        className="w-full text-xs font-bold p-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-450"
                      >
                        <option value="bangla">Bangla Medium (NCTB)</option>
                        <option value="english">English Version (NCTB)</option>
                        <option value="cambridge">Cambridge IGCSE / Edexcel O-Levels</option>
                      </select>
                    </div>

                    {/* Proposed Class/Grade Select */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Target Student Grade</label>
                      <select
                        value={aiMatchGrade}
                        onChange={e => setAiMatchGrade(e.target.value)}
                        className="w-full text-xs font-bold p-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200"
                      >
                        <option value="Class 5">Class 5 (Primary NCTB)</option>
                        <option value="Class 8">Class 8 (Junior High)</option>
                        <option value="Class 9">Class 9 (SSC Target)</option>
                        <option value="Class 10">Class 10 (Syllabus Complete)</option>
                        <option value="Class 12">Class 12 (HSC Target / A-Levels)</option>
                      </select>
                    </div>

                    {/* Proposed Subject Select */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Core Course Topic</label>
                      <select
                        value={aiMatchSubject}
                        onChange={e => setAiMatchSubject(e.target.value as any)}
                        className="w-full text-xs font-bold p-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200"
                      >
                        {availableSubjects.map(subStr => (
                          <option key={subStr} value={subStr}>{subStr.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>

                    {/* Propose Budget Input field */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Proposed Monthly Compensation Target (৳ BDT)</label>
                      <input 
                        type="number"
                        value={aiMatchBudget}
                        onChange={e => setAiMatchBudget(e.target.value)}
                        placeholder="e.g. 8500"
                        className="w-full text-xs font-bold p-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200"
                      />
                    </div>

                    {/* adviser feedback panel */}
                    <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100/50 space-y-3">
                      {(() => {
                        const proposedAmount = parseInt(aiMatchBudget) || 0;
                        const medium = aiMatchMedium;
                        
                        // Reference rates based on curriculum standards
                        let minComp = 4000;
                        let maxComp = 6000;
                        
                        if (medium === 'english') {
                          minComp = 6000;
                          maxComp = 9000;
                        } else if (medium === 'cambridge') {
                          minComp = 9550;
                          maxComp = 16000;
                        }

                        // Adjust based on grade level
                        if (aiMatchGrade.includes("9") || aiMatchGrade.includes("10")) {
                          minComp += 1000;
                          maxComp += 2000;
                        } else if (aiMatchGrade.includes("12")) {
                          minComp += 2500;
                          maxComp += 4000;
                        }

                        let matchStatus = "Competitive Standard";
                        let matchColor = "text-emerald-700 bg-emerald-100 border border-emerald-300";
                        let feedbackMsg = "Your proposed compensation matches realistic market demand in Dhaka cities for elite tutors.";

                        if (proposedAmount < minComp) {
                          matchStatus = "Low Fee Alert";
                          matchColor = "text-rose-700 bg-rose-100 border border-rose-300";
                          feedbackMsg = `Under-minimum advisory: Standard market rates for ${medium} (${aiMatchGrade}) generally range between ৳${minComp.toLocaleString()} - ৳${maxComp.toLocaleString()}. Qualified teachers may demand higher compensation parameters.`;
                        } else if (proposedAmount > maxComp) {
                          matchStatus = "Elite Offering";
                          matchColor = "text-indigo-700 bg-indigo-100 border border-indigo-300";
                          feedbackMsg = "Generous compensation target. This will easily attract top-tier University (BUET/DU/Medical) qualified tutors for target preps!";
                        }

                        // Find currently registered matches
                        const matchingTutors = teachers.filter(t => t.subjects && Array.isArray(t.subjects) && t.subjects.includes(aiMatchSubject));

                        return (
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">AI Estimate</span>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${matchColor}`}>{matchStatus}</span>
                            </div>
                            
                            <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                              {feedbackMsg}
                            </p>

                            <div className="border-t border-slate-200/50 pt-2.5">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Registered In-App Qualified Matches</p>
                              {matchingTutors.length > 0 ? (
                                <div className="space-y-1.5">
                                  {matchingTutors.map(matchTutor => (
                                    <div key={matchTutor.id} className="p-2 bg-white rounded-lg border border-slate-150 flex justify-between items-center text-[11px]">
                                      <span className="font-bold text-slate-800">{matchTutor.name}</span>
                                      <span className="font-semibold text-rose-600 font-mono">৳{matchTutor.salary}/mo</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-slate-400 italic">No registered tutors match the target course topic: {aiMatchSubject.toUpperCase()}. See 'Tutors' section to add profile parameters.</p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

      </main>

      {/* Styled Parent panel footer */}
      <footer className="bg-slate-930 text-slate-400 py-6 border-t border-slate-200 text-center text-xs mt-12 bg-white">
        <p className="font-bold text-slate-500 font-sans tracking-wide">
          Tutors' Diary — Designed by Apurba Barua. All rights reserved®
        </p>
        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-mono">
          Currency: BDT Locale (৳) | Secure local sandboxing persistence active | Responsive Web + Mobile
        </p>
      </footer>
    </div>
  );
};
