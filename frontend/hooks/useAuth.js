'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { auth } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const fetchUser = useCallback(async () => {
    try {
      const data = await auth.me();
      setUser(data.user);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);
  
  const logout = useCallback(async () => {
    try {
      await auth.logout();
    } catch {
      // silently clear local state even if the server request fails
    } finally {
      setUser(null);
    }
  }, []);
  
  return (
    <AuthContext.Provider value={{ user, loading, logout, refetch: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    // Return a default state when used outside provider
    return {
      user: null,
      loading: true,
      logout: () => {},
      refetch: () => {},
    };
  }
  
  return context;
}

export function useRequireAuth(redirectTo = '/login') {
  const { user, loading } = useAuth();
  
  useEffect(() => {
    if (!loading && !user) {
      window.location.href = redirectTo;
    }
  }, [user, loading, redirectTo]);
  
  return { user, loading };
}

export function useRequireAdmin(redirectTo = '/dashboard') {
  const { user, loading } = useAuth();
  
  useEffect(() => {
    if (!loading) {
      if (!user) {
        window.location.href = '/login';
      } else if (!['admin', 'super_admin'].includes(user.role)) {
        window.location.href = redirectTo;
      }
    }
  }, [user, loading, redirectTo]);
  
  const isAdmin = user && ['admin', 'super_admin'].includes(user.role);

  return { user, loading, isAdmin };
}

export function useRequireSuperAdmin(redirectTo = '/dashboard') {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        window.location.href = '/login';
      } else if (user.role !== 'super_admin') {
        window.location.href = redirectTo;
      }
    }
  }, [user, loading, redirectTo]);

  const isSuperAdmin = user?.role === 'super_admin';

  return { user, loading, isSuperAdmin };
}
