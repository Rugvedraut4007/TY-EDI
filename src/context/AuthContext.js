import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { api, getToken, setToken } from "../lib/api";

const USER_KEY = "medsure_user";
const AuthContext = createContext(null);

export const ROLE_HOME = {
  admin: "/admin-dashboard",
  manufacturer: "/manufacturer-dashboard",
  distributor: "/distributor-dashboard",
  pharmacist: "/pharmacist-dashboard",
  customer: "/customer-dashboard",
};

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [booting, setBooting] = useState(Boolean(getToken()));

  const persist = useCallback((token, nextUser) => {
    setToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  // Validate an existing session on first load
  useEffect(() => {
    let alive = true;
    if (!getToken()) {
      setBooting(false);
      return () => { alive = false; };
    }
    api
      .get("/auth/me")
      .then((data) => {
        if (!alive) return;
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setUser(data.user);
      })
      .catch(() => alive && logout())
      .finally(() => alive && setBooting(false));
    return () => { alive = false; };
  }, [logout]);

  const login = useCallback(
    async (email, password) => {
      const data = await api.post("/auth/login", { email, password }, { auth: false });
      persist(data.token, data.user);
      return data.user;
    },
    [persist]
  );

  const register = useCallback(
    async (payload) => {
      const data = await api.post("/auth/register", payload, { auth: false });
      persist(data.token, data.user);
      return data.user;
    },
    [persist]
  );

  const value = useMemo(
    () => ({ user, booting, login, register, logout, isAuthenticated: Boolean(user) }),
    [user, booting, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
