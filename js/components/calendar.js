// Interactive Week & Month Dispatch Schedule Calendar Component for FixFlow CRM
// Supports Technician View (My daily jobs & shifts) & Dispatcher/Owner View (Master schedule)

import { storage } from '../utils/storage.js';
import { getStatusBadgeHTML } from '../utils/formatters.js';

// Calendar View State
const calendarState = {
  currentDate: new Date(2026, 8, 10), // Set to current project date (September 10, 2026)
  viewMode: 'week', // 'week' | 'month'
  selectedTechId: 'all' // 'all' or specific techId
};

// Ensure state date initializes to current date if later than Sept 2026
const realNow = new Date();
if (realNow.getFullYear() >= 2026) {
  calendarState.currentDate = new Date(realNow);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function renderCalendar() {
  const container = document.getElementById('view-container');
  if (!container) return;

  const userRole = storage.getRole();
  const activeTechId = storage.getActiveTechId();
  const isTechnician = userRole === 'technician' && !!activeTechId;
  const technicians = storage.getTechnicians();
  const shifts = storage.getShifts();
  const jobs = storage.getJobs();

  // If logged in as technician, enforce viewing only their own jobs
  let effectiveTechId = isTechnician ? activeTechId : calendarState.selectedTechId;
  const currentTech = isTechnician ? technicians.find(t => t.id === activeTechId) : null;

  // Render Header & Controls
  const headerHTML = renderCalendarHeader({
    isTechnician,
    currentTech,
    technicians,
    effectiveTechId
  });

  // Render Body according to viewMode
  let bodyHTML = '';
  if (calendarState.viewMode === 'week') {
    bodyHTML = renderWeekView({
      technicians,
      shifts,
      jobs,
      isTechnician,
      effectiveTechId
    });
  } else {
    bodyHTML = renderMonthView({
      technicians,
      shifts,
      jobs,
      isTechnician,
      effectiveTechId
    });
  }

  container.innerHTML = `
    <div class="space-y-4">
      ${headerHTML}
      ${bodyHTML}
    </div>
  `;

  attachCalendarListeners();
}

// ── Header & Navigation Controls ─────────────────────────────────────────────
function renderCalendarHeader({ isTechnician, currentTech, technicians, effectiveTechId }) {
  const date = calendarState.currentDate;
  let dateTitle = '';

  if (calendarState.viewMode === 'week') {
    const monday = getMonday(date);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const monMonth = MONTH_NAMES[monday.getMonth()].slice(0, 3);
    const sunMonth = MONTH_NAMES[sunday.getMonth()].slice(0, 3);

    if (monday.getMonth() === sunday.getMonth()) {
      dateTitle = `${monMonth} ${monday.getDate()} – ${sunday.getDate()}, ${monday.getFullYear()}`;
    } else {
      dateTitle = `${monMonth} ${monday.getDate()} – ${sunMonth} ${sunday.getDate()}, ${sunday.getFullYear()}`;
    }
  } else {
    dateTitle = `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
  }

  return `
    <div class="card p-4 space-y-3 bg-slate-900/90 border-slate-800">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <!-- Title & Role Info -->
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-extrabold text-white flex items-center gap-2">
              📅 Dispatch & Jobs Calendar
            </h2>
            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full ${isTechnician ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}">
              ${isTechnician ? '🔧 Tech Schedule' : '🎧 Master Dispatch'}
            </span>
          </div>
          <p class="text-xs text-muted mt-0.5">
            ${isTechnician && currentTech ? `Logged in as <strong>${currentTech.name}</strong> • Showing your scheduled service tickets` : 'Interactive weekly & monthly dispatch scheduling'}
          </p>
        </div>

        <!-- Navigation Buttons -->
        <div class="flex items-center gap-2">
          <div class="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button id="btn-cal-prev" class="calendar-nav-btn" style="padding: 0.35rem 0.65rem; font-size: 0.75rem;">
              ◀ Prev
            </button>
            <button id="btn-cal-today" class="calendar-nav-btn" style="padding: 0.35rem 0.65rem; font-size: 0.75rem; color: #60a5fa;">
              Today
            </button>
            <button id="btn-cal-next" class="calendar-nav-btn" style="padding: 0.35rem 0.65rem; font-size: 0.75rem;">
              Next ▶
            </button>
          </div>

          <div class="px-3 py-1.5 bg-slate-950 rounded-xl border border-slate-800 font-bold text-white text-xs min-w-[170px] text-center">
            ${dateTitle}
          </div>
        </div>

        <!-- View Toggle & Technician Selector -->
        <div class="flex items-center gap-2">
          <!-- Week / Month Switcher -->
          <div class="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button id="btn-view-week" class="calendar-view-btn ${calendarState.viewMode === 'week' ? 'active' : ''}">
              📅 Week
            </button>
            <button id="btn-view-month" class="calendar-view-btn ${calendarState.viewMode === 'month' ? 'active' : ''}">
              🗓 Month
            </button>
          </div>

          <!-- Tech Filter Dropdown (Hidden or Disabled for Technicians) -->
          ${!isTechnician ? `
            <select id="select-cal-tech-filter" class="form-control text-xs py-1.5 px-3 bg-slate-950 border-slate-800 text-white rounded-xl">
              <option value="all" ${effectiveTechId === 'all' ? 'selected' : ''}>👥 All Technicians</option>
              ${technicians.map(t => `
                <option value="${t.id}" ${effectiveTechId === t.id ? 'selected' : ''}>
                  👤 ${t.name}
                </option>
              `).join('')}
            </select>
          ` : `
            <div class="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>My Jobs Only</span>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

// ── Week View (7 Days: Mon - Sun) ────────────────────────────────────────────
function renderWeekView({ technicians, shifts, jobs, isTechnician, effectiveTechId }) {
  const monday = getMonday(calendarState.currentDate);
  const todayStr = formatISO(new Date());

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDays.push(d);
  }

  const columnsHTML = weekDays.map((d, index) => {
    const dateStr = formatISO(d);
    const isToday = dateStr === todayStr;
    const dayName = DAY_NAMES[index];
    const shortMonth = MONTH_NAMES[d.getMonth()].slice(0, 3);
    const dayNum = d.getDate();

    // Filter jobs for this date and technician
    let dayJobs = jobs.filter(j => j.scheduledDate === dateStr);
    if (effectiveTechId !== 'all') {
      dayJobs = dayJobs.filter(j => j.assignedTechId === effectiveTechId);
    }

    // Sort jobs by scheduledTimeWindow
    dayJobs.sort((a, b) => (a.scheduledTimeWindow || '').localeCompare(b.scheduledTimeWindow || ''));

    // Shifts on this date
    const dayShifts = shifts.filter(s => s.date === dateStr);

    return `
      <div class="calendar-week-col ${isToday ? 'today' : ''}">
        <!-- Day Header -->
        <div class="calendar-col-header ${isToday ? 'today' : ''}">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-bold uppercase tracking-wider ${isToday ? 'text-blue-400 font-extrabold' : 'text-slate-400'}">
              ${dayName.slice(0, 3)}
            </span>
            ${isToday ? `
              <span class="px-1.5 py-0.2 text-2xs bg-blue-500 text-white font-black rounded uppercase tracking-wider">
                TODAY
              </span>
            ` : ''}
          </div>

          <div class="flex items-baseline justify-between">
            <div class="text-lg font-black text-white">
              ${dayNum} <span class="text-xs font-normal text-slate-400">${shortMonth}</span>
            </div>

            <!-- Job Count Badge -->
            <div>
              ${dayJobs.length === 0 ? `
                <span class="px-2 py-0.5 rounded-full text-2xs font-semibold bg-slate-800 text-slate-400 border border-slate-700/50">
                  0 jobs
                </span>
              ` : dayJobs.length === 1 ? `
                <span class="px-2 py-0.5 rounded-full text-2xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  1 job
                </span>
              ` : `
                <span class="px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  ${dayJobs.length} jobs
                </span>
              `}
            </div>
          </div>

          <!-- Shift pill for day -->
          <div class="mt-2 pt-2 border-t border-slate-800/80">
            ${renderDayShiftInfo({
              isTechnician,
              effectiveTechId,
              technicians,
              dayShifts,
              dateStr
            })}
          </div>
        </div>

        <!-- Day Body (List of Jobs) -->
        <div class="calendar-col-body">
          ${dayJobs.length === 0 ? `
            <div class="flex flex-col items-center justify-center py-10 text-center opacity-60">
              <span class="text-2xl mb-1">☕</span>
              <p class="text-xs text-slate-400 font-medium">No jobs scheduled</p>
            </div>
          ` : `
            <div class="space-y-2">
              ${dayJobs.map(job => renderJobCard(job, technicians, effectiveTechId)).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="calendar-week-grid">
      ${columnsHTML}
    </div>
  `;
}

// ── Job Card in Week Column ──────────────────────────────────────────────────
function renderJobCard(job, technicians, effectiveTechId) {
  const tech = technicians.find(t => t.id === job.assignedTechId);
  const statusKey = (job.status || 'scheduled').toLowerCase().replace(/\s+/g, '_');
  const statusCls = `status-${statusKey}`;

  return `
    <div class="calendar-job-card ${statusCls}" data-job-id="${job.id}">
      <!-- Header: ID + Time Window -->
      <div class="flex items-center justify-between gap-1 mb-1">
        <span class="font-mono font-bold text-blue-400 text-2xs">${job.id}</span>
        <span class="text-2xs font-semibold px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-300">
          ⏰ ${job.scheduledTimeWindow || 'TBD'}
        </span>
      </div>

      <!-- Customer Name & Appliance -->
      <div class="font-bold text-white text-xs truncate">
        ${job.customerName || 'Customer'}
      </div>
      <div class="text-2xs text-slate-300 font-medium truncate flex items-center gap-1 mt-0.5">
        <span>🔧</span>
        <span class="truncate">${job.brand ? job.brand + ' ' : ''}${job.applianceType || 'Appliance'}</span>
      </div>

      <!-- Address -->
      <div class="text-2xs text-slate-400 truncate flex items-center gap-1 mt-1">
        <span>📍</span>
        <span class="truncate">${job.address || job.city || 'Austin, TX'}</span>
      </div>

      <!-- Footer: Status Badge + Technician if All view -->
      <div class="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between gap-1 flex-wrap">
        <div>
          ${getStatusBadgeHTML(job.status)}
        </div>
        ${effectiveTechId === 'all' && tech ? `
          <span class="text-2xs font-bold text-white px-1.5 py-0.5 rounded flex items-center gap-1" style="background-color: ${tech.color}30; border: 1px solid ${tech.color}60;">
            <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${tech.color};"></span>
            <span>${tech.avatar}</span>
          </span>
        ` : ''}
      </div>
    </div>
  `;
}

// ── Shift Info inside Column Header ──────────────────────────────────────────
function renderDayShiftInfo({ isTechnician, effectiveTechId, technicians, dayShifts, dateStr }) {
  if (isTechnician || effectiveTechId !== 'all') {
    const techId = isTechnician ? effectiveTechId : effectiveTechId;
    const shift = dayShifts.find(s => s.techId === techId);
    const shiftText = shift ? shift.shiftType : '8:00 AM - 5:00 PM';
    const isOff = shiftText.toLowerCase() === 'off';

    return `
      <div class="flex items-center justify-between text-2xs ${isOff ? 'text-slate-500' : 'text-emerald-400'} font-semibold">
        <span>Shift:</span>
        <span class="px-1.5 py-0.2 rounded ${isOff ? 'bg-slate-800 text-slate-400' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}">
          ${shiftText}
        </span>
      </div>
    `;
  }

  // All Technicians view: show shift pills clickable for modal edit
  return `
    <div class="flex items-center gap-1 flex-wrap">
      ${technicians.slice(0, 3).map(tech => {
        const shiftObj = dayShifts.find(s => s.techId === tech.id);
        const shiftType = shiftObj ? shiftObj.shiftType : '8am-5pm';
        const isOff = shiftType.toLowerCase() === 'off';

        return `
          <div class="tech-shift-pill btn-edit-shift cursor-pointer" 
               data-tech-id="${tech.id}" 
               data-tech-name="${tech.name}"
               data-date="${dateStr}" 
               data-shift="${shiftType}"
               title="${tech.name}: ${shiftType}"
               style="background-color: ${isOff ? '#1e293b' : tech.color + '25'}; border: 1px solid ${isOff ? '#334155' : tech.color + '60'}; color: ${isOff ? '#94a3b8' : '#ffffff'};">
            <span class="font-bold">${tech.avatar}</span>
            <span class="truncate text-2xs">${isOff ? 'Off' : shiftType.split(' ')[0]}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ── Month View ───────────────────────────────────────────────────────────────
function renderMonthView({ technicians, shifts, jobs, isTechnician, effectiveTechId }) {
  const date = calendarState.currentDate;
  const year = date.getFullYear();
  const month = date.getMonth();
  const todayStr = formatISO(new Date());

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sun
  // Convert so Monday is 0:
  const startOffset = (firstDayIndex === 0 ? 6 : firstDayIndex - 1);
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  let cellsHTML = '';

  // Padding cells before first day
  for (let p = 0; p < startOffset; p++) {
    cellsHTML += `<div class="calendar-day-cell bg-slate-950/40 opacity-30"></div>`;
  }

  // Month days
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const currentDayDate = new Date(year, month, day);
    const dateStr = formatISO(currentDayDate);
    const isToday = dateStr === todayStr;

    let dayJobs = jobs.filter(j => j.scheduledDate === dateStr);
    if (effectiveTechId !== 'all') {
      dayJobs = dayJobs.filter(j => j.assignedTechId === effectiveTechId);
    }
    const dayShifts = shifts.filter(s => s.date === dateStr);

    cellsHTML += `
      <div class="calendar-day-cell ${isToday ? 'today' : ''}">
        <div class="flex items-center justify-between mb-1">
          <span class="day-number ${isToday ? 'text-blue-400 font-extrabold' : ''}">${day}</span>
          ${dayJobs.length > 0 ? `
            <span class="text-2xs bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded-full font-bold border border-blue-500/30">
              ${dayJobs.length} ${dayJobs.length === 1 ? 'job' : 'jobs'}
            </span>
          ` : ''}
        </div>

        <!-- Mini job badges in month cell -->
        <div class="space-y-1 overflow-hidden">
          ${dayJobs.slice(0, 2).map(job => `
            <div class="calendar-job-card py-1 px-1.5 text-2xs truncate font-medium cursor-pointer" data-job-id="${job.id}" title="${job.customerName} - ${job.scheduledTimeWindow}">
              <span class="text-blue-400 font-bold">${job.scheduledTimeWindow ? job.scheduledTimeWindow.split(' ')[0] : 'Job'}</span>
              <span class="text-white truncate ml-1">${job.customerName}</span>
            </div>
          `).join('')}
          ${dayJobs.length > 2 ? `
            <div class="text-2xs text-muted text-center font-bold">
              +${dayJobs.length - 2} more
            </div>
          ` : ''}
        </div>

        <!-- Shifts in month cell -->
        <div class="mt-auto pt-1">
          ${renderDayShiftInfo({ isTechnician, effectiveTechId, technicians, dayShifts, dateStr })}
        </div>
      </div>
    `;
  }

  return `
    <div class="card p-3">
      <div class="calendar-grid">
        ${DAY_SHORT.map(d => `<div class="calendar-header-day">${d}</div>`).join('')}
        ${cellsHTML}
      </div>
    </div>
  `;
}

// ── Event Listeners ──────────────────────────────────────────────────────────
function attachCalendarListeners() {
  // Prev button
  const btnPrev = document.getElementById('btn-cal-prev');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (calendarState.viewMode === 'week') {
        calendarState.currentDate.setDate(calendarState.currentDate.getDate() - 7);
      } else {
        calendarState.currentDate.setMonth(calendarState.currentDate.getMonth() - 1);
      }
      renderCalendar();
    });
  }

  // Next button
  const btnNext = document.getElementById('btn-cal-next');
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (calendarState.viewMode === 'week') {
        calendarState.currentDate.setDate(calendarState.currentDate.getDate() + 7);
      } else {
        calendarState.currentDate.setMonth(calendarState.currentDate.getMonth() + 1);
      }
      renderCalendar();
    });
  }

  // Today button
  const btnToday = document.getElementById('btn-cal-today');
  if (btnToday) {
    btnToday.addEventListener('click', () => {
      calendarState.currentDate = new Date();
      // If current real date is earlier than 2026, keep in Sept 2026 for demo data
      if (calendarState.currentDate.getFullYear() < 2026) {
        calendarState.currentDate = new Date(2026, 8, 10);
      }
      renderCalendar();
    });
  }

  // Week view toggle
  const btnWeek = document.getElementById('btn-view-week');
  if (btnWeek) {
    btnWeek.addEventListener('click', () => {
      calendarState.viewMode = 'week';
      renderCalendar();
    });
  }

  // Month view toggle
  const btnMonth = document.getElementById('btn-view-month');
  if (btnMonth) {
    btnMonth.addEventListener('click', () => {
      calendarState.viewMode = 'month';
      renderCalendar();
    });
  }

  // Tech filter select
  const selectTech = document.getElementById('select-cal-tech-filter');
  if (selectTech) {
    selectTech.addEventListener('change', (e) => {
      calendarState.selectedTechId = e.target.value;
      renderCalendar();
    });
  }

  // Job cards click -> open modal
  document.querySelectorAll('.calendar-job-card').forEach(card => {
    card.addEventListener('click', () => {
      const jobId = card.getAttribute('data-job-id');
      if (jobId && window.openJobDetailModal) {
        window.openJobDetailModal(jobId);
      }
    });
  });

  // Shift badges click -> open shift modal
  document.querySelectorAll('.btn-edit-shift').forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const techId = pill.getAttribute('data-tech-id');
      const techName = pill.getAttribute('data-tech-name');
      const dateStr = pill.getAttribute('data-date');
      const currentShift = pill.getAttribute('data-shift');

      if (window.openShiftModal) {
        window.openShiftModal(techId, techName, dateStr, currentShift);
      }
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getMonday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

function formatISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
