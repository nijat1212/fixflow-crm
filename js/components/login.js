// Login Screen Component for FixFlow CRM
// Uses Firebase Authentication (Email/Password)

import { storage } from '../utils/storage.js';

export function renderLoginScreen() {
  const html = `
    <div class="min-h-[80vh] flex items-center justify-center py-10 px-4">
      <div class="card w-full max-w-md p-8 border-slate-700/80 shadow-2xl bg-slate-900/90 relative overflow-hidden" style="max-width: 440px;">
        <!-- Top Glow Accent -->
        <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400"></div>

        <!-- Brand Title -->
        <div class="text-center mb-6">
          <div class="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center font-bold text-white shadow-xl shadow-blue-500/20 text-3xl" style="width: 56px; height: 56px; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #3b82f6, #06b6d4); border-radius: 16px;">
            ⚡
          </div>
          <h2 class="text-2xl font-extrabold text-white">FixFlow <span class="text-blue-400">CRM</span></h2>
          <p class="text-xs text-muted mt-1">US Appliance Repair Service Engine</p>
        </div>

        <!-- Error Alert Container -->
        <div id="login-error-alert" class="hidden mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
          <span>⚠️</span>
          <span id="login-error-text">Invalid credentials</span>
        </div>

        <!-- Login Form -->
        <form id="form-login" class="space-y-4">
          <div class="form-group mb-0">
            <label class="form-label">Email Address</label>
            <input type="email" id="login-email" class="form-control" placeholder="name@fixflow.com" required autocomplete="email">
          </div>

          <div class="form-group mb-0">
            <label class="form-label">Password</label>
            <input type="password" id="login-password" class="form-control" placeholder="••••••••" required autocomplete="current-password">
          </div>

          <button type="submit" id="btn-login-submit" class="btn btn-primary w-full py-3 text-sm font-bold shadow-lg shadow-blue-500/30" style="width: 100%;">
            <span id="btn-login-text">Sign In to FixFlow</span>
            <span id="btn-login-spinner" class="hidden ml-2">⏳</span>
          </button>
        </form>

        <p class="text-center text-xs text-muted mt-6">
          Secured by <span class="text-blue-400 font-semibold">Firebase Authentication</span>
        </p>
      </div>
    </div>
  `;

  const container = document.getElementById('view-container');
  if (container) {
    container.innerHTML = html;
    attachLoginEvents();
  }
}

function attachLoginEvents() {
  const form = document.getElementById('form-login');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const pass = document.getElementById('login-password').value;
      await attemptLogin(email, pass);
    });
  }
}

async function attemptLogin(email, pass) {
  const alertEl = document.getElementById('login-error-alert');
  const alertText = document.getElementById('login-error-text');
  const submitBtn = document.getElementById('btn-login-submit');
  const btnText = document.getElementById('btn-login-text');
  const spinner = document.getElementById('btn-login-spinner');

  // Hide previous error
  if (alertEl) alertEl.classList.add('hidden');

  // Show loading state
  if (submitBtn) submitBtn.disabled = true;
  if (btnText) btnText.textContent = 'Signing in...';
  if (spinner) spinner.classList.remove('hidden');

  const res = await storage.login(email, pass);

  // Restore button state
  if (submitBtn) submitBtn.disabled = false;
  if (btnText) btnText.textContent = 'Sign In to FixFlow';
  if (spinner) spinner.classList.add('hidden');

  if (!res.success) {
    if (alertEl && alertText) {
      alertText.textContent = res.error;
      alertEl.classList.remove('hidden');
    }
  }
}
