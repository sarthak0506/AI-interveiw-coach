import { createContext, useContext, useMemo, useState } from "react";

import { setApiToken } from "../api/client";

const TOKEN_KEY = "ai-interview-coach-token";
const AuthContext = createContext(null);

function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    const storedToken = getStoredToken();
    setApiToken(storedToken);
    return storedToken;
  });

  const login = (newToken) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setApiToken(newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setApiToken(null);
    setToken(null);
  };

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
