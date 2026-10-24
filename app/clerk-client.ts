"use client";

import { useEffect, useState, useCallback } from "react";

export type ClerkUser = {
  id: string;
  fullName?: string;
  primaryEmailAddress?: { emailAddress: string };
  imageUrl?: string;
};

declare global {
  interface Window {
    Clerk?: {
      loaded?: boolean;
      version?: string;
      load: (options?: Record<string, unknown>) => Promise<void>;
      user: any | null;
      session: { id: string; user?: any } | null;
      client?: {
        sessions?: Array<{
          id: string;
          status: string;
          user?: any;
        }>;
      };
      setActive?: (options: { session: string | null }) => Promise<void>;
      openSignIn: (options?: Record<string, unknown>) => void;
      openSignUp: (options?: Record<string, unknown>) => void;
      openUserProfile: () => void;
      signOut: () => Promise<void>;
      addListener: (listener: (emission: any) => void) => () => void;
    };
  }
}

function extractUser(rawUser: any): ClerkUser | null {
  if (!rawUser || !rawUser.id) return null;
  const email =
    rawUser.primaryEmailAddress?.emailAddress ||
    rawUser.emailAddresses?.[0]?.emailAddress ||
    undefined;
  const fullName =
    rawUser.fullName ||
    [rawUser.firstName, rawUser.lastName].filter(Boolean).join(" ") ||
    email?.split("@")[0] ||
    "User";

  return {
    id: rawUser.id,
    fullName,
    primaryEmailAddress: email ? { emailAddress: email } : undefined,
    imageUrl: rawUser.imageUrl || rawUser.profileImageUrl || undefined,
  };
}

export function useClerkAuth() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<ClerkUser | null>(null);

  const syncState = useCallback(async () => {
    if (!window.Clerk) return;

    try {
      // 1. Ensure Clerk is loaded
      if (!window.Clerk.loaded && typeof window.Clerk.load === "function") {
        await window.Clerk.load();
      }

      // 2. If Clerk.session is not set but client has an active session, activate it
      if (!window.Clerk.session && window.Clerk.client?.sessions?.length) {
        const activeSession =
          window.Clerk.client.sessions.find((s) => s.status === "active") ||
          window.Clerk.client.sessions[0];

        if (activeSession && typeof window.Clerk.setActive === "function") {
          try {
            await window.Clerk.setActive({ session: activeSession.id });
          } catch (err) {
            console.warn("Clerk setActive notice:", err);
          }
        }
      }

      // 3. Extract user from current active session or user object
      const rawUser =
        window.Clerk.user ||
        window.Clerk.session?.user ||
        window.Clerk.client?.sessions?.find((s) => s.status === "active")?.user ||
        null;

      setUser(extractUser(rawUser));
      setIsLoaded(true);
    } catch (err) {
      console.error("Clerk sync error:", err);
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    let checkInterval: NodeJS.Timeout;
    let removeListener: (() => void) | undefined;

    const init = async () => {
      if (window.Clerk) {
        await syncState();

        if (typeof window.Clerk.addListener === "function") {
          removeListener = window.Clerk.addListener(async (emission) => {
            if (!window.Clerk?.session && emission?.client?.sessions?.length) {
              const active =
                emission.client.sessions.find((s: any) => s.status === "active") ||
                emission.client.sessions[0];
              if (active && typeof window.Clerk?.setActive === "function") {
                try {
                  await window.Clerk.setActive({ session: active.id });
                } catch {}
              }
            }

            const raw =
              emission?.user ||
              window.Clerk?.user ||
              emission?.session?.user ||
              window.Clerk?.session?.user ||
              null;

            setUser(extractUser(raw));
            setIsLoaded(true);
          });
        }
        clearInterval(checkInterval);
      }
    };

    checkInterval = setInterval(init, 150);
    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
      setIsLoaded(true);
    }, 4000);

    const handleFocus = () => {
      void syncState();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
      window.removeEventListener("focus", handleFocus);
      if (removeListener) removeListener();
    };
  }, [syncState]);

  const openSignIn = () => {
    if (window.Clerk?.openSignIn) {
      window.Clerk.openSignIn({
        afterSignInUrl: window.location.href,
        afterSignUpUrl: window.location.href,
      });

      // Poll periodically for 8 seconds after opening modal to catch sign-in completion
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await syncState();
        if (window.Clerk?.user || attempts > 25) {
          clearInterval(poll);
        }
      }, 350);
    } else {
      window.location.href = "/";
    }
  };

  const openUserProfile = () => {
    if (window.Clerk?.openUserProfile) {
      window.Clerk.openUserProfile();
    }
  };

  const signOut = async () => {
    if (window.Clerk?.signOut) {
      await window.Clerk.signOut();
      setUser(null);
      window.location.replace("/");
    }
  };

  return {
    isLoaded,
    isSignedIn: !!user,
    user,
    openSignIn,
    openUserProfile,
    signOut,
  };
}
