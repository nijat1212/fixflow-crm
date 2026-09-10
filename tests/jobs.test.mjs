// tests/jobs.test.mjs
// Automated QA Test Suite for FixFlow CRM Jobs & Calendar Slot Scheduling

import { spawn } from 'child_process';
import path from 'path';

const API_PORT = 8000;
const BASE_URL = `http://127.0.0.1:${API_PORT}/api`;

const CALENDAR_SLOTS = [
  '8:00 AM - 11:00 AM',
  '11:00 AM - 2:00 PM',
  '2:00 PM - 5:00 PM',
  'Urgent Same-Day'
];

function isValidISODate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr + 'T00:00:00Z');
  return !isNaN(d.getTime());
}

function parseTimeWindow(timeWindow) {
  if (!timeWindow) return { startHour: 9, duration: 2 };
  if (timeWindow === 'Urgent Same-Day') return { startHour: 8, duration: 10, isUrgent: true };
  const parts = timeWindow.split('-').map(s => s.trim());
  if (parts.length < 2) return { startHour: 9, duration: 2 };

  function toHour(str) {
    const m = str.match(/(\d+):?(\d+)?\s*(AM|PM)?/i);
    if (!m) return 9;
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const period = (m[3] || '').toUpperCase();
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h + (min >= 30 ? 0.5 : 0);
  }

  const start = toHour(parts[0]);
  const end = toHour(parts[1]);
  const duration = Math.max(1, end - start);
  return { startHour: start, duration };
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

  try { proc.kill(); } catch {}
  throw new Error('Timed out waiting for FixFlow FastAPI backend server on port ' + API_PORT);
}

let passed = 0;
let failed = 0;

function logPass(desc) {
  passed++;
  console.log(`  ✅ [PASS] ${desc}`);
}

function logFail(desc, err) {
  failed++;
  console.error(`  ❌ [FAIL] ${desc}:`, err?.message || err);
}

