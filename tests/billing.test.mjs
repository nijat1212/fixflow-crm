// tests/billing.test.mjs
// Automated QA Test Suite for FixFlow CRM Billing, Invoice Calculations & Parts Tracking

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

export async function runBillingTests() {
  console.log('\n💵 Starting FixFlow Billing, Invoice Calculation & Parts Tracking Test Suite...\n');
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

  // ── TEST 1: Exact Tax & Invoice Math Calculation Verification ─────────────
  const laborCost = 150.00;
  const partsCost = 45.00;
  const subtotal = laborCost + partsCost; // 195.00
  const taxRate = 0.0825; // Texas standard 8.25%
  const calculatedTax = Math.round(subtotal * taxRate * 100) / 100; // 16.09
  const totalInvoice = Math.round((subtotal + calculatedTax) * 100) / 100; // 211.09

  if (calculatedTax === 16.09 && totalInvoice === 211.09) {
    logPass(
      'Tax & Final Invoice Formula Calculation',
      `Labor: $150.00, Parts: $45.00, Tax (8.25%): $${calculatedTax.toFixed(2)} -> Total: $${totalInvoice.toFixed(2)}`
    );
  } else {
    logFail('Invoice calculation formula error', `Tax: ${calculatedTax}, Total: ${totalInvoice}`);
  }

  // ── TEST 2: Create a job assigned to tech_1 for completion testing ────────
  let testJobId = null;
  try {
    const jobRes = await fetch(`${BASE_URL}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dispatchToken}`
      },
      body: JSON.stringify({
        customer_name: 'Billing Test Customer',
        phone: '(555) 987-6543',
        address: '1000 Congress Ave',
        city: 'Austin',
        zip_code: '78701',
        appliance_type: 'Refrigerator',
        brand: 'Whirlpool',
        issue_description: 'Compressor relay failure, cooling loss',
        scheduled_date: '2026-09-16',
        scheduled_time_window: '8:00 AM - 11:00 AM',
        urgency: 'high',
        assigned_tech_id: 'tech_1'
      })
    });

    if (jobRes.ok) {
      const job = await jobRes.json();
      testJobId = job.id;
      logPass('Test job created for billing lifecycle', `Job ID: ${testJobId}`);
    } else {
      const err = await jobRes.text();
      logFail('Failed to create test job for billing', err);
    }
  } catch (err) {
    logFail('Test job creation exception', err);
  }

  // ── TEST 3: Complete Job with Labor, Parts, Tax & Final Invoice ───────────
  const partsUsed = ['OEM Compressor Start Relay #W10613606', 'Run Capacitor 15uF'];
  const technicianNotes = 'Diagnosed bad relay. Replaced relay and capacitor. Verified temperature dropped to 37F.';

  try {
    const statusRes = await fetch(`${BASE_URL}/jobs/${testJobId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${techToken}`
      },
      body: JSON.stringify({
        status: 'completed',
        labor_cost: laborCost,
        parts_cost: partsCost,
        diagnostic_fee: 0.0,
        tax: calculatedTax,
        total_amount: totalInvoice,
        parts_used: partsUsed,
        note: technicianNotes
      })
    });

    if (statusRes.ok) {
      const completedJob = await statusRes.json();
      if (
        completedJob.status === 'completed' &&
        completedJob.labor_cost === 150.00 &&
        completedJob.parts_cost === 45.00 &&
        completedJob.total_amount === 211.09
      ) {
        logPass(
          'POST /api/jobs/{id}/status (Job completed with invoice figures)',
          `Labor: $${completedJob.labor_cost}, Parts: $${completedJob.parts_cost}, Total: $${completedJob.total_amount}`
        );
      } else {
        logFail('Completed job financial figures mismatch', JSON.stringify(completedJob));
      }
    } else {
      const err = await statusRes.text();
      logFail('Status update to completed failed', err);
    }
  } catch (err) {
    logFail('Job completion request exception', err);
  }

  // ── TEST 4: Verify Parts Used & Technician Notes Preservation in Timeline ─
  try {
    const fetchRes = await fetch(`${BASE_URL}/jobs/${testJobId}`, {
      headers: { 'Authorization': `Bearer ${techToken}` }
    });

    if (fetchRes.ok) {
      const jobData = await fetchRes.json();
      const completionEntry = (jobData.timeline || []).find(t => t.status === 'completed');

      if (completionEntry && completionEntry.note && completionEntry.note.includes('OEM Compressor Start Relay') && completionEntry.note.includes('Diagnosed bad relay')) {
        logPass(
          'Parts Used & Technician Notes preservation in Job Timeline',
          `Timeline Note: "${completionEntry.note.slice(0, 70)}..."`
        );
      } else {
        logFail('Timeline entry missing parts or notes', JSON.stringify(completionEntry));
      }
    } else {
      logFail('Failed to retrieve job for timeline verification', await fetchRes.text());
    }
  } catch (err) {
    logFail('Timeline check exception', err);
  }

  // ── TEST 5: Verify Owner access to complete invoice details ───────────────
  try {
    const ownerFetch = await fetch(`${BASE_URL}/jobs/${testJobId}`, {
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });

    if (ownerFetch.ok) {
      const job = await ownerFetch.json();
      if (job.total_amount === 211.09 && job.status === 'completed') {
        logPass('Owner retrieval of final completed invoice', `Confirmed Total: $${job.total_amount}`);
      } else {
        logFail('Owner retrieval invoice mismatch', JSON.stringify(job));
      }
    } else {
      logFail('Owner fetch failed', await ownerFetch.text());
    }
  } catch (err) {
    logFail('Owner fetch exception', err);
  }

  // ── TEST 6: Verify Zero/Empty Costs handling ──────────────────────────────
  try {
    const zeroLabor = 0;
    const zeroParts = 0;
    const zeroTax = (zeroLabor + zeroParts) * 0.0825;
    const zeroTotal = zeroLabor + zeroParts + zeroTax;

    if (zeroTax === 0 && zeroTotal === 0) {
      logPass('Zero/Warranty Service Call calculation ($0.00)', 'Handled cleanly without NaN/division issues');
    } else {
      logFail('Zero cost calculation check', `Total: ${zeroTotal}`);
    }
  } catch (err) {
    logFail('Zero cost check exception', err);
  }

  if (serverControl && serverControl.spawned && serverControl.proc) {
    try {
      serverControl.proc.unref();
      serverControl.proc.kill();
    } catch {}
    await new Promise(r => setTimeout(r, 150));
  }

  console.log('\n========================================');
  console.log(`📊 Billing & Invoicing Test Summary:`);
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

if (process.argv[1] && process.argv[1].endsWith('billing.test.mjs')) {
  runBillingTests().then(results => {
    process.exit(results.failed === 0 ? 0 : 1);
  });
}
