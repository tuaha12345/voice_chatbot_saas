export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("vc_token");
}

export function setToken(token) {
  localStorage.setItem("vc_token", token);
}

export function clearToken() {
  localStorage.removeItem("vc_token");
}

function detail(data) {
  if (!data) return "Request failed";
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
  }
  return "Request failed";
}

export async function api(path, options = {}) {
  const { timeoutMs = 15000, signal, ...rest } = options;
  const headers = { ...(rest.headers || {}) };
  if (!(rest.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(API + path, { ...rest, headers, signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(detail(data));
    return data;
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("API request timed out — is the backend running on port 8000?");
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}
