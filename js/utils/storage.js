// FixFlow CRM — Storage Manager
// Auth: Firebase Authentication (Email/Password)
// Data: LocalStorage (Jobs, Shifts, Technicians, Users)
// Remote: Cloud Firestore (Users, Technicians) with resilient offline fallback

import { INITIAL_JOBS, INITIAL_TECHNICIANS, INITIAL_USERS, generateSeedShifts } from '../mockData.js';
import { auth, db } from '../firebase.js';
import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  getAuth
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs
} from 'firebase/firestore';

const STORAGE_KEYS = {
  SESSION: 'fixflow_session_v1',
  JOBS: 'fixflow_jobs_v1',
  TECHNICIANS: 'fixflow_techs_v1',
  SHIFTS: 'fixflow_shifts_v1',
  USERS: 'fixflow_users_v1'
};

// Known system roles fallback
const KNOWN_ROLES = {
  'owner@fixflow.com': { name: 'Business Owner', role: 'owner', techId: null },
  'dispatch@fixflow.com': { name: 'Sarah (Dispatch)', role: 'dispatcher', techId: null },
  'mike@fixflow.com': { name: 'Mike Miller', role: 'technician', techId: 'tech_1' },
  'marcus@fixflow.com': { name: 'Marcus Vance', role: 'technician', techId: 'tech_2' }
};

class StorageManager {
  constructor() {
    this.listeners = [];
    this._sessionCache = null;
    this._initLocalData();
    this._watchAuthState();
    this._syncFromFirestore();
  }

