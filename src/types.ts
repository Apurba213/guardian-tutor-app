/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// User roles in Tutors' Diary
export type UserRole = 'tutor' | 'guardian';

// User account credential/profile structure
export interface UserAccount {
  name: string;
  gmail: string;
  mobile: string;
  passwordHash: string; // Plain-simulated for evaluation
  role: UserRole;
}

// Student mediums
export type StudentMedium = 'bangla' | 'english' | 'british' | 'cambridge';

// Valid subjects
export type CourseSubject = 
  | 'math' 
  | 'english' 
  | 'physics' 
  | 'chemistry' 
  | 'biology' 
  | 'higher math' 
  | 'ict' 
  | 'general science' 
  | 'bangla';

// Attendance Options for Tutors
export type TutorAttendanceStatus = 
  | 'present' 
  | 'absent' 
  | 'gap' 
  | 'holiday' 
  | 'covered_gap' 
  | 'student_off';

// Attendance Options for Guardians/Parents
export type GuardianAttendanceStatus = 
  | 'present' 
  | 'absent' 
  | 'gap_covered' 
  | 'holiday' 
  | 'guardian_off';

// Tutor Student model
export interface TutorStudent {
  id: string;
  name: string;
  schoolOrCollege: string;
  medium: StudentMedium;
  className: string; // e.g. "9", "Standard 4", "SSC candidate"
  groupName?: 'science' | 'commerce' | 'arts' | ''; // for class 9/10/SSC/HSC etc.
  subjects: CourseSubject[];
  daysPerWeek: string[]; // e.g. ["Sat", "Mon", "Wed"]
  timeSlot?: string; // e.g. "04:30 PM"
  salary: number; // monthly in BDT
  location: string;
  parentNumber: string;
}

// Attendance Record
export interface AttendanceRecord {
  studentOrTeacherId: string;
  year: number;
  month: number; // 0-indexed (0 = Jan, 11 = Dec)
  dayLogs: {
    [day: number]: {
      status: TutorAttendanceStatus | GuardianAttendanceStatus;
      gapDateStr?: string; // date of original gap class
    };
  };
}

// Salary payment record for Tutor's student or Guardian's teacher
export interface SalaryPayment {
  id: string;
  studentOrTeacherId: string;
  month: number; // 0-indexed (0 - 11)
  year: number;
  status: 'paid' | 'unpaid';
  paymentDate?: string; // YYYY-MM-DD
  amount: number;
}

// Guardian's Private Teacher entry
export interface GuardianTeacher {
  id: string;
  name: string;
  address: string;
  subjects: CourseSubject[];
  salary: number; // monthly in BDT
  mobile: string;
  whatsapp: string;
  qualification: string;
  daysPerWeek: string[]; // e.g. ["Sun", "Tue", "Thu"]
  timeSlot: string; // e.g. "10:30 AM"
}
