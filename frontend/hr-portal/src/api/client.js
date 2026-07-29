const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

let accessToken = null;

export function setApiToken(token) {
  accessToken = token;
}

export async function fetchJson(path, options = {}) {
  const { headers: customHeaders, body, ...fetchOptions } = options;
  const headers = new Headers(customHeaders);

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  if (body && !(body instanceof FormData) && !(body instanceof URLSearchParams)) {
    headers.set("Content-Type", "application/json");
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers,
      body,
    });
  } catch {
    throw new Error("Unable to reach the server. Check that the backend is running.");
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
    throw new Error(detail);
  }

  return data;
}
