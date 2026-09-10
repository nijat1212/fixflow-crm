// tests/staff.test.mjs
// Automated QA Test Suite for FixFlow CRM Staff Management & RBAC Security

import { spawn } from 'child_process';
import path from 'path';

const API_PORT = 8000;
const BASE_URL = `http://127.0.0.1:${API_PORT}/api`;

let testsPassed = 0;
let testsFailed = 0;

function logPass(title, detail = '') {
  testsPassed++;
  console.log(`  ✅ [PASS] ${title} ${detail ? `(${detail})` : ''}`);
}

function logFail(title, err) {
  testsFailed++;
  console.error(`  ❌ [FAIL] ${title}:`, err);
}

async function isServerRunning() {
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureBackendServer() {
  if (await isServerRunning()) {
    return { spawned: false, proc: null };
  }

  const backendDir = path.resolve(process.cwd(), 'backend');
  const proc = spawn('python', ['-m', 'uvicorn', 'main:app', '--port', String(API_PORT)], {
    cwd: backendDir,
    stdio: 'ignore'
  });

  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 400));
    if (await isServerRunning()) {
      return { spawned: true, proc };
    }
  }
  throw new Error('Failed to start local FastAPI backend server within 12 seconds');
}

async function getToken(email, password) {
  const form = new URLSearchParams();
  form.append('username', email);
  form.append('password', password);

  const res = await fetch(`${BASE_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  });

  if (!res.ok) {
    throw new Error(`Auth failed for ${email} with status ${res.status}`);
  }

  const data = await res.json();
  return data.access_token;
}

export async function runStaffTests() {
  console.log('\n👥 Starting FixFlow Staff Management & RBAC Security Test Suite...\n');
  testsPassed = 0;
  testsFailed = 0;

  let serverControl;
  try {
    serverControl = await ensureBackendServer();
  } catch (err) {
    console.error('Server startup error:', err);
    return { passed: 0, failed: 1, total: 1 };
  }

  let ownerToken, dispatchToken, techToken;
  try {
    ownerToken = await getToken('owner@24fix.us', 'owner123');
    dispatchToken = await getToken('dispatch@24fix.us', 'dispatch123');
    techToken = await getToken('mike@24fix.us', 'mike123');
  } catch (err) {
    logFail('Authentication prerequisites', err);
    return { passed: testsPassed, failed: testsFailed, total: testsPassed + testsFailed };
  }

  const uniqueId = Date.now().toString().slice(-6);
  const newStaffEmail = `david.tech.${uniqueId}@24fix.us`;
  let createdUserId = null;
  let resetNewPassword = null;

  // ── TEST 1: Owner creates new technician staff member ─────────────────────
  try {
    const res = await fetch(`${BASE_URL}/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        name: 'David Technician',
        email: newStaffEmail,
        password: 'davidInitialPass123!',
        role: 'technician',
        phone: '(555) 345-6789'
      })
    });

    if (res.ok) {
      const user = await res.json();
      createdUserId = user.id;
      if (user.email === newStaffEmail && user.role === 'technician') {
        logPass('POST /api/staff (Owner creates technician employee)', `User ID: ${user.id}, Role: ${user.role}`);
      } else {
        logFail('POST /api/staff property mismatch', JSON.stringify(user));
      }
    } else {
      const err = await res.text();
      logFail('POST /api/staff creation failed', `Status ${res.status}: ${err}`);
    }
  } catch (err) {
    logFail('POST /api/staff exception', err);
  }

  // ── TEST 2: Verify duplicate email rejection ──────────────────────────────
  try {
    const res = await fetch(`${BASE_URL}/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        name: 'David Duplicate',
        email: newStaffEmail,
        password: 'pass',
        role: 'technician'
      })
    });

    if (res.status === 400) {
      logPass('POST /api/staff duplicate email correctly rejected', 'HTTP 400 Bad Request');
    } else {
      logFail('POST /api/staff duplicate email check', `Expected 400, got ${res.status}`);
    }
  } catch (err) {
    logFail('Duplicate check exception', err);
  }

  // ── TEST 3: Password reset via POST /api/staff/reset-password ─────────────
  try {
    const res = await fetch(`${BASE_URL}/staff/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        user_id: createdUserId,
        new_password: 'SecretNewPass2026!'
      })
    });

    if (res.ok) {
      const data = await res.json();
      resetNewPassword = data.new_password;
      if (data.status === 'success' && data.new_password === 'SecretNewPass2026!') {
        logPass('POST /api/staff/reset-password (Owner resets employee password)', `New Password: ${data.new_password}`);
      } else {
        logFail('POST /api/staff/reset-password response mismatch', JSON.stringify(data));
      }
    } else {
      const err = await res.text();
      logFail('POST /api/staff/reset-password failed', `Status ${res.status}: ${err}`);
    }
  } catch (err) {
    logFail('Password reset exception', err);
  }

  // ── TEST 4: Verify new password login functionality ───────────────────────
  try {
    const newToken = await getToken(newStaffEmail, resetNewPassword || 'SecretNewPass2026!');
    if (newToken) {
      logPass('Employee login with reset password verified', 'Valid JWT obtained');
    } else {
      logFail('Employee login with reset password', 'No token returned');
    }
  } catch (err) {
    logFail('Login with reset password failed', err);
  }

  // ── TEST 5: RBAC Security — Dispatcher blocked from creating staff ─────────
  try {
    const res = await fetch(`${BASE_URL}/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dispatchToken}`
      },
      body: JSON.stringify({
        name: 'Hacker User',
        email: `hacker.${Date.now()}@test.com`,
        password: 'pass',
        role: 'technician'
      })
    });

    if (res.status === 403) {
      logPass('RBAC: Dispatcher blocked from creating staff', 'HTTP 403 Forbidden');
    } else {
      logFail('RBAC staff creation check (dispatcher)', `Expected 403, got ${res.status}`);
    }
  } catch (err) {
    logFail('Dispatcher staff creation security exception', err);
  }

  // ── TEST 6: RBAC Security — Technician blocked from creating staff ─────────
  try {
    const res = await fetch(`${BASE_URL}/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${techToken}`
      },
      body: JSON.stringify({
        name: 'Tech Rogue',
        email: `techrogue.${Date.now()}@test.com`,
        password: 'pass',
        role: 'dispatcher'
      })
    });

    if (res.status === 403) {
      logPass('RBAC: Technician blocked from creating staff', 'HTTP 403 Forbidden');
    } else {
      logFail('RBAC staff creation check (technician)', `Expected 403, got ${res.status}`);
    }
  } catch (err) {
    logFail('Tech staff creation security exception', err);
  }

  // ── TEST 7: RBAC Security — Dispatcher & Tech blocked from reset-password ─
  try {
    const resDisp = await fetch(`${BASE_URL}/staff/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dispatchToken}`
      },
      body: JSON.stringify({ user_id: createdUserId, new_password: 'hackedPassword1!' })
    });

    const resTech = await fetch(`${BASE_URL}/staff/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${techToken}`
      },
      body: JSON.stringify({ user_id: createdUserId, new_password: 'hackedPassword2!' })
    });

    if (resDisp.status === 403 && resTech.status === 403) {
      logPass('RBAC: Non-owner roles blocked from resetting employee passwords', 'Both returned HTTP 403 Forbidden');
    } else {
      logFail('RBAC reset-password security check', `Dispatcher: ${resDisp.status}, Tech: ${resTech.status}`);
    }
  } catch (err) {
    logFail('Reset password security check exception', err);
  }

  if (serverControl && serverControl.spawned && serverControl.proc) {
    try {
      serverControl.proc.unref();
      serverControl.proc.kill();
    } catch {}
    await new Promise(r => setTimeout(r, 150));
  }

  console.log('\n========================================');
  console.log(`📊 Staff Management Test Summary:`);
  console.log(`   Total Tests: ${testsPassed + testsFailed}`);
  console.log(`   Passed:      ${testsPassed}`);
  console.log(`   Failed:      ${testsFailed}`);
  console.log(`   Status:      ${testsFailed === 0 ? 'ALL PASSED (100%)' : 'FAILURES DETECTED'}`);
  console.log('========================================\n');

  return {
    passed: testsPassed,
    failed: testsFailed,
    total: testsPassed + testsFailed
  };
}

if (process.argv[1] && process.argv[1].endsWith('staff.test.mjs')) {
  runStaffTests().then(results => {
    process.exit(results.failed === 0 ? 0 : 1);
  });
}
