// FixFlow CRM — Storage & State Manager
// Architecture: Python FastAPI REST Client (Google Cloud) with LocalStorage Caching & Event Bus

import { api, getStoredToken, setStoredToken } from '../api.js';
import { INITIAL_JOBS, INITIAL_TECHNICIANS, INITIAL_USERS, generateSeedShifts } from '../mockData.js';

const STORAGE_KEYS = {
  SESSION: 'fixflow_session_v2',
  JOBS: 'fixflow_jobs_v2',
  TECHNICIANS: 'fixflow_techs_v2',
  SHIFTS: 'fixflow_shifts_v2',
  USERS: 'fixflow_users_v2'
};

class StorageManager {
  constructor() {
    this.listeners = [];
    this._sessionCache = null;
    this._initLocalData();
    this._loadCachedSession();
  }

  // Initialize local fallback data if storage is completely empty
  _initLocalData() {
    // Purge any phantom timestamp jobs from previous test sessions
    try {
      const existing = localStorage.getItem(STORAGE_KEYS.JOBS);
      if (existing) {
        const parsed = JSON.parse(existing);
        const filtered = parsed.filter(item => !/^job_\d{10,}$/.test(item.id));
        if (filtered.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(filtered));
        }
      }
    } catch {
      // ignore
    }

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

  _loadCachedSession() {
    try {
      const s = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (s) {
        this._sessionCache = JSON.parse(s);
      }
    } catch {
      this._sessionCache = null;
    }
  }

  // ── Reactive Event Bus ──────────────────────────────────────────────────────
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify(event, data) {
    this.listeners.forEach(cb => {
      try {
        cb(event, data);
      } catch (err) {
        console.error('[FixFlow] Error in event subscriber:', err);
      }
    });
  }

