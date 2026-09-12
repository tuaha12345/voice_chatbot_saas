"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken } from "./api";
import { homePathForUser, isServiceAllowed } from "./authRedirect";

/** Redirects unapproved tenants to /pending; admins stay allowed. */
export function useApprovedGuard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api("/v1/auth/me")
      .then((me) => {
        if (!isServiceAllowed(me)) {
          router.replace("/pending");
          return;
        }
        if (me.is_admin) {
          router.replace("/admin");
          return;
        }
        setUser(me);
        setReady(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  return { ready, user };
}

export function redirectAfterAuth(router, me) {
  router.replace(homePathForUser(me));
}
