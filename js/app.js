// Main Application Entry Point & State Router for FixFlow CRM

import { storage } from './utils/storage.js';
import { formatCurrency, formatPhone, formatDate, getStatusBadgeHTML, getUrgencyBadgeHTML } from './utils/formatters.js';
import { renderHeader } from './components/header.js';
import { renderLoginScreen } from './components/login.js';
import { renderDispatcherDashboard } from './components/dispatcher.js';
import { renderTechnicianDashboard } from './components/technician.js';
import { renderCalendar } from './components/calendar.js';
import { renderAnalytics } from './components/analytics.js';
import { renderStaffManagement } from './components/staff.js';

let currentView = 'dispatcher';

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  renderApp();

  // Reactive state listener
  storage.subscribe((event, data) => {
    if (event === 'session_changed') {
      const session = storage.getSession();
      if (session) {
        currentView = session.role === 'technician' ? 'technician' : 'dispatcher';
      }
    }
    renderApp();
  });

  attachModalGlobalEvents();
}

function renderApp() {
  const session = storage.getSession();

  renderHeader();

  const desktopNav = document.getElementById('desktop-nav-bar');
  const mobileNav = document.getElementById('mobile-nav-bar');

  if (!session) {
    // UNAUTHENTICATED: Render Login Screen
    if (desktopNav) desktopNav.classList.add('hidden');
    if (mobileNav) mobileNav.style.display = 'none';
    renderLoginScreen();
    return;
  }

  // AUTHENTICATED: Build Role-Based Navigation
  if (session.role === 'technician') {
    // Technician: Strip desktop nav bar, render mobile view strictly
    if (desktopNav) desktopNav.classList.add('hidden');
    if (mobileNav) mobileNav.style.display = 'flex';
    currentView = 'technician';
    renderTechnicianDashboard();
    return;
  }

  // Owner or Dispatcher
  if (desktopNav) desktopNav.classList.remove('hidden');
  if (mobileNav) mobileNav.style.display = 'none';

  renderNavigationTabs(session.role);
  renderCurrentView();
}

function renderNavigationTabs(role) {
  const tabsContainer = document.getElementById('view-tabs');
  if (!tabsContainer) return;

  let tabsHTML = '';

  if (role === 'owner') {
    tabsHTML = `
      <div class="nav-tab ${currentView === 'dispatcher' ? 'active' : ''}" data-view="dispatcher">
        🎧 Dispatch Desk
      </div>
      <div class="nav-tab ${currentView === 'calendar' ? 'active' : ''}" data-view="calendar">
        📅 Month Shift Schedule
      </div>
      <div class="nav-tab ${currentView === 'staff' ? 'active' : ''}" data-view="staff">
        👥 Manage Staff
      </div>
      <div class="nav-tab ${currentView === 'analytics' ? 'active' : ''}" data-view="analytics">
        👑 Business Owner Analytics
      </div>
      <div class="nav-tab ${currentView === 'technician' ? 'active' : ''}" data-view="technician">
        🔧 Tech Mobile View
      </div>
    `;
  } else if (role === 'dispatcher') {
    // Dispatcher: Lock out Analytics and Manage Staff
    if (!['dispatcher', 'calendar'].includes(currentView)) {
      currentView = 'dispatcher';
    }
    tabsHTML = `
      <div class="nav-tab ${currentView === 'dispatcher' ? 'active' : ''}" data-view="dispatcher">
        🎧 Dispatch Desk
      </div>
      <div class="nav-tab ${currentView === 'calendar' ? 'active' : ''}" data-view="calendar">
        📅 Month Shift Schedule
      </div>
    `;
  }

  tabsContainer.innerHTML = tabsHTML;

  // Attach tab click listeners
  tabsContainer.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const view = e.currentTarget.getAttribute('data-view');
      if (view) {
        currentView = view;
        renderApp();
      }
    });
  });

  // Reset Data Button listener
  const resetBtn = document.getElementById('btn-reset-data');
  if (resetBtn) {
    resetBtn.onclick = () => {
      if (confirm('Reset all jobs, accounts, and shift data back to default demo state?')) {
        storage.resetData();
        showToast('Demo data reset successfully!');
      }
    };
  }
}

