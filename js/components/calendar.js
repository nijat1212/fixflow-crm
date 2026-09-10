// Interactive Timeline & Schedule Matrix Calendar Component for FixFlow CRM
// Modeled after Housecall Pro / ServiceTitan field service dispatch matrices

import { storage } from '../utils/storage.js';

// Calendar View State
const calendarState = {
  currentDate: new Date(2026, 8, 10), // September 10, 2026 (or new Date())
  selectedDayIndex: 4, // 0 = Sun, 1 = Mon ... default to Thursday (Sep 10)
  viewMode: 'timeline', // 'timeline' | 'cards' | 'month'
  selectedTechId: 'all' // 'all' or techId
};

// Initialize to real current date if 2026 or later
const realNow = new Date();
if (realNow.getFullYear() >= 2026) {
  calendarState.currentDate = new Date(realNow);
  calendarState.selectedDayIndex = realNow.getDay();
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const APPLIANCE_ABBR = {
  'Refrigerator': 'Refr',
  'Washing Machine': 'Washer',
  'Dryer': 'Dryer',
  'Dishwasher': 'Dish',
  'Oven / Range': 'Oven',
  'Microwave': 'Micro',
  'Freezer': 'Freeze',
  'Garbage Disposal': 'Disp'
};

// Start and End hours for the matrix grid
const START_HOUR = 6;  // 6am
const END_HOUR = 19;   // 7pm
const SLOT_HEIGHT = 50; // px per hour slot

export function renderCalendar() {
  const container = document.getElementById('view-container');
  if (!container) return;

  const userRole = storage.getRole();
  const activeTechId = storage.getActiveTechId();
  const isTechnician = userRole === 'technician' && !!activeTechId;
  const technicians = storage.getTechnicians();
  const shifts = storage.getShifts();
  const jobs = storage.getJobs();

  let effectiveTechId = isTechnician ? activeTechId : calendarState.selectedTechId;
  const currentTech = isTechnician ? technicians.find(t => t.id === activeTechId) : null;

  // Render Top Controls Bar
  const controlsHTML = renderCalendarControls({
    isTechnician,
    currentTech,
    technicians,
    effectiveTechId
  });

  // Render Day Strip at Top (Sun - Sat)
  const sunday = getSundayOfWeek(calendarState.currentDate);
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    weekDays.push(d);
  }

  let bodyHTML = '';
  if (calendarState.viewMode === 'timeline') {
    bodyHTML = renderTimelineMatrix({
      weekDays,
      technicians,
      shifts,
      jobs,
      effectiveTechId,
      isTechnician
    });
  } else if (calendarState.viewMode === 'cards') {
    bodyHTML = renderSummaryCardsView({
      weekDays,
      technicians,
      shifts,
      jobs,
      effectiveTechId
    });
  } else {
    bodyHTML = renderMonthGridView({
      technicians,
      shifts,
      jobs,
      effectiveTechId
    });
  }

  container.innerHTML = `
    <div class="space-y-3">
      ${controlsHTML}
      ${bodyHTML}
    </div>
  `;

  attachCalendarListeners(weekDays);
}

