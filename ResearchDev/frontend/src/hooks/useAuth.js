/* Session state for App.jsx: the token and user object, persisted to
   localStorage so a refresh does not sign the reader out. */
import { useState, useEffect, useCallback } from "react";
import { getMe } from "../api/client";

const TOKEN_KEY = "amore_token";
const USER_KEY  = "amore_user";

/* "Remember me" decides where the session lives: localStorage survives closing
   the browser, sessionStorage ends with the tab. Reads look in both. */
function holder() {
  try {
    if (localStorage.getItem(TOKEN_KEY)) return localStorage;
    if (sessionStorage.getItem(TOKEN_KEY)) return sessionStorage;
  } catch { /* storage blocked */ }
  return localStorage;
}

function load() {
  try {
    const s = holder();
    return {
      token: s.getItem(TOKEN_KEY) || null,
      user:  JSON.parse(s.getItem(USER_KEY) || "null"),
    };
  } catch {
    return { token: null, user: null };
  }
}

/** Returns { user, token, signedIn, saveSession, clearSession, refreshUser } */
export function useAuth() {
  const [state, setState] = useState(load);

  const saveSession = useCallback((token, user, remember = true) => {
    const s = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    other.removeItem(TOKEN_KEY); other.removeItem(USER_KEY);
    s.setItem(TOKEN_KEY, token);
    s.setItem(USER_KEY, JSON.stringify(user));
    setState({ token, user });
  }, []);

  const clearSession = useCallback(() => {
    for (const s of [localStorage, sessionStorage]) {
      s.removeItem(TOKEN_KEY);
      s.removeItem(USER_KEY);
    }
    setState({ token: null, user: null });
  }, []);

  const refreshUser = useCallback(async () => {
    const { token } = load();
    if (!token) return;
    try {
      const user = await getMe(token);
      holder().setItem(USER_KEY, JSON.stringify(user));
      setState((s) => ({ ...s, user }));
    } catch {
      // Token expired or invalid — clear
      clearSession();
    }
  }, [clearSession]);

  return {
    user: state.user,
    token: state.token,
    signedIn: !!state.token,
    saveSession,
    clearSession,
    refreshUser,
  };
}
