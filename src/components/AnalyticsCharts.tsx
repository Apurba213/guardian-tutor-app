/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

// Pie Segment Type
interface Segment {
  label: string;
  value: number;
  color: string;
}

interface AttendancePieChartProps {
  present: number;
  absent: number;
  gapOrOff: number;
  holiday: number;
  plain?: boolean;
}

export const AttendancePieChart: React.FC<AttendancePieChartProps> = ({
  present,
  absent,
  gapOrOff,
  holiday,
  plain = false
}) => {
  const total = present + absent + gapOrOff + holiday;
  
  const segments: Segment[] = [
    { label: 'Present', value: present, color: '#10b981' }, // emerald-500
    { label: 'Absent', value: absent, color: '#f43f5e' }, // rose-500
    { label: 'Gap / Off', value: gapOrOff, color: '#f59e0b' }, // amber-500
    { label: 'Holiday', value: holiday, color: '#6366f1' } // indigo-500
  ];

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-4 h-full w-full rounded-2xl text-slate-400 text-xs">
        <p className="font-semibold text-center mt-2">No attendance logs available yet</p>
        <p className="text-[10px] text-slate-400 mt-0.5 text-center">Mark dates in the calendar to populate</p>
      </div>
    );
  }

  // Calculate coordinates for SVG donut slices
  let accumulatedAngle = 0;
  
  const svgSlices = segments
    .filter(s => s.value > 0)
    .map((s, index) => {
      const percentage = s.value / total;
      const angle = percentage * 360;
      const startAngle = accumulatedAngle;
      const endAngle = accumulatedAngle + angle;
      accumulatedAngle = endAngle;

      // Convert angles to radians
      const rad1 = (startAngle - 90) * (Math.PI / 180);
      const rad2 = (endAngle - 90) * (Math.PI / 180);

      // Coordinates for center (50, 50) and radius 38
      const r = 38;
      const x1 = 50 + r * Math.cos(rad1);
      const y1 = 50 + r * Math.sin(rad1);
      const x2 = 50 + r * Math.cos(rad2);
      const y2 = 50 + r * Math.sin(rad2);

      const largeArc = angle > 180 ? 1 : 0;

      // If it takes up the entire circle, render a simplified stroke
      if (angle >= 359.9) {
        return (
          <circle 
            key={index} 
            cx="50" 
            cy="50" 
            r={r} 
            fill="none" 
            stroke={s.color} 
            strokeWidth="11" 
          />
        );
      }

      // Return path DSL
      return (
        <path
          key={index}
          d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
          fill="none"
          stroke={s.color}
          strokeWidth="11"
          strokeLinecap="round"
          className="transition-all duration-300 hover:opacity-90"
        />
      );
    });

  const attendanceRate = total > 0 ? Math.round(((present + holiday) / total) * 100) : 0;

  const chartContent = (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="relative w-28 h-28 md:w-32 md:h-32 flex items-center justify-center my-0.5">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-12">
          {/* Background circle track */}
          <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="11" />
          {svgSlices}
        </svg>

        {/* Center label */}
        <div className="absolute text-center">
          <span className="text-xl md:text-2xl font-black font-mono text-slate-800 leading-none">{attendanceRate}%</span>
          <p className="text-[8px] uppercase font-bold text-slate-400 tracking-wider">Attendance</p>
        </div>
      </div>

      {/* Legends column-adjusted */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 w-full mt-2.5 text-[9px] md:text-[10px]">
        {segments.map((s, index) => {
          const count = s.value;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={index} className="flex items-center justify-between border-b border-dashed border-slate-100 pb-0.5">
              <div className="flex items-center gap-1 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-slate-500 truncate">{s.label}</span>
              </div>
              <span className="font-extrabold text-slate-705 font-mono text-[9px] shrink-0">
                {count} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (plain) {
    return chartContent;
  }

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-between h-full">
      <h4 className="font-semibold text-slate-800 text-sm md:text-base self-start mb-3">
        Attendance Ratio
      </h4>

      <div className="relative w-44 h-44 flex items-center justify-center my-2">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-12">
          {/* Background circle track */}
          <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="12" />
          {svgSlices}
        </svg>

        {/* Center label */}
        <div className="absolute text-center">
          <span className="text-2xl font-bold font-mono text-slate-800">{attendanceRate}%</span>
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Attendance</p>
        </div>
      </div>

      {/* Legends column-adjusted */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 w-full mt-2 text-xs">
        {segments.map((s, index) => {
          const count = s.value;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={index} className="flex items-center justify-between border-b border-dashed border-slate-100 pb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-slate-500 truncate">{s.label}</span>
              </div>
              <span className="font-bold text-slate-700 font-mono text-[11px] shrink-0">
                {count} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface FinancialStatusBarProps {
  received: number;
  pending: number;
  plain?: boolean;
}

export const FinancialStatusBar: React.FC<FinancialStatusBarProps> = ({
  received,
  pending,
  plain = false
}) => {
  const total = received + pending;
  const receivedPercent = total > 0 ? Math.round((received / total) * 100) : 0;
  const pendingPercent = total > 0 ? Math.round((pending / total) * 100) : 0;

  const content = (
    <div className="space-y-3 w-full">
      {/* Visual percentage slider */}
      <div className="h-5 w-full bg-slate-100 rounded-full overflow-hidden flex font-mono text-[9px] font-bold text-white select-none">
        {received > 0 && (
          <div 
            style={{ width: `${receivedPercent}%` }} 
            className="bg-emerald-500 flex items-center justify-center transition-all duration-300"
            title={`Received: ${receivedPercent}%`}
          >
            {receivedPercent >= 15 ? `${receivedPercent}%` : ''}
          </div>
        )}
        {pending > 0 && (
          <div 
            style={{ width: `${pendingPercent}%` }} 
            className="bg-rose-400 flex items-center justify-center transition-all duration-300"
            title={`Pending: ${pendingPercent}%`}
          >
            {pendingPercent >= 15 ? `${pendingPercent}%` : ''}
          </div>
        )}
        {total === 0 && (
          <div className="w-full text-slate-400 flex items-center justify-center font-normal text-xs">
            No entries logged
          </div>
        )}
      </div>

      {/* Detailed cards */}
      <div className="grid grid-cols-2 gap-3 mt-1.5">
        {/* Received Card */}
        <div className="p-2.5 bg-emerald-50/60 rounded-2xl border border-emerald-100/40 text-center">
          <span className="text-[9px] font-bold uppercase text-emerald-600 tracking-wider">Received</span>
          <div className="text-base font-black text-slate-800 font-mono mt-0.5">
            ৳{received.toLocaleString('en-US')}
          </div>
        </div>
        {/* Pending Card */}
        <div className="p-2.5 bg-rose-50/60 rounded-2xl border border-rose-100/40 text-center">
          <span className="text-[9px] font-bold uppercase text-rose-500 tracking-wider">Pending</span>
          <div className="text-base font-black text-slate-800 font-mono mt-0.5">
            ৳{pending.toLocaleString('en-US')}
          </div>
        </div>
      </div>
    </div>
  );

  if (plain) {
    return content;
  }

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between h-full">
      <div>
        <h4 className="font-semibold text-slate-800 text-sm md:text-base mb-1">
          Earnings Breakdown (BDT)
        </h4>
        <p className="text-xs text-slate-400 mb-4">Current month transaction states</p>
      </div>

      <div className="space-y-4">
        {/* Visual percentage slider */}
        <div className="h-6 w-full bg-slate-100 rounded-full overflow-hidden flex font-mono text-[10px] font-bold text-white select-none">
          {received > 0 && (
            <div 
              style={{ width: `${receivedPercent}%` }} 
              className="bg-emerald-500 flex items-center justify-center transition-all duration-300"
              title={`Received: ${receivedPercent}%`}
            >
              {receivedPercent >= 15 ? `${receivedPercent}%` : ''}
            </div>
          )}
          {pending > 0 && (
            <div 
              style={{ width: `${pendingPercent}%` }} 
              className="bg-rose-400 flex items-center justify-center transition-all duration-300"
              title={`Pending: ${pendingPercent}%`}
            >
              {pendingPercent >= 15 ? `${pendingPercent}%` : ''}
            </div>
          )}
          {total === 0 && (
            <div className="w-full text-slate-400 flex items-center justify-center font-normal">
              No salary entries
            </div>
          )}
        </div>

        {/* Detailed cards */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          {/* Received Card */}
          <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/60">
            <span className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">Received</span>
            <div className="text-lg font-bold text-slate-800 font-mono mt-0.5">
              ৳ {received.toLocaleString('en-US')}
            </div>
          </div>
          {/* Pending Card */}
          <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100/60">
            <span className="text-[10px] font-bold uppercase text-rose-500 tracking-wider">Pending</span>
            <div className="text-lg font-bold text-slate-800 font-mono mt-0.5">
              ৳ {pending.toLocaleString('en-US')}
            </div>
          </div>
        </div>
      </div>

      <div className="text-[10px] text-slate-400 mt-4 text-center border-t border-slate-50 pt-3">
        Total expected revenue: <span className="font-bold text-slate-700 font-mono">৳ {total.toLocaleString('en-US')}</span>
      </div>
    </div>
  );
};
