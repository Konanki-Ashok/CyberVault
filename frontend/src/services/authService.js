import { api } from './api.js';

export const authService = {
  async register(data) {
    const res = await api.post('/auth/register', data);
    return res.data;
  },

  async login(credentials) {
    const res = await api.post('/auth/login', credentials);
    return res.data;
  },

  async firebaseLogin(idToken, role = 'viewer') {
    const res = await api.post('/auth/firebase-login', { idToken, role });
    return res.data;
  },

  async logout() {
    const res = await api.post('/auth/logout');
    return res.data;
  },

  async getCurrentUser() {
    const res = await api.get('/auth/me');
    return res.data;
  },

  async getSessions() {
    const res = await api.get('/auth/sessions');
    return res.data;
  },

  async revokeSession(sessionId) {
    const res = await api.delete(`/auth/sessions/${sessionId}`);
    return res.data;
  },
};
