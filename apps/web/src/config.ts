// Central API configuration
// In development: Vite proxy forwards /api/* to localhost:3001
// In production: direct calls to the Railway API URL
export const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : '';
