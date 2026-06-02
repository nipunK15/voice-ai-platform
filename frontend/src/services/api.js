// src/services/api.js
// Centralized API service using axios.
//
// ARCHITECTURE: All API calls go through this one module.
// This means:
// - Base URL changes in ONE place (env variable)
// - Auth headers added automatically in ONE place
// - Error handling standardized in ONE interceptor
// - Easy to swap to a different HTTP client or add a mock layer

import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    // MVP: Use demo mode header — no real auth needed
    "x-demo-mode": "true",
  },
});

// Response interceptor — normalize errors for UI consumption
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "An unexpected error occurred";

    const enhancedError = new Error(message);
    enhancedError.status = error.response?.status;
    enhancedError.data = error.response?.data;
    return Promise.reject(enhancedError);
  }
);

// ─── Agent API ─────────────────────────────────────────────────────────────────

export const agentsApi = {
  getAll: () => apiClient.get("/agents"),
  getById: (id) => apiClient.get(`/agents/${id}`),
  create: (data) => apiClient.post("/agents", data),
  update: (id, data) => apiClient.put(`/agents/${id}`, data),
  delete: (id) => apiClient.delete(`/agents/${id}`),
  getVapiConfig: (id) => apiClient.get(`/agents/${id}/vapi-config`),
  getVoices: () => apiClient.get("/agents/meta/voices"),
};

// ─── Conversation API ──────────────────────────────────────────────────────────

export const conversationsApi = {
  getAll: (params) => apiClient.get("/conversations", { params }),
  getById: (id) => apiClient.get(`/conversations/${id}`),
  create: (data) => apiClient.post("/conversations", data),
  end: (id, data) => apiClient.patch(`/conversations/${id}/end`, data),
  addMessage: (id, data) =>
    apiClient.post(`/conversations/${id}/messages`, data),
  getStats: () => apiClient.get("/conversations/stats"),
};

// ─── Health check ─────────────────────────────────────────────────────────────

export const healthApi = {
  check: () =>
    axios.get(`${BASE_URL}/health`).then((r) => r.data),
};

export default apiClient;