// Modern Login Screen Component for FixFlow CRM

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
            <input type="email" id="login-email" class="form-control" placeholder="name@fixflow.com" required value="owner@fixflow.com">
          </div>

          <div class="form-group mb-0">
            <label class="form-label">Password</label>
            <input type="password" id="login-password" class="form-control" placeholder="••••••••" required value="owner123">
          </div>

          <button type="submit" class="btn btn-primary w-full py-3 text-sm font-bold shadow-lg shadow-blue-500/30" style="width: 100%;">
            <span>Sign In to FixFlow</span>
          </button>
        </form>

        <!-- Quick Demo Login Presets -->
        <div class="mt-6 pt-4 border-t border-slate-800">
          <p class="text-2xs font-bold uppercase text-muted text-center mb-2.5 tracking-wider">Quick Demo One-Tap Login:</p>
          <div class="grid grid-cols-2 gap-2">
            <button class="btn btn-secondary btn-sm text-2xs demo-login-btn" data-email="owner@fixflow.com" data-pass="owner123">
              👑 Owner
            </button>
            <button class="btn btn-secondary btn-sm text-2xs demo-login-btn" data-email="dispatch@fixflow.com" data-pass="dispatch123">
              🎧 Dispatcher
            </button>
            <button class="btn btn-secondary btn-sm text-2xs demo-login-btn" data-email="mike@fixflow.com" data-pass="mike123">
              🔧 Tech (Mike)
            </button>
            <button class="btn btn-secondary btn-sm text-2xs demo-login-btn" data-email="marcus@fixflow.com" data-pass="marcus123">
              🔧 Tech (Marcus)
            </button>
          </div>
        </div>
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
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const pass = document.getElementById('login-password').value;
      attemptLogin(email, pass);
    });
  }

  document.querySelectorAll('.demo-login-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const email = e.currentTarget.getAttribute('data-email');
      const pass = e.currentTarget.getAttribute('data-pass');
      attemptLogin(email, pass);
    });
  });
}

function attemptLogin(email, pass) {
  const alertEl = document.getElementById('login-error-alert');
  const alertText = document.getElementById('login-error-text');

  const res = storage.login(email, pass);
  if (!res.success) {
    if (alertEl && alertText) {
      alertText.textContent = res.error;
      alertEl.classList.remove('hidden');
    }
  }
}
