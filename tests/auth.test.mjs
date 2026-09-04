// tests/auth.test.mjs
// Automated CI/CD test for FixFlow CRM

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';
import path from 'path';

// Helper: load .env file if process.env is empty (for local testing)
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...rest] = trimmed.split('=');
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = rest.join('=').trim();
        }
      }
    }
  }
}

loadEnv();

const apiKey = process.env.VITE_FIREBASE_API_KEY;
const projectId = process.env.VITE_FIREBASE_PROJECT_ID;

if (!apiKey || !projectId) {
  console.log('⚠️ [SKIP] Firebase credentials not found in environment. Skipping live auth tests.');
  console.log('💡 Set VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID in GitHub Secrets or .env to enable.');
  process.exit(0);
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function runTests() {
  console.log('🧪 Starting FixFlow CI Automated Tests...\n');

  const users = [
    { email: 'owner@fixflow.com', pass: process.env.TEST_OWNER_PASSWORD },
    { email: 'dispatch@fixflow.com', pass: process.env.TEST_DISPATCH_PASSWORD },
    { email: 'mike@fixflow.com', pass: process.env.TEST_TECH1_PASSWORD },
    { email: 'marcus@fixflow.com', pass: process.env.TEST_TECH2_PASSWORD }
  ].filter(u => Boolean(u.pass));

  if (users.length === 0) {
    console.log('⚠️ [SKIP] No test passwords supplied in environment. Skipping credential tests.');
    process.exit(0);
  }

  let passed = 0;

  for (const u of users) {
    try {
      const res = await signInWithEmailAndPassword(auth, u.email, u.pass);
      if (res.user && res.user.uid) {
        console.log(`✅ [PASS] Auth for ${u.email}`);
        passed++;
      }
    } catch (err) {
      console.error(`❌ [FAIL] Auth failed for ${u.email}:`, err.message);
      process.exit(1);
    }
  }

  // Security test: invalid password must be rejected
  try {
    await signInWithEmailAndPassword(auth, 'owner@fixflow.com', 'wrong_pass_security_check');
    console.error('❌ [FAIL] Security test: Invalid credentials was unexpectedly accepted!');
    process.exit(1);
  } catch (err) {
    console.log(`✅ [PASS] Security check: Invalid password rejected (${err.code})`);
    passed++;
  }

  console.log(`\n🎉 All ${passed} tests passed successfully!`);
  process.exit(0);
}

runTests();
