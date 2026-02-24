import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, User } from '@/lib/api';
import { getOAuthRedirectTo, supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (input?: { createIfMissing?: boolean; companyName?: string }) => Promise<void>;
  completeGoogleLogin: (input: { accessToken: string; refreshToken?: string; createIfMissing?: boolean; companyName?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.getMe()
        .then((response) => setUser(response.data))
        .catch(() => api.setSession(null))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.login(email, password);
    setUser(response.user);
  };

  const loginWithGoogle = async (input?: { createIfMissing?: boolean; companyName?: string }) => {
    const locale = window.location.pathname.split('/')[1] || 'en';
    const next = new URL(getOAuthRedirectTo(locale));
    if (input?.createIfMissing) {
      next.searchParams.set('createIfMissing', '1');
    }
    if (input?.companyName) {
      next.searchParams.set('companyName', input.companyName);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: next.toString(),
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      throw new Error(error.message || 'Unable to start Google sign-in');
    }
  };

  const completeGoogleLogin = async (input: {
    accessToken: string;
    refreshToken?: string;
    createIfMissing?: boolean;
    companyName?: string;
  }) => {
    const response = await api.exchangeGoogleSession(input);
    setUser(response.user);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithGoogle,
        completeGoogleLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
