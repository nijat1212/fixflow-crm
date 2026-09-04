// FixFlow CRM — Storage Manager
// Auth: Firebase Authentication (Email/Password)
// Data: LocalStorage (Jobs, Shifts, Technicians)
// Roles: Firestore with resilient Auth-based fallback

import { INITIAL_JOBS, INITIAL_TECHNICIANS, INITIAL_USERS, generateSeedShifts } from '../mockData.js';
import { auth, db } from '../firebase.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  doc,
  getDoc,
  collection,
  getDocs
} from 'firebase/firestore';

const STORAGE_KEYS = {
  SESSION: 'fixflow_session_v1',
  JOBS: 'fixflow_jobs_v1',
  TECHNICIANS: 'fixflow_techs_v1',
  SHIFTS: 'fixflow_shifts_v1'
};

// Known system roles fallback if Firestore document is not yet provisioned
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
  }

  // Initialize LocalStorage data (jobs, shifts, techs) on first load
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
  }

  // Resolve user profile from Firestore or fallback mapping
  async _resolveProfile(firebaseUser) {
    const email = (firebaseUser.email || '').toLowerCase().trim();
    const fallback = KNOWN_ROLES[email] || {
      name: firebaseUser.displayName || email.split('@')[0] || 'User',
      role: 'technician',
      techId: null
    };

    try {
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          name: data.name || firebaseUser.displayName || fallback.name,
          role: data.role || fallback.role,
          techId: data.techId !== undefined ? data.techId : fallback.techId
        };
      }
    } catch (err) {
      console.warn('[FixFlow] Firestore read profile notice (using Auth profile):', err.message);
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

  // Firebase Email/Password login
  async login(email, password) {
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password.trim());
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

  // Create user in Firebase Auth + Firestore (called from Staff panel)
  async createUser(userData) {
    return { success: false, error: 'Staff account creation is managed via Firebase Console.' };
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

  // ── Users List ──────────────────────────────────────────────────────────────
  async getUsers() {
    try {
      const snap = await getDocs(collection(db, 'users'));
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (err) {
      console.warn('[FixFlow] Firestore getUsers notice (using default staff):', err.message);
    }
    return INITIAL_USERS;
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
    return jobs.find(j => j.id === id) || null;
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
    this.notify('data_reset', null);
  }
}

export const storage = new StorageManager();
