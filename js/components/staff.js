// Admin Manage Staff Panel Component for FixFlow CRM

import { storage } from '../utils/storage.js';

export function renderStaffManagement() {
  const users = storage.getUsers();
  const technicians = storage.getTechnicians();

  const html = `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 class="text-xl font-bold text-white flex items-center gap-2">
            👥 Staff & Employee Management
            <span class="text-xs font-normal text-muted bg-slate-800 border border-slate-700 px-2.5 py-0.5 rounded-full">
              ${users.length} Active Accounts
            </span>
          </h2>
          <p class="text-xs text-muted">Provision new dispatcher & technician accounts and manage company personnel credentials.</p>
        </div>

        <button id="btn-open-create-staff-modal" class="btn btn-primary">
          <span>+ Add New Employee</span>
        </button>
      </div>

      <!-- Staff Roster Table -->
      <div class="card">
        <h3 class="text-base font-bold text-white mb-3">Company Staff Directory</h3>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-slate-700 text-muted uppercase text-2xs tracking-wider">
                <th class="py-2.5 px-3">Employee Name</th>
                <th class="py-2.5 px-3">Email Address</th>
                <th class="py-2.5 px-3">Role</th>
                <th class="py-2.5 px-3">Tech ID / Details</th>
                <th class="py-2.5 px-3 text-right">Password</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800 text-slate-300">
              ${users.map(user => {
                const tech = user.techId ? technicians.find(t => t.id === user.techId) : null;
                const roleBadges = {
                  'owner': 'bg-purple-500/20 text-purple-300 border-purple-500/40',
                  'dispatcher': 'bg-blue-500/20 text-blue-300 border-blue-500/40',
                  'technician': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                };
                const badgeCls = roleBadges[user.role] || 'bg-slate-500/20 text-slate-300 border-slate-500/40';

                return `
                  <tr class="hover:bg-slate-800/40 transition-colors">
                    <td class="py-3 px-3 font-semibold text-white">${user.name}</td>
                    <td class="py-3 px-3 text-slate-300 font-mono">${user.email}</td>
                    <td class="py-3 px-3">
                      <span class="badge ${badgeCls} border px-2.5 py-0.5 rounded text-2xs font-bold capitalize">
                        ${user.role}
                      </span>
                    </td>
                    <td class="py-3 px-3">
                      ${user.techId ? `
                        <span class="font-mono text-blue-400 font-bold">${user.techId}</span>
                        ${tech ? `<span class="text-2xs text-muted block">Rating: ${tech.rating}★</span>` : ''}
                      ` : '<span class="text-slate-500">-</span>'}
                    </td>
                    <td class="py-3 px-3 text-right font-mono text-slate-400">
                      ••••••••
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const container = document.getElementById('view-container');
  if (container) {
    container.innerHTML = html;
    attachStaffEvents();
  }
}

function attachStaffEvents() {
  const btn = document.getElementById('btn-open-create-staff-modal');
  if (btn) {
    btn.addEventListener('click', () => {
      const modal = document.getElementById('modal-create-staff');
      if (modal) modal.classList.add('open');
    });
  }
}
