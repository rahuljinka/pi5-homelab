// Every control panel request goes through apiFetch.
// - "/api" is on the panel's own web server, which forwards it to the backend,
//   so the login cookie is sent automatically and no other site can use it.
// - The backend requires X-Requested-With on changes (blocks cross-site requests).
// - A 401 means the session ended; the app listens for this and shows the login screen.
export const API = "/api";

export async function apiFetch(url, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("X-Requested-With", "fetch");
    const response = await fetch(url, { ...options, headers, credentials: "same-origin" });
    if (response.status === 401) window.dispatchEvent(new Event("pdm:unauthorized"));
    return response;
}
