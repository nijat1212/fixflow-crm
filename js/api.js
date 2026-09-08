// FixFlow CRM — REST API Client (FastAPI Backend on Google Cloud)
// Direct HTTP fetch client with JWT Bearer authentication and snake_case <-> camelCase mapping

// Direct trusted HTTPS endpoint (Let's Encrypt SSL certificate configured on server)
const DEFAULT_API_BASE = 'https://34.63.55.225.sslip.io/api';

export const API_BASE = window.FIXFLOW_API_URL || 
  localStorage.getItem('fixflow_api_url') || 
  DEFAULT_API_BASE;

// ── Token Management ────────────────────────────────────────────────────────
const TOKEN_KEY = 'fixflow_jwt_token';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

// ── Generic Request Wrapper ──────────────────────────────────────────────────
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const errorMsg = (data && (data.detail || data.message || data.error)) || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
  }

  return data;
}

// ── Normalizers (Backend snake_case <-> Frontend camelCase) ───────────────────
export function normalizeJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    customerName: job.customer_name || job.customerName || '',
    phone: job.phone || '',
    address: job.address || '',
    city: job.city || 'Austin',
    zipCode: job.zip_code || job.zipCode || '78701',
    latitude: job.latitude !== undefined ? job.latitude : null,
    longitude: job.longitude !== undefined ? job.longitude : null,
    applianceType: job.appliance_type || job.applianceType || 'Appliance',
    brand: job.brand || '',
    issueDescription: job.issue_description || job.issueDescription || '',
    scheduledDate: job.scheduled_date || job.scheduledDate || '',
    scheduledTimeWindow: job.scheduled_time_window || job.scheduledTimeWindow || '',
    urgency: job.urgency || 'normal',
    status: job.status || 'draft_ticket',
    assignedTechId: job.assigned_tech_id !== undefined ? job.assigned_tech_id : job.assignedTechId || null,
    laborCost: job.labor_cost !== undefined ? job.labor_cost : (job.laborCost || 0),
    partsCost: job.parts_cost !== undefined ? job.parts_cost : (job.partsCost || 0),
    diagnosticFee: job.diagnostic_fee !== undefined ? job.diagnostic_fee : (job.diagnosticFee || 85),
    totalAmount: job.total_amount !== undefined ? job.total_amount : (job.totalAmount || 85),
    paymentStatus: job.payment_status || job.paymentStatus || 'unpaid',
    createdAt: job.created_at || job.createdAt || new Date().toISOString(),
    updatedAt: job.updated_at || job.updatedAt || new Date().toISOString(),
    timeline: (job.timeline || []).map(t => ({
      status: t.status,
      note: t.note,
      timestamp: t.timestamp
    }))
  };
}

export function jobToBackendPayload(jobData) {
  return {
    customer_name: jobData.customerName || jobData.customer_name,
    phone: jobData.phone,
    address: jobData.address,
    city: jobData.city || 'Austin',
    zip_code: jobData.zipCode || jobData.zip_code || '78701',
    latitude: jobData.latitude || null,
    longitude: jobData.longitude || null,
    appliance_type: jobData.applianceType || jobData.appliance_type,
    brand: jobData.brand,
    issue_description: jobData.issueDescription || jobData.issue_description,
    scheduled_date: jobData.scheduledDate || jobData.scheduled_date,
    scheduled_time_window: jobData.scheduledTimeWindow || jobData.scheduled_time_window,
    urgency: jobData.urgency || 'normal',
    assigned_tech_id: jobData.assignedTechId || jobData.assigned_tech_id || null
  };
}

export function normalizeTech(tech) {
  if (!tech) return null;
  return {
    id: tech.id,
    name: tech.name,
    email: tech.email,
    phone: tech.phone || '(555) 000-0000',
    avatar: tech.avatar || 'TK',
    color: tech.color || '#3b82f6',
    specialties: tech.specialties || ['General Repairs'],
    rating: tech.rating !== undefined ? tech.rating : 5.0,
    jobsCompletedThisMonth: tech.jobs_completed_this_month !== undefined ? tech.jobs_completed_this_month : (tech.jobsCompletedThisMonth || 0),
    revenueThisMonth: tech.revenue_this_month !== undefined ? tech.revenue_this_month : (tech.revenueThisMonth || 0),
    currentLat: tech.current_lat !== undefined ? tech.current_lat : null,
    currentLon: tech.current_lon !== undefined ? tech.current_lon : null,
    lastLocationUpdate: tech.last_location_update || null
  };
}

