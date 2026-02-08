import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Scenarios
export const scenariosAPI = {
    create: (data) => api.post('/api/scenarios/', data),
    list: () => api.get('/api/scenarios/'),
    get: (id) => api.get(`/api/scenarios/${id}`),
    update: (id, data) => api.put(`/api/scenarios/${id}`, data),
    delete: (id) => api.delete(`/api/scenarios/${id}`),
};

// Jobs
export const jobsAPI = {
    create: (data) => api.post('/api/jobs/', data),
    list: (statusFilter) => api.get('/api/jobs/', { params: { status_filter: statusFilter } }),
    get: (id) => api.get(`/api/jobs/${id}`),
    updateStatus: (id, status) => api.patch(`/api/jobs/${id}/status`, null, { params: { new_status: status } }),
    delete: (id) => api.delete(`/api/jobs/${id}`),
};

// Metrics
export const metricsAPI = {
    createTelemetry: (data) => api.post('/api/metrics/telemetry', data),
    getTelemetry: (jobId) => api.get(`/api/metrics/telemetry/${jobId}`),
    getSafety: (jobId) => api.get(`/api/metrics/safety/${jobId}`),
    getInsights: (jobId) => api.get(`/api/metrics/insights/${jobId}`),
};

// Assistant
export const assistantAPI = {
    chat: (data) => api.post('/api/assistant/chat', data),
};

export default api;
