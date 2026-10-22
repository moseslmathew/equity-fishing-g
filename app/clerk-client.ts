"use client";

import { useEffect, useState } from "react";

type ClerkUser = {
  id: string;
  fullName?: string;
  primaryEmailAddress?: { emailAddress: string };
  imageUrl?: string;
};

declare global {
  interface Window {
    Clerk?: {
      load: () => Promise<void>;
      user: ClerkUser | null;
      session: { id: string } | null;
      openSignIn: () => void;
      openSignUp: () => void;
      openUserProfile: () => void;
      signOut: () => Promise<void>;
      addListener: (listener: (state: any) => void) => () => void;
    };
  }
}

export function useClerkAuth() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<ClerkUser | null>(null);

  useEffect(() => {
    let checkInterval: NodeJS.Timeout;

    const initClerk = async () => {
      if (window.Clerk) {
        if (!window.Clerk.user && typeof window.Clerk.load === "function") {
          await window.Clerk.load();
        }
        setUser(window.Clerk.user || null);
        setIsLoaded(true);

        if (typeof window.Clerk.addListener === "function") {
          window.Clerk.addListener(() => {
            setUser(window.Clerk?.user || null);
          });
        }
        clearInterval(checkInterval);
      }
    };

    checkInterval = setInterval(initClerk, 150);
    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
      setIsLoaded(true);
    }, 4000);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, []);

  const openSignIn = () => {
    if (window.Clerk?.openSignIn) {
      window.Clerk.openSignIn();
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
