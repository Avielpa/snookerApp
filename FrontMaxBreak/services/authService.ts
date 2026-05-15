// services/authService.ts
// JWT auth for cloud scoreboard sync.
// Tokens stored in SecureStore (encrypted). AsyncStorage is NOT used for tokens.

import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://snookerapp.up.railway.app/oneFourSeven/';

const ACCESS_KEY = 'auth_access_token';
const REFRESH_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
}

// ── Token storage helpers ────────────────────────────────────────────────────

async function saveTokens(access: string, refresh: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, access),
    SecureStore.setItemAsync(REFRESH_KEY, refresh),
  ]);
}

async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}

async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

// ── JWT payload decode (no verification — server already verified) ───────────

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return Date.now() / 1000 >= payload.exp - 30; // 30s grace
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function register(username: string, password: string, email = ''): Promise<AuthUser> {
  const res = await axios.post(`${API_BASE}users/`, { username, password, email });
  return res.data as AuthUser;
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await axios.post(`${API_BASE}auth/login/`, { username, password });
  const { access, refresh, user } = res.data;
  await saveTokens(access, refresh);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  return user as AuthUser;
}

export async function logout(): Promise<void> {
  await clearTokens();
}

export async function isLoggedIn(): Promise<boolean> {
  const refresh = await getRefreshToken();
  return !!refresh;
}

export async function getUser(): Promise<AuthUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

/**
 * Returns a valid access token, refreshing if needed.
 * Throws if the user is not logged in or the refresh token has expired.
 */
export async function getValidAccessToken(): Promise<string> {
  const access = await getAccessToken();

  if (access && !isTokenExpired(access)) {
    return access;
  }

  const refresh = await getRefreshToken();
  if (!refresh) throw new Error('Not logged in');

  const res = await axios.post(`${API_BASE}auth/token/refresh/`, { refresh });
  const newAccess: string = res.data.access;
  const newRefresh: string | undefined = res.data.refresh;

  await SecureStore.setItemAsync(ACCESS_KEY, newAccess);
  if (newRefresh) await SecureStore.setItemAsync(REFRESH_KEY, newRefresh);

  return newAccess;
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const token = await getValidAccessToken();
  await axios.post(
    `${API_BASE}auth/change-password/`,
    { old_password: oldPassword, new_password: newPassword },
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

/**
 * Returns an Authorization header value, or null if the user is not logged in.
 * Safe to call even when logged out.
 */
export async function getAuthHeader(): Promise<string | null> {
  try {
    const token = await getValidAccessToken();
    return `Bearer ${token}`;
  } catch {
    return null;
  }
}
