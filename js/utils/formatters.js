// Formatting helpers for US Appliance Repair CRM (FixFlow CRM)

export function formatCurrency(amount) {
  const val = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(val);
}

export function formatPhone(phoneStr) {
  if (!phoneStr) return '';
  const cleaned = ('' + phoneStr).replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phoneStr;
}

export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

export function getStatusBadgeHTML(status) {
  const statusConfig = {
    'Available': { label: 'Available', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', icon: '⚡' },
    'Assigned': { label: 'Assigned', bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', icon: '👤' },
    'Accepted': { label: 'Accepted', bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30', icon: '👍' },
    'In Route': { label: 'In Route', bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30', icon: '🚚' },
    'On Site': { label: 'On Site', bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', icon: '🔧' },
    'Waiting for Parts': { label: 'Parts Pending', bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30', icon: '📦' },
    'Completed': { label: 'Completed', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: '✅' },
    'Cancelled': { label: 'Cancelled', bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30', icon: '❌' }
  };

  const config = statusConfig[status] || { label: status, bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30', icon: '📌' };

  return `<span class="badge ${config.bg} ${config.text} ${config.border} border rounded-full px-2.5 py-1 text-xs font-semibold inline-flex items-center gap-1.5">
    <span>${config.icon}</span>
    <span>${config.label}</span>
  </span>`;
}

export function getUrgencyBadgeHTML(urgency) {
  const urgencyConfig = {
    'Urgent': 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    'High': 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    'Medium': 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    'Low': 'bg-slate-500/20 text-slate-400 border-slate-500/40'
  };
  const cls = urgencyConfig[urgency] || urgencyConfig['Low'];
  return `<span class="badge ${cls} border rounded px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider">${urgency || 'Low'}</span>`;
}