  // Initialize LocalStorage data on first load
  _initLocalData() {
    if (!localStorage.getItem(STORAGE_KEYS.JOBS)) {
      localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(INITIAL_JOBS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.TECHNICIANS)) {
      localStorage.setItem(STORAGE_KEYS.TECHNICIANS, JSON.stringify(INITIAL_TECHNICIANS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SHIFTS)) {
      localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(generateSeedShifts()));
    }
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    }
  }

  // Background sync of Firestore users into local cache
  async _syncFromFirestore() {
    try {
      const snap = await getDocs(collection(db, 'users'));
      if (!snap.empty) {
        const firestoreUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const localUsers = this.getUsers();
        
        // Merge without duplicating emails
        const merged = [...localUsers];
        for (const fu of firestoreUsers) {
          const idx = merged.findIndex(u => u.email.toLowerCase() === fu.email.toLowerCase());
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], ...fu };
          } else {
            merged.push(fu);
          }
        }
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
        this.notify('users_changed', merged);
      }
    } catch (err) {
      console.warn('[FixFlow] Firestore background sync notice:', err.message);
    }
  }

  // Resolve user profile from Firestore or local users
  async _resolveProfile(firebaseUser) {
    const email = (firebaseUser.email || '').toLowerCase().trim();
    const localUser = this.getUsers().find(u => u.email.toLowerCase() === email);

    const fallback = KNOWN_ROLES[email] || {
      name: localUser ? localUser.name : (firebaseUser.displayName || email.split('@')[0] || 'User'),
      role: localUser ? localUser.role : 'technician',
      techId: localUser ? localUser.techId : null
    };

    try {
      // 1. Try fetching by uid
      let userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      // 2. If not found by uid, try by email
      if (!userDoc.exists() && email) {
        userDoc = await getDoc(doc(db, 'users', email));
      }

      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          name: data.name || firebaseUser.displayName || fallback.name,
          role: data.role || fallback.role,
          techId: data.techId !== undefined ? data.techId : fallback.techId
        };
      }
    } catch (err) {
      console.warn('[FixFlow] Firestore read profile notice (using Auth/Local profile):', err.message);
    }

    return {
      name: firebaseUser.displayName || fallback.name,
      role: fallback.role,
      techId: fallback.techId
    };
  }

  // Watch Firebase Auth state changes
  _watchAuthState() {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await this._resolveProfile(firebaseUser);
        this._sessionCache = {
          uid: firebaseUser.uid,
          id: firebaseUser.uid,
          name: profile.name,
          email: firebaseUser.email,
          role: profile.role,
          techId: profile.techId
        };
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(this._sessionCache));
        this.notify('session_changed', this._sessionCache);
      } else {
        this._sessionCache = null;
        localStorage.removeItem(STORAGE_KEYS.SESSION);
        this.notify('session_changed', null);
      }
    });
  }

  // ── Reactive Event Bus ──────────────────────────────────────────────────────
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify(event, data) {
    this.listeners.forEach(cb => cb(event, data));
  }

  // ── Authentication ──────────────────────────────────────────────────────────

  getSession() {
    if (this._sessionCache) return this._sessionCache;
    try {
      const s = localStorage.getItem(STORAGE_KEYS.SESSION);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }

  // Firebase Email/Password login with hybrid fallback
  async login(email, password) {
    const cleanedEmail = (email || '').trim().toLowerCase();
    const cleanedPass = (password || '').trim();

    try {
      // Attempt 1: Standard Firebase Auth
      const credential = await signInWithEmailAndPassword(auth, cleanedEmail, cleanedPass);
      const firebaseUser = credential.user;

      const profile = await this._resolveProfile(firebaseUser);
      const sessionData = {
        uid: firebaseUser.uid,
        id: firebaseUser.uid,
        name: profile.name,
        email: firebaseUser.email,
        role: profile.role,
        techId: profile.techId
      };

      this._sessionCache = sessionData;
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionData));
      this.notify('session_changed', sessionData);
      return { success: true, user: sessionData };

    } catch (err) {
      console.warn('[FixFlow] Firebase Auth failed, attempting hybrid Firestore/Local fallback...', err.message);

      // Attempt 2: Hybrid fallback via Firestore users collection
      try {
        const userDoc = await getDoc(doc(db, 'users', cleanedEmail));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.password && userData.password === cleanedPass) {
            const sessionData = {
              uid: userData.uid || userData.id || `fallback_${Date.now()}`,
              id: userData.id || userData.uid || `fallback_${Date.now()}`,
              name: userData.name,
              email: userData.email,
              role: userData.role,
              techId: userData.techId || null
            };

            this._sessionCache = sessionData;
            localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionData));
            this.notify('session_changed', sessionData);
            return { success: true, user: sessionData };
          }
        }
      } catch (firestoreErr) {
        console.warn('[FixFlow] Firestore fallback notice:', firestoreErr.message);
      }

      // Attempt 3: Local cache fallback (for newly created offline staff)
      try {
        const localUser = this.getUsers().find(u => u.email.toLowerCase() === cleanedEmail);
        if (localUser && localUser.password && localUser.password === cleanedPass) {
          const sessionData = {
            uid: localUser.id || `local_${Date.now()}`,
            id: localUser.id || `local_${Date.now()}`,
            name: localUser.name,
            email: localUser.email,
            role: localUser.role,
            techId: localUser.techId || null
          };

          this._sessionCache = sessionData;
          localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionData));
          this.notify('session_changed', sessionData);
          return { success: true, user: sessionData };
        }
      } catch (localErr) {
        console.warn('[FixFlow] Local fallback error:', localErr);
      }

      const msg = this._friendlyAuthError(err.code);
      return { success: false, error: msg };
    }
  }

  _friendlyAuthError(code) {
    const map = {
      'auth/invalid-email': 'Invalid email address format.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/too-many-requests': 'Too many failed attempts. Try again later.',
      'auth/network-request-failed': 'Network error. Check your internet connection.'
    };
    return map[code] || 'Login failed. Please try again.';
  }

  async logout() {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('[FixFlow] Sign out error:', err);
    }
    this._sessionCache = null;
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    this.notify('session_changed', null);
  }

  // ── Staff Management & User Creation ────────────────────────────────────────
  // Create user in Firebase Auth (via secondary instance) + Firestore
  async createUser(userData) {
    try {
      const cleanedEmail = userData.email.trim().toLowerCase();
      
      // 1. Check local cache & Firestore for duplicates
      const existingUsers = this.getUsers();
      if (existingUsers.some(u => u.email.toLowerCase() === cleanedEmail)) {
        return { success: false, error: 'A worker with this email address already exists.' };
      }

      const userDocRef = doc(db, 'users', cleanedEmail);
      try {
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          return { success: false, error: 'A worker with this email address already exists in Firestore.' };
        }
      } catch (fErr) {
        console.warn('[FixFlow] Firestore duplicate check notice:', fErr.message);
      }

      // 2. Initialize secondary Firebase app instance to create Auth user without logging out admin
      let uid = `user_${Date.now()}`;
      try {
        const firebaseConfig = {
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID,
          measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
        };

        let secondaryApp;
        if (getApps().find(app => app.name === 'Secondary')) {
          secondaryApp = getApp('Secondary');
        } else {
          secondaryApp = initializeApp(firebaseConfig, 'Secondary');
        }
        const secondaryAuth = getAuth(secondaryApp);

        // Create user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, cleanedEmail, userData.password);
        uid = userCredential.user.uid;

        // Immediately sign out secondary auth so it does not interfere
        await signOut(secondaryAuth);
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
          console.warn('[FixFlow] Email already exists in Auth, continuing profile creation...');
        } else {
          console.warn('[FixFlow] Secondary auth notice:', authErr.message);
        }
      }

      // 3. If role is technician, create technician profile
      let techId = null;
      if (userData.role === 'technician') {
        const currentTechs = this.getTechnicians();
        techId = `tech_${currentTechs.length + 1}`;
        const newTech = {
          id: techId,
          name: userData.name,
          phone: userData.phone || '(555) 000-0000',
          email: cleanedEmail,
          avatar: userData.name.split(' ').map(n => n[0] || '').join('').substring(0, 2).toUpperCase() || 'TK',
          color: '#3b82f6',
          specialties: ['General Repairs'],
          rating: 5.0,
          jobsCompletedThisMonth: 0,
          revenueThisMonth: 0
        };

        try {
          await setDoc(doc(db, "technicians", techId), newTech);
        } catch (tErr) {
          console.warn('[FixFlow] Firestore setDoc technician notice:', tErr.message);
        }

        this.saveTechnicians([...currentTechs, newTech]);
      }

      // 4. Record profile in Firestore
      const newUser = {
        id: uid,
        uid: uid,
        name: userData.name,
        email: cleanedEmail,
        password: userData.password,
        role: userData.role,
        techId: techId
      };

      try {
        await setDoc(userDocRef, newUser);
      } catch (uErr) {
        console.warn('[FixFlow] Firestore setDoc user notice:', uErr.message);
      }

      // 5. Save to local storage and trigger UI reactivity
      this.saveUsers([...existingUsers, newUser]);

      return { success: true, user: newUser };

    } catch (err) {
      console.error('[FixFlow] Error in createUser:', err);
      return { success: false, error: err.message };
    }
  }

  // Active role helpers
  getRole() {
    const s = this.getSession();
    return s ? s.role : null;
  }

  getActiveTechId() {
    const s = this.getSession();
    return s ? s.techId : null;
  }

  // ── Users List (Synchronous for smooth UI rendering) ────────────────────────
  getUsers() {
    try {
      const u = localStorage.getItem(STORAGE_KEYS.USERS);
      return u ? JSON.parse(u) : INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  }

  saveUsers(users) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    this.notify('users_changed', users);
  }

  // ── Technicians (LocalStorage) ──────────────────────────────────────────────
  getTechnicians() {
    try {
      const t = localStorage.getItem(STORAGE_KEYS.TECHNICIANS);
      return t ? JSON.parse(t) : INITIAL_TECHNICIANS;
    } catch {
      return INITIAL_TECHNICIANS;
    }
  }

  saveTechnicians(techs) {
    localStorage.setItem(STORAGE_KEYS.TECHNICIANS, JSON.stringify(techs));
    this.notify('techs_changed', techs);
  }

  getTechnicianById(id) {
    const techs = this.getTechnicians();
    return techs.find(t => t.id === id) || null;
  }

  // ── Jobs (LocalStorage) ─────────────────────────────────────────────────────
  getJobs() {
    try {
      const j = localStorage.getItem(STORAGE_KEYS.JOBS);
      return j ? JSON.parse(j) : INITIAL_JOBS;
    } catch {
      return INITIAL_JOBS;
    }
  }

  saveJobs(jobs) {
    localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
    this.notify('jobs_changed', jobs);
  }

  getJobById(id) {
    const jobs = this.getJobs();
    return jobs.find(j => j.id === jobId);
  }

  saveJob(jobData) {
    const jobs = this.getJobs();
    const existingIndex = jobs.findIndex(j => j.id === jobData.id);

    if (existingIndex >= 0) {
      jobs[existingIndex] = { ...jobs[existingIndex], ...jobData, updatedAt: new Date().toISOString() };
    } else {
      const newJob = {
        ...jobData,
        id: jobData.id || `job_${Date.now()}`,
        status: jobData.status || 'draft_ticket',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeline: [
          {
            timestamp: new Date().toISOString(),
            status: 'draft_ticket',
            note: 'Ticket created in FixFlow CRM.'
          }
        ]
      };
      jobs.unshift(newJob);
    }

    this.saveJobs(jobs);
  }

  updateJobStatus(jobId, newStatus, note = '') {
    const jobs = this.getJobs();
    const job = jobs.find(j => j.id === jobId);
    if (!job) return false;

    job.status = newStatus;
    job.updatedAt = new Date().toISOString();
    if (!job.timeline) job.timeline = [];
    job.timeline.push({
      timestamp: new Date().toISOString(),
      status: newStatus,
      note: note || `Status updated to ${newStatus}`
    });

    this.saveJobs(jobs);
    return true;
  }

  assignJob(jobId, techId) {
    const jobs = this.getJobs();
    const job = jobs.find(j => j.id === jobId);
    if (!job) return false;

    job.assignedTechId = techId;
    job.status = 'scheduled';
    job.updatedAt = new Date().toISOString();
    if (!job.timeline) job.timeline = [];
    job.timeline.push({
      timestamp: new Date().toISOString(),
      status: 'scheduled',
      note: `Assigned to technician ${techId}`
    });

    this.saveJobs(jobs);
    return true;
  }

  // ── Shifts (LocalStorage) ───────────────────────────────────────────────────
  getShifts() {
    try {
      const s = localStorage.getItem(STORAGE_KEYS.SHIFTS);
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  }

  saveShifts(shifts) {
    localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));
    this.notify('shifts_changed', shifts);
  }

  saveShift(shiftData) {
    const shifts = this.getShifts();
    const existingIndex = shifts.findIndex(s => s.id === shiftData.id);

    if (existingIndex >= 0) {
      shifts[existingIndex] = { ...shifts[existingIndex], ...shiftData };
    } else {
      shifts.push({ ...shiftData, id: shiftData.id || `shift_${Date.now()}` });
    }

    this.saveShifts(shifts);
  }

  deleteShift(shiftId) {
    let shifts = this.getShifts();
    shifts = shifts.filter(s => s.id !== shiftId);
    this.saveShifts(shifts);
  }

  // ── Reset to Seed Data ──────────────────────────────────────────────────────
  resetData() {
    localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(INITIAL_JOBS));
    localStorage.setItem(STORAGE_KEYS.TECHNICIANS, JSON.stringify(INITIAL_TECHNICIANS));
    localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(generateSeedShifts()));
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    this.notify('data_reset', null);
  }
}

export const storage = new StorageManager();
