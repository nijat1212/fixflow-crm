// Interactive Monthly Shift Calendar Component for FixFlow CRM

import { storage } from '../utils/storage.js';

export function renderCalendar() {
  const technicians = storage.getTechnicians();
  const shifts = storage.getShifts();
  const jobs = storage.getJobs();

  // Days of week
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Generate 30 days for September 2026
  // Sept 1 2026 was a Tuesday (day index 2)
  const totalDays = 30;
  const startDayOfWeek = 2; // Tuesday

  let calendarCellsHTML = '';

  // Empty padding cells for start of month
  for (let p = 0; p < startDayOfWeek; p++) {
    calendarCellsHTML += `<div class="calendar-day-cell bg-slate-950/40 opacity-40"></div>`;
  }

  // Days 1 to 30
  for (let day = 1; day <= totalDays; day++) {
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const dateStr = `2026-09-${dayStr}`;
    const isToday = day === 2; // Sept 2

    // Get jobs scheduled on this date
    const dayJobs = jobs.filter(j => j.scheduledDate === dateStr);
    const dayShifts = shifts.filter(s => s.date === dateStr);

    calendarCellsHTML += `
      <div class="calendar-day-cell ${isToday ? 'today' : ''}">
        <div class="flex items-center justify-between">
          <span class="day-number">${day}</span>
          ${dayJobs.length > 0 ? `
            <span class="text-2xs bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded-full font-bold border border-blue-500/30">
              ${dayJobs.length} ${dayJobs.length === 1 ? 'job' : 'jobs'}
            </span>
          ` : ''}
        </div>

        <div class="space-y-1 mt-1">
          ${technicians.map(tech => {
            const shiftObj = dayShifts.find(s => s.techId === tech.id);
            const shiftType = shiftObj ? shiftObj.shiftType : 'Off';
            const isOff = shiftType === 'Off';

            return `
              <div class="tech-shift-pill btn-edit-shift" 
                   data-tech-id="${tech.id}" 
                   data-tech-name="${tech.name}"
                   data-date="${dateStr}" 
                   data-shift="${shiftType}"
                   style="background-color: ${isOff ? 'rgba(30, 41, 59, 0.6)' : tech.color + '25'}; border: 1px solid ${isOff ? '#334155' : tech.color + '60'}; color: ${isOff ? '#94a3b8' : '#ffffff'};">
                <span class="font-bold">${tech.avatar}</span>
                <span class="truncate">${shiftType.split(' ')[0]}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  const html = `
    <div class="space-y-5">
      <!-- Calendar Title & Legend Header -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 class="text-xl font-bold text-white flex items-center gap-2">
            📅 Master Shift Calendar
            <span class="text-xs font-normal text-muted bg-slate-800 border border-slate-700 px-2.5 py-0.5 rounded-full">
              September 2026
            </span>
          </h2>
          <p class="text-xs text-muted">Click any technician shift badge to adjust duty hours & manage technician availability.</p>
        </div>

        <!-- Tech Color Legend -->
        <div class="flex items-center gap-3 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
          ${technicians.map(t => `
            <div class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${t.color}"></span>
              <span class="text-slate-300 font-medium">${t.name}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Main Calendar Component -->
      <div class="card p-3">
        <div class="calendar-grid">
          <!-- Day Headers -->
          ${daysOfWeek.map(d => `<div class="calendar-header-day">${d}</div>`).join('')}
          <!-- Calendar Day Cells -->
          ${calendarCellsHTML}
        </div>
      </div>
    </div>
  `;

  const container = document.getElementById('view-container');
  if (container) {
    container.innerHTML = html;
    attachCalendarEvents();
  }
}

function attachCalendarEvents() {
  document.querySelectorAll('.btn-edit-shift').forEach(pill => {
    pill.addEventListener('click', (e) => {
      const techId = e.currentTarget.getAttribute('data-tech-id');
      const techName = e.currentTarget.getAttribute('data-tech-name');
      const dateStr = e.currentTarget.getAttribute('data-date');
      const currentShift = e.currentTarget.getAttribute('data-shift');

      if (window.openShiftModal) {
        window.openShiftModal(techId, techName, dateStr, currentShift);
      }
    });
  });
}
