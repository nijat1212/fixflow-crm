// Field Technician Mobile Component for FixFlow CRM

import { storage } from '../utils/storage.js';
import { formatCurrency, formatPhone, formatDate, getStatusBadgeHTML, getUrgencyBadgeHTML } from '../utils/formatters.js';

export function renderTechnicianDashboard() {
  const activeTechId = storage.getActiveTechId();
  const technicians = storage.getTechnicians();
  const activeTech = storage.getTechnicianById(activeTechId) || technicians[0];
  const allJobs = storage.getJobs();

  // Tech specific jobs
  const myJobs = allJobs.filter(j => j.assignedTechId === activeTechId);
  const myActiveJobs = myJobs.filter(j => ['Accepted', 'In Route', 'On Site', 'Waiting for Parts'].includes(j.status));
  const myCompletedJobs = myJobs.filter(j => j.status === 'Completed');
  const availablePool = allJobs.filter(j => j.status === 'Available');

  // Today's earnings
  const todayEarnings = myCompletedJobs.reduce((acc, j) => acc + (j.laborCost || 0) + (j.partsCost || 0), 0);

  const html = `
    <div class="space-y-5 max-w-xl mx-auto">
      <!-- Tech Profile Header Banner -->
      <div class="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-500/30 rounded-2xl p-4 shadow-xl flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-full font-bold text-lg flex items-center justify-center text-white shadow-md" style="width: 48px; height: 48px; display: inline-flex; align-items: center; justify-content: center; background-color: ${activeTech.color}; border-radius: 50%;">
            ${activeTech.avatar}
          </div>
          <div>
            <h2 class="text-base font-bold text-white flex items-center gap-1.5">
              ${activeTech.name}
              <span class="text-amber-400 text-xs font-semibold">★ ${activeTech.rating}</span>
            </h2>
            <p class="text-xs text-blue-300 font-medium">${activeTech.specialties.join(', ')}</p>
          </div>
        </div>

        <div class="text-right">
          <p class="text-2xs uppercase text-muted font-bold tracking-wider">Today's Revenue</p>
          <p class="text-base font-bold text-emerald-400">${formatCurrency(todayEarnings)}</p>
        </div>
      </div>

      <!-- Technician Sub-Tabs -->
      <div class="nav-tabs justify-around">
        <div class="nav-tab tech-tab active" data-tab="active">
          🔧 My Active Jobs (${myActiveJobs.length})
        </div>
        <div class="nav-tab tech-tab" data-tab="pool">
          ⚡ Available Pool (${availablePool.length})
        </div>
        <div class="nav-tab tech-tab" data-tab="completed">
          ✅ Completed (${myCompletedJobs.length})
        </div>
      </div>

      <!-- Tab Content 1: My Active Jobs -->
      <div id="tech-tab-active" class="tech-tab-content space-y-4">
        ${myActiveJobs.length === 0 ? `
          <div class="text-center py-10 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-6">
            <p class="text-2xl mb-2">☕</p>
            <h3 class="text-sm font-bold text-white">No Active Jobs Right Now</h3>
            <p class="text-xs text-muted mt-1">Check the "Available Pool" tab to claim unassigned repair requests in your area.</p>
          </div>
        ` : myActiveJobs.map(job => renderTechJobCard(job)).join('')}
      </div>

      <!-- Tab Content 2: Available Pool (Self-Claim) -->
      <div id="tech-tab-pool" class="tech-tab-content space-y-4 hidden">
        ${availablePool.length === 0 ? `
          <div class="text-center py-10 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-6">
            <p class="text-2xl mb-2">👍</p>
            <h3 class="text-sm font-bold text-white">Available Pool is Clear</h3>
            <p class="text-xs text-muted mt-1">New customer calls will show up here automatically for quick claiming.</p>
          </div>
        ` : availablePool.map(job => renderClaimableJobCard(job)).join('')}
      </div>

      <!-- Tab Content 3: Completed Jobs -->
      <div id="tech-tab-completed" class="tech-tab-content space-y-4 hidden">
        ${myCompletedJobs.length === 0 ? `
          <div class="text-center py-8 text-muted border border-dashed border-slate-800 rounded-2xl">
            <p class="text-xs">No completed jobs logged yet today.</p>
          </div>
        ` : myCompletedJobs.map(job => renderTechCompletedCard(job)).join('')}
      </div>
    </div>
  `;

  const container = document.getElementById('view-container');
  if (container) {
    container.innerHTML = html;
    attachTechnicianEvents();
  }
}

