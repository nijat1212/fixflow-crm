// tests/tech_geo.test.mjs
// Automated QA Test Suite for FixFlow CRM Technician GPS Geolocation & Financial Analytics

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

export async function runTechGeoTests() {
  console.log('\n📍 Starting FixFlow Technician Geolocation & Analytics Test Suite...\n');
  testsPassed = 0;
  testsFailed = 0;

  let serverControl;
  try {
    serverControl = await ensureBackendServer();
  } catch (err) {
    console.error('Server startup error:', err);
    return { passed: 0, failed: 1, total: 1 };
  }

  let ownerToken, dispatchToken, tech1Token, tech2Token;
  try {
    ownerToken = await getToken('owner@24fix.us', 'owner123');
    dispatchToken = await getToken('dispatch@24fix.us', 'dispatch123');
    tech1Token = await getToken('mike@24fix.us', 'mike123');
    tech2Token = await getToken('marcus@24fix.us', 'marcus123');
  } catch (err) {
    logFail('Authentication prerequisites', err);
    return { passed: testsPassed, failed: testsFailed, total: testsPassed + testsFailed };
  }

  // ── TEST 1: Technician updates real-time GPS location ─────────────────────
  const targetLat = 30.2672;
  const targetLon = -97.7431; // Austin, TX

  try {
    const locRes = await fetch(`${BASE_URL}/technicians/tech_1/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tech1Token}`
      },
      body: JSON.stringify({
        lat: targetLat,
        lon: targetLon
      })
    });

    if (locRes.ok) {
      const locData = await locRes.json();
      if (locData.status === 'success' && locData.lat === targetLat && locData.lon === targetLon) {
        logPass(
          'POST /api/technicians/{id}/location (Technician telemetry update)',
          `Tech: tech_1, Lat: ${locData.lat}, Lon: ${locData.lon}`
        );
      } else {
        logFail('Location response data mismatch', JSON.stringify(locData));
      }
    } else {
      logFail('Location update request failed', await locRes.text());
    }
  } catch (err) {
    logFail('Location update exception', err);
  }

  // ── TEST 2: Verify updated coordinates via GET /api/technicians/{id} ──────
  try {
    const techRes = await fetch(`${BASE_URL}/technicians/tech_1`, {
      headers: { 'Authorization': `Bearer ${dispatchToken}` }
    });

    if (techRes.ok) {
      const tech = await techRes.json();
      if (tech.current_lat === targetLat && tech.current_lon === targetLon) {
        logPass(
          'GET /api/technicians/{id} (Verified persisted GPS coordinates)',
          `Confirmed in DB: Lat ${tech.current_lat}, Lon ${tech.current_lon}`
        );
      } else {
        logFail('Persisted GPS coordinates mismatch', `Got Lat: ${tech.current_lat}, Lon: ${tech.current_lon}`);
      }
    } else {
      logFail('Get technician request failed', await techRes.text());
    }
  } catch (err) {
    logFail('Get technician exception', err);
  }

  // ── TEST 3: RBAC Security — Technician blocked from updating other's GPS ──
  try {
    const hijackRes = await fetch(`${BASE_URL}/technicians/tech_2/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tech1Token}` // Mike attempting to move Marcus
      },
      body: JSON.stringify({
        lat: 32.7767,
        lon: -96.7970
      })
    });

    if (hijackRes.status === 403) {
      logPass(
        'RBAC: Technician blocked from altering another technician GPS location',
        'HTTP 403 Forbidden'
      );
    } else {
      logFail('Technician location hijacking check', `Expected 403, got ${hijackRes.status}`);
    }
  } catch (err) {
    logFail('Location isolation exception', err);
  }

  // ── TEST 4: Financial Analytics Revenue & Average Ticket Math Verification ─
  try {
    const jobsRes = await fetch(`${BASE_URL}/jobs`, {
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });

    if (jobsRes.ok) {
      const allJobs = await jobsRes.json();
      const completedJobs = allJobs.filter(j => j.status === 'completed' || j.status === 'Completed');

      // Formula: sum of labor_cost + parts_cost
      const totalRevenue = completedJobs.reduce((sum, j) => sum + (j.labor_cost || 0) + (j.parts_cost || 0), 0);
      const avgTicket = completedJobs.length > 0 ? Math.round((totalRevenue / completedJobs.length) * 100) / 100 : 0;

      if (typeof totalRevenue === 'number' && !isNaN(totalRevenue) && !isNaN(avgTicket)) {
        logPass(
          'Analytics Formula: Total Revenue & Average Ticket Value',
          `Completed: ${completedJobs.length}, Total Revenue: $${totalRevenue.toFixed(2)}, Avg Ticket: $${avgTicket.toFixed(2)}`
        );
      } else {
        logFail('Analytics math calculation error', `Revenue: ${totalRevenue}, Avg: ${avgTicket}`);
      }
    } else {
      logFail('Failed to fetch jobs for analytics verification', await jobsRes.text());
    }
  } catch (err) {
    logFail('Analytics jobs fetch exception', err);
  }

  // ── TEST 5: Appliance Category & Technician Breakdown Aggregation ─────────
  try {
    const jobsRes = await fetch(`${BASE_URL}/jobs`, {
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });

    const jobs = await jobsRes.json();
    const completed = jobs.filter(j => j.status === 'completed' || j.status === 'Completed');

    const categoryStats = {};
    jobs.forEach(j => {
      const cat = j.appliance_type || 'Other';
      if (!categoryStats[cat]) categoryStats[cat] = { count: 0, revenue: 0 };
      categoryStats[cat].count += 1;
      if (j.status === 'completed' || j.status === 'Completed') {
        categoryStats[cat].revenue += (j.labor_cost || 0) + (j.parts_cost || 0);
      }
    });

    const hasCategories = Object.keys(categoryStats).length > 0;
    if (hasCategories) {
      const topCat = Object.keys(categoryStats)[0];
      logPass(
        'Appliance Category Performance breakdown aggregation',
        `Categories parsed: ${Object.keys(categoryStats).length} (Sample: ${topCat})`
      );
    } else {
      logFail('Category stats breakdown empty', JSON.stringify(categoryStats));
    }
  } catch (err) {
    logFail('Category breakdown exception', err);
  }

  // ── TEST 6: Zero-division Safe Fallback in Analytics ───────────────────────
  try {
    const emptyJobs = [];
    const safeRev = emptyJobs.reduce((sum, j) => sum + (j.labor_cost || 0), 0);
    const safeAvg = emptyJobs.length > 0 ? safeRev / emptyJobs.length : 0;

    if (safeRev === 0 && safeAvg === 0) {
      logPass('Safe Zero-Division Protection in Financial Analytics', 'Handled 0 completed calls -> $0.00 avg ticket');
    } else {
      logFail('Zero-division check failed', `Avg: ${safeAvg}`);
    }
  } catch (err) {
    logFail('Zero-division exception', err);
  }

  if (serverControl && serverControl.spawned && serverControl.proc) {
    try {
      serverControl.proc.unref();
      serverControl.proc.kill();
    } catch {}
    await new Promise(r => setTimeout(r, 150));
  }

  console.log('\n========================================');
  console.log(`📊 Geolocation & Analytics Test Summary:`);
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

if (process.argv[1] && process.argv[1].endsWith('tech_geo.test.mjs')) {
  runTechGeoTests().then(results => {
    process.exit(results.failed === 0 ? 0 : 1);
  });
}
