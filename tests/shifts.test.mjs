// tests/shifts.test.mjs
// Automated QA Test Suite for FixFlow CRM Technician Shifts & Scheduling Calendar

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
    throw new Error(`Auth failed for ${email}`);
  }

  const data = await res.json();
  return data.access_token;
}

export async function runShiftsTests() {
  console.log('\n📅 Starting FixFlow Shifts & Scheduling Calendar Test Suite...\n');
  testsPassed = 0;
  testsFailed = 0;

  let serverControl;
  try {
    serverControl = await ensureBackendServer();
  } catch (err) {
    console.error('Server startup error:', err);
    return { passed: 0, failed: 1, total: 1 };
  }

  let dispatchToken, techToken;
  try {
    dispatchToken = await getToken('dispatch@24fix.us', 'dispatch123');
    techToken = await getToken('mike@24fix.us', 'mike123');
  } catch (err) {
    logFail('Authentication prerequisites', err);
    return { passed: testsPassed, failed: testsFailed, total: testsPassed + testsFailed };
  }

  let createdShiftId = null;
  const shiftDate = '2026-09-22';

  // ── TEST 1: Dispatcher creates technician duty shift ─────────────────────
  try {
    const res = await fetch(`${BASE_URL}/shifts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dispatchToken}`
      },
      body: JSON.stringify({
        tech_id: 'tech_1',
        date: shiftDate,
        start_time: '08:00',
        end_time: '17:00',
        status: 'confirmed'
      })
    });

    if (res.ok) {
      const shift = await res.json();
      createdShiftId = shift.id;
      if (shift.tech_id === 'tech_1' && shift.date === shiftDate && shift.status === 'confirmed') {
        logPass(
          'POST /api/shifts (Create working shift for technician)',
          `Shift ID: ${shift.id}, Date: ${shift.date}, Hours: ${shift.start_time}-${shift.end_time}`
        );
      } else {
        logFail('Shift properties mismatch', JSON.stringify(shift));
      }
    } else {
      logFail('Shift creation failed', await res.text());
    }
  } catch (err) {
    logFail('Shift creation exception', err);
  }

  // ── TEST 2: Retrieve shift in all shifts list ─────────────────────────────
  try {
    const listRes = await fetch(`${BASE_URL}/shifts`, {
      headers: { 'Authorization': `Bearer ${techToken}` }
    });

    if (listRes.ok) {
      const shifts = await listRes.json();
      const found = shifts.find(s => s.id === createdShiftId);
      if (found) {
        logPass('GET /api/shifts (Technician retrieves schedule list)', `Total active shifts: ${shifts.length}`);
      } else {
        logFail('Created shift not in GET /api/shifts list', `Target ID: ${createdShiftId}`);
      }
    } else {
      logFail('List shifts request failed', await listRes.text());
    }
  } catch (err) {
    logFail('List shifts exception', err);
  }

  // ── TEST 3: Update shift to "Off" (Day Off) ───────────────────────────────
  try {
    const updateRes = await fetch(`${BASE_URL}/shifts/${createdShiftId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dispatchToken}`
      },
      body: JSON.stringify({
        status: 'Off'
      })
    });

    if (updateRes.ok) {
      const updated = await updateRes.json();
      if (updated.status === 'Off') {
        logPass('PUT /api/shifts/{id} (Change shift type to "Off")', `Updated status: ${updated.status}`);
      } else {
        logFail('Shift status not changed to Off', JSON.stringify(updated));
      }
    } else {
      logFail('Shift update failed', await updateRes.text());
    }
  } catch (err) {
    logFail('Shift update exception', err);
  }

  // ── TEST 4: Delete shift (DELETE /api/shifts/{id}) ────────────────────────
  try {
    const deleteRes = await fetch(`${BASE_URL}/shifts/${createdShiftId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${dispatchToken}` }
    });

    if (deleteRes.ok) {
      const result = await deleteRes.json();
      if (result.status === 'deleted' && result.id === createdShiftId) {
        logPass('DELETE /api/shifts/{id} (Remove duty shift)', `Deleted ID: ${createdShiftId}`);
      } else {
        logFail('Delete shift response mismatch', JSON.stringify(result));
      }
    } else {
      logFail('Shift deletion failed', await deleteRes.text());
    }
  } catch (err) {
    logFail('Shift delete exception', err);
  }

  // ── TEST 5: RBAC Security — Technician blocked from deleting shifts ───────
  try {
    const rogueRes = await fetch(`${BASE_URL}/shifts/nonexistent_shift`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${techToken}` }
    });

    if (rogueRes.status === 403) {
      logPass('RBAC: Technician blocked from deleting shifts', 'HTTP 403 Forbidden');
    } else {
      logFail('Technician shift delete check', `Expected 403, got ${rogueRes.status}`);
    }
  } catch (err) {
    logFail('Technician delete check exception', err);
  }

  if (serverControl && serverControl.spawned && serverControl.proc) {
    try {
      serverControl.proc.unref();
      serverControl.proc.kill();
    } catch {}
    await new Promise(r => setTimeout(r, 150));
  }

  console.log('\n========================================');
  console.log(`📊 Shifts & Calendar Test Summary:`);
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

if (process.argv[1] && process.argv[1].endsWith('shifts.test.mjs')) {
  runShiftsTests().then(results => {
    process.exit(results.failed === 0 ? 0 : 1);
  });
}
