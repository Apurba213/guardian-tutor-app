/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TutorAttendanceStatus, GuardianAttendanceStatus } from '../types';

interface GitHubContributionGridProps {
  logs: {
    [day: number]: {
      status: TutorAttendanceStatus | GuardianAttendanceStatus;
      gapDateStr?: string;
    };
  };
  year: number;
  month: number;
  onSelectDay?: (day: number) => void;
}

export const GitHubContributionGrid: React.FC<GitHubContributionGridProps> = ({
  logs,
  year,
  month,
  onSelectDay
}) => {
  // Get number of days in the specific month
  const totalDays = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month).toLocaleString('en-US', { month: 'long' });

  // Get weekday of the first day to align the grid if needed, or simply render index blocks
  // Render clean daily blocks from 1 to totalDays
  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);

  const getStatusColorClass = (status?: string) => {
    if (!status) return 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700';
    switch (status) {
      case 'present':
        return 'bg-emerald-500 text-white shadow-emerald-100 hover:bg-emerald-600 border-emerald-600';
      case 'absent':
        return 'bg-rose-500 text-white shadow-rose-100 hover:bg-rose-600 border-rose-600';
      case 'gap':
      case 'guardian_off':
        return 'bg-amber-500 text-white shadow-amber-100 hover:bg-amber-600 border-amber-600';
      case 'holiday':
        return 'bg-indigo-500 text-white shadow-indigo-100 hover:bg-indigo-600 border-indigo-600';
      case 'covered_gap':
      case 'gap_covered':
        return 'bg-teal-600 text-white shadow-teal-100 hover:bg-teal-700 border-teal-700';
      case 'student_off':
        return 'bg-sky-500 text-white shadow-sky-100 hover:bg-sky-600 border-sky-600';
      default:
        return 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700';
    }
  };

  const formatStatusName = (status?: string, gapDate?: string) => {
    if (!status) return 'No entry';
    const clean = status.replace('_', ' ');
    const normalized = clean.charAt(0).toUpperCase() + clean.slice(1);
    if (gapDate && (status === 'covered_gap' || status === 'gap_covered')) {
      return `${normalized} (Covering: ${gapDate})`;
    }
    return normalized;
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
        <div>
          <h4 className="font-semibold text-slate-800 text-sm md:text-base">
            Attendance Heatmap — {monthName} {year}
          </h4>
        
        </div>
        
        {/* Legends */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block border border-emerald-600 shrink-0" />
            <span>Present</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-3 h-3 rounded-sm bg-rose-500 inline-block border border-rose-600 shrink-0" />
            <span>Absent</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block border border-amber-600 shrink-0" />
            <span>Gap/Off</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-3 h-3 rounded-sm bg-teal-600 inline-block border border-teal-700 shrink-0" />
            <span>Covered</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block border border-indigo-600 shrink-0" />
            <span>Holiday</span>
          </div>
        </div>
      </div>

      {/* Grid wrapper */}
      <div className="overflow-x-auto py-1">
        <div className="flex flex-wrap gap-2 min-w-[280px]">
          {daysArray.map((day) => {
            const entry = logs[day];
            const status = entry?.status;
            const gapDateStr = entry?.gapDateStr;
            const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;

            return (
              <button
                key={day}
                id={`day-square-${day}`}
                onClick={() => onSelectDay && onSelectDay(day)}
                title={`Day ${day}: ${formatStatusName(status, gapDateStr)}`}
                className={`
                  w-9 h-9 sm:w-10 sm:h-10 flex flex-col items-center justify-center p-0.5 rounded-xl text-center
                  border transition-all duration-150 cursor-pointer text-xs font-bold select-none group relative shrink-0
                  ${getStatusColorClass(status)}
                  ${isToday ? 'ring-2 ring-indigo-600 ring-offset-2 scale-102 shadow-md' : ''}
                `}
              >
                <span>{day}</span>
                <span className="text-[9px] font-bold opacity-80 mt-[-2px]">
                  {status ? (status === 'present' ? 'P' : status === 'absent' ? 'A' : '•') : ''}
                </span>

                {/* Micro tooltip fallback */}
                <div className="absolute bottom-[115%] left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded hidden group-hover:block z-20 whitespace-nowrap shadow-md pointer-events-none font-medium">
                  {`Day ${day}: `} 
                  <span className="font-extrabold">{formatStatusName(status, gapDateStr)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
