import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService.js';
import { authenticateWithGoogle } from '../config/firebase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const data = await authService.getCurrentUser();
      if (data?.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async (credentials) => {
    const data = await authService.login(credentials);
    setUser(data.user);
    return data;
  };

  const register = async (userData) => {
    const data = await authService.register(userData);
    return data;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  };

  /**
   * Google Sign-In via Firebase.
   * Calls authenticateWithGoogle() to get a Firebase ID token, then
   * exchanges it with the backend /auth/firebase-login endpoint to
   * establish a full TrustVault session (HttpOnly cookie + CSRF token).
   */
  const loginWithGoogle = async (role = 'viewer') => {
    const { idToken } = await authenticateWithGoogle();
    const data = await authService.firebaseLogin(idToken, role);
    setUser(data.user);
    return data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        loginWithGoogle,
        refreshUser: fetchUser,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isOwner: user?.role === 'owner',
        isViewer: user?.role === 'viewer',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
