/**
 * API Client
 * Centralized fetch wrapper with error handling
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

class ApiError extends Error {
  constructor(message, status, code, details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Base fetch wrapper with common configuration
 */
async function fetchApi(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  
  const config = {
    credentials: 'include', // Include cookies for auth
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };
  
  // Don't set Content-Type for FormData
  if (options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  
  // Stringify JSON body
  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }
  
  try {
    const response = await fetch(url, config);
    
    // Parse JSON response
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    // Handle error responses
    if (!response.ok) {
      throw new ApiError(
        data.error || 'Request failed',
        response.status,
        data.code || 'UNKNOWN_ERROR',
        data.details
      );
    }
    
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Network or other errors
    throw new ApiError(
      error.message || 'Network error',
      0,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Auth API
 */
export const auth = {
  // 2FA step 1 — verify password, receive OTP
  login: (email, password) =>
    fetchApi('/api/auth/login', { method: 'POST', body: { email, password } }),

  // 2FA register — create account, receive OTP for email verification
  register: (data) =>
    fetchApi('/api/auth/register', { method: 'POST', body: data }),

  // Legacy OTP-only (kept for backward compat / admin use)
  requestOtp: (email) =>
    fetchApi('/api/auth/request-otp', { method: 'POST', body: { email } }),

  // 2FA step 2 (and legacy OTP final step)
  verifyOtp: (data) =>
    fetchApi('/api/auth/verify-otp', { method: 'POST', body: data }),

  logout: () =>
    fetchApi('/api/auth/logout', { method: 'POST' }),

  me: () =>
    fetchApi('/api/auth/me'),
};

/**
 * Elections API (Student)
 */
export const elections = {
  list: () => 
    fetchApi('/api/elections'),
  
  get: (id) => 
    fetchApi(`/api/elections/${id}`),
  
  vote: (id, candidateId) => 
    fetchApi(`/api/elections/${id}/vote`, { method: 'POST', body: { candidateId } }),
  
  status: (id) => 
    fetchApi(`/api/elections/${id}/status`),
  
  results: (id) => 
    fetchApi(`/api/elections/${id}/results`),
  
  receipt: (id, token) => 
    fetchApi(`/api/elections/${id}/receipt/${token}`),
};

/**
 * Admin API
 */
export const admin = {
  elections: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return fetchApi(`/api/admin/elections${query ? `?${query}` : ''}`);
    },
    
    create: (data) => 
      fetchApi('/api/admin/elections', { method: 'POST', body: data }),
    
    get: (id) => 
      fetchApi(`/api/admin/elections/${id}`),
    
    update: (id, data) => 
      fetchApi(`/api/admin/elections/${id}`, { method: 'PUT', body: data }),
    
    delete: (id) => 
      fetchApi(`/api/admin/elections/${id}`, { method: 'DELETE' }),
    
    open: (id) => 
      fetchApi(`/api/admin/elections/${id}/open`, { method: 'POST' }),
    
    close: (id) =>
      fetchApi(`/api/admin/elections/${id}/close`, { method: 'POST' }),

    analytics: (id) =>
      fetchApi(`/api/admin/elections/${id}/analytics`),

    // Returns { results: [...candidates with vote_count] }
    results: (id) =>
      fetchApi(`/api/admin/elections/${id}/analytics`).then(d => ({
        results: d.candidates || [],
      })),
  },
  
  candidates: {
    add: (electionId, data) => 
      fetchApi(`/api/admin/elections/${electionId}/candidates`, { method: 'POST', body: data }),
    
    update: (id, data) => 
      fetchApi(`/api/admin/candidates/${id}`, { method: 'PUT', body: data }),
    
    delete: (id) => 
      fetchApi(`/api/admin/candidates/${id}`, { method: 'DELETE' }),
  },
  
  auditLog: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/api/admin/audit-log${query ? `?${query}` : ''}`);
  },
  
  users: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/api/admin/users${query ? `?${query}` : ''}`);
  },
};

export { ApiError, fetchApi };
