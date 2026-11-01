import React, { useEffect, useState } from "react";
import { API, apiFetch } from "../api";
import { Card, Button } from "./ui";

// Shows the control panel only when logged in.
// First run (no password yet): asks for the one-time setup code printed in
// the backend log, then a new password. Afterwards: a normal login.
export default function AuthGate({ children }) {
    const [status, setStatus] = useState(null); // {authenticated, setup_required, auth_disabled}
    const [error, setError] = useState(null);

    async function loadStatus() {
        try {
            const response = await apiFetch(`${API}/auth/status`);
            setStatus(await response.json());
        } catch {
            setError("Can't reach the Pi. Check that the display manager is running.");
        }
    }

    useEffect(() => {
        loadStatus();
        const onUnauthorized = () => setStatus((s) => (s ? { ...s, authenticated: false } : s));
        window.addEventListener("pdm:unauthorized", onUnauthorized);
        return () => window.removeEventListener("pdm:unauthorized", onUnauthorized);
    }, []);

    if (!status) {
        return <Centered>{error || "Loading…"}</Centered>;
    }
    if (status.authenticated) {
        return children;
    }
    return <LoginForm setup={status.setup_required} onDone={loadStatus} />;
}

export async function logout() {
    await apiFetch(`${API}/auth/logout`, { method: "POST" });
    window.dispatchEvent(new Event("pdm:unauthorized"));
}

function Centered({ children }) {
    return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--spacing-lg)", color: "var(--color-textSecondary)" }}>
            {children}
        </div>
    );
}

const FIELD = {
    width: "100%",
    font: "inherit",
    fontSize: "16px",
    padding: "10px 12px",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-border)",
    background: "var(--color-background)",
    color: "var(--color-text)",
};

function LoginForm({ setup, onDone }) {
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    async function submit(event) {
        event.preventDefault();
        setError(null);
        if (setup && password !== confirm) {
            setError("The two passwords don't match.");
            return;
        }
        setBusy(true);
        try {
            const response = await apiFetch(`${API}/auth/${setup ? "setup" : "login"}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(setup ? { code, password } : { password }),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                setError(typeof body.detail === "string" ? body.detail : "That didn't work. Try again.");
                return;
            }
            onDone();
        } catch {
            setError("Can't reach the Pi.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <Centered>
            <Card style={{ width: "100%", maxWidth: "380px", color: "var(--color-text)" }}>
                <form onSubmit={submit} style={{ display: "grid", gap: "var(--spacing-md)" }}>
                    <h1 style={{ margin: 0, fontSize: "22px" }}>Pi Display Manager</h1>
                    <p style={{ margin: 0, color: "var(--color-textSecondary)", fontSize: "14px" }}>
                        {setup
                            ? "Create the control panel password. The one-time setup code is in the backend log (docker compose logs backend)."
                            : "Enter the control panel password."}
                    </p>
                    {setup && (
                        <label style={{ display: "grid", gap: "6px", fontSize: "14px" }}>
                            Setup code
                            <input id="setup-code" style={FIELD} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" required />
                        </label>
                    )}
                    <label style={{ display: "grid", gap: "6px", fontSize: "14px" }}>
                        {setup ? "New password (at least 10 characters)" : "Password"}
                        <input id="password" type="password" style={FIELD} value={password} onChange={(e) => setPassword(e.target.value)}
                            autoComplete={setup ? "new-password" : "current-password"} minLength={setup ? 10 : undefined} required autoFocus={!setup} />
                    </label>
                    {setup && (
                        <label style={{ display: "grid", gap: "6px", fontSize: "14px" }}>
                            Repeat password
                            <input id="password-confirm" type="password" style={FIELD} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
                        </label>
                    )}
                    {error && <p role="alert" style={{ margin: 0, color: "var(--color-error)", fontSize: "14px" }}>{error}</p>}
                    <Button type="submit" disabled={busy}>{busy ? "…" : setup ? "Create password" : "Log in"}</Button>
                </form>
            </Card>
        </Centered>
    );
}
