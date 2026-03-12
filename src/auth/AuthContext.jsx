import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { api } from "../api/api";

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
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/auth/me")
      .then((res) => {
        setUser(res.data);
        localStorage.setItem("last_user", JSON.stringify(res.data));
      })
      .catch(async () => {
        const online = await isOnline();
        if (!online) {
          const cached = localStorage.getItem("last_user");
          if (cached) {
            setUser(JSON.parse(cached));
          }
          return;
        }
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password, remember) => {
    const res = await api.post("/auth/login", { username, password });
    const { access_token, user: userData } = res.data;
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem("token", access_token);
    localStorage.setItem("last_user", JSON.stringify(userData));
    setUser(userData);
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
