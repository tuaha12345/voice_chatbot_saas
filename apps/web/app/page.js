"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, getToken } from "../lib/api";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api("/v1/auth/me")
      .then((me) => router.replace(me.is_admin ? "/admin" : "/dashboard"))
      .catch(() => router.replace("/login"));
  }, [router]);
  return <p className="wrap muted">Loading…</p>;
}
