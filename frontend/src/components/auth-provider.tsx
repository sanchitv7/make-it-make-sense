"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isAnonymousAccount, isPermanentAccount } from "@/lib/account-kind";
import {
  clearPendingConvertPassword,
  stashPendingConvertPassword,
  takePendingConvertPassword,
} from "@/lib/pending-convert-password";

type AuthResult = { error: string | null; pendingConfirmation?: boolean };

type AuthContextValue = {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  isAnonymous: boolean;
  hasAccount: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, fullName: string) => Promise<AuthResult>;
  signInAnonymously: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function emailRedirectTo(): string {
  return `${window.location.origin}/auth/callback`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  const applyPendingConvertPassword = useCallback(
    async (user: User | null | undefined) => {
      if (!isPermanentAccount(user)) return;
      const password = takePendingConvertPassword();
      if (!password) return;
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        // Put it back so a later session refresh can retry once.
        stashPendingConvertPassword(password);
        console.error("[Auth] Failed to set password after email confirm:", error.message);
      }
    },
    [supabase],
  );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      void applyPendingConvertPassword(data.session?.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      void applyPendingConvertPassword(nextSession?.user);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, applyPendingConvertPassword]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      const current = sessionRef.current?.user;
      if (isAnonymousAccount(current)) {
        // Confirm-email on: link email first, set password after the user verifies.
        stashPendingConvertPassword(password);
        const { data, error } = await supabase.auth.updateUser(
          {
            email,
            data: { full_name: fullName },
          },
          { emailRedirectTo: emailRedirectTo() },
        );
        if (error) {
          clearPendingConvertPassword();
          return { error: error.message };
        }
        return {
          error: null,
          pendingConfirmation: Boolean(data.user?.is_anonymous) || !data.user?.email_confirmed_at,
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: emailRedirectTo(),
        },
      });
      if (error) return { error: error.message };
      return {
        error: null,
        pendingConfirmation: Boolean(data.user) && !data.session,
      };
    },
    [supabase],
  );

  const signInAnonymously = useCallback(async () => {
    if (sessionRef.current?.user) return { error: null };
    const { error } = await supabase.auth.signInAnonymously();
    return { error: error?.message ?? null };
  }, [supabase]);

  const signOut = useCallback(async () => {
    clearPendingConvertPassword();
    await supabase.auth.signOut();
  }, [supabase]);

  const resetPassword = useCallback(
    async (email: string) => {
      const redirectTo = `${window.location.origin}/auth/reset`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const updatePassword = useCallback(
    async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const user = session?.user ?? null;
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken: session?.access_token ?? null,
      loading,
      isAnonymous: isAnonymousAccount(user),
      hasAccount: isPermanentAccount(user),
      signIn,
      signUp,
      signInAnonymously,
      signOut,
      resetPassword,
      updatePassword,
    }),
    [
      user,
      session?.access_token,
      loading,
      signIn,
      signUp,
      signInAnonymously,
      signOut,
      resetPassword,
      updatePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
