import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

// Debug mode - set to false in production
const DEBUG = true;

interface DecodedToken {
  // Standard JWT claims
  sub?: string;     // Subject (user ID)
  exp?: number;    // Expiration time
  iat?: number;    // Issued at
  jti?: string;    // JWT ID
  // Custom claims
  csrf?: string;   // CSRF token
  type?: string;   // Token type (e.g., 'access' or 'refresh')
  fresh?: boolean; // If the user logged in with credentials
  [key: string]: any; // Allow other custom claims
}

// Helper function to log debug messages
const debugLog = (...args: any[]) => {
  if (DEBUG) {
    console.log('[API Client]', ...args);
  }
};

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true
});

// Add a request interceptor to include the auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    debugLog(`[Request] ${config.method?.toUpperCase()} ${config.url}`, config);
    
    if (token) {
      try {
        // Decode the token to inspect its contents
        const decodedToken = jwtDecode<DecodedToken>(token);
        debugLog('[JWT Decoded]', {
          exp: decodedToken.exp ? new Date(decodedToken.exp * 1000).toISOString() : 'No expiration',
          type: decodedToken.type || 'unknown',
          csrf: !!decodedToken.csrf,
          sub: decodedToken.sub,
          // Log other relevant claims
        });

        // Add Authorization header
        config.headers.Authorization = `Bearer ${token}`;
        
        // Add CSRF token if available
        if (decodedToken.csrf) {
          config.headers['X-CSRF-TOKEN'] = decodedToken.csrf;
          debugLog('[Request] Added X-CSRF-TOKEN header');
        } else {
          debugLog('[Warning] No CSRF token found in JWT');
        }
        
        // Check if token is expired
        if (decodedToken.exp && decodedToken.exp * 1000 < Date.now()) {
          debugLog('[Warning] Token is expired');
        }
        
      } catch (e) {
        console.error('[Error] Failed to decode JWT:', e);
        // Optionally clear invalid token
        // localStorage.removeItem('token');
      }
    } else {
      debugLog('[Warning] No auth token found in localStorage');
    }
    
    debugLog('[Request Headers]', config.headers);
    return config;
  },
  (error) => {
    console.error('[Error] Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => {
    debugLog(`[Response ${response.status}] ${response.config.method?.toUpperCase()} ${response.config.url}`, 
      response.status, response.data);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Log the error details
    if (error.response) {
      // Server responded with a status code outside 2xx
      debugLog(`[API Error ${error.response.status}] ${error.config.method?.toUpperCase()} ${error.config.url}`, 
        error.response.data || 'No response data');
      debugLog('[Error Response Headers]', error.response.headers);
    } else if (error.request) {
      // Request was made but no response received
      debugLog('[Network Error] No response received:', error.request);
    } else {
      // Something happened in setting up the request
      debugLog('[Request Setup Error]', error.message);
    }

    // If the error is 401 and we haven't already tried to refresh the token
    if (error.response?.status === 401 && !originalRequest._retry) {
      debugLog('[Auth] Attempting token refresh...');
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          debugLog('[Auth] No refresh token available, redirecting to login');
          window.location.href = '/login';
          return Promise.reject(error);
        }

        // Try to refresh the token
        debugLog('[Auth] Refreshing access token...');
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/auth/refresh`, 
          {},
          {
            headers: {
              'Authorization': `Bearer ${refreshToken}`,
              'Content-Type': 'application/json'
            },
            withCredentials: true
          }
        );

        const { access_token } = response.data;
        debugLog('[Auth] Successfully refreshed access token');
        
        // Update the stored tokens
        localStorage.setItem('token', access_token);
        
        // Update the Authorization header for the original request
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        
        // Retry the original request
        debugLog('[Auth] Retrying original request with new token');
        return apiClient(originalRequest);
      } catch (refreshError) {
        debugLog('[Auth] Token refresh failed:', refreshError);
        // If refresh fails, clear tokens and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
