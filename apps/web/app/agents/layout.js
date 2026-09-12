"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, getToken } from "../../lib/api";
import { isServiceAllowed } from "../../lib/authRedirect";

export default function AgentsLayout({ children }) {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api("/v1/auth/me")
      .then((me) => {
        if (me.is_admin) {
          router.replace("/admin");
          return;
        }
        if (!isServiceAllowed(me)) {
          router.replace("/pending");
        }
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  return children;
}