// ── Controls Header ──────────────────────────────────────────────────────────
function renderCalendarControls({ isTechnician, currentTech, technicians, effectiveTechId }) {
  const date = calendarState.currentDate;
  const monthName = MONTH_NAMES[date.getMonth()];

  return `
    <div class="card p-3 bg-slate-900/90 border-slate-800 flex items-center justify-between flex-wrap gap-3">
      <!-- Left: Now Button & Month Dropdown -->
      <div class="flex items-center gap-3">
        <button id="btn-cal-now" class="calendar-nav-btn font-bold text-xs py-1.5 px-3 flex items-center gap-1.5 bg-blue-600/20 border-blue-500/40 text-blue-400 hover:bg-blue-600/30">
          <span>⚡</span>
          <span>Now</span>
        </button>

        <div class="flex items-center gap-1">
          <button id="btn-cal-prev-week" class="calendar-nav-btn py-1 px-2 text-xs">◀</button>
          <span class="text-base font-extrabold text-white px-2">
            ${monthName} ${date.getFullYear()}
          </span>
          <button id="btn-cal-next-week" class="calendar-nav-btn py-1 px-2 text-xs">▶</button>
        </div>
      </div>

      <!-- Right: Role & View Mode Switcher -->
      <div class="flex items-center gap-2">
        ${!isTechnician ? `
          <select id="select-cal-tech" class="form-control text-xs py-1 px-2.5 bg-slate-950 border-slate-800 text-white rounded-lg">
            <option value="all" ${effectiveTechId === 'all' ? 'selected' : ''}>👥 All Technicians</option>
            ${technicians.map(t => `
              <option value="${t.id}" ${effectiveTechId === t.id ? 'selected' : ''}>
                👤 ${t.name}
              </option>
            `).join('')}
          </select>
        ` : `
          <div class="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>${currentTech ? currentTech.name : 'Technician'} Schedule</span>
          </div>
        `}

        <div class="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          <button id="btn-mode-timeline" class="calendar-view-btn ${calendarState.viewMode === 'timeline' ? 'active' : ''}">
            ⏱ Timeline
          </button>
          <button id="btn-mode-cards" class="calendar-view-btn ${calendarState.viewMode === 'cards' ? 'active' : ''}">
            📋 List
          </button>
          <button id="btn-mode-month" class="calendar-view-btn ${calendarState.viewMode === 'month' ? 'active' : ''}">
            🗓 Month
          </button>
        </div>
      </div>
    </div>
  `;
}

