import axios from 'axios'
import { supabase } from './supabaseClient'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL
const API_BASE = `${BACKEND_URL}/api`

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  
  return config
})

// Device APIs
export const deviceAPI = {
  list: (params = {}) => api.get('/devices', { params }),
  get: (id) => api.get(`/devices/${id}`),
  create: (data) => api.post('/devices', data),
  update: (id, data) => api.put(`/devices/${id}`, null, { params: data }),
  delete: (id) => api.delete(`/devices/${id}`),
  // New device control APIs
  disable: (id) => api.put(`/devices/${id}`, null, { params: { city: null } }), // Soft disable
  forceRefresh: (id) => api.post(`/devices/${id}/refresh`),
}

// Driver APIs
export const driverAPI = {
  list: () => api.get('/drivers'),
  create: (data) => api.post('/drivers', null, { params: { name: data.name, phone: data.phone || null } }),
  update: (id, data) => api.put(`/drivers/${id}`, null, { params: data }),
  delete: (id) => api.delete(`/drivers/${id}`)
}

// Client APIs
export const clientAPI = {
  list: () => api.get('/clients'),
  create: (data) => api.post('/clients', null, { 
    params: {
      name: data.company_name || data.name, 
      contact_person: data.contact_person || null,
      phone: data.phone || null
    }
  }),
  update: (id, data) => api.put(`/clients/${id}`, null, { params: data })
}

// Campaign APIs
export const campaignAPI = {
  list: (params = {}) => api.get('/campaigns', { params }),
  get: (id) => api.get(`/campaigns/${id}`),
  create: (data) => api.post('/campaigns', null, { 
    params: {
      name: data.name || data.campaign_name,
      client_id: data.client_id,
      start_date: data.start_date,
      end_date: data.end_date
    }
  }),
  update: (id, data) => api.put(`/campaigns/${id}`, null, { params: data }),
  updateStatus: (id, status) => api.put(`/campaigns/${id}/status`, null, { params: { new_status: status } }),
  
  // Ad management
  getAds: (campaignId) => api.get(`/campaigns/${campaignId}/ads`),
  uploadAd: async (campaignId, file, duration = 30) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/campaigns/${campaignId}/ads?duration_seconds=${duration}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000 // 2 minute timeout for video upload
    })
  },
  deleteAd: (adId) => api.delete(`/ads/${adId}`)
}

// Analytics APIs
export const analyticsAPI = {
  overview: () => api.get('/analytics/overview'),
  campaigns: (campaignId = null) => api.get('/analytics/campaigns', { 
    params: campaignId ? { campaign_id: campaignId } : {} 
  }),
  impressions: (params = {}) => api.get('/analytics/impressions', { params }),
  
  // Export CSV helper
  exportCSV: async (params = {}) => {
    const response = await api.get('/analytics/impressions', { 
      params: { ...params, limit: 10000 } 
    })
    return response.data
  }
}

// Admin APIs
export const adminAPI = {
  markOfflineDevices: () => api.post('/admin/mark-offline')
}

// Helper function to convert data to CSV
export const convertToCSV = (data, fields) => {
  if (!data || data.length === 0) return ''
  
  const headers = fields.map(f => f.label).join(',')
  const rows = data.map(item => 
    fields.map(f => {
      const value = item[f.key]
      // Escape commas and quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value ?? ''
    }).join(',')
  )
  
  return [headers, ...rows].join('\n')
}

// Download CSV helper
export const downloadCSV = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
}
