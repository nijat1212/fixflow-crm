// Business Owner Analytics & Financial Dashboard Component for FixFlow CRM

import { storage } from '../utils/storage.js';
import { formatCurrency } from '../utils/formatters.js';

export function renderAnalytics() {
  const jobs = storage.getJobs();
  const technicians = storage.getTechnicians();

  const completedJobs = jobs.filter(j => j.status === 'Completed');
  
  // Total Revenue (Labor + Parts of completed jobs)
  const totalRevenue = completedJobs.reduce((sum, j) => sum + (j.laborCost || 0) + (j.partsCost || 0), 0);
  const avgJobValue = completedJobs.length > 0 ? totalRevenue / completedJobs.length : 0;

  // Breakdown by Appliance Type
  const categoryStats = {};
  jobs.forEach(j => {
    const cat = j.applianceType || 'Other';
    if (!categoryStats[cat]) {
      categoryStats[cat] = { count: 0, revenue: 0 };
    }
    categoryStats[cat].count += 1;
    if (j.status === 'Completed') {
      categoryStats[cat].revenue += (j.laborCost || 0) + (j.partsCost || 0);
    }
  });

  const categories = Object.keys(categoryStats);

  // Breakdown by Technician
  const techStats = technicians.map(tech => {
    const techCompleted = completedJobs.filter(j => j.assignedTechId === tech.id);
    const techRevenue = techCompleted.reduce((sum, j) => sum + (j.laborCost || 0) + (j.partsCost || 0), 0);
    return {
      ...tech,
      completedCount: techCompleted.length,
      revenue: techRevenue,
      avgTicket: techCompleted.length > 0 ? techRevenue / techCompleted.length : 0
    };
  }).sort((a, b) => b.revenue - a.revenue); // Leaderboard order

  const maxCategoryRevenue = Math.max(...categories.map(c => categoryStats[c].revenue), 1);
  const maxTechRevenue = Math.max(...techStats.map(t => t.revenue), 1);

  const html = `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 class="text-xl font-bold text-white flex items-center gap-2">
            👑 Executive Analytics & Performance Dashboard
            <span class="text-xs font-normal text-muted bg-slate-800 border border-slate-700 px-2.5 py-0.5 rounded-full">
              September 2026 Report
            </span>
          </h2>
          <p class="text-xs text-muted">Comprehensive revenue breakdown, technician leaderboard & appliance service metrics.</p>
        </div>
      </div>

      <!-- KPI Executive Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="card border-l-4 border-l-emerald-500 bg-gradient-to-br from-slate-900 to-slate-900/90">
          <p class="text-2xs uppercase font-bold text-muted tracking-wider">Total Monthly Revenue</p>
          <h3 class="text-2xl font-bold text-emerald-400 mt-1">${formatCurrency(totalRevenue)}</h3>
          <p class="text-2xs text-emerald-500/80 font-medium mt-1">↑ 14.2% vs last month</p>
        </div>

        <div class="card border-l-4 border-l-blue-500 bg-gradient-to-br from-slate-900 to-slate-900/90">
          <p class="text-2xs uppercase font-bold text-muted tracking-wider">Completed Service Calls</p>
          <h3 class="text-2xl font-bold text-blue-400 mt-1">${completedJobs.length}</h3>
          <p class="text-2xs text-muted mt-1">out of ${jobs.length} total tickets</p>
        </div>

        <div class="card border-l-4 border-l-purple-500 bg-gradient-to-br from-slate-900 to-slate-900/90">
          <p class="text-2xs uppercase font-bold text-muted tracking-wider">Average Ticket Value</p>
          <h3 class="text-2xl font-bold text-purple-400 mt-1">${formatCurrency(avgJobValue)}</h3>
          <p class="text-2xs text-muted mt-1">Labor + Parts combined</p>
        </div>

        <div class="card border-l-4 border-l-amber-500 bg-gradient-to-br from-slate-900 to-slate-900/90">
          <p class="text-2xs uppercase font-bold text-muted tracking-wider">Customer Rating</p>
          <h3 class="text-2xl font-bold text-amber-400 mt-1">4.85 ★</h3>
          <p class="text-2xs text-muted mt-1">Based on 42 customer reviews</p>
        </div>
      </div>

      <!-- Main Analytics Grid (Charts & Leaderboard) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Revenue by Appliance Type -->
        <div class="card">
          <h3 class="text-base font-bold text-white mb-1">Revenue by Appliance Category</h3>
          <p class="text-xs text-muted mb-4">Financial volume distribution across major household appliances.</p>

          <div class="space-y-3">
            ${categories.map(cat => {
              const stat = categoryStats[cat];
              const pct = Math.round((stat.revenue / maxCategoryRevenue) * 100);
              return `
                <div>
                  <div class="flex items-center justify-between text-xs mb-1">
                    <span class="font-semibold text-slate-200">${cat} (${stat.count} jobs)</span>
                    <span class="font-bold text-emerald-400">${formatCurrency(stat.revenue)}</span>
                  </div>
                  <div class="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800" style="height: 10px;">
                    <div class="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-500" style="width: ${pct}%;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Technician Leaderboard -->
        <div class="card">
          <h3 class="text-base font-bold text-white mb-1">Technician Leaderboard</h3>
          <p class="text-xs text-muted mb-4">Monthly revenue performance and completed job volume by technician.</p>

          <div class="space-y-4">
            ${techStats.map((t, idx) => {
              const pct = Math.round((t.revenue / maxTechRevenue) * 100);
              return `
                <div class="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                  <div class="font-bold text-sm text-slate-500 w-5 text-center">#${idx + 1}</div>
                  
                  <div class="w-9 h-9 rounded-full font-bold text-xs flex items-center justify-center text-white shadow" style="background-color: ${t.color}; width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;">
                    ${t.avatar}
                  </div>

                  <div class="flex-1">
                    <div class="flex items-center justify-between text-xs mb-1">
                      <span class="font-bold text-white">${t.name} <span class="text-amber-400 font-normal">★ ${t.rating}</span></span>
                      <span class="font-bold text-emerald-400">${formatCurrency(t.revenue)}</span>
                    </div>

                    <div class="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800" style="height: 8px;">
                      <div class="h-full rounded-full" style="width: ${pct}%; background-color: ${t.color}"></div>
                    </div>

                    <div class="flex justify-between text-2xs text-muted mt-1">
                      <span>${t.completedCount} Jobs Completed</span>
                      <span>Avg: ${formatCurrency(t.avgTicket)} / job</span>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  const container = document.getElementById('view-container');
  if (container) {
    container.innerHTML = html;
  }
}
