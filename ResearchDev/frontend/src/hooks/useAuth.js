import { useState, useEffect, useCallback } from "react";
import { getMe } from "../api/client";

const TOKEN_KEY = "amore_token";
const USER_KEY  = "amore_user";

function load() {
  try {
    return {
      token: localStorage.getItem(TOKEN_KEY) || null,
      user:  JSON.parse(localStorage.getItem(USER_KEY) || "null"),
    };
  } catch {
    return { token: null, user: null };
  }
}

/** Returns { user, token, signedIn, saveSession, clearSession, refreshUser } */
export function useAuth() {
  const [state, setState] = useState(load);

  const saveSession = useCallback((token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setState({ token, user });
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({ token: null, user: null });
  }, []);

  const refreshUser = useCallback(async () => {
    const { token } = load();
    if (!token) return;
    try {
      const user = await getMe(token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
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
