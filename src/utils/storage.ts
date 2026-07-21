/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  UserAccount, 
  TutorStudent, 
  GuardianTeacher, 
  AttendanceRecord, 
  SalaryPayment, 
  UserRole 
} from '../types';
import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  collection, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from './firebase';

// Storage keys
const ACCOUNTS_KEY = 'tutors_diary_accounts';
const CURRENT_USER_KEY = 'tutors_diary_active_user';

// Helper to retrieve all accounts
export function getAccounts(): UserAccount[] {
  const data = localStorage.getItem(ACCOUNTS_KEY);
  return data ? JSON.parse(data) : [];
}

// Helper to save accounts
export function saveAccounts(accounts: UserAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

// Register user
export async function registerAccount(
  account: Omit<UserAccount, 'passwordHash'>, 
  password: string, 
  seedDemoData = false
): Promise<{ success: boolean; message: string }> {
  try {
    const gmailLower = account.gmail.toLowerCase();
    const userDocRef = doc(db, 'accounts', gmailLower);
    
    // First check Firestore
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return { success: false, message: 'This Gmail address is already registered.' };
    }

    const newAcc: UserAccount = {
      ...account,
      gmail: gmailLower,
      passwordHash: password
    };

    // Save to Firestore
    await setDoc(userDocRef, newAcc);

    // Save locally
    const accounts = getAccounts();
    accounts.push(newAcc);
    saveAccounts(accounts);
    
    if (seedDemoData) {
      seedMockDataForUser(gmailLower, newAcc.role);
    } else {
      // Sync initial empty collections
      await uploadStudentsToCloud(gmailLower, []);
      await uploadTeachersToCloud(gmailLower, []);
      await uploadAttendanceToCloud(gmailLower, []);
      await uploadSalaryToCloud(gmailLower, []);
    }

    return { success: true, message: 'Account created successfully! You can now log in.' };
  } catch (err) {
    console.error("Registration error:", err);
    return { success: false, message: `Could not connect to database: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// Login user
export async function loginUser(gmail: string, passwordHash: string, role: UserRole): Promise<UserAccount | null> {
  const gmailLower = gmail.toLowerCase();
  try {
    const userDocRef = doc(db, 'accounts', gmailLower);
    const docSnap = await getDoc(userDocRef);
    
    if (docSnap.exists()) {
      const acc = docSnap.data() as UserAccount;
      if (acc.passwordHash === passwordHash && acc.role === role) {
        // Save current user locally
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(acc));
        
        // Save to local accounts cache
        const localAccounts = getAccounts();
        if (!localAccounts.some(a => a.gmail.toLowerCase() === gmailLower)) {
          localAccounts.push(acc);
          saveAccounts(localAccounts);
        }

        // Pull and sync full student diaries, calendars, finances for multi-device harmony!
        await downloadAllFromCloud(gmailLower);
        
        return acc;
      }
    }
  } catch (err) {
    console.error("Firestore Login Error:", err);
  }

  // Fallback to local accounts just in case they are offline, or as legacy support
  const localAccounts = getAccounts();
  const matched = localAccounts.find(
    acc => acc.gmail.toLowerCase() === gmailLower && 
           acc.passwordHash === passwordHash && 
           acc.role === role
  );

  if (matched) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(matched));
    return matched;
  }
  return null;
}

// Get active session
export function getActiveUser(): UserAccount | null {
  const data = localStorage.getItem(CURRENT_USER_KEY);
  return data ? JSON.parse(data) : null;
}

// Logout session
export function logoutActiveUser() {
  localStorage.removeItem(CURRENT_USER_KEY);
}

// SCOPED DATA LOADERS/SAVERS Based on Gmail
export function getUserDataKey(gmail: string, key: string): string {
  return `tutors_diary_${gmail.replace(/[@.]/g, '_')}_${key}`;
}

export function loadTutorStudents(gmail: string): TutorStudent[] {
  const key = getUserDataKey(gmail, 'students');
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

export function saveTutorStudents(gmail: string, students: TutorStudent[]) {
  const key = getUserDataKey(gmail, 'students');
  localStorage.setItem(key, JSON.stringify(students));
  uploadStudentsToCloud(gmail, students).catch(err => console.error("Cloud students upload err:", err));
}

export function loadGuardianTeachers(gmail: string): GuardianTeacher[] {
  const key = getUserDataKey(gmail, 'teachers');
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

export function saveGuardianTeachers(gmail: string, teachers: GuardianTeacher[]) {
  const key = getUserDataKey(gmail, 'teachers');
  localStorage.setItem(key, JSON.stringify(teachers));
  uploadTeachersToCloud(gmail, teachers).catch(err => console.error("Cloud teachers upload err:", err));
}

export function loadAttendance(gmail: string): AttendanceRecord[] {
  const key = getUserDataKey(gmail, 'attendance');
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

export function saveAttendance(gmail: string, records: AttendanceRecord[]) {
  const key = getUserDataKey(gmail, 'attendance');
  localStorage.setItem(key, JSON.stringify(records));
  uploadAttendanceToCloud(gmail, records).catch(err => console.error("Cloud attendance upload err:", err));
}

export function loadSalaryPayments(gmail: string): SalaryPayment[] {
  const key = getUserDataKey(gmail, 'salaries');
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

export function saveSalaryPayments(gmail: string, payments: SalaryPayment[]) {
  const key = getUserDataKey(gmail, 'salaries');
  localStorage.setItem(key, JSON.stringify(payments));
  uploadSalaryToCloud(gmail, payments).catch(err => console.error("Cloud salaries upload err:", err));
}

// --- CLOUD TRANSFER ENGINES ---

// Helper to recursively strip undefined properties so Firestore does not reject writes with an "Unsupported field value: undefined" error
function cleanUndefinedKeys(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefinedKeys(item));
  }
  if (typeof obj === 'object') {
    // If it is a generic object, prune its undefined values
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        cleaned[key] = cleanUndefinedKeys(val);
      }
    }
    return cleaned;
  }
  return obj;
}

export async function uploadStudentsToCloud(gmail: string, students: TutorStudent[]) {
  const normalizedGmail = gmail.toLowerCase();
  try {
    const snap = await getDocs(query(collection(db, 'students'), where('ownerGmail', '==', normalizedGmail)));
    const localIds = new Set(students.map(s => s.id));
    
    // Prune deleted docs
    for (const docSnap of snap.docs) {
      if (!localIds.has(docSnap.id)) {
        await deleteDoc(doc(db, 'students', docSnap.id));
      }
    }

    // Upload current docs
    for (const s of students) {
      await setDoc(doc(db, 'students', s.id), cleanUndefinedKeys({
        ...s,
        ownerGmail: normalizedGmail
      }));
    }
  } catch (err) {
    console.error("Firestore Upload Students error:", err);
  }
}

export async function uploadTeachersToCloud(gmail: string, teachers: GuardianTeacher[]) {
  const normalizedGmail = gmail.toLowerCase();
  try {
    const snap = await getDocs(query(collection(db, 'teachers'), where('ownerGmail', '==', normalizedGmail)));
    const localIds = new Set(teachers.map(t => t.id));
    
    // Prune deleted docs
    for (const docSnap of snap.docs) {
      if (!localIds.has(docSnap.id)) {
        await deleteDoc(doc(db, 'teachers', docSnap.id));
      }
    }

    // Upload current docs
    for (const t of teachers) {
      await setDoc(doc(db, 'teachers', t.id), cleanUndefinedKeys({
        ...t,
        ownerGmail: normalizedGmail
      }));
    }
  } catch (err) {
    console.error("Firestore Upload Teachers error:", err);
  }
}

export async function uploadAttendanceToCloud(gmail: string, records: AttendanceRecord[]) {
  const normalizedGmail = gmail.toLowerCase();
  try {
    const snap = await getDocs(query(collection(db, 'attendance'), where('ownerGmail', '==', normalizedGmail)));
    const localKeys = new Set(records.map(r => `${r.studentOrTeacherId}_${r.year}_${r.month}`));
    
    // Prune deleted docs
    for (const docSnap of snap.docs) {
      if (!localKeys.has(docSnap.id)) {
        await deleteDoc(doc(db, 'attendance', docSnap.id));
      }
    }

    // Upload current docs
    for (const r of records) {
      const docId = `${r.studentOrTeacherId}_${r.year}_${r.month}`;
      await setDoc(doc(db, 'attendance', docId), cleanUndefinedKeys({
        id: docId,
        studentOrTeacherId: r.studentOrTeacherId,
        year: r.year,
        month: r.month,
        dayLogs: r.dayLogs || {},
        ownerGmail: normalizedGmail
      }));
    }
  } catch (err) {
    console.error("Firestore Upload Attendance error:", err);
  }
}

export async function uploadSalaryToCloud(gmail: string, payments: SalaryPayment[]) {
  const normalizedGmail = gmail.toLowerCase();
  try {
    const snap = await getDocs(query(collection(db, 'salaries'), where('ownerGmail', '==', normalizedGmail)));
    const localIds = new Set(payments.map(p => p.id));
    
    // Prune deleted docs
    for (const docSnap of snap.docs) {
      if (!localIds.has(docSnap.id)) {
        await deleteDoc(doc(db, 'salaries', docSnap.id));
      }
    }

    // Upload current docs
    for (const p of payments) {
      await setDoc(doc(db, 'salaries', p.id), cleanUndefinedKeys({
        ...p,
        ownerGmail: normalizedGmail
      }));
    }
  } catch (err) {
    console.error("Firestore Upload Salary error:", err);
  }
}

// Download cloud copies and restore into local storage cache
export async function downloadAllFromCloud(gmail: string): Promise<void> {
  const normalizedGmail = gmail.toLowerCase();
  try {
    // 1. Download Students
    const studentsSnap = await getDocs(
      query(collection(db, 'students'), where('ownerGmail', '==', normalizedGmail))
    );
    const students: TutorStudent[] = [];
    studentsSnap.forEach(docSnap => {
      students.push(docSnap.data() as TutorStudent);
    });
    localStorage.setItem(getUserDataKey(normalizedGmail, 'students'), JSON.stringify(students));

    // 2. Download Teachers
    const teachersSnap = await getDocs(
      query(collection(db, 'teachers'), where('ownerGmail', '==', normalizedGmail))
    );
    const teachers: GuardianTeacher[] = [];
    teachersSnap.forEach(docSnap => {
      teachers.push(docSnap.data() as GuardianTeacher);
    });
    localStorage.setItem(getUserDataKey(normalizedGmail, 'teachers'), JSON.stringify(teachers));

    // 3. Download Attendance
    const attendanceSnap = await getDocs(
      query(collection(db, 'attendance'), where('ownerGmail', '==', normalizedGmail))
    );
    const attendance: AttendanceRecord[] = [];
    attendanceSnap.forEach(docSnap => {
      attendance.push(docSnap.data() as AttendanceRecord);
    });
    localStorage.setItem(getUserDataKey(normalizedGmail, 'attendance'), JSON.stringify(attendance));

    // 4. Download Salaries
    const salariesSnap = await getDocs(
      query(collection(db, 'salaries'), where('ownerGmail', '==', normalizedGmail))
    );
    const salaries: SalaryPayment[] = [];
    salariesSnap.forEach(docSnap => {
      salaries.push(docSnap.data() as SalaryPayment);
    });
    localStorage.setItem(getUserDataKey(normalizedGmail, 'salaries'), JSON.stringify(salaries));
  } catch (err) {
    console.error("Error downloading from Cloud:", err);
  }
}

// Seed colorful, high fidelity, mock data for newly created accounts so it looks gorgeous!
export function seedMockDataForUser(gmail: string, role: UserRole) {
  const today = new Date();
  const curYear = today.getFullYear();
  const curMonth = today.getMonth(); // 0-11
  
  if (role === 'tutor') {
    // 3 mock students
    const students: TutorStudent[] = [
      {
        id: 'stud-1',
        name: 'Sajid Al Hasan',
        schoolOrCollege: 'Dhaka Residential Model College',
        medium: 'bangla',
        className: 'Class 9',
        groupName: 'science',
        subjects: ['math', 'physics', 'chemistry', 'higher math'],
        daysPerWeek: ['Sat', 'Mon', 'Wed'],
        salary: 8500,
        location: 'Dhanmondi, Dhaka',
        parentNumber: '01712345678'
      },
      {
        id: 'stud-2',
        name: 'Amina Chowdhury',
        schoolOrCollege: 'Scholastica School',
        medium: 'cambridge',
        className: 'O level',
        subjects: ['english', 'biology', 'ict', 'chemistry'],
        daysPerWeek: ['Sun', 'Tue', 'Thu'],
        salary: 12000,
        location: 'Uttara, Dhaka',
        parentNumber: '01899887766'
      },
      {
        id: 'stud-3',
        name: 'Tahmid Rahman',
        schoolOrCollege: 'Notre Dame College',
        medium: 'bangla',
        className: 'HSC candidate',
        groupName: 'science',
        subjects: ['physics', 'chemistry', 'higher math', 'ict'],
        daysPerWeek: ['Sat', 'Mon', 'Wed', 'Fri'],
        salary: 10000,
        location: 'Motijheel, Dhaka',
        parentNumber: '01555443322'
      }
    ];

    saveTutorStudents(gmail, students);

    // Seed attendance record for this month
    const attendance: AttendanceRecord[] = [
      {
        studentOrTeacherId: 'stud-1',
        year: curYear,
        month: curMonth,
        dayLogs: generateRealisticLogs('tutor', ['Sat', 'Mon', 'Wed'], today)
      },
      {
        studentOrTeacherId: 'stud-2',
        year: curYear,
        month: curMonth,
        dayLogs: generateRealisticLogs('tutor', ['Sun', 'Tue', 'Thu'], today)
      },
      {
        studentOrTeacherId: 'stud-3',
        year: curYear,
        month: curMonth,
        dayLogs: generateRealisticLogs('tutor', ['Sat', 'Mon', 'Wed', 'Fri'], today)
      }
    ];
    saveAttendance(gmail, attendance);

    // Seed salary payments for current & past months
    const salaries: SalaryPayment[] = [
      {
        id: 'sal-1a',
        studentOrTeacherId: 'stud-1',
        year: curYear,
        month: (curMonth - 1 + 12) % 12,
        status: 'paid',
        paymentDate: `${curYear}-${String(curMonth).padStart(2, '0')}-05`,
        amount: 8500
      },
      {
        id: 'sal-1b',
        studentOrTeacherId: 'stud-1',
        year: curYear,
        month: curMonth,
        status: 'unpaid',
        amount: 8500
      },
      {
        id: 'sal-2a',
        studentOrTeacherId: 'stud-2',
        year: curYear,
        month: (curMonth - 1 + 12) % 12,
        status: 'paid',
        paymentDate: `${curYear}-${String(curMonth).padStart(2, '0')}-02`,
        amount: 12000
      },
      {
        id: 'sal-2b',
        studentOrTeacherId: 'stud-2',
        year: curYear,
        month: curMonth,
        status: 'paid',
        paymentDate: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-01`,
        amount: 12000
      },
      {
        id: 'sal-3a',
        studentOrTeacherId: 'stud-3',
        year: curYear,
        month: (curMonth - 1 + 12) % 12,
        status: 'paid',
        paymentDate: `${curYear}-${String(curMonth).padStart(2, '0')}-10`,
        amount: 10000
      },
      {
        id: 'sal-3b',
        studentOrTeacherId: 'stud-3',
        year: curYear,
        month: curMonth,
        status: 'unpaid',
        amount: 10000
      }
    ];
    saveSalaryPayments(gmail, salaries);

    // Initial background push
    uploadStudentsToCloud(gmail, students).catch(e => console.error(e));
    uploadAttendanceToCloud(gmail, attendance).catch(e => console.error(e));
    uploadSalaryToCloud(gmail, salaries).catch(e => console.error(e));

  } else {
    // Parent Panel: 2 mock private tutors
    const teachers: GuardianTeacher[] = [
      {
        id: 'teach-1',
        name: 'Abrar Tanvir',
        address: 'Banasree, Dhaka',
        subjects: ['math', 'higher math', 'physics'],
        salary: 8000,
        mobile: '01911223344',
        whatsapp: '01911223344',
        qualification: 'B.Sc in ME, BUET',
        daysPerWeek: ['Sun', 'Tue', 'Thu'],
        timeSlot: '04:30 PM'
      },
      {
        id: 'teach-2',
        name: 'Dr. Nusrat Jahan',
        address: 'Farmgate, Dhaka',
        subjects: ['biology', 'chemistry', 'general science'],
        salary: 9500,
        mobile: '01677665544',
        whatsapp: '01677665544',
        qualification: 'MBBS student (3rd year), DMC',
        daysPerWeek: ['Mon', 'Wed'],
        timeSlot: '06:00 PM'
      }
    ];
    saveGuardianTeachers(gmail, teachers);

    // Attendance
    const attendance: AttendanceRecord[] = [
      {
        studentOrTeacherId: 'teach-1',
        year: curYear,
        month: curMonth,
        dayLogs: generateRealisticLogs('guardian', ['Sun', 'Tue', 'Thu'], today)
      },
      {
        studentOrTeacherId: 'teach-2',
        year: curYear,
        month: curMonth,
        dayLogs: generateRealisticLogs('guardian', ['Mon', 'Wed'], today)
      }
    ];
    saveAttendance(gmail, attendance);

    // Salaries
    const salaries: SalaryPayment[] = [
      {
        id: 'sal-t1a',
        studentOrTeacherId: 'teach-1',
        year: curYear,
        month: (curMonth - 1 + 12) % 12,
        status: 'paid',
        paymentDate: `${curYear}-${String(curMonth).padStart(2, '0')}-03`,
        amount: 8000
      },
      {
        id: 'sal-t1b',
        studentOrTeacherId: 'teach-1',
        year: curYear,
        month: curMonth,
        status: 'unpaid',
        amount: 8000
      },
      {
        id: 'sal-t2a',
        studentOrTeacherId: 'teach-2',
        year: curYear,
        month: (curMonth - 1 + 12) % 12,
        status: 'paid',
        paymentDate: `${curYear}-${String(curMonth).padStart(2, '0')}-07`,
        amount: 9500
      },
      {
        id: 'sal-t2b',
        studentOrTeacherId: 'teach-2',
        year: curYear,
        month: curMonth,
        status: 'paid',
        paymentDate: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-04`,
        amount: 9500
      }
    ];
    saveSalaryPayments(gmail, salaries);

    // Initial background push
    uploadTeachersToCloud(gmail, teachers).catch(e => console.error(e));
    uploadAttendanceToCloud(gmail, attendance).catch(e => console.error(e));
    uploadSalaryToCloud(gmail, salaries).catch(e => console.error(e));
  }
}

// Generate logs matching targeted days of the week, with some nice realistic present/absent mix
function generateRealisticLogs(
  panelType: 'tutor' | 'guardian',
  daysInWeek: string[],
  endDate: Date
): Record<number, any> {
  const logs: Record<number, any> = {};
  const totalDays = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
  const currentDayLimit = endDate.getDate();

  const weekdayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  
  const targetWebdays = daysInWeek.map(d => weekdayMap[d]);

  for (let d = 1; d <= totalDays; d++) {
    // If future date, skip or don't set status
    if (d > currentDayLimit) continue;

    const date = new Date(endDate.getFullYear(), endDate.getMonth(), d);
    const dayOfWeek = date.getDay();

    if (targetWebdays.includes(dayOfWeek)) {
      // Pick status randomly but high-chance present
      const r = Math.random();
      if (panelType === 'tutor') {
        if (r < 0.75) {
          logs[d] = { status: 'present' };
        } else if (r < 0.85) {
          logs[d] = { status: 'absent' };
        } else if (r < 0.92) {
          // select a previous date to cover
          const gapDay = Math.max(1, d - 4);
          logs[d] = { status: 'covered_gap', gapDateStr: `${endDate.getFullYear()}-${String(endDate.getMonth()+1).padStart(2, '0')}-${String(gapDay).padStart(2, '0')}` };
        } else if (r < 0.96) {
          logs[d] = { status: 'holiday' };
        } else {
          logs[d] = { status: 'gap' };
        }
      } else {
        if (r < 0.78) {
          logs[d] = { status: 'present' };
        } else if (r < 0.88) {
          logs[d] = { status: 'absent' };
        } else if (r < 0.93) {
          const gapDay = Math.max(1, d - 4);
          logs[d] = { status: 'gap_covered', gapDateStr: `${endDate.getFullYear()}-${String(endDate.getMonth()+1).padStart(2, '0')}-${String(gapDay).padStart(2, '0')}` };
        } else if (r < 0.97) {
          logs[d] = { status: 'holiday' };
        } else {
          logs[d] = { status: 'guardian_off' };
        }
      }
    }
  }

  return logs;
}
