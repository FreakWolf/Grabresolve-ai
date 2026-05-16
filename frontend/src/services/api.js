import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// Centralized timeouts (vision adds latency to single calls)
const AI_TIMEOUT = 180000;       // 3 min for single investigation
const BATCH_TIMEOUT = 600000;    // 10 min for batch

const api = {
    // ============================================================
    // HEALTH
    // ============================================================
    health: () => axios.get(`${API_URL}/health`),

    // ============================================================
    // TICKETS
    // ============================================================
    getTickets: () => axios.get(`${API_URL}/tickets`),
    getTicket: (id) => axios.get(`${API_URL}/tickets/${id}`),
    createTicket: (data) => axios.post(`${API_URL}/tickets`, data),

    // ============================================================
    // INVESTIGATION
    // ============================================================
    /**
     * Investigate a ticket.
     * @param {string} id - Ticket ID
     * @param {object} [ticketData] - Optional full ticket payload.
     *        When provided (e.g. live demo with evidence images),
     *        forwards the complete ticket including `evidence` array
     *        so the AI engine can run vision validation.
     *        When omitted, backend uses the stored ticket.
     */
    investigate: (id, ticketData = null) => {
        const config = { timeout: AI_TIMEOUT };
        if (ticketData) {
            return axios.post(
                `${API_URL}/tickets/${id}/investigate`,
                ticketData,
                config
            );
        }
        return axios.post(
            `${API_URL}/tickets/${id}/investigate`,
            {},
            config
        );
    },

    investigateAll: () => axios.post(
        `${API_URL}/investigate-all`,
        {},
        { timeout: BATCH_TIMEOUT }
    ),

    // ============================================================
    // EVIDENCE (NEW — vision validation)
    // ============================================================
    /**
     * Run vision validation on a ticket's attached evidence
     * without going through the full pipeline.
     * Useful for debugging or previewing image analysis.
     */
    validateEvidence: (ticketData) => axios.post(
        `${API_URL}/evidence/validate`,
        ticketData,
        { timeout: AI_TIMEOUT }
    ),

    // ============================================================
    // ACTIONS
    // ============================================================
    approve: (id, agentName) => axios.post(
        `${API_URL}/tickets/${id}/approve`,
        { agent_name: agentName }
    ),
    escalate: (id, reason) => axios.post(
        `${API_URL}/tickets/${id}/escalate`,
        { reason }
    ),

    // ============================================================
    // SEED DATA
    // ============================================================
    seed: () => axios.post(`${API_URL}/seed`),

    // ============================================================
    // ANALYTICS
    // ============================================================
    getOverview: () => axios.get(`${API_URL}/analytics/overview`),
    getSystemic: () => axios.get(`${API_URL}/analytics/systemic`),

    // ============================================================
    // TOKENS (per-ticket usage)
    // ============================================================
    getTokens: (id) => axios.get(`${API_URL}/tickets/${id}/tokens`),

    // ============================================================
    // POLICIES (NEW)
    // ============================================================
    getPolicies: () => axios.get(`${API_URL}/policies`),
    reloadPolicies: () => axios.post(`${API_URL}/policies/reload`),
};

export default api;