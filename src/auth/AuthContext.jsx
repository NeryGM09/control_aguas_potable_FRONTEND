import React, { createContext, useContext, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { api } from "../api/api";
import { upsertOfflineUser, verifyOfflineUser } from "./offlineAuth";

const AuthContext = createContext(null);

async function isOnline() {
  try {
    if (Capacitor.isNativePlatform()) {
      const status = await Network.getStatus();
      return status.connected;
    }
    if (typeof navigator !== "undefined" && "onLine" in navigator) {
      return navigator.onLine;
    }
  } catch (err) {
    console.warn("No se pudo leer el estado de red.", err);
  }
  return true;
}

function shouldTryOfflineFallback(err) {
  if (!err) return false;
  if (err.code === "ECONNABORTED" || err.code === "ERR_NETWORK") return true;
  return !err.response;
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

  const persistAuthenticatedSession = async (
    userData,
    token,
    password,
    remember,
    options = {}
  ) => {
    const beforeSetUser = options?.beforeSetUser;

    if (!token || !userData) {
      const err = new Error("INVALID_LOGIN_RESPONSE");
      err.code = "INVALID_LOGIN_RESPONSE";
      err.response = { status: 401 };
      throw err;
    }

    localStorage.removeItem("token");
    sessionStorage.removeItem("token");

    const storage = remember ? localStorage : sessionStorage;
    storage.setItem("token", token);
    localStorage.setItem("last_user", JSON.stringify(userData));
    try {
      await upsertOfflineUser(userData, password, token, {
        loginIdentifier: options?.loginIdentifier,
      });
    } catch (err) {
      console.warn("No se pudo preparar el acceso offline.", err);
    }

    const payload = { mode: "online", user: userData };
    if (typeof beforeSetUser === "function") {
      await beforeSetUser(payload);
    }
    setUser(userData);
    return payload;
  };

  const login = async (username, password, remember, options = {}) => {
    const trimmed = String(username || "").trim();
    const online = await isOnline();

    const loginOffline = async () => {
      const offline = await verifyOfflineUser(trimmed, password);
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      if (offline.token) {
        sessionStorage.setItem("token", offline.token);
      }
      const payload = { mode: "offline", user: offline.user };
      if (typeof options?.beforeSetUser === "function") {
        await options.beforeSetUser(payload);
      }
      setUser(offline.user);
      return payload;
    };

    if (online) {
      try {
        const res = await api.post("/api/auth/login", {
          username: trimmed,
          password,
        });
        const {
          access_token,
          user: userData,
          must_change_password,
          resetToken,
          email,
        } = res.data || {};

        if (must_change_password && resetToken && userData) {
          const err = new Error("PASSWORD_RESET_REQUIRED");
          err.code = "PASSWORD_RESET_REQUIRED";
          err.resetToken = resetToken;
          err.user = userData;
          err.email = email || userData.email || "";
          throw err;
        }

        return persistAuthenticatedSession(
          userData,
          access_token,
          password,
          remember,
          { ...options, loginIdentifier: trimmed }
        );
      } catch (err) {
        if (shouldTryOfflineFallback(err)) {
          return loginOffline();
        }
        throw err;
      }
    }

    return loginOffline();
  };

  const completePasswordReset = async (
    resetToken,
    newPassword,
    confirmPassword,
    remember,
    options = {}
  ) => {
    const trimmedToken = String(resetToken || "").trim();
    if (!trimmedToken) {
      const err = new Error("RESET_TOKEN_REQUIRED");
      err.code = "RESET_TOKEN_REQUIRED";
      throw err;
    }

    const resetResponse = await api.post(
      "/api/auth/change-password",
      {
        newPassword,
        confirmPassword,
      },
      {
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
        },
      }
    );

    const token = resetResponse?.data?.token;
    if (!token) {
      const err = new Error("INVALID_RESET_RESPONSE");
      err.code = "INVALID_RESET_RESPONSE";
      err.response = { status: 401 };
      throw err;
    }

    const meResponse = await api.get("/api/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const userData = meResponse?.data || null;

    return persistAuthenticatedSession(userData, token, newPassword, remember, options);
  };

  const logout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    completePasswordReset,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
