// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';

// Other API endpoints
export const ENDPOINTS = {
  QR_CODES: `${API_URL}/qrcodes`,
  QR_CODE_STATS: (id: string | number) => `${API_URL}/qrcodes/${id}/stats`,
  QR_CODE_ENHANCED_STATS: (id: string | number) => `${API_URL}/qrcodes/${id}/enhanced-stats`,
  STATS_DASHBOARD: `${API_URL}/stats/dashboard`,
  STATS_DAILY: `${API_URL}/stats/daily`,
  FOLDERS: `${API_URL}/folders`,
  FOLDER: (name: string) => `${API_URL}/folders/${encodeURIComponent(name)}`,
};
