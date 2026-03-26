import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { api } from "../api/api";
import { upsertOfflineUser, verifyOfflineUser } from "./offlineAuth";

const AuthContext = createContext(null);

async function isOnline() {
  if (Capacitor.isNativePlatform()) {
    const status = await Network.getStatus();
    return status.connected;
  }
  if (typeof navigator !== "undefined" && "onLine" in navigator) {
    return navigator.onLine;
  }
  return true;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      // Always require login when the app starts.
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      if (!cancelled) {
        setUser(null);
        setLoading(false);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (username, password, remember, options = {}) => {
    const beforeSetUser = options?.beforeSetUser;
    const trimmed = String(username || "").trim();
    const online = await isOnline();

    if (online) {
      const res = await api.post("/auth/login", { username: trimmed, password });
      const { access_token, user: userData } = res.data || {};
      if (!access_token || !userData) {
        const err = new Error("INVALID_LOGIN_RESPONSE");
        err.code = "INVALID_LOGIN_RESPONSE";
        err.response = { status: 401 };
        throw err;
      }
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem("token", access_token);
      localStorage.setItem("last_user", JSON.stringify(userData));
      await upsertOfflineUser(userData, password, access_token);
      const payload = { mode: "online", user: userData };
      if (typeof beforeSetUser === "function") {
        await beforeSetUser(payload);
      }
      setUser(userData);
      return payload;
    }

    const offline = await verifyOfflineUser(trimmed, password);
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    if (offline.token) {
      sessionStorage.setItem("token", offline.token);
    }
    const payload = { mode: "offline", user: offline.user };
    if (typeof beforeSetUser === "function") {
      await beforeSetUser(payload);
    }
    setUser(offline.user);
    return payload;
  };

  const logout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