function renderCurrentView() {
  populateTechDropdowns();

  switch (currentView) {
    case 'dispatcher':
      renderDispatcherDashboard();
      break;
    case 'technician':
      renderTechnicianDashboard();
      break;
    case 'calendar':
      renderCalendar();
      break;
    case 'staff':
      renderStaffManagement();
      break;
    case 'analytics':
      renderAnalytics();
      break;
    default:
      renderDispatcherDashboard();
  }
}

function populateTechDropdowns() {
  const technicians = storage.getTechnicians();
  const select = document.getElementById('modal-assign-tech-select');
  if (select) {
    select.innerHTML = `<option value="">⚡ Available Pool (Unassigned)</option>` + 
      technicians.map(t => `<option value="${t.id}">${t.name} (${t.rating}★)</option>`).join('');
  }
}

/* Global Modals & Form Handlers */
function attachModalGlobalEvents() {
  // Close Modals
  document.querySelectorAll('.btn-close-modal, .modal-backdrop').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target === el || e.target.classList.contains('btn-close-modal')) {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
      }
    });
  });

  // New Job Form Submit
  const newJobForm = document.getElementById('form-new-job');
  if (newJobForm) {
    newJobForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(newJobForm);
      const jobData = {
        customerName: formData.get('customerName'),
        phone: formData.get('phone'),
        address: formData.get('address'),
        city: formData.get('city'),
        zipCode: formData.get('zipCode'),
        applianceType: formData.get('applianceType'),
        brand: formData.get('brand'),
        issueDescription: formData.get('issueDescription'),
        scheduledDate: formData.get('scheduledDate'),
        scheduledTimeWindow: formData.get('scheduledTimeWindow'),
        urgency: formData.get('urgency'),
        assignedTechId: formData.get('assignedTechId') || null
      };

      storage.saveJob(jobData);
      document.getElementById('modal-new-job').classList.remove('open');
      newJobForm.reset();
      showToast('New Repair Ticket created!');
    });
  }

  // Create Staff Form Submit
  const staffForm = document.getElementById('form-create-staff');
  if (staffForm) {
    staffForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(staffForm);
      const userData = {
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
        role: formData.get('role')
      };

      const res = storage.createUser(userData);
      if (res.success) {
        document.getElementById('modal-create-staff').classList.remove('open');
        staffForm.reset();

        // Show SMS Credential Modal
        const smsBox = document.getElementById('sms-credential-box');
        const smsText = `Hi ${res.user.name},\nHere are your FixFlow CRM login credentials:\n\nURL: http://localhost:8080\nRole: ${res.user.role.toUpperCase()}\nEmail: ${res.user.email}\nPassword: ${res.user.password}\n\nPlease save this message.`;
        
        if (smsBox) {
          smsBox.innerText = smsText;
        }

        const smsBtn = document.getElementById('btn-copy-sms');
        if (smsBtn) {
          smsBtn.onclick = () => {
            navigator.clipboard.writeText(smsText);
            showToast('Credentials copied to clipboard!');
          };
        }

        document.getElementById('modal-staff-created').classList.add('open');
      } else {
        alert(res.error);
      }
    });
  }

  // Billing Modal Recalculation & Submit
  const laborInput = document.getElementById('billing-labor-input');
  const partsInput = document.getElementById('billing-parts-input');
  if (laborInput && partsInput) {
    const updateCalc = () => {
      const labor = parseFloat(laborInput.value) || 0;
      const parts = parseFloat(partsInput.value) || 0;
      const tax = (labor + parts) * 0.0825;
      const total = labor + parts + tax;

      document.getElementById('calc-labor').textContent = formatCurrency(labor);
      document.getElementById('calc-parts').textContent = formatCurrency(parts);
      document.getElementById('calc-tax').textContent = formatCurrency(tax);
      document.getElementById('calc-total').textContent = formatCurrency(total);
    };

    laborInput.addEventListener('input', updateCalc);
    partsInput.addEventListener('input', updateCalc);
  }

  const billingForm = document.getElementById('form-billing');
  if (billingForm) {
    billingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(billingForm);
      const jobId = formData.get('jobId');
      const laborCost = parseFloat(formData.get('laborCost')) || 0;
      const partsCost = parseFloat(formData.get('partsCost')) || 0;
      const partsDesc = formData.get('partsDescription');
      const notes = formData.get('notes');

      const partsUsed = partsDesc ? [partsDesc] : [];

      storage.updateJobStatus(jobId, 'Completed', {
        laborCost,
        partsCost,
        partsUsed,
        notes
      });

      document.getElementById('modal-billing').classList.remove('open');
      showToast(`Ticket ${jobId} marked as COMPLETED! Invoice generated.`);
    });
  }

  // Shift Form Submit
  const shiftForm = document.getElementById('form-shift');
  if (shiftForm) {
    shiftForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(shiftForm);
      const techId = formData.get('techId');
      const dateStr = formData.get('date');
      const shiftType = formData.get('shiftType');

      storage.saveShift(techId, dateStr, shiftType);
      document.getElementById('modal-shift').classList.remove('open');
      showToast('Shift schedule updated!');
    });
  }
}

