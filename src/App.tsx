/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserAccount, UserRole } from './types';
import { 
  getActiveUser, 
  registerAccount, 
  loginUser, 
  logoutActiveUser 
} from './utils/storage';
import { TutorDashboard } from './components/TutorDashboard';
import { GuardianDashboard } from './components/GuardianDashboard';
import { 
  Sparkles, 
  Users, 
  UserCheck, 
  Lock, 
  Mail, 
  Phone, 
  ArrowRight, 
  Heart, 
  CheckCircle,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';

export default function App() {
  // --- SESSION FLOW ---
  const [activeUser, setActiveUser] = useState<UserAccount | null>(null);
  const [initChecked, setInitChecked] = useState(false);

  // Authentication page status: 'login' | 'register'
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Selected Role for authentication context
  const [selectedRole, setSelectedRole] = useState<UserRole>('tutor');

  // Register Form states
  const [name, setName] = useState('');
  const [gmail, setGmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');

  // Login Form states
  const [loginGmail, setLoginGmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Cloud auth loading indicators
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Info message banners
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check login state on mount
  useEffect(() => {
    const session = getActiveUser();
    if (session) {
      setActiveUser(session);
    }
    setInitChecked(true);
  }, []);

  // Quick helper to show messages
  const notify = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !gmail || !mobile || !password) {
      notify('error', 'All fields are strictly required!');
      return;
    }

    if (!gmail.includes('@') || !gmail.includes('.')) {
      notify('error', 'Please provide a valid Gmail / Email address.');
      return;
    }

    setIsRegistering(true);
    try {
      const regResult = await registerAccount({
        name,
        gmail: gmail.trim(),
        mobile: mobile.trim(),
        role: selectedRole
      }, password, false);

      if (regResult.success) {
        notify('success', regResult.message);
        // Clean register inputs
        setName('');
        setGmail('');
        setMobile('');
        setPassword('');
        setAuthMode('login');
      } else {
        notify('error', regResult.message);
      }
    } catch (err) {
      console.error("Reg Error", err);
      notify('error', 'Registration request failed. Check connection.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginGmail || !loginPassword) {
      notify('error', 'Gmail and Password are required!');
      return;
    }

    setIsLoggingIn(true);
    try {
      const matchedUser = await loginUser(loginGmail.trim(), loginPassword, selectedRole);

      if (matchedUser) {
        setActiveUser(matchedUser);
        notify('success', `Welcome back, ${matchedUser.name}!`);
        // Clean login inputs
        setLoginGmail('');
        setLoginPassword('');
      } else {
        notify('error', `Invalid credentials for the selected ${selectedRole === 'tutor' ? 'Tutor' : 'Guardian'} panel. Please try again!`);
      }
    } catch (err) {
      console.error("Login Error", err);
      notify('error', 'Failed to connect to cloud login directory.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    logoutActiveUser();
    setActiveUser(null);
    notify('success', 'You have been safely logged out.');
  };

  // Wait for session checkout
  if (!initChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-bold tracking-wider uppercase font-mono">Loading Tutors' Diary...</p>
        </div>
      </div>
    );
  }

  // --- ROUTE TO ACTIVE DASHBOARDS ---
  if (activeUser) {
    if (activeUser.role === 'tutor') {
      return <TutorDashboard user={activeUser} onLogout={handleLogout} />;
    } else {
      return <GuardianDashboard user={activeUser} onLogout={handleLogout} />;
    }
  }

  // Define colorful thematic configurations based on the SELECTED ROLE
  // Tutor = Cool emerald focus green. Guardian = Warm pink family rose.
  const isTutorTheme = selectedRole === 'tutor';
  const themeGrad = isTutorTheme 
    ? 'from-emerald-600 via-teal-600 to-cyan-600' 
    : 'from-rose-500 via-pink-600 to-violet-600';
  const themeText = isTutorTheme ? 'text-emerald-600' : 'text-rose-600';
  const themeBtn = isTutorTheme ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700';
  const themeBgLight = isTutorTheme ? 'bg-emerald-50' : 'bg-rose-50';
  const themeBorderActive = isTutorTheme ? 'border-emerald-500 bg-emerald-50/50' : 'border-rose-500 bg-rose-50/50';

  // --- RENDERING AUTHENTICATION VIEW ---
  return (
    <div className={`min-h-screen ${isTutorTheme ? 'bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-emerald-50/60 via-slate-50 to-indigo-50/50' : 'bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-rose-50/60 via-slate-50 to-violet-50/50'} flex flex-col justify-between transition-colors duration-500`} id="auth-root-container">
      
      {/* Decorative colored top header */}
      <div className={`h-2.5 bg-gradient-to-r ${themeGrad} transition-all duration-500`} />

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 flex-grow flex items-center justify-center relative overflow-hidden">
        {/* Background ambient light sparks */}
        <div className={`absolute -top-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-20 bg-gradient-to-tr ${themeGrad}`} />
        <div className={`absolute -bottom-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-20 bg-gradient-to-tr ${themeGrad}`} />
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center w-full max-w-5xl relative z-10">
          
          {/* Left information column detailing the software highlights */}
          <div className="lg:col-span-5 space-y-6 text-slate-800">
            <div className="flex items-center gap-3">
              <span className={`p-3 rounded-2xl bg-gradient-to-tr ${themeGrad} text-white shadow-lg shadow-indigo-100 transition-all duration-500`}>
                <Sparkles className="w-6 h-6 animate-pulse" />
              </span>
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 font-display">
                  Tutors' <span className={themeText}>Diary</span>
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Automated Tuition Scheduler</p>
              </div>
            </div>

            {/* Bullets highlighting features */}
            <div className="space-y-4 text-xs md:text-sm text-slate-650 font-medium pt-2">
              <div className="flex items-start gap-3">
                <CheckCircle className={`w-5 h-5 shrink-0 mt-0.5 ${isTutorTheme ? 'text-emerald-500' : 'text-rose-500'}`} />
                <div>
                  <p className="font-bold text-slate-805">Exclusive Secure Profile Sandboxing</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Dedicated database namespaces ensure 100% isolated guardian and tutor diary files. Absolute client privacy, free from diagnostic tracking or shared credentials leaks.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className={`w-5 h-5 shrink-0 mt-0.5 ${isTutorTheme ? 'text-emerald-500' : 'text-rose-500'}`} />
                <div>
                  <p className="font-bold text-slate-805">Dynamic Attendance Matrix & Progress Tracker</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Log regular tuition hours, schedule expert make-up sessions, configure special holiday leaves, and review daily interactive calendars in real-time.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className={`w-5 h-5 shrink-0 mt-0.5 ${isTutorTheme ? 'text-emerald-500' : 'text-rose-500'}`} />
                <div>
                  <p className="font-bold text-slate-805">Glossy Ledgering & Smart Fee Receipts</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Systematically record monthly fees, monitor pending tuition dues, issue beautifully itemized digital payment vouchers, and export neat audit sheets instantly.</p>
                </div>
              </div>
            </div>

            {/* Quick trust tag */}
            <div className="bg-white/70 backdrop-blur-md p-4 rounded-[22px] border border-slate-200/60 flex items-center gap-3 text-xs text-slate-650 font-mono shadow-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              <div className="leading-tight">
                <p className="font-bold text-slate-800">State Sandbox Shield Active</p>
                <p className="text-[10px] text-slate-400 mt-0.5">BDT calculations secured locally • Instant offline capability</p>
              </div>
            </div>
          </div>

          {/* Right login form column */}
          <div className={`lg:col-span-7 rounded-[32px] p-6 md:p-9 border backdrop-blur-xl transition-all duration-500 ${
            isTutorTheme 
              ? 'bg-white/85 border-emerald-500/25 shadow-xl shadow-emerald-500/5' 
              : 'bg-white/85 border-rose-500/25 shadow-xl shadow-rose-500/5'
          }`}>
            
            {/* ROLE PICKER SELECTORS (Tutor Panel vs Guardian Panel) */}
            <div className="mb-6 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Choose workspace panel:</span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  id="select-tutor-role-btn"
                  onClick={() => setSelectedRole('tutor')}
                  className={`py-3.5 px-4 rounded-2xl border text-center font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                    isTutorTheme 
                      ? 'border-emerald-500 bg-emerald-50/40 text-emerald-800 ring-2 ring-emerald-500/20' 
                      : 'border-slate-200 hover:border-slate-350 bg-white text-slate-600'
                  }`}
                >
                  <Users className="w-5 h-5 text-emerald-600" />
                  <span className="tracking-wide">Tutor Panel</span>
                </button>

                <button
                  type="button"
                  id="select-guardian-role-btn"
                  onClick={() => setSelectedRole('guardian')}
                  className={`py-3.5 px-4 rounded-2xl border text-center font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                    !isTutorTheme 
                      ? 'border-rose-500 bg-rose-50/40 text-rose-800 ring-2 ring-rose-500/20' 
                      : 'border-slate-200 hover:border-slate-350 bg-white text-slate-600'
                  }`}
                >
                  <Heart className="w-5 h-5 text-rose-500" />
                  <span className="tracking-wide">Parent / Guardian Panel</span>
                </button>
              </div>
            </div>

            {/* Error / Success banners */}
            {message && (
              <div className={`p-4 rounded-2xl text-xs font-bold leading-5 mb-5 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'}`}>
                {message.text}
              </div>
            )}

            {/* LOGIN CARD TAB */}
            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-800 text-lg">
                    Log In to Your <span className="capitalize">{selectedRole === 'tutor' ? 'Tutor' : 'Guardian/Parent'}</span> Panel
                  </h3>
                  <span className="text-xs text-slate-400">Authenticating scoped security credentials</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gmail Address *</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input 
                      type="email" 
                      required
                      value={loginGmail}
                      onChange={e => setLoginGmail(e.target.value)}
                      placeholder="e.g. any@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Secure Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input 
                      type="password" 
                      required
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className={`w-full py-3 ${themeBtn} text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isLoggingIn ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Entering Workspace...
                    </>
                  ) : (
                    <>
                      Enter Your Workspace <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-xs text-center text-slate-500 pt-2 font-medium">
                  Don't have an isolated diary account?{' '}
                  <button 
                    type="button" 
                    onClick={() => { setAuthMode('register'); setMessage(null); }}
                    className={`${themeText} font-black hover:underline`}
                  >
                    Register Account Now
                  </button>
                </p>
              </form>
            ) : (
              /* REGISTRATION CARD TAB */
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-800 text-lg">
                    Create Secure <span className="capitalize">{selectedRole === 'tutor' ? 'Tutor' : 'Guardian'}</span> Account
                  </h3>
                  <span className="text-xs text-slate-400">Join to organize schedules separately</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Full Name *</label>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Apurba Barua"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-xs sm:text-sm focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gmail Address *</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input 
                      type="email" 
                      required
                      value={gmail}
                      onChange={e => setGmail(e.target.value)}
                      placeholder="e.g. apurba@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-xs sm:text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mobile Number *</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      required
                      value={mobile}
                      onChange={e => setMobile(e.target.value)}
                      placeholder="e.g. 01712345678"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-xs sm:text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input 
                      type="password" 
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-xs sm:text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isRegistering}
                  className={`w-full py-3 ${themeBtn} text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isRegistering ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      Create Secure Account <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-xs text-center text-slate-500 pt-2 font-medium">
                  Already registered account?{' '}
                  <button 
                    type="button" 
                    onClick={() => { setAuthMode('login'); setMessage(null); }}
                    className={`${themeText} font-black hover:underline`}
                  >
                    Log In Here
                  </button>
                </p>
              </form>
            )}

          </div>
        </div>
      </main>

      {/* Persistent platform footer */}
      <footer className="bg-white border-t border-slate-200 py-5 text-center text-xs text-slate-400 font-sans mt-8">
        <p className="font-semibold text-slate-500">
          Tutors' Diary — Designed  by <span className="font-extrabold text-slate-705 underline decoration-indigo-400">Apurba Barua</span>. All rights reserved®
        </p>
        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-mono">
          Strictly compliant under BDT (৳) calculations | Responsive layout models and isolated state persistence
        </p>
      </footer>
    </div>
  );
}
