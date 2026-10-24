import { api } from './api.js';

export const adminService = {
  async getStats() {
    const res = await api.get('/admin/stats');
    return res.data;
  },

  async listUsers() {
    const res = await api.get('/admin/users');
    return res.data;
  },

  async updateUserStatus(userId, status) {
    const res = await api.patch(`/admin/users/${userId}/status`, { status });
    return res.data;
  },

  async revokeUserSessions(userId) {
    const res = await api.post(`/admin/users/${userId}/revoke-sessions`);
    return res.data;
  },

  async listAuditLogs(params = {}) {
    const res = await api.get('/admin/audit', { params });
    return res.data;
  },

  async verifyAuditChain() {
    const res = await api.post('/admin/audit/verify');
    return res.data;
  },
};