async function runJobVerificationTests() {
  console.log('\n📅 Starting FixFlow Jobs & Calendar Slot Verification Test Suite...\n');

  let serverProcess = null;
  try {
    const serverInfo = await ensureBackendServer();
    serverProcess = serverInfo.proc;
    if (serverInfo.spawned) {
      console.log('  🚀 FastAPI backend service automatically initialized for test run.');
    } else {
      console.log('  ⚡ Connected to active FixFlow backend instance.');
    }
  } catch (err) {
    console.error('❌ Failed to connect to FixFlow backend:', err.message);
    process.exit(1);
  }

  try {
    // ── Test 1: Health check endpoint
    try {
      const res = await fetch(`${BASE_URL}/health`);
      const body = await res.json();
      if (res.ok && body.status === 'ok') {
        logPass(`Health check verified (${body.service} v${body.version})`);
      } else {
        throw new Error(`Unexpected health status: ${JSON.stringify(body)}`);
      }
    } catch (err) {
      logFail('Backend health check', err);
    }

    // ── Test 2: Dispatcher authentication with new domain
    let dispatchToken = null;
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'dispatch@24fix.us', password: 'dispatch123' })
      });
      const data = await res.json();
      if (res.ok && data.access_token) {
        dispatchToken = data.access_token;
        logPass(`Dispatcher authentication: dispatch@24fix.us (Role: ${data.user.role})`);
      } else {
        throw new Error(data.detail || 'Failed to authenticate dispatcher');
      }
    } catch (err) {
      logFail('Dispatcher authentication (dispatch@24fix.us)', err);
    }

    // ── Test 3: Owner authentication with new domain
    let ownerToken = null;
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@24fix.us', password: 'owner123' })
      });
      const data = await res.json();
      if (res.ok && data.access_token) {
        ownerToken = data.access_token;
        logPass(`Owner authentication: owner@24fix.us (Role: ${data.user.role})`);
      } else {
        throw new Error(data.detail || 'Failed to authenticate owner');
      }
    } catch (err) {
      logFail('Owner authentication (owner@24fix.us)', err);
    }

    // ── Test 4: Technician authentication with new domain
    let techToken = null;
    let techId = null;
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'mike@24fix.us', password: 'mike123' })
      });
      const data = await res.json();
      if (res.ok && data.access_token) {
        techToken = data.access_token;
        techId = data.user.tech_id;
        logPass(`Technician authentication: mike@24fix.us (Tech ID: ${techId})`);
      } else {
        throw new Error(data.detail || 'Failed to authenticate technician');
      }
    } catch (err) {
      logFail('Technician authentication (mike@24fix.us)', err);
    }

    // ── Test 5-8: Job Creation for each Calendar Time Slot
    const createdJobIds = [];
    const testDate = '2026-09-15';

    for (const slot of CALENDAR_SLOTS) {
      try {
        const payload = {
          customer_name: `Test Client (${slot})`,
          phone: '(512) 555-0199',
          address: '100 Congress Ave, Suite 400',
          city: 'Austin',
          zip_code: '78701',
          latitude: 30.2642,
          longitude: -97.7431,
          appliance_type: 'Refrigerator',
          brand: 'Samsung',
          issue_description: `Automated test ticket for calendar slot: ${slot}`,
          scheduled_date: testDate,
          scheduled_time_window: slot,
          urgency: slot === 'Urgent Same-Day' ? 'urgent' : 'normal',
          assigned_tech_id: 'tech_1'
        };

        const res = await fetch(`${BASE_URL}/jobs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${dispatchToken}`
          },
          body: JSON.stringify(payload)
        });

        const job = await res.json();
        if (!res.ok) throw new Error(job.detail || `HTTP ${res.status}`);

        if (job.scheduled_date !== testDate) {
          throw new Error(`scheduled_date mismatch: expected ${testDate}, got ${job.scheduled_date}`);
        }
        if (job.scheduled_time_window !== slot) {
          throw new Error(`scheduled_time_window mismatch: expected ${slot}, got ${job.scheduled_time_window}`);
        }
        if (!isValidISODate(job.scheduled_date)) {
          throw new Error(`scheduled_date is not valid ISO format: ${job.scheduled_date}`);
        }

        createdJobIds.push(job.id);
        logPass(`Job created with calendar slot "${slot}" on ${job.scheduled_date} (Job ID: ${job.id})`);
      } catch (err) {
        logFail(`Create job for calendar slot "${slot}"`, err);
      }
    }

    // ── Test 9: Calendar Slot Time Window Matrix Parsing
    try {
      const t1 = parseTimeWindow('8:00 AM - 11:00 AM');
      if (t1.startHour !== 8 || t1.duration !== 3) {
        throw new Error(`Expected startHour 8 and duration 3, got ${JSON.stringify(t1)}`);
      }

      const t2 = parseTimeWindow('11:00 AM - 2:00 PM');
      if (t2.startHour !== 11 || t2.duration !== 3) {
        throw new Error(`Expected startHour 11 and duration 3, got ${JSON.stringify(t2)}`);
      }

      const t3 = parseTimeWindow('2:00 PM - 5:00 PM');
      if (t3.startHour !== 14 || t3.duration !== 3) {
        throw new Error(`Expected startHour 14 and duration 3, got ${JSON.stringify(t3)}`);
      }

      const t4 = parseTimeWindow('Urgent Same-Day');
      if (!t4.isUrgent) {
        throw new Error('Expected isUrgent to be true for Urgent Same-Day slot');
      }

      logPass('Calendar matrix time parsing: correct startHour & duration calculated for all slots');
    } catch (err) {
      logFail('Calendar matrix time parsing', err);
    }

    // ── Test 10: GET /api/jobs verification of all scheduled jobs
    try {
      const res = await fetch(`${BASE_URL}/jobs`, {
        headers: { 'Authorization': `Bearer ${ownerToken}` }
      });
      const jobs = await res.json();
      if (!res.ok) throw new Error(jobs.detail || `HTTP ${res.status}`);

      if (!Array.isArray(jobs) || jobs.length === 0) {
        throw new Error('Jobs list returned empty or non-array');
      }

      // Check all jobs have valid scheduledDate & scheduledTimeWindow
      let invalidCount = 0;
      for (const j of jobs) {
        if (!isValidISODate(j.scheduled_date) || !j.scheduled_time_window) {
          invalidCount++;
        }
      }

      if (invalidCount > 0) {
        throw new Error(`Found ${invalidCount} jobs with invalid scheduled_date or missing scheduled_time_window`);
      }

      logPass(`GET /api/jobs verified: all ${jobs.length} jobs have valid scheduled_date and scheduled_time_window`);
    } catch (err) {
      logFail('GET /api/jobs calendar slot validation', err);
    }

    // ── Test 11: GET /api/jobs/{id} single job integrity
    if (createdJobIds.length > 0) {
      const testJobId = createdJobIds[0];
      try {
        const res = await fetch(`${BASE_URL}/jobs/${testJobId}`, {
          headers: { 'Authorization': `Bearer ${dispatchToken}` }
        });
        const job = await res.json();
        if (!res.ok) throw new Error(job.detail || `HTTP ${res.status}`);

        if (job.id !== testJobId || !isValidISODate(job.scheduled_date) || !job.scheduled_time_window) {
          throw new Error(`Job details incomplete: ${JSON.stringify(job)}`);
        }
        logPass(`GET /api/jobs/${testJobId} verified single job calendar properties`);
      } catch (err) {
        logFail(`GET /api/jobs/${testJobId}`, err);
      }
    }

    // ── Test 12: RBAC Security — Technician cannot create jobs
    try {
      const res = await fetch(`${BASE_URL}/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${techToken}`
        },
        body: JSON.stringify({
          customer_name: 'Unauthorized Tech Job',
          phone: '(512) 555-9999',
          address: '99 Rogue Way',
          city: 'Austin',
          zip_code: '78701',
          appliance_type: 'Dryer',
          brand: 'LG',
          issue_description: 'Should be rejected',
          scheduled_date: '2026-09-15',
          scheduled_time_window: '8:00 AM - 11:00 AM'
        })
      });

      if (res.status === 403) {
        logPass('RBAC Security: Technician restricted from creating jobs (HTTP 403 Forbidden)');
      } else {
        throw new Error(`Expected HTTP 403 Forbidden, got ${res.status}`);
      }
    } catch (err) {
      logFail('RBAC Security: Technician job creation restriction', err);
    }

    // ── Test 13: RBAC Security — Technician can only access assigned jobs
    try {
      // Create job assigned to tech_2 (Marcus)
      const res = await fetch(`${BASE_URL}/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${dispatchToken}`
        },
        body: JSON.stringify({
          customer_name: 'Marcus Exclusive Job',
          phone: '(512) 555-8888',
          address: '200 East 11th St',
          city: 'Austin',
          zip_code: '78702',
          appliance_type: 'Dishwasher',
          brand: 'Bosch',
          issue_description: 'Motor hums, no wash cycle',
          scheduled_date: '2026-09-16',
          scheduled_time_window: '11:00 AM - 2:00 PM',
          assigned_tech_id: 'tech_2'
        })
      });
      const otherJob = await res.json();

      // Mike (tech_1) tries to fetch Marcus's job
      const accessRes = await fetch(`${BASE_URL}/jobs/${otherJob.id}`, {
        headers: { 'Authorization': `Bearer ${techToken}` }
      });

      if (accessRes.status === 403) {
        logPass("RBAC Security: Technician blocked from accessing other technician's job (HTTP 403 Forbidden)");
      } else {
        throw new Error(`Expected HTTP 403 Forbidden, got ${accessRes.status}`);
      }
    } catch (err) {
      logFail('RBAC Security: Cross-technician job isolation', err);
    }

    // ── Test 14: Security — Unauthenticated request rejected
    try {
      const res = await fetch(`${BASE_URL}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: 'Anonymous Job',
          phone: '(512) 555-0000',
          address: '101 Void St',
          appliance_type: 'Oven',
          brand: 'GE',
          issue_description: 'Will not heat',
          scheduled_date: '2026-09-15',
          scheduled_time_window: '2:00 PM - 5:00 PM'
        })
      });

      if (res.status === 401) {
        logPass('Security: Unauthenticated job creation rejected (HTTP 401 Unauthorized)');
      } else {
        throw new Error(`Expected HTTP 401 Unauthorized, got ${res.status}`);
      }
    } catch (err) {
      logFail('Security: Unauthenticated job creation check', err);
    }

    // ── Test 15: Input Validation — Missing required fields rejected
    try {
      const res = await fetch(`${BASE_URL}/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${dispatchToken}`
        },
        body: JSON.stringify({
          // Missing customer_name, scheduled_date, scheduled_time_window
          appliance_type: 'Washing Machine'
        })
      });

      if (res.status === 422) {
        logPass('Input Validation: Missing required calendar slot & customer fields rejected (HTTP 422 Unprocessable Entity)');
      } else {
        throw new Error(`Expected HTTP 422, got ${res.status}`);
      }
    } catch (err) {
      logFail('Input Validation: Missing required fields check', err);
    }

  } finally {
    if (serverProcess) {
      try {
        serverProcess.kill();
      } catch {}
    }
  }

  const total = passed + failed;
  console.log(`\n========================================`);
  console.log(`📊 Jobs & Calendar Slots Test Summary:`);
  console.log(`   Total Tests: ${total}`);
  console.log(`   Passed:      ${passed}`);
  console.log(`   Failed:      ${failed}`);
  console.log(`   Status:      ${failed === 0 ? 'ALL PASSED (100%)' : 'SOME TESTS FAILED'}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runJobVerificationTests().catch(err => {
  console.error('Fatal error during jobs test execution:', err);
  process.exit(1);
});