  // ── Server Sync ─────────────────────────────────────────────────────────────
  async syncFromServer() {
    const token = getStoredToken();
    if (!token) return;

    try {
      // 1. Verify token & refresh active user profile
      const me = await api.auth.getMe();
      if (me) {
        this._sessionCache = me;
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(me));
      }

      // 2. Fetch fresh Technicians
      try {
        const techs = await api.technicians.list();
        if (techs && techs.length > 0) {
          localStorage.setItem(STORAGE_KEYS.TECHNICIANS, JSON.stringify(techs));
          this.notify('techs_changed', techs);
        }
      } catch (err) {
        console.warn('[FixFlow] Techs sync notice:', err.message);
      }

      // 3. Fetch fresh Jobs
      try {
        const jobs = await api.jobs.list();
        if (jobs) {
          localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
          this.notify('jobs_changed', jobs);
        }
      } catch (err) {
        console.warn('[FixFlow] Jobs sync notice:', err.message);
      }

      // 4. Fetch Shifts
      try {
        const shifts = await api.shifts.list();
        if (shifts) {
          localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));
          this.notify('shifts_changed', shifts);
        }
      } catch (err) {
        console.warn('[FixFlow] Shifts sync notice:', err.message);
      }

      // 5. If owner, fetch staff
      if (this.getRole() === 'owner') {
        try {
          const staff = await api.staff.list();
          if (staff && staff.length > 0) {
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(staff));
            this.notify('users_changed', staff);
          }
        } catch (err) {
          console.warn('[FixFlow] Staff sync notice:', err.message);
        }
      }

    } catch (err) {
      console.warn('[FixFlow] Token validation notice (session may have expired):', err.message);
      if (err.message.includes('401') || err.message.includes('credentials') || err.message.includes('expired')) {
        this.logout();
      }
    }
  }

  // ── Authentication ──────────────────────────────────────────────────────────
  getSession() {
    return this._sessionCache;
  }

  getRole() {
    return this._sessionCache ? this._sessionCache.role : null;
  }

  getActiveTechId() {
    return this._sessionCache ? this._sessionCache.techId : null;
  }

  async login(email, password) {
    try {
      const res = await api.auth.login(email, password);
      this._sessionCache = res.user;
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(res.user));

      // 1. Immediately switch the view/dashboard so the UI doesn't hang
      this.notify('session_changed', res.user);

      // 2. Synchronize data from FastAPI server in the background (non-blocking)
      this.syncFromServer().catch(err => {
        console.warn('[FixFlow] Background sync notice:', err);
      });

      return { success: true, user: res.user };
    } catch (err) {
      console.error('[FixFlow] Login failed:', err);
      let msg = err.message || 'Invalid email or password.';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        msg = 'Cannot reach API server. Please verify your connection or try again in a moment.';
      }
      return { success: false, error: msg };
    }
  }

  logout() {
    api.auth.logout();
    this._sessionCache = null;
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    this.notify('session_changed', null);
  }

  // ── Users / Staff Management ────────────────────────────────────────────────
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

  async createUser(userData) {
    try {
      const newUser = await api.staff.create(userData);
      
      // Re-fetch users and technicians from server
      const updatedStaff = await api.staff.list();
      this.saveUsers(updatedStaff);

      if (userData.role === 'technician') {
        const updatedTechs = await api.technicians.list();
        this.saveTechnicians(updatedTechs);
      }

      return { success: true, user: newUser };
    } catch (err) {
      console.error('[FixFlow] Create user error:', err);
      return { success: false, error: err.message };
    }
  }

  async resetUserPassword(userId, newPassword = null) {
    try {
      const res = await api.staff.resetPassword(userId, newPassword);
      return { success: true, ...res };
    } catch (err) {
      console.error('[FixFlow] Reset password error:', err);
      return { success: false, error: err.message };
    }
  }

  // ── Technicians ─────────────────────────────────────────────────────────────
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

  async updateTechnicianLocation(techId, lat, lon) {
    try {
      await api.technicians.updateLocation(techId, lat, lon);
      const techs = this.getTechnicians();
      const tech = techs.find(t => t.id === techId);
      if (tech) {
        tech.currentLat = lat;
        tech.currentLon = lon;
        this.saveTechnicians(techs);
      }
    } catch (err) {
      console.warn('[FixFlow] Failed to update location on server:', err.message);
    }
  }

  // ── Jobs ────────────────────────────────────────────────────────────────────
  getJobs() {
    try {
      const j = localStorage.getItem(STORAGE_KEYS.JOBS);
      let jobs = j ? JSON.parse(j) : INITIAL_JOBS;
      // Auto-purge any client-side temporary or phantom jobs (numeric timestamp IDs)
      const cleaned = (jobs || []).filter(item => item && !/^job_\d{10,}$/.test(item.id));
      if (cleaned.length !== jobs.length) {
        localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(cleaned));
        jobs = cleaned;
      }
      return jobs;
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

  async saveJob(jobData) {
    if (this.getRole() === 'technician') {
      throw new Error('Access denied: Technicians are not authorized to create tickets.');
    }
    try {
      const newJob = await api.jobs.create(jobData);
      const currentJobs = this.getJobs();
      const updated = [newJob, ...currentJobs.filter(j => j.id !== newJob.id)];
      this.saveJobs(updated);
      this.notify('jobs_changed', updated);
      return newJob;
    } catch (err) {
      // Never create fake local tickets on permission errors (403 Forbidden)
      if (err.message && (err.message.includes('403') || err.message.toLowerCase().includes('forbidden') || err.message.toLowerCase().includes('denied'))) {
        throw err;
      }
      console.warn('[FixFlow] Remote saveJob notice:', err.message);
      throw err;
    }
  }

  async updateJob(jobId, jobData) {
    try {
      const updated = await api.jobs.update(jobId, jobData);
      const currentJobs = this.getJobs();
      const idx = currentJobs.findIndex(j => j.id === jobId);
      if (idx >= 0) {
        currentJobs[idx] = updated;
      } else {
        currentJobs.unshift(updated);
      }
      this.saveJobs(currentJobs);
      return updated;
    } catch (err) {
      console.warn('[FixFlow] Remote updateJob error, falling back to local:', err.message);
      const currentJobs = this.getJobs();
      const idx = currentJobs.findIndex(j => j.id === jobId);
      if (idx >= 0) {
        const merged = { ...currentJobs[idx], ...jobData, updatedAt: new Date().toISOString() };
        currentJobs[idx] = merged;
        this.saveJobs(currentJobs);
        return merged;
      }
      return null;
    }
  }

  async deleteJob(jobId) {
    try {
      await api.jobs.delete(jobId);
    } catch (err) {
      console.warn('[FixFlow] Remote deleteJob notice:', err.message);
      throw err;
    }
    const currentJobs = this.getJobs();
    const filtered = currentJobs.filter(j => j.id !== jobId);
    this.saveJobs(filtered);
    this.notify('jobs_changed', filtered);
    return true;
  }

  async updateJobStatus(jobId, newStatus, note = '', costs = {}) {
    if (typeof note === 'object' && note !== null) {
      costs = note;
      note = costs.notes || costs.note || '';
    }
    try {
      const updated = await api.jobs.updateStatus(jobId, newStatus, note, costs);
      const currentJobs = this.getJobs();
      const idx = currentJobs.findIndex(j => j.id === jobId);
      if (idx >= 0) {
        currentJobs[idx] = updated;
      } else {
        currentJobs.unshift(updated);
      }
      this.saveJobs(currentJobs);
      return true;
    } catch (err) {
      console.warn('[FixFlow] Remote updateJobStatus notice:', err.message);
      // Local optimistic update
      const jobs = this.getJobs();
      const job = jobs.find(j => j.id === jobId);
      if (!job) return false;
      job.status = newStatus;
      job.updatedAt = new Date().toISOString();
      if (!job.timeline) job.timeline = [];
      job.timeline.push({ timestamp: new Date().toISOString(), status: newStatus, note: note || `Status: ${newStatus}` });
      this.saveJobs(jobs);
      return true;
    }
  }

  async assignJob(jobId, techId) {
    try {
      const updated = await api.jobs.assign(jobId, techId);
      const currentJobs = this.getJobs();
      const idx = currentJobs.findIndex(j => j.id === jobId);
      if (idx >= 0) {
        currentJobs[idx] = updated;
      } else {
        currentJobs.unshift(updated);
      }
      this.saveJobs(currentJobs);
      return true;
    } catch (err) {
      console.warn('[FixFlow] Remote assignJob notice:', err.message);
      const jobs = this.getJobs();
      const job = jobs.find(j => j.id === jobId);
      if (!job) return false;
      job.assignedTechId = techId;
      job.status = 'scheduled';
      job.updatedAt = new Date().toISOString();
      if (!job.timeline) job.timeline = [];
      job.timeline.push({ timestamp: new Date().toISOString(), status: 'scheduled', note: `Assigned to ${techId}` });
      this.saveJobs(jobs);
      return true;
    }
  }

  async claimJob(jobId, techId) {
    return await this.assignJob(jobId, techId);
  }

  // ── Shifts & Scheduling ─────────────────────────────────────────────────────
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

  async saveShift(shiftData) {
    try {
      const newShift = await api.shifts.create(shiftData);
      const shifts = this.getShifts();
      const updated = [...shifts.filter(s => s.id !== newShift.id), newShift];
      this.saveShifts(updated);
      return newShift;
    } catch (err) {
      console.warn('[FixFlow] Remote saveShift notice:', err.message);
      const shifts = this.getShifts();
      const fallback = { ...shiftData, id: shiftData.id || `shift_${Date.now()}` };
      this.saveShifts([...shifts, fallback]);
      return fallback;
    }
  }

  async deleteShift(shiftId) {
    try {
      await api.shifts.delete(shiftId);
    } catch (err) {
      console.warn('[FixFlow] Remote deleteShift notice:', err.message);
    }
    const shifts = this.getShifts().filter(s => s.id !== shiftId);
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
