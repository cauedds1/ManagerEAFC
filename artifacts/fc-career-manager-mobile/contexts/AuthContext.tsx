import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api, saveToken, deleteToken, TOKEN_KEY, type User } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadStoredToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredToken().then(async (storedToken) => {
      if (storedToken) {
        setToken(storedToken);
        try {
          const { user: freshUser } = await api.auth.me();
          setUser(freshUser);
        } catch {
          await deleteToken();
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token: newToken, user: newUser } = await api.auth.login(email, password);
    await saveToken(newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const { token: newToken, user: newUser } = await api.auth.register(email, password, name);
    await saveToken(newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    await deleteToken();
    setToken(null);
    setUser(null);
    queryClient.clear();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isLoading, login, register, logout }),
    [user, token, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
