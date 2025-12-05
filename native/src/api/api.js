// React Native API client for Expo Go
// Configure your backend URL in native/.env as:
//   EXPO_PUBLIC_API_URL=https://your-backend-domain.com/api
// The value must be publicly reachable from your phone when using Expo Go.

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const rawBase =
  (typeof process !== 'undefined' &&
    process.env &&
    (process.env.EXPO_PUBLIC_API_URL || process.env.API_URL)) ||
  ''; // e.g. https://api.example.com/api

let baseURL = rawBase;
if (!baseURL) {
  console.warn(
    '[API] EXPO_PUBLIC_API_URL is not set. Set it in native/.env (e.g., EXPO_PUBLIC_API_URL=https://your-backend.com/api)'
  );
  // Fallback for local testing; will NOT work on a physical device unless port-forwarded/public.
  baseURL = 'http://127.0.0.1:8000/api';
}
if (!/\/$/.test(baseURL)) baseURL += '/';

const API = axios.create({ baseURL, timeout: 10000 }); // 10s network timeout to avoid hanging spinners

/**
 * Attach Authorization header and normalize request URL
 * - Strips leading "/" (and "/api/") when baseURL already includes "/api" to avoid double "/api"
 */
API.interceptors.request.use(async (config) => {
  try {
    // Normalize request URL similar to web client to avoid "/api/api/*" or base reset
    try {
      const u = config?.url || '';
      const b = config.baseURL || API.defaults.baseURL || baseURL || '';
      if (typeof u === 'string' && u.startsWith('/')) {
        const bEndsWithApi = /\/api\/?$/.test(b);
        // If url begins with "/api/", strip that prefix; else strip the leading "/"
        let path = u.startsWith('/api/') ? u.slice(5) : u.slice(1);
        config.url = bEndsWithApi ? path : u.replace(/^\//, '');
      }
    } catch {}

    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers = config.headers || {};
      if (!config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch {}
  return config;
});

// Minimal helpers expected by LoginScreen
export async function fetchMe(access) {
  const headers = access ? { Authorization: `Bearer ${access}` } : undefined;
  const res = await API.get('accounts/me/', headers ? { headers } : undefined);
  return res?.data || res;
}

export async function saveSession({ access, refresh, user }) {
  try {
    if (access) await AsyncStorage.setItem('token', access);
    if (refresh) await AsyncStorage.setItem('refresh', refresh);
    if (user) await AsyncStorage.setItem('user', JSON.stringify(user));
  } catch (e) {
    // best effort; still proceed
  }
}

export async function getMyEcouponOrders(params = {}) {
  const res = await API.get('coupons/store/orders/mine/', { params });
  return res?.data || res;
}

export async function getMyECoupons(params = {}) {
  const res = await API.get('coupons/codes/mine-consumer/', { params });
  return res?.data || res;
}

export async function getMyECouponSummary() {
  const res = await API.get('coupons/codes/consumer-summary/');
  return res?.data || res;
}

export async function listStoreProducts(params = {}) {
  const res = await API.get('coupons/store/products/', { params });
  return res?.data || res;
}

export function getAPIBase() {
  try {
    return API?.defaults?.baseURL || baseURL;
  } catch {
    return baseURL;
  }
}

export default API;
