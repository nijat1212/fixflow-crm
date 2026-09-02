// LocalStorage persistence and reactive state manager for FixFlow CRM

import { INITIAL_JOBS, INITIAL_TECHNICIANS, INITIAL_USERS, generateSeedShifts } from '../mockData.js';

const STORAGE_KEYS = {
  USERS: 'fixflow_users_v1',
  SESSION: 'fixflow_session_v1',
  JOBS: 'fixflow_jobs_v1',
  TECHNICIANS: 'fixflow_techs_v1',
  SHIFTS: 'fixflow_shifts_v1'
};

class StorageManager {
  constructor() {
    this.listeners = [];
    this.initDefaults();
  }

  initDefaults() {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
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
  }

  // Subscribe to state changes
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify(event, data) {
    this.listeners.forEach(cb => cb(event, data));
  }

  // AUTHENTICATION & USERS
  getUsers() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  }

  getSession() {
    try {
      const sessStr = localStorage.getItem(STORAGE_KEYS.SESSION);
      return sessStr ? JSON.parse(sessStr) : null;
    } catch {
      return null;
    }
  }

  login(email, password) {
    const users = this.getUsers();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    const user = users.find(u => u.email.toLowerCase() === cleanEmail && u.password === cleanPass);

    if (user) {
      const sessionData = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        techId: user.techId || null
      };
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionData));
      this.notify('session_changed', sessionData);
      return { success: true, user: sessionData };
    } else {
      return { success: false, error: 'Invalid email or password.' };
    }
  }

  logout() {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    this.notify('session_changed', null);
  }

  createUser(userData) {
    const users = this.getUsers();
    const existing = users.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
    if (existing) {
      return { success: false, error: 'A user with this email address already exists.' };
    }

    const newUserId = `user_${Date.now()}`;
    let techId = null;

    // If new user is a Technician, auto-create a technician profile if needed
    if (userData.role === 'technician') {
      const techs = this.getTechnicians();
      techId = `tech_${techs.length + 1}`;
      
      const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];
      const avatarInitials = userData.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

      const newTech = {
        id: techId,
        name: userData.name,
        phone: userData.phone || '(555) 000-0000',
        email: userData.email,
        avatar: avatarInitials || 'WT',
        color: colors[techs.length % colors.length],
        specialties: userData.specialties || ['General Repairs'],
        rating: 5.0,
        jobsCompletedThisMonth: 0,
        revenueThisMonth: 0
      };
      techs.push(newTech);
      localStorage.setItem(STORAGE_KEYS.TECHNICIANS, JSON.stringify(techs));
    }

    const newUser = {
      id: newUserId,
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role: userData.role,
      techId: techId
    };

    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    this.notify('users_updated', users);
    return { success: true, user: newUser };
  }

  // Active Role Helper derived from session
  getRole() {
    const session = this.getSession();
    return session ? session.role : null;
  }

  getActiveTechId() {
    const session = this.getSession();
    return session ? session.techId : null;
  }

  // Technicians
  getTechnicians() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.TECHNICIANS)) || INITIAL_TECHNICIANS;
    } catch {
      return INITIAL_TECHNICIANS;
    }
  }

  getTechnicianById(id) {
    const techs = this.getTechnicians();
    return techs.find(t => t.id === id) || null;
  }

  // Jobs
  getJobs() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.JOBS)) || INITIAL_JOBS;
    } catch {
      return INITIAL_JOBS;
    }
  }

  getJobById(id) {
    const jobs = this.getJobs();
    return jobs.find(j => j.id === id) || null;
  }

  saveJob(jobData) {
    const jobs = this.getJobs();
    const existingIdx = jobs.findIndex(j => j.id === jobData.id);
    
    if (existingIdx >= 0) {
      jobs[existingIdx] = { ...jobs[existingIdx], ...jobData };
    } else {
      const nextNum = 1000 + jobs.length + 1;
      const newJob = {
        id: `JOB-${nextNum}`,
        status: jobData.assignedTechId ? 'Assigned' : 'Available',
        createdAt: new Date().toISOString(),
        laborCost: 0,
        partsCost: 0,
        partsUsed: [],
        ...jobData
      };
      jobs.unshift(newJob);
    }

    localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
    this.notify('jobs_updated', jobs);
    return true;
  }

  claimJob(jobId, techId) {
    const jobs = this.getJobs();
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      job.assignedTechId = techId;
      job.status = 'Accepted';
      localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
      this.notify('jobs_updated', jobs);
      return true;
    }
    return false;
  }

  updateJobStatus(jobId, newStatus, billingData = null) {
    const jobs = this.getJobs();
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      job.status = newStatus;
      if (billingData) {
        if (billingData.laborCost !== undefined) job.laborCost = parseFloat(billingData.laborCost) || 0;
        if (billingData.partsCost !== undefined) job.partsCost = parseFloat(billingData.partsCost) || 0;
        if (billingData.partsUsed) job.partsUsed = billingData.partsUsed;
        if (billingData.notes) job.notes = billingData.notes;
      }
      localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
      this.notify('jobs_updated', jobs);
      return true;
    }
    return false;
  }

  deleteJob(jobId) {
    let jobs = this.getJobs();
    jobs = jobs.filter(j => j.id !== jobId);
    localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
    this.notify('jobs_updated', jobs);
  }

  // Shifts
  getShifts() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.SHIFTS)) || generateSeedShifts();
    } catch {
      return generateSeedShifts();
    }
  }

  saveShift(techId, dateStr, shiftType) {
    const shifts = this.getShifts();
    const existingIdx = shifts.findIndex(s => s.techId === techId && s.date === dateStr);
    
    if (existingIdx >= 0) {
      shifts[existingIdx].shiftType = shiftType;
    } else {
      shifts.push({
        id: `shift_${techId}_${dateStr}`,
        techId,
        date: dateStr,
        shiftType
      });
    }

    localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));
    this.notify('shifts_updated', shifts);
  }

  // Reset to default seed
  resetData() {
    localStorage.clear();
    this.initDefaults();
    this.notify('data_reset');
  }
}

export const storage = new StorageManager();
