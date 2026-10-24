import { api } from './api.js';

export const documentService = {
  async listDocuments(params = {}) {
    const res = await api.get('/documents', { params });
    return res.data;
  },

  async getDocument(id) {
    const res = await api.get(`/documents/${id}`);
    return res.data;
  },

  async uploadDocument(formData) {
    const res = await api.post('/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  async updateMetadata(id, data) {
    const res = await api.patch(`/documents/${id}`, data);
    return res.data;
  },

  async deleteDocument(id) {
    const res = await api.delete(`/documents/${id}`);
    return res.data;
  },

  async createDownloadTicket(id, purpose = 'download') {
    const res = await api.post(`/documents/${id}/tickets?purpose=${purpose}`);
    return res.data;
  },

  async grantPermission(id, { email, permission }) {
    const res = await api.post(`/documents/${id}/permissions`, { email, permission });
    return res.data;
  },

  async revokePermission(id, targetUserId) {
    const res = await api.delete(`/documents/${id}/permissions/${targetUserId}`);
    return res.data;
  },

  async getAIRecommendations(id, purpose = '') {
    const res = await api.post(`/ai/documents/${id}/recommendations`, { purpose });
    return res.data;
  },

  async recordAIDecision(id, data) {
    const res = await api.post(`/ai/documents/${id}/decisions`, data);
    return res.data;
  },
};
