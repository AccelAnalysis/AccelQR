import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AxiosError } from 'axios';
import apiClient from '../api/client';
import { AuthContext, type User } from './auth.context';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

  // Set up axios defaults
  useEffect(() => {
    const token = localStorage.getItem('token');
    

    
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    
    // Clean up function
    return () => {
      delete apiClient.defaults.headers.common['Authorization'];
    };
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setLoading(false);
        return;
      }
      
      try {
        // Set the auth header for the request
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        // Try to get the current user
        const response = await apiClient.get(`/me`);
        setUser(response.data);
        setAuthError(null);
      } catch (error) {
        const axiosError = error as AxiosError;
        console.error('Auth check failed', error);
        // Clear invalid tokens
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        delete apiClient.defaults.headers.common['Authorization'];
        setUser(null);
        // Set a user-facing error message
        if (axiosError.response && (axiosError.response.status === 401 || axiosError.response.status === 422)) {
          setAuthError('Your session has expired or is invalid. Please log in again.');
        } else {
          setAuthError('Authentication failed. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [API_BASE_URL]);

  const login = async (email: string, password: string) => {
    try {
      const response = await apiClient.post(`/login`, { email, password });
      const { access_token, refresh_token, user } = response.data;
      
      if (!access_token) {
        throw new Error('No access token received');
      }
      
      localStorage.setItem('token', access_token);
      if (refresh_token) {
        localStorage.setItem('refreshToken', refresh_token);
      }
      
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      setUser(user);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string) => {
    try {
      await apiClient.post(`/register`, { email, password });
      await login(email, password);
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    delete apiClient.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {authError && (
        <div style={{ color: 'red', background: '#fff3f3', padding: '1em', marginBottom: '1em', borderRadius: '4px', textAlign: 'center' }}>
          {authError}
        </div>
      )}
      {!loading && children}
    </AuthContext.Provider>
  );
};

// useAuth hook has been moved to src/hooks/useAuth.ts
