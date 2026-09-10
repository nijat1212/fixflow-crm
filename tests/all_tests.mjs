// tests/all_tests.mjs
// Master QA Test Runner & Reporting Engine for FixFlow CRM

import { spawn } from 'child_process';
import path from 'path';

const SUITES = [
  {
    id: 'auth',
    name: '1. Auth & Domain Security',
    file: 'tests/auth.test.mjs'
  },
  {
    id: 'jobs',
    name: '2. Jobs & Calendar Matrix',
    file: 'tests/jobs.test.mjs'
  },
  {
    id: 'staff',
    name: '3. Staff Management & RBAC',
    file: 'tests/staff.test.mjs'
  },
  {
    id: 'billing',
    name: '4. Billing & Invoicing',
    file: 'tests/billing.test.mjs'
  },
  {
    id: 'shifts',
    name: '5. Shifts & Duty Calendar',
    file: 'tests/shifts.test.mjs'
  },
  {
    id: 'tech_geo',
    name: '6. Tech Geolocation & Analytics',
    file: 'tests/tech_geo.test.mjs'
  }
];

function runSuiteProcess(suite) {
  return new Promise((resolve) => {
    const fullPath = path.resolve(process.cwd(), suite.file);
    const proc = spawn('node', [fullPath], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    proc.on('close', (code) => {
      // Parse passed and failed test count from output
      const passMatches = stdout.match(/✅\s*\[PASS\]/g) || [];
      const failMatches = stdout.match(/❌\s*\[FAIL\]/g) || [];

      let passed = passMatches.length;
      let failed = failMatches.length;

      if (code !== 0 && failed === 0) {
        failed = 1;
      }

      resolve({
        ...suite,
        passed,
        failed,
        total: passed + failed,
        code
      });
    });
  });
}

function pad(str, len, align = 'left') {
  str = String(str);
  if (str.length >= len) return str.slice(0, len);
  const diff = len - str.length;
  if (align === 'right') return ' '.repeat(diff) + str;
  if (align === 'center') {
    const left = Math.floor(diff / 2);
    const right = diff - left;
    return ' '.repeat(left) + str + ' '.repeat(right);
  }
  return str + ' '.repeat(diff);
}

export async function runAllSuites() {
  console.log('\n======================================================================');
  console.log('⚡ FixFlow CRM — Unified Master QA Automated Test Suite Runner');
  console.log('Target: Google Cloud Production API (https://24fix.us) & Local Backend');
  console.log('======================================================================\n');

  const startTime = Date.now();
  const results = [];

  for (const suite of SUITES) {
    console.log(`\n──────────────────────────────────────────────────────────────────────`);
    console.log(`▶ Running Suite: ${suite.name} (${suite.file})`);
    console.log(`──────────────────────────────────────────────────────────────────────`);
    const res = await runSuiteProcess(suite);
    results.push(res);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const totalTests = totalPassed + totalFailed;
  const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0.0';

  // ── Executive Summary Table ────────────────────────────────────────────────
  console.log('\n\n================================================================================');
  console.log('📊 FIXFLOW CRM — MASTER AUTOMATED TEST EXECUTION SUMMARY REPORT');
  console.log('================================================================================\n');

  console.log('┌───────────────────────────────────────────────────┬────────────┬────────────┬─────────────┬──────────┐');
  console.log('│ Test Suite Description                            │ Passed     │ Failed     │ Total Tests │ Status   │');
  console.log('├───────────────────────────────────────────────────┼────────────┼────────────┼─────────────┼──────────┤');

  for (const r of results) {
    const statusStr = r.failed === 0 ? '✅ PASS' : '❌ FAIL';
    console.log(
      `│ ${pad(r.name, 49)} │ ${pad(r.passed, 10, 'center')} │ ${pad(r.failed, 10, 'center')} │ ${pad(r.total, 11, 'center')} │ ${pad(statusStr, 8, 'center')} │`
    );
  }

  console.log('├───────────────────────────────────────────────────┼────────────┼────────────┼─────────────┼──────────┤');
  const allStatus = totalFailed === 0 ? '100% OK' : 'FAILED';
  console.log(
    `│ ${pad('TOTAL COMPREHENSIVE TEST METRICS', 49)} │ ${pad(totalPassed, 10, 'center')} │ ${pad(totalFailed, 10, 'center')} │ ${pad(totalTests, 11, 'center')} │ ${pad(allStatus, 8, 'center')} │`
  );
  console.log('└───────────────────────────────────────────────────┴────────────┴────────────┴─────────────┴──────────┘\n');

  console.log(`⏱ Total Execution Time: ${durationSec}s`);
  console.log(`🎯 Pass Rate:           ${passRate}% (${totalPassed}/${totalTests} Passed)`);

  if (totalFailed === 0) {
    console.log('\n🎉 ALL 44+ AUTOMATED TESTS PASSED WITH 100% SUCCESS RATE!');
    console.log('🔒 Security, RBAC, Billing, Shifts, Geolocation & Database are Production Ready.\n');
    return 0;
  } else {
    console.error(`\n⚠️ ${totalFailed} TEST(S) FAILED. Please review the detailed logs above.\n`);
    return 1;
  }
}

runAllSuites().then((code) => {
  process.exit(code);
});
