import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';

interface User {
  email: string;
  is_admin: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

  // Set up axios defaults
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    
    // Clean up function
    return () => {
      delete axios.defaults.headers.common['Authorization'];
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
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Try to get the current user
        const response = await axios.get(`${API_BASE_URL}/auth/me`);
        setUser(response.data);
      } catch (error) {
        console.error('Auth check failed', error);
        // Clear invalid tokens
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        delete axios.defaults.headers.common['Authorization'];
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [API_BASE_URL]);

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
      const { access_token, refresh_token, user } = response.data;
      
      if (!access_token) {
        throw new Error('No access token received');
      }
      
      localStorage.setItem('token', access_token);
      if (refresh_token) {
        localStorage.setItem('refreshToken', refresh_token);
      }
      
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      setUser(user);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string) => {
    try {
      await axios.post(`${API_BASE_URL}/auth/register`, { email, password });
      await login(email, password);
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
