"use client";

import { useEffect, useState, useCallback } from "react";

export type ClerkUser = {
  id: string;
  fullName?: string;
  primaryEmailAddress?: { emailAddress: string };
  imageUrl?: string;
};

type ClerkRawUser = {
  id?: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  profileImageUrl?: string | null;
  primaryEmailAddress?: { emailAddress?: string } | null;
  emailAddresses?: Array<{ emailAddress?: string }> | null;
};

type ClerkSession = {
  id: string;
  status?: string;
  user?: ClerkRawUser | null;
};

type ClerkEmission = {
  user?: ClerkRawUser | null;
  session?: ClerkSession | null;
  client?: {
    sessions?: ClerkSession[];
  } | null;
};

declare global {
  interface Window {
    Clerk?: {
      loaded?: boolean;
      version?: string;
      load: (options?: Record<string, unknown>) => Promise<void>;
      user: ClerkRawUser | null;
      session: ClerkSession | null;
      client?: {
        sessions?: ClerkSession[];
      };
      setActive?: (options: { session: string | null }) => Promise<void>;
      openSignIn: (options?: Record<string, unknown>) => void;
      openSignUp: (options?: Record<string, unknown>) => void;
      openUserProfile: () => void;
      signOut: () => Promise<void>;
      addListener: (listener: (emission: ClerkEmission) => void) => () => void;
    };
  }
}

let clerkLoadPromise: Promise<boolean> | null = null;

/**
 * Ensures `window.Clerk.load()` is invoked at most once concurrently across
 * all mounted components (header, watchlist, login). Concurrent `.load()`
 * calls on ClerkJS v5 cause initialization races and broken modal mounts.
 */
async function ensureClerkLoaded(): Promise<boolean> {
  if (typeof window === "undefined" || !window.Clerk) return false;
  if (window.Clerk.loaded) return true;
  if (!clerkLoadPromise) {
    clerkLoadPromise = (async () => {
      try {
        if (!window.Clerk!.loaded && typeof window.Clerk!.load === "function") {
          await window.Clerk!.load();
        }
        return Boolean(window.Clerk?.loaded);
      } catch (err) {
        console.error("Clerk load failed:", err);
        clerkLoadPromise = null;
        return false;
      }
    })();
  }
  return clerkLoadPromise;
}

function triggerPostSignInWatchlist() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem("clerk_post_sign_in_nav");
  } catch {}
  if (window.location.pathname !== "/" || window.location.hash !== "#watchlist") {
    window.location.assign("/#watchlist");
  } else {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
}

function extractUser(rawUser: ClerkRawUser | null | undefined): ClerkUser | null {
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
    if (typeof window === "undefined" || !window.Clerk) return;

    try {
      const ready = await ensureClerkLoaded();
      if (!ready) {
        setIsLoaded(true);
        return;
      }

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
    let cancelled = false;
    let initialized = false;
    let checkInterval: ReturnType<typeof setInterval> | undefined;
    let removeListener: (() => void) | undefined;

    const tryInit = async () => {
      if (initialized || cancelled || !window.Clerk) return;
      initialized = true;
      if (checkInterval) clearInterval(checkInterval);

      await syncState();
      if (cancelled || !window.Clerk) return;

      if (typeof window.Clerk.addListener === "function") {
        removeListener = window.Clerk.addListener(async (emission) => {
          if (cancelled) return;
          if (!window.Clerk?.session && emission?.client?.sessions?.length) {
            const active =
              emission.client.sessions.find((s) => s.status === "active") ||
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

          const currentUser = extractUser(raw);
          setUser(currentUser);
          setIsLoaded(true);

          if (currentUser) {
            let shouldNav = false;
            try {
              if (sessionStorage.getItem("clerk_post_sign_in_nav") === "watchlist") {
                sessionStorage.removeItem("clerk_post_sign_in_nav");
                shouldNav = true;
              }
            } catch {}
            if (shouldNav) {
              triggerPostSignInWatchlist();
            }
          }
        });
      }
    };

    if (typeof window !== "undefined" && window.Clerk) {
      Promise.resolve().then(() => {
        void tryInit();
      });
    } else {
      checkInterval = setInterval(() => {
        void tryInit();
      }, 150);
    }

    const timeout = setTimeout(() => {
      if (checkInterval) clearInterval(checkInterval);
      if (!cancelled) setIsLoaded(true);
    }, 4000);

    const handleFocus = () => {
      void syncState();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      if (checkInterval) clearInterval(checkInterval);
      clearTimeout(timeout);
      window.removeEventListener("focus", handleFocus);
      if (removeListener) removeListener();
    };
  }, [syncState]);

  const openSignIn = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!window.Clerk?.openSignIn) {
      if (window.location.pathname !== "/login") window.location.assign("/login");
      return;
    }

    try {
      const ready = await ensureClerkLoaded();
      if (!ready || !window.Clerk.loaded) {
        clerkLoadPromise = null;
        const retried = await ensureClerkLoaded();
        if (!retried) {
          if (window.location.pathname !== "/login") window.location.assign("/login");
          return;
        }
      }

      if (
        window.Clerk.user ||
        window.Clerk.session ||
        window.Clerk.client?.sessions?.some((s) => s.status === "active")
      ) {
        await syncState();
        return;
      }

      const watchlistTarget =
        typeof window !== "undefined" ? `${window.location.origin}/#watchlist` : "/#watchlist";

      try {
        sessionStorage.setItem("clerk_post_sign_in_nav", "watchlist");
      } catch {}

      window.Clerk.openSignIn({
        forceRedirectUrl: watchlistTarget,
        fallbackRedirectUrl: watchlistTarget,
        signUpForceRedirectUrl: watchlistTarget,
        signUpFallbackRedirectUrl: watchlistTarget,
        afterSignInUrl: watchlistTarget,
        afterSignUpUrl: watchlistTarget,
      });

      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await syncState();
        if (window.Clerk?.user || attempts > 25) {
          clearInterval(poll);
          if (window.Clerk?.user) {
            triggerPostSignInWatchlist();
          }
        }
      }, 350);
    } catch (err) {
      console.error("Clerk openSignIn error:", err);
      await syncState();
    }
  }, [syncState]);

  const openUserProfile = useCallback(async () => {
    if (typeof window === "undefined" || !window.Clerk?.openUserProfile) return;
    try {
      const ready = await ensureClerkLoaded();
      if (ready && window.Clerk.loaded) {
        window.Clerk.openUserProfile();
      }
    } catch (err) {
      console.error("Clerk openUserProfile error:", err);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (typeof window === "undefined" || !window.Clerk?.signOut) return;
    try {
      await ensureClerkLoaded();
      await window.Clerk.signOut();
      setUser(null);
      window.location.replace("/");
    } catch (err) {
      console.error("Clerk signOut error:", err);
    }
  }, []);

  return {
    isLoaded,
    isSignedIn: !!user,
    user,
    openSignIn,
    openUserProfile,
    signOut,
  };
}

export async function getClerkAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined" || !window.Clerk) return {};
  try {
    if (window.Clerk.session && typeof (window.Clerk.session as any).getToken === "function") {
      const token = await (window.Clerk.session as any).getToken();
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
    }
  } catch {}
  return {};
}