export function normalizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    uid: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    techId: user.tech_id !== undefined ? user.tech_id : (user.techId || null),
    createdAt: user.created_at || new Date().toISOString()
  };
}

export function normalizeShift(shift) {
  if (!shift) return null;
  return {
    id: shift.id,
    techId: shift.tech_id || shift.techId,
    date: shift.date,
    startTime: shift.start_time || shift.startTime,
    endTime: shift.end_time || shift.endTime,
    status: shift.status || 'scheduled'
  };
}

// ── API Service Modules ───────────────────────────────────────────────────────
export const api = {
  // Auth
  auth: {
    async login(email, password) {
      const res = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password })
      });
      setStoredToken(res.access_token);
      return {
        accessToken: res.access_token,
        tokenType: res.token_type,
        user: normalizeUser(res.user)
      };
    },

    async getMe() {
      const res = await request('/auth/me');
      return normalizeUser(res);
    },

    logout() {
      setStoredToken(null);
    }
  },

  // Jobs
  jobs: {
    async list(statusFilter = null) {
      const query = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : '';
      const list = await request(`/jobs${query}`);
      return (list || []).map(normalizeJob);
    },

    async get(id) {
      const job = await request(`/jobs/${id}`);
      return normalizeJob(job);
    },

    async create(jobData) {
      const payload = jobToBackendPayload(jobData);
      const res = await request('/jobs', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return normalizeJob(res);
    },

    async updateStatus(jobId, status, note = '', costs = {}) {
      const payload = {
        status,
        note,
        labor_cost: costs.laborCost !== undefined ? costs.laborCost : null,
        parts_cost: costs.partsCost !== undefined ? costs.partsCost : null,
        diagnostic_fee: costs.diagnosticFee !== undefined ? costs.diagnosticFee : null
      };
      const res = await request(`/jobs/${jobId}/status`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return normalizeJob(res);
    },

    async assign(jobId, techId) {
      const res = await request(`/jobs/${jobId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ tech_id: techId })
      });
      return normalizeJob(res);
    }
  },

  // Technicians
  technicians: {
    async list() {
      const list = await request('/technicians');
      return (list || []).map(normalizeTech);
    },

    async get(id) {
      const tech = await request(`/technicians/${id}`);
      return normalizeTech(tech);
    },

    async updateLocation(techId, lat, lon) {
      return await request(`/technicians/${techId}/location`, {
        method: 'POST',
        body: JSON.stringify({ lat: parseFloat(lat), lon: parseFloat(lon) })
      });
    }
  },

  // Shifts
  shifts: {
    async list() {
      const list = await request('/shifts');
      return (list || []).map(normalizeShift);
    },

    async create(shiftData) {
      const payload = {
        tech_id: shiftData.techId || shiftData.tech_id,
        date: shiftData.date,
        start_time: shiftData.startTime || shiftData.start_time,
        end_time: shiftData.endTime || shiftData.end_time,
        status: shiftData.status || 'scheduled'
      };
      const res = await request('/shifts', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return normalizeShift(res);
    },

    async delete(shiftId) {
      return await request(`/shifts/${shiftId}`, {
        method: 'DELETE'
      });
    }
  },

  // Staff
  staff: {
    async list() {
      const list = await request('/staff');
      return (list || []).map(normalizeUser);
    },

    async create(userData) {
      const payload = {
        name: userData.name,
        email: userData.email.trim().toLowerCase(),
        password: userData.password,
        role: userData.role,
        phone: userData.phone || '(555) 000-0000',
        tech_id: null
      };
      const res = await request('/staff', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return normalizeUser(res);
    },

    async resetPassword(userId, newPassword = null) {
      const payload = newPassword ? { new_password: newPassword } : {};
      return await request(`/staff/${userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
  },

  // System
  system: {
    async health() {
      return await request('/health');
    }
  }
};
