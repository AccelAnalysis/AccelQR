import { API_URL } from '../config';

const getApiOrigin = () => API_URL.replace(/\/api\/?$/, '').replace(/\/+$/, '');

export const getShortUrl = (shortCode: string, providedShortUrl?: string | null) => {
  if (providedShortUrl) return providedShortUrl;
  return `${getApiOrigin()}/r/${shortCode}`;
};