// ── Timeline Matrix (Housecall Pro Style) ────────────────────────────────────
function renderTimelineMatrix({ weekDays, technicians, shifts, jobs, effectiveTechId }) {
  const currentHour = new Date().getHours();
  const todayStr = formatISO(new Date());

  // Top Days Strip HTML
  const daysStripHTML = `
    <div class="timeline-days-strip">
      <!-- Top Left Corner spacer -->
      <div></div>
      ${weekDays.map((d, i) => {
        const dateStr = formatISO(d);
        const isToday = dateStr === todayStr;
        const isSelected = i === calendarState.selectedDayIndex;

        // Count jobs for badge
        let dJobs = jobs.filter(j => j.scheduledDate === dateStr);
        if (effectiveTechId !== 'all') {
          dJobs = dJobs.filter(j => j.assignedTechId === effectiveTechId);
        }

        return `
          <div class="timeline-day-bubble ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}" data-day-index="${i}">
            <div class="timeline-day-num">${d.getDate()}</div>
            <div class="timeline-day-name">${DAY_SHORT[i]}</div>
            ${dJobs.length > 0 ? `
              <span class="text-3xs px-1 rounded bg-blue-500/20 text-blue-300 font-bold mt-0.5">
                ${dJobs.length}
              </span>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Left Hours Axis HTML
  const hoursList = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    hoursList.push(h);
  }

  const hoursAxisHTML = `
    <div class="timeline-hours-axis">
      ${hoursList.map(h => {
        const isCurrent = h === currentHour;
        const label = formatHourLabel(h);
        return `
          <div class="timeline-hour-label ${isCurrent ? 'current-hour' : ''}">
            ${label}
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Columns for the 7 Days
  const columnsHTML = weekDays.map((d, colIndex) => {
    const dateStr = formatISO(d);

    // Get jobs for this day
    let dayJobs = jobs.filter(j => j.scheduledDate === dateStr);
    if (effectiveTechId !== 'all') {
      dayJobs = dayJobs.filter(j => j.assignedTechId === effectiveTechId);
    }

    // Render empty slot background cells
    const slotCellsHTML = hoursList.map(h => `
      <div class="timeline-slot-cell" data-date="${dateStr}" data-hour="${h}" title="${formatHourLabel(h)} - Click to schedule"></div>
    `).join('');

    // Render positioned job blocks
    const jobBlocksHTML = dayJobs.map(job => {
      const timeInfo = parseTimeWindow(job.scheduledTimeWindow);
      const startH = Math.max(START_HOUR, timeInfo.startHour);
      const duration = Math.max(1, timeInfo.duration);

      const topPx = (startH - START_HOUR) * SLOT_HEIGHT + 3;
      const heightPx = duration * SLOT_HEIGHT - 6;

      // Color theme: vibrant blue or slate card matching the reference screenshot
      const tech = technicians.find(t => t.id === job.assignedTechId);
      const isBlue = job.brand === 'Whirlpool' || job.assignedTechId === 'tech_1';
      const bgStyle = isBlue 
        ? 'background: linear-gradient(135deg, #1d4ed8, #2563eb); border: 1px solid #60a5fa;'
        : 'background: #334155; border: 1px solid #475569;';

      const shortCust = formatShortCustomer(job.customerName);
      const shortAppliance = APPLIANCE_ABBR[job.applianceType] || (job.applianceType ? job.applianceType.slice(0, 4) : 'App');

      return `
        <div class="timeline-job-block"
             data-job-id="${job.id}"
             style="top: ${topPx}px; height: ${heightPx}px; left: 1px; right: 1px; ${bgStyle}"
             title="${job.customerName} - ${job.applianceType} (${job.scheduledTimeWindow})">
          
          <div class="font-extrabold text-2xs leading-tight truncate">
            ${shortCust}
          </div>
          <div class="text-3xs opacity-90 truncate leading-tight">
            ${shortAppliance}
          </div>
          <div class="text-3xs opacity-75 truncate mt-auto font-mono">
            ${job.scheduledTimeWindow ? job.scheduledTimeWindow.split(' ')[0] : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="timeline-day-col" data-col-index="${colIndex}">
        ${slotCellsHTML}
        ${jobBlocksHTML}
      </div>
    `;
  }).join('');

  return `
    <div class="timeline-matrix-container">
      ${daysStripHTML}
      <div class="timeline-body-wrap">
        ${hoursAxisHTML}
        <div class="timeline-days-grid">
          ${columnsHTML}
        </div>
      </div>
    </div>
  `;
}

// ── Summary Cards View (Fallback / Detailed view) ────────────────────────────
function renderSummaryCardsView({ weekDays, technicians, shifts, jobs, effectiveTechId }) {
  return `
    <div class="grid grid-cols-1 md:grid-cols-7 gap-3">
      ${weekDays.map((d, i) => {
        const dateStr = formatISO(d);
        let dayJobs = jobs.filter(j => j.scheduledDate === dateStr);
        if (effectiveTechId !== 'all') {
          dayJobs = dayJobs.filter(j => j.assignedTechId === effectiveTechId);
        }

        return `
          <div class="card p-3 bg-slate-900 border-slate-800">
            <div class="flex items-center justify-between mb-2">
              <span class="font-bold text-white text-xs">${DAY_SHORT[i]} ${d.getDate()}</span>
              <span class="text-2xs font-bold text-blue-400">${dayJobs.length} jobs</span>
            </div>
            <div class="space-y-2">
              ${dayJobs.map(j => `
                <div class="calendar-job-card cursor-pointer" data-job-id="${j.id}">
                  <p class="font-bold text-white text-xs truncate">${j.customerName}</p>
                  <p class="text-2xs text-slate-300 truncate">${j.applianceType} • ${j.scheduledTimeWindow}</p>
                </div>
              `).join('')}
              ${dayJobs.length === 0 ? `<p class="text-3xs text-muted text-center py-4">No jobs</p>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ── Month Grid View ──────────────────────────────────────────────────────────
function renderMonthGridView({ technicians, shifts, jobs, effectiveTechId }) {
  const date = calendarState.currentDate;
  const year = date.getFullYear();
  const month = date.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const startDay = new Date(year, month, 1).getDay();

  let cells = '';
  for (let p = 0; p < startDay; p++) {
    cells += `<div class="calendar-day-cell bg-slate-950/40 opacity-30"></div>`;
  }
  for (let day = 1; day <= totalDays; day++) {
    const curDate = new Date(year, month, day);
    const dateStr = formatISO(curDate);
    let dJobs = jobs.filter(j => j.scheduledDate === dateStr);
    if (effectiveTechId !== 'all') {
      dJobs = dJobs.filter(j => j.assignedTechId === effectiveTechId);
    }

    cells += `
      <div class="calendar-day-cell">
        <div class="flex items-center justify-between mb-1">
          <span class="day-number">${day}</span>
          ${dJobs.length > 0 ? `<span class="text-2xs font-bold text-blue-400">${dJobs.length}</span>` : ''}
        </div>
        <div class="space-y-1">
          ${dJobs.slice(0, 2).map(j => `
            <div class="calendar-job-card text-2xs truncate py-0.5 px-1 font-semibold" data-job-id="${j.id}">
              ${j.customerName}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  return `
    <div class="card p-3">
      <div class="calendar-grid">
        ${DAY_SHORT.map(d => `<div class="calendar-header-day">${d}</div>`).join('')}
        ${cells}
      </div>
    </div>
  `;
}

// ── Event Listeners ──────────────────────────────────────────────────────────
function attachCalendarListeners(weekDays) {
  // Now button
  const btnNow = document.getElementById('btn-cal-now');
  if (btnNow) {
    btnNow.addEventListener('click', () => {
      calendarState.currentDate = new Date(2026, 8, 10);
      calendarState.selectedDayIndex = 4; // Thursday
      renderCalendar();
    });
  }

  // Prev / Next Week
  const btnPrev = document.getElementById('btn-cal-prev-week');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      calendarState.currentDate.setDate(calendarState.currentDate.getDate() - 7);
      renderCalendar();
    });
  }

  const btnNext = document.getElementById('btn-cal-next-week');
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      calendarState.currentDate.setDate(calendarState.currentDate.getDate() + 7);
      renderCalendar();
    });
  }

  // Mode buttons
  const btnTimeline = document.getElementById('btn-mode-timeline');
  if (btnTimeline) {
    btnTimeline.addEventListener('click', () => {
      calendarState.viewMode = 'timeline';
      renderCalendar();
    });
  }

  const btnCards = document.getElementById('btn-mode-cards');
  if (btnCards) {
    btnCards.addEventListener('click', () => {
      calendarState.viewMode = 'cards';
      renderCalendar();
    });
  }

  const btnMonth = document.getElementById('btn-mode-month');
  if (btnMonth) {
    btnMonth.addEventListener('click', () => {
      calendarState.viewMode = 'month';
      renderCalendar();
    });
  }

  // Day Bubble clicks in top strip
  document.querySelectorAll('.timeline-day-bubble').forEach(bubble => {
    bubble.addEventListener('click', () => {
      const idx = parseInt(bubble.getAttribute('data-day-index'), 10);
      calendarState.selectedDayIndex = idx;
      if (weekDays[idx]) {
        calendarState.currentDate = new Date(weekDays[idx]);
      }
      renderCalendar();
    });
  });

  // Technician filter
  const selectTech = document.getElementById('select-cal-tech');
  if (selectTech) {
    selectTech.addEventListener('change', (e) => {
      calendarState.selectedTechId = e.target.value;
      renderCalendar();
    });
  }

  // Job card/block clicks
  document.querySelectorAll('.timeline-job-block, .calendar-job-card').forEach(block => {
    block.addEventListener('click', (e) => {
      e.stopPropagation();
      const jobId = block.getAttribute('data-job-id');
      if (jobId && window.openJobDetailModal) {
        window.openJobDetailModal(jobId);
      }
    });
  });

  // Empty slot clicks -> opens new job modal with preselected time
  document.querySelectorAll('.timeline-slot-cell').forEach(slot => {
    slot.addEventListener('click', () => {
      const date = slot.getAttribute('data-date');
      const hour = parseInt(slot.getAttribute('data-hour'), 10);
      const modal = document.getElementById('modal-new-job');
      if (modal) {
        const dateInput = modal.querySelector('input[name="scheduledDate"]');
        if (dateInput) dateInput.value = date;
        modal.classList.add('open');
      }
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getSundayOfWeek(d) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0 is Sun
  date.setDate(date.getDate() - day);
  return date;
}

function formatISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatHourLabel(h) {
  if (h === 0 || h === 24) return '12am';
  if (h === 12) return '12pm';
  if (h > 12) return `${h - 12}pm`;
  return `${h}am`;
}

function formatShortCustomer(fullName) {
  if (!fullName) return 'Customer';
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

function parseTimeWindow(timeWindow) {
  if (!timeWindow) return { startHour: 9, duration: 2 };
  const parts = timeWindow.split('-').map(s => s.trim());
  if (parts.length < 2) return { startHour: 9, duration: 2 };

  function toHour(str) {
    const m = str.match(/(\d+):?(\d+)?\s*(AM|PM)?/i);
    if (!m) return 9;
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const period = (m[3] || '').toUpperCase();
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h + (min >= 30 ? 0.5 : 0);
  }

  const start = toHour(parts[0]);
  const end = toHour(parts[1]);
  const duration = Math.max(1, end - start);
  return { startHour: start, duration };
}
