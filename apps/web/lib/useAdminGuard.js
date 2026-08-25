"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken } from "./api";

export function useAdminGuard() {
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
        if (!me.is_admin) {
          router.replace("/dashboard");
          return;
        }
        setUser(me);
        setReady(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  return { ready, user };
}
