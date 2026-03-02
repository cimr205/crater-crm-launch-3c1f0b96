import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, User } from '@/lib/api';
import { getOAuthRedirectTo, supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  login: (email: string, password: string) => Promise<{ needsOnboarding: boolean }>;
  signup: (fullName: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: (input?: { createIfMissing?: boolean; companyName?: string }) => Promise<void>;
  completeGoogleLogin: (input: { accessToken: string; refreshToken?: string; createIfMissing?: boolean; companyName?: string }) => Promise<{ needsOnboarding: boolean }>;
  refreshGate: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function resolveNeedsOnboarding(user: User | null): boolean {
  if (!user) return false;
  return user.needs_onboarding === true || user.onboarding_completed === false || !user.company_id;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.getMe()
        .then((u) => {
          setUser(u);
          setNeedsOnboarding(resolveNeedsOnboarding(u));
        })
        .catch(() => api.setSession(null))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.login(email, password);
    setUser(response.user);
    const no = resolveNeedsOnboarding(response.user);
    setNeedsOnboarding(no);
    return { needsOnboarding: no };
  };

  const signup = async (fullName: string, email: string, password: string) => {
    const response = await api.signup(fullName, email, password);
    setUser(response.user);
    setNeedsOnboarding(true); // new users always need onboarding
  };

  const loginWithGoogle = async (input?: { createIfMissing?: boolean; companyName?: string }) => {
    const locale = window.location.pathname.split('/')[1] || 'en';
    const next = new URL(getOAuthRedirectTo(locale));

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
    const no = resolveNeedsOnboarding(response.user);
    setNeedsOnboarding(no);
    return { needsOnboarding: no };
  };

  const refreshGate = async () => {
    try {
      const gate = await api.getGate();
      if (user) {
        const updated = {
          ...user,
          onboarding_completed: gate.onboarding_completed,
          needs_onboarding: gate.needs_onboarding,
        };
        setUser(updated);
        setNeedsOnboarding(gate.needs_onboarding);
      }
      return gate.needs_onboarding;
    } catch {
      return needsOnboarding;
    }
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setNeedsOnboarding(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        needsOnboarding,
        login,
        signup,
        loginWithGoogle,
        completeGoogleLogin,
        refreshGate,
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
