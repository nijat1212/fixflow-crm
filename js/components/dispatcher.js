// Dispatcher Dashboard Component for FixFlow CRM

import { storage } from '../utils/storage.js';
import { formatPhone, formatDate, getStatusBadgeHTML, getUrgencyBadgeHTML } from '../utils/formatters.js';

export function renderDispatcherDashboard() {
  const jobs = storage.getJobs();
  const technicians = storage.getTechnicians();

  const availableJobs = jobs.filter(j => j.status === 'Available');
  const activeJobs = jobs.filter(j => ['Assigned', 'Accepted', 'In Route', 'On Site', 'Waiting for Parts'].includes(j.status));
  const completedJobs = jobs.filter(j => j.status === 'Completed');

  const html = `
    <div class="space-y-6">
      <!-- Top Action & Overview Row -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 class="text-xl font-bold text-white flex items-center gap-2">
            🎧 Dispatch Control Desk
            <span class="text-xs font-normal text-muted bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">
              ${jobs.length} Total Tickets
            </span>
          </h2>
          <p class="text-xs text-muted">Manage incoming repair calls, assign field technicians & monitor job pipelines.</p>
        </div>

        <button id="btn-create-job-main" class="btn btn-primary">
          <span>⚡ Create Repair Ticket</span>
        </button>
      </div>

      <!-- Quick Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="card flex items-center justify-between border-l-4 border-l-amber-500">
          <div>
            <p class="text-2xs uppercase text-muted font-bold tracking-wider">Available Pool</p>
            <h3 class="text-2xl font-bold text-amber-400 mt-1">${availableJobs.length}</h3>
            <p class="text-xs text-subtle">Unassigned tickets</p>
          </div>
          <div class="text-2xl opacity-60">⚡</div>
        </div>

        <div class="card flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <p class="text-2xs uppercase text-muted font-bold tracking-wider">In Progress</p>
            <h3 class="text-2xl font-bold text-blue-400 mt-1">${activeJobs.length}</h3>
            <p class="text-xs text-subtle">Field techs active</p>
          </div>
          <div class="text-2xl opacity-60">🔧</div>
        </div>

        <div class="card flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <p class="text-2xs uppercase text-muted font-bold tracking-wider">Completed Today</p>
            <h3 class="text-2xl font-bold text-emerald-400 mt-1">${completedJobs.length}</h3>
            <p class="text-xs text-subtle">Closed service calls</p>
          </div>
          <div class="text-2xl opacity-60">✅</div>
        </div>

        <div class="card flex items-center justify-between border-l-4 border-l-purple-500">
          <div>
            <p class="text-2xs uppercase text-muted font-bold tracking-wider">Active Techs</p>
            <h3 class="text-2xl font-bold text-purple-400 mt-1">${technicians.length}</h3>
            <p class="text-xs text-subtle">On duty today</p>
          </div>
          <div class="text-2xl opacity-60">👥</div>
        </div>
      </div>

      <!-- Unassigned Pool Section (Available Jobs) -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <h3 class="text-base font-bold text-amber-400">Available Jobs Pool</h3>
            <span class="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-300 rounded-full font-semibold border border-amber-500/30">
              ${availableJobs.length} Ready for Dispatch
            </span>
          </div>
          <p class="text-xs text-muted">Technicians can self-claim these from mobile or Dispatchers can assign below.</p>
        </div>

        ${availableJobs.length === 0 ? `
          <div class="text-center py-8 text-muted border border-dashed border-slate-700 rounded-lg">
            <p class="text-sm">🎉 All incoming jobs have been assigned to technicians!</p>
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${availableJobs.map(job => renderAvailableJobCard(job, technicians)).join('')}
          </div>
        `}
      </div>

      <!-- All Tickets Table & Search Bar -->
      <div class="card">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 class="text-base font-bold text-white">All Repair Tickets</h3>
          <div class="flex items-center gap-2 flex-1 max-w-md">
            <input type="text" id="job-search-input" class="form-control" placeholder="Search by customer, Zip Code, brand, or job ID...">
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-slate-700 text-muted uppercase text-2xs tracking-wider">
                <th class="py-2.5 px-3">Job ID</th>
                <th class="py-2.5 px-3">Customer</th>
                <th class="py-2.5 px-3">Location & Zip</th>
                <th class="py-2.5 px-3">Appliance</th>
                <th class="py-2.5 px-3">Urgency</th>
                <th class="py-2.5 px-3">Assigned Tech</th>
                <th class="py-2.5 px-3">Status</th>
                <th class="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="dispatcher-jobs-tbody" class="divide-y divide-slate-800 text-slate-300">
              ${jobs.map(job => renderJobTableRow(job, technicians)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const container = document.getElementById('view-container');
  if (container) {
    container.innerHTML = html;
    attachDispatcherEvents();
  }
}

function renderAvailableJobCard(job, technicians) {
  return `
    <div class="bg-slate-900/90 border border-amber-500/30 rounded-xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
      <div class="absolute top-0 right-0 bg-amber-500 text-slate-950 font-bold text-2xs px-2 py-0.5 rounded-bl">
        UNASSIGNED
      </div>
      
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-amber-400">${job.id}</span>
          ${getUrgencyBadgeHTML(job.urgency)}
        </div>
        
        <h4 class="font-bold text-white text-sm mb-1">${job.brand} ${job.applianceType}</h4>
        <p class="text-xs text-slate-300 mb-2 line-clamp-2">${job.issueDescription}</p>

        <div class="text-2xs text-muted space-y-1 mb-3 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
          <div class="flex items-center gap-1">
            <span>👤</span> <strong class="text-slate-200">${job.customerName}</strong>
          </div>
          <div class="flex items-center gap-1">
            <span>📍</span> <span>${job.address}, ${job.zipCode}</span>
          </div>
          <div class="flex items-center gap-1">
            <span>📅</span> <span>${formatDate(job.scheduledDate)} (${job.scheduledTimeWindow})</span>
          </div>
        </div>
      </div>

      <div class="pt-2 border-t border-slate-800 flex items-center gap-2">
        <select class="form-control text-xs py-1 select-direct-assign" data-job-id="${job.id}">
          <option value="">-- Assign Tech --</option>
          ${technicians.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
        </select>
        <button class="btn btn-primary btn-sm btn-confirm-assign" data-job-id="${job.id}">
          Dispatch
        </button>
      </div>
    </div>
  `;
}

function renderJobTableRow(job, technicians) {
  const tech = technicians.find(t => t.id === job.assignedTechId);
  return `
    <tr class="hover:bg-slate-800/40 transition-colors">
      <td class="py-3 px-3 font-mono font-bold text-blue-400">${job.id}</td>
      <td class="py-3 px-3">
        <div class="font-semibold text-white">${job.customerName}</div>
        <div class="text-muted text-2xs">${formatPhone(job.phone)}</div>
      </td>
      <td class="py-3 px-3">
        <div>${job.city}, TX</div>
        <div class="text-muted text-2xs font-mono">Zip: ${job.zipCode}</div>
      </td>
      <td class="py-3 px-3">
        <div class="font-medium text-slate-200">${job.applianceType}</div>
        <div class="text-muted text-2xs">${job.brand}</div>
      </td>
      <td class="py-3 px-3">${getUrgencyBadgeHTML(job.urgency)}</td>
      <td class="py-3 px-3">
        ${tech ? `
          <span class="inline-flex items-center gap-1 text-xs font-semibold text-slate-200">
            <span class="w-2 h-2 rounded-full inline-block" style="background-color: ${tech.color}"></span>
            ${tech.name}
          </span>
        ` : `<span class="text-amber-400 font-semibold text-2xs">Unassigned</span>`}
      </td>
      <td class="py-3 px-3">${getStatusBadgeHTML(job.status)}</td>
      <td class="py-3 px-3 text-right">
        <button class="btn btn-secondary btn-sm btn-view-job-details" data-job-id="${job.id}">
          View Ticket
        </button>
      </td>
    </tr>
  `;
}

function attachDispatcherEvents() {
  // Main Create Job Button
  const createBtn = document.getElementById('btn-create-job-main');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      const modal = document.getElementById('modal-new-job');
      if (modal) modal.classList.add('open');
    });
  }

  // Direct Assign Button in Available Pool
  document.querySelectorAll('.btn-confirm-assign').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const jobId = e.currentTarget.getAttribute('data-job-id');
      const select = document.querySelector(`.select-direct-assign[data-job-id="${jobId}"]`);
      if (select && select.value) {
        storage.claimJob(jobId, select.value);
      } else {
        alert('Please select a technician to dispatch this job to.');
      }
    });
  });

  // Search Filter
  const searchInput = document.getElementById('job-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const rows = document.querySelectorAll('#dispatcher-jobs-tbody tr');
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
      });
    });
  }

  // View Ticket Details
  document.querySelectorAll('.btn-view-job-details').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const jobId = e.currentTarget.getAttribute('data-job-id');
      if (window.openJobDetailModal) {
        window.openJobDetailModal(jobId);
      }
    });
  });
}
