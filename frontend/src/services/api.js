import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = {
    // Health check
    health: () => axios.get(`${API_URL}/health`),

    // Tickets
    getTickets: () => axios.get(`${API_URL}/tickets`),
    getTicket: (id) => axios.get(`${API_URL}/tickets/${id}`),
    createTicket: (data) => axios.post(`${API_URL}/tickets`, data),

    // Investigation
    investigate: (id) => axios.post(`${API_URL}/tickets/${id}/investigate`, {}, { timeout: 60000 }),
    investigateAll: () => axios.post(`${API_URL}/investigate-all`, {}, { timeout: 300000 }),

    // Actions
    approve: (id, agentName) => axios.post(`${API_URL}/tickets/${id}/approve`, { agent_name: agentName }),
    escalate: (id, reason) => axios.post(`${API_URL}/tickets/${id}/escalate`, { reason }),

    // Seed data
    seed: () => axios.post(`${API_URL}/seed`),

    // Analytics
    getOverview: () => axios.get(`${API_URL}/analytics/overview`),
    getSystemic: () => axios.get(`${API_URL}/analytics/systemic`),
};

export default api;