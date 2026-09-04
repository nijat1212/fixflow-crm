// Header Component for FixFlow CRM

import { storage } from '../utils/storage.js';

export function renderHeader() {
  const session = storage.getSession();

  if (!session) {
    // If logged out, render a clean minimalist header
    const minimalHTML = `
      <div class="container flex items-center justify-between py-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20 text-xl" style="width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #3b82f6, #06b6d4); border-radius: 12px;">
            ⚡
          </div>
          <div>
            <h1 class="text-lg font-bold text-white leading-none">FixFlow <span class="text-blue-500 text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">CRM</span></h1>
            <p class="text-2xs text-muted">US Appliance Repair Service Engine</p>
          </div>
        </div>
      </div>
    `;
    const headerEl = document.getElementById('app-header');
    if (headerEl) headerEl.innerHTML = minimalHTML;
    return;
  }

  // Role Badge Config
  const roleBadges = {
    'owner': { label: '👑 Owner', bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/40' },
    'dispatcher': { label: '🎧 Dispatcher', bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/40' },
    'technician': { label: '🔧 Technician', bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/40' }
  };
  const roleBadge = roleBadges[session.role] || roleBadges['dispatcher'];

  const headerHTML = `
    <div class="container flex items-center justify-between py-3 flex-wrap gap-2">
      <!-- Logo & Brand -->
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20 text-xl" style="width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #3b82f6, #06b6d4); border-radius: 12px;">
          ⚡
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-lg font-bold text-white leading-none">FixFlow <span class="text-blue-500 text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">CRM</span></h1>
          </div>
          <p class="text-2xs text-muted">US Appliance Repair Service Engine</p>
        </div>
      </div>

      <!-- Logged In User Profile & Actions -->
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="font-bold text-white">${session.name}</span>
          <span class="badge ${roleBadge.bg} ${roleBadge.text} ${roleBadge.border} border px-2 py-0.5 rounded text-2xs font-bold">
            ${roleBadge.label}
          </span>
        </div>

        ${session.role !== 'technician' ? `
          <button id="btn-quick-new-job" class="btn btn-primary btn-sm">
            <span>+ New Ticket</span>
          </button>
        ` : ''}

        <button id="btn-logout" class="btn btn-secondary btn-sm text-slate-300 hover:text-rose-400">
          <span>🚪 Log Out</span>
        </button>
      </div>
    </div>
  `;

  const headerEl = document.getElementById('app-header');
  if (headerEl) {
    headerEl.innerHTML = headerHTML;
    attachHeaderEvents();
  }
}

function attachHeaderEvents() {
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await storage.logout();
    });
  }

  const newJobBtn = document.getElementById('btn-quick-new-job');
  if (newJobBtn) {
    newJobBtn.addEventListener('click', () => {
      const modal = document.getElementById('modal-new-job');
      if (modal) modal.classList.add('open');
    });
  }
}
