import axios from 'axios';

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
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401 and we haven't already tried to refresh the token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          // No refresh token, redirect to login
          window.location.href = '/login';
          return Promise.reject(error);
        }

        // Try to refresh the token
        const response = await axios.post('/api/auth/refresh', {}, {
          headers: {
            'Authorization': `Bearer ${refreshToken}`
          }
        });

        const { access_token } = response.data;
        
        // Update the stored tokens
        localStorage.setItem('token', access_token);
        
        // Update the Authorization header
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        
        // Retry the original request
        return apiClient(originalRequest);
      } catch (error) {
        // If refresh fails, redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