function renderTechJobCard(job) {
  const isAccepted = job.status === 'Accepted';
  const isInRoute = job.status === 'In Route';
  const isOnSite = job.status === 'On Site';
  const isParts = job.status === 'Waiting for Parts';

  return `
    <div class="tech-job-card card space-y-3 relative border-l-4 ${isOnSite ? 'border-l-purple-500' : isInRoute ? 'border-l-indigo-500' : 'border-l-cyan-500'}">
      <!-- Top header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="font-mono font-bold text-sm text-blue-400">${job.id}</span>
          ${getUrgencyBadgeHTML(job.urgency)}
        </div>
        ${getStatusBadgeHTML(job.status)}
      </div>

      <!-- Customer & Appliance Details -->
      <div>
        <h3 class="text-base font-bold text-white">${job.brand} ${job.applianceType}</h3>
        <p class="text-xs text-slate-300 font-medium mt-0.5">${job.issueDescription}</p>
      </div>

      <!-- Contact & Address box -->
      <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="font-bold text-white">👤 ${job.customerName}</span>
          <a href="tel:${job.phone}" class="text-blue-400 font-semibold hover:underline flex items-center gap-1">
            📞 ${formatPhone(job.phone)}
          </a>
        </div>
        <div class="text-slate-300 flex items-center justify-between">
          <span>📍 ${job.address}, ${job.zipCode}</span>
          <a href="https://maps.google.com/?q=${encodeURIComponent(job.address + ', ' + job.zipCode)}" target="_blank" class="text-emerald-400 font-semibold text-2xs bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            🗺️ Maps
          </a>
        </div>
        <div class="text-muted text-2xs flex items-center gap-1">
          <span>📅 Scheduled:</span> <strong class="text-slate-200">${job.scheduledTimeWindow}</strong>
        </div>
        ${job.notes ? `<div class="text-2xs text-amber-300 bg-amber-500/10 p-1.5 rounded border border-amber-500/20 mt-1">📝 ${job.notes}</div>` : ''}
      </div>

      <!-- Status Progression Pipeline Controls -->
      <div>
        <p class="text-2xs font-bold uppercase text-muted mb-1 tracking-wider">Update Job Status:</p>
        <div class="grid grid-cols-5 gap-1 text-2xs text-center">
          <button class="pipeline-step ${isAccepted ? 'active' : ''} btn-update-status" data-job-id="${job.id}" data-status="Accepted">
            Accepted
          </button>
          <button class="pipeline-step ${isInRoute ? 'active' : ''} btn-update-status" data-job-id="${job.id}" data-status="In Route">
            In Route
          </button>
          <button class="pipeline-step ${isOnSite ? 'active' : ''} btn-update-status" data-job-id="${job.id}" data-status="On Site">
            On Site
          </button>
          <button class="pipeline-step ${isParts ? 'active' : ''} btn-update-status" data-job-id="${job.id}" data-status="Waiting for Parts">
            Parts Pending
          </button>
          <button class="pipeline-step btn-open-completion-billing btn-emerald" data-job-id="${job.id}">
            Complete & Bill
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderClaimableJobCard(job) {
  return `
    <div class="card border-l-4 border-l-amber-500 space-y-3">
      <div class="flex items-center justify-between">
        <span class="font-mono font-bold text-xs text-amber-400">${job.id}</span>
        ${getUrgencyBadgeHTML(job.urgency)}
      </div>

      <div>
        <h3 class="text-sm font-bold text-white">${job.brand} ${job.applianceType}</h3>
        <p class="text-xs text-slate-300 mt-1">${job.issueDescription}</p>
      </div>

      <div class="text-xs text-muted bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 space-y-1">
        <div>📍 <strong>${job.city}, TX ${job.zipCode}</strong> (${job.address})</div>
        <div>📅 ${formatDate(job.scheduledDate)} - ${job.scheduledTimeWindow}</div>
      </div>

      <button class="btn btn-amber w-full btn-claim-job" data-job-id="${job.id}" style="width: 100%;">
        <span>⚡ Claim & Accept Job</span>
      </button>
    </div>
  `;
}

function renderTechCompletedCard(job) {
  const total = (job.laborCost || 0) + (job.partsCost || 0);
  return `
    <div class="card border-l-4 border-l-emerald-500 opacity-90">
      <div class="flex items-center justify-between text-xs mb-1">
        <span class="font-mono font-bold text-emerald-400">${job.id}</span>
        <span class="text-emerald-400 font-bold">${formatCurrency(total)}</span>
      </div>
      <h4 class="font-bold text-white text-xs">${job.brand} ${job.applianceType} - ${job.customerName}</h4>
      <p class="text-2xs text-muted mt-1">Labor: ${formatCurrency(job.laborCost)} | Parts: ${formatCurrency(job.partsCost)}</p>
    </div>
  `;
}

function attachTechnicianEvents() {
  // Technician Tabs
  document.querySelectorAll('.tech-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.tech-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tech-tab-content').forEach(c => c.classList.add('hidden'));

      const target = e.currentTarget.getAttribute('data-tab');
      e.currentTarget.classList.add('active');
      document.getElementById(`tech-tab-${target}`).classList.remove('hidden');
    });
  });

  // Claim Job
  document.querySelectorAll('.btn-claim-job').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const jobId = e.currentTarget.getAttribute('data-job-id');
      const activeTechId = storage.getActiveTechId();
      storage.claimJob(jobId, activeTechId);
    });
  });

  // Update Status Step
  document.querySelectorAll('.btn-update-status').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const jobId = e.currentTarget.getAttribute('data-job-id');
      const newStatus = e.currentTarget.getAttribute('data-status');
      storage.updateJobStatus(jobId, newStatus);
    });
  });

  // Complete & Bill Trigger Modal
  document.querySelectorAll('.btn-open-completion-billing').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const jobId = e.currentTarget.getAttribute('data-job-id');
      if (window.openBillingModal) {
        window.openBillingModal(jobId);
      }
    });
  });
}