// Global modal triggers bound to window
window.openJobDetailModal = function(jobId) {
  const job = storage.getJobById(jobId);
  const technicians = storage.getTechnicians();
  if (!job) return;

  const tech = technicians.find(t => t.id === job.assignedTechId);
  const total = (job.laborCost || 0) + (job.partsCost || 0);

  document.getElementById('detail-job-id').textContent = job.id;
  document.getElementById('detail-job-body').innerHTML = `
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800">
        <div>
          <span class="text-muted">Status:</span> ${getStatusBadgeHTML(job.status)}
        </div>
        <div>
          ${getUrgencyBadgeHTML(job.urgency)}
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <span class="text-muted block text-2xs uppercase font-bold">Customer</span>
          <p class="font-bold text-white text-sm">${job.customerName}</p>
          <p class="text-blue-400 font-semibold">${formatPhone(job.phone)}</p>
        </div>

        <div>
          <span class="text-muted block text-2xs uppercase font-bold">Location</span>
          <p class="text-slate-200">${job.address}</p>
          <p class="text-slate-400">${job.city}, TX ${job.zipCode}</p>
        </div>
      </div>

      <div class="border-t border-slate-800 pt-2">
        <span class="text-muted block text-2xs uppercase font-bold">Appliance & Issue</span>
        <p class="font-bold text-white text-sm mt-0.5">${job.brand} ${job.applianceType}</p>
        <p class="text-slate-300 mt-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">${job.issueDescription}</p>
      </div>

      <div class="grid grid-cols-2 gap-3 border-t border-slate-800 pt-2">
        <div>
          <span class="text-muted block text-2xs uppercase font-bold">Assigned Tech</span>
          <p class="font-semibold text-slate-200">${tech ? tech.name : 'Unassigned'}</p>
        </div>
        <div>
          <span class="text-muted block text-2xs uppercase font-bold">Scheduled Window</span>
          <p class="font-semibold text-slate-200">${formatDate(job.scheduledDate)} (${job.scheduledTimeWindow})</p>
        </div>
      </div>

      ${job.status === 'Completed' ? `
        <div class="border-t border-slate-800 pt-2 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
          <span class="text-emerald-400 block text-2xs uppercase font-bold">Completed Billing</span>
          <div class="flex justify-between text-slate-200 mt-1">
            <span>Labor: ${formatCurrency(job.laborCost)}</span>
            <span>Parts: ${formatCurrency(job.partsCost)}</span>
          </div>
          <div class="text-right font-bold text-emerald-400 text-sm mt-1">
            Total Revenue: ${formatCurrency(total)}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById('modal-job-details').classList.add('open');
};

window.openBillingModal = function(jobId) {
  const job = storage.getJobById(jobId);
  if (!job) return;

  document.getElementById('billing-job-id').value = job.id;
  document.getElementById('billing-job-summary').textContent = `${job.id} - ${job.brand} ${job.applianceType} (${job.customerName})`;
  
  const modal = document.getElementById('modal-billing');
  modal.classList.add('open');
};

window.openShiftModal = function(techId, techName, dateStr, currentShift) {
  document.getElementById('shift-tech-id').value = techId;
  document.getElementById('shift-tech-name').textContent = techName;
  document.getElementById('shift-date-input').value = dateStr;
  document.getElementById('shift-date-display').textContent = formatDate(dateStr);
  document.getElementById('shift-type-select').value = currentShift;

  document.getElementById('modal-shift').classList.add('open');
};

function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>⚡</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}
