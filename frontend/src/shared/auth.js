import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api } from "./api";

const AuthContext = createContext(null);

const getStoredToken = () => {
  if (typeof window === "undefined") {
    return null;
  }
  const token = window.localStorage.getItem("authToken");
  if (!token || ["null", "undefined", ""].includes(token)) {
    return null;
  }
  return token;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const syncUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await api.getCurrentUser();
      setUser(response.data || null);
    } catch (error) {
      console.error("Greška pri dohvaćanju korisnika", error);
      // Only clear token if it's an authentication error (401)
      if (error.response && error.response.status === 401) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("authToken");
        }
        setUser(null);
      }
      // For other errors, keep the token and retry later / show error state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    syncUser();
  }, [syncUser]);

  useEffect(() => {
    const handleUnauthorized = () => {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("authToken");
      }
      setUser(null);
      setLoading(false);
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, []);

  const login = useCallback(
    async ({ email, password }) => {
      const response = await api.login({ email, password });
      const token = response.data?.access_token;
      if (token && typeof window !== "undefined") {
        window.localStorage.setItem("authToken", token);
      }
      const userData = response.data?.user;
      if (userData) {
        setUser(userData);
        // Set active tenant from user's default/assigned tenant
        if (userData.tenant_id) {
          // Import setActiveTenantId dynamically or moving import to top if possible
          // But api.js imports are already there.
          // We need to import setActiveTenantId from ./api at top.
          const { setActiveTenantId } = require("./api");
          setActiveTenantId(userData.tenant_id);
        }
        setLoading(false);
      } else {
        await syncUser();
      }
      return userData;
    },
    [syncUser],
  );

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("authToken");
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refresh: syncUser,
    }),
    [user, loading, login, logout, syncUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
