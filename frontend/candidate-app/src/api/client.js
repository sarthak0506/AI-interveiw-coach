const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "candidateAccessToken";
let accessToken = typeof localStorage === "undefined" ? null : localStorage.getItem(TOKEN_KEY);

export function setCandidateToken(token) {
  accessToken = token;
  if (typeof localStorage === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function fetchJson(path, options = {}) {
  let response;
  const headers = new Headers(options.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error("Unable to reach the interview service. Please try again shortly.");
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail =
      typeof data === "object" && data?.detail
        ? data.detail
        : typeof data === "string" && data
          ? data
          : `Request failed with status ${response.status}`;

    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }

  return data;
}
