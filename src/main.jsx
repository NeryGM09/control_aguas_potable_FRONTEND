import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";

if (import.meta.env.DEV && typeof window !== "undefined") {
  const perfFlag = "__codexMessagePerfPatched__";
  if (!window[perfFlag]) {
    window[perfFlag] = true;
    const THRESHOLD_MS = 50;
    const originalAdd = EventTarget.prototype.addEventListener;
    const originalRemove = EventTarget.prototype.removeEventListener;
    const listenerMap = new WeakMap();

    const wrapListener = (listener) => {
      if (listenerMap.has(listener)) {
        return listenerMap.get(listener);
      }
      const registeredAt = new Error().stack;
      const wrapped = function (...args) {
        const start = performance.now();
        try {
          return listener.apply(this, args);
        } finally {
          const duration = performance.now() - start;
          if (duration > THRESHOLD_MS) {
            console.warn(`[Perf] 'message' handler took ${duration.toFixed(1)}ms`, {
              duration,
              registeredAt,
              listener,
            });
          }
        }
      };
      listenerMap.set(listener, wrapped);
      return wrapped;
    };

    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (type === "message" && typeof listener === "function") {
        return originalAdd.call(this, type, wrapListener(listener), options);
      }
      return originalAdd.call(this, type, listener, options);
    };

    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      if (type === "message" && typeof listener === "function") {
        const wrapped = listenerMap.get(listener);
        if (wrapped) {
          return originalRemove.call(this, type, wrapped, options);
        }
      }
      return originalRemove.call(this, type, listener, options);
    };
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
