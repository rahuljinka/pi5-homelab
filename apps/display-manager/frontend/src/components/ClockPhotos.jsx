import React, { useEffect, useRef, useState } from "react";
import { Card, Button, SectionHeader, Collapsible } from "./ui";

import { API, apiFetch } from "../api";
const ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.heif";
const photoUrl = (name) => `${API}/clock/photos/${encodeURIComponent(name)}`;

const EXTENSIONS_BY_TYPE = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heic",
};

// iPhones can hand over dragged photos with no name (or no extension), and a
// part without a filename isn't treated as a file upload at all. Make sure
// every photo has a sensible name before sending it.
function uploadName(file, index) {
    const name = (file.name || "").trim();
    if (name && /\.[a-z0-9]+$/i.test(name)) return name;
    const ext = EXTENSIONS_BY_TYPE[file.type] || "jpg";
    const base = name || `photo-${Date.now()}-${index + 1}`;
    return `${base}.${ext}`;
}

// Files from a drop. Some browsers (iOS Safari) leave dataTransfer.files
// empty and only expose the photos through dataTransfer.items.
function droppedFiles(dataTransfer) {
    if (dataTransfer.files && dataTransfer.files.length) return Array.from(dataTransfer.files);
    return Array.from(dataTransfer.items || [])
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter(Boolean);
}

// Manage the wallpapers shown behind the clock screen. They're stored in
// media/clock-photos/ in the project folder (next to the Media Library's uploads).
export default function ClockPhotos() {
    const [photos, setPhotos] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [showing, setShowing] = useState(null);
    // { mode: "slideshow" | "single", file: chosen single photo }
    const [mode, setMode] = useState({ mode: "slideshow", file: null });
    const inputRef = useRef(null);
    const confirmTimer = useRef(null);

    async function loadPhotos() {
        try {
            const response = await apiFetch(`${API}/clock/photos`);
            const data = await response.json();
            setPhotos(data.photos || []);
        } catch (error) {
            console.error("Failed to load clock photos:", error);
            setPhotos([]);
        }
    }

    async function loadShowing() {
        try {
            const response = await apiFetch(`${API}/clock/current`);
            const data = await response.json();
            setShowing(data.showing);
            setMode({ mode: data.mode_mode || "slideshow", file: data.mode_file || null });
        } catch {
            // Backend unreachable; keep the last known value.
        }
    }

    useEffect(() => {
        loadPhotos();
        loadShowing();
        const interval = setInterval(loadShowing, 4000);
        return () => {
            clearInterval(interval);
            clearTimeout(confirmTimer.current);
        };
    }, []);

    async function setClockMode(newMode) {
        try {
            const response = await apiFetch(`${API}/clock/mode`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: newMode }),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            setMode({ mode: data.mode_mode, file: data.mode_file });
            setMessage({
                error: false,
                text: newMode === "single"
                    ? (data.mode_file
                        ? `The clock will stay on "${data.mode_file}". Pick "Use this photo" on another to change it.`
                        : "Single photo mode is on. Add a photo, then pick \"Use this photo\".")
                    : "Slideshow on: the photo changes every 10 minutes.",
            });
        } catch (error) {
            setMessage({ error: true, text: `Couldn't change mode: ${error.message}` });
        }
    }

    async function showNow(name) {
        try {
            const response = await apiFetch(`${API}/clock/current`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ file: name }),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            setMode({ mode: data.mode_mode, file: data.mode_file });
            setMessage({
                error: false,
                text: data.mode_mode === "single"
                    ? `The clock will stay on "${name}".`
                    : `Showing "${name}" on the clock in a few seconds. Rotation continues 10 minutes after that.`,
            });
        } catch (error) {
            setMessage({ error: true, text: `Couldn't show photo: ${error.message}` });
        }
    }

    async function upload(fileList) {
        const files = Array.from(fileList || []);
        if (files.length === 0) return;

        setUploading(true);
        setMessage(null);
        try {
            // Read each photo into memory before sending. Photos dragged out of
            // the iPhone Photos app are placeholders that Safari only fills in
            // when read; sent directly they can arrive with no data at all.
            const form = new FormData();
            let unreadable = 0;
            for (const [i, file] of files.entries()) {
                let bytes = null;
                try {
                    bytes = await file.arrayBuffer();
                } catch {
                    bytes = null;
                }
                if (!bytes || bytes.byteLength === 0) {
                    unreadable += 1;
                    continue;
                }
                form.append("files", new Blob([bytes], { type: file.type }), uploadName(file, i));
            }

            if (unreadable === files.length) {
                throw new Error(
                    "the photo couldn't be read from the drag. On iPhone, tap the box above and choose photos instead."
                );
            }

            const response = await apiFetch(`${API}/clock/photos`, { method: "POST", body: form });
            if (!response.ok) {
                // Show the backend's reason, not just the status code.
                let detail = "";
                try {
                    const body = await response.json();
                    detail = typeof body.detail === "string" ? body.detail : body.detail?.[0]?.msg || "";
                } catch {
                    // body wasn't JSON
                }
                throw new Error(`HTTP ${response.status}${detail ? ` – ${detail}` : ""}`);
            }
            const data = await response.json();
            const parts = [];
            if (unreadable) parts.push(`${unreadable} dropped photo${unreadable === 1 ? "" : "s"} couldn't be read.`);
            if (data.saved.length) parts.push(`Added ${data.saved.length} photo${data.saved.length === 1 ? "" : "s"}.`);
            if (data.skipped.length) parts.push(`Skipped ${data.skipped.length} unsupported file${data.skipped.length === 1 ? "" : "s"}.`);
            setMessage({ error: data.saved.length === 0, text: parts.join(" ") });
            loadPhotos();
        } catch (error) {
            setMessage({ error: true, text: `Upload failed: ${error.message}` });
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    }

    async function remove(name) {
        if (confirmDelete !== name) {
            setConfirmDelete(name);
            clearTimeout(confirmTimer.current);
            confirmTimer.current = setTimeout(() => setConfirmDelete(null), 4000);
            return;
        }
        setConfirmDelete(null);
        try {
            const response = await apiFetch(photoUrl(name), { method: "DELETE" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            loadPhotos();
        } catch (error) {
            setMessage({ error: true, text: `Delete failed: ${error.message}` });
        }
    }

    const count = photos ? photos.length : 0;

    return (
        <div style={{ marginBottom: "var(--spacing-xl)" }}>
            <SectionHeader title="Clock Photos" />
            <Card>
                <p style={{ marginTop: 0, color: "var(--color-textSecondary)", fontSize: "14px" }}>
                    Shown behind the clock screen. Vertical photos look best.
                </p>

                <div
                    role="radiogroup"
                    aria-label="Clock photo mode"
                    style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing-sm)", marginBottom: "var(--spacing-sm)" }}
                >
                    {[
                        { id: "slideshow", label: "Slideshow" },
                        { id: "single", label: "Single photo" },
                    ].map((option) => (
                        <Button
                            key={option.id}
                            role="radio"
                            aria-checked={mode.mode === option.id}
                            variant={mode.mode === option.id ? "primary" : "ghost"}
                            onClick={() => mode.mode !== option.id && setClockMode(option.id)}
                        >
                            {option.label}
                        </Button>
                    ))}
                </div>
                <p style={{ margin: "0 0 var(--spacing-md)", fontSize: "13px", color: "var(--color-textSecondary)" }}>
                    {mode.mode === "single"
                        ? (mode.file
                            ? <>Staying on <strong>{mode.file}</strong>. Press <strong>Use this photo</strong> on another photo to change it.</>
                            : <>Press <strong>Use this photo</strong> on a photo to keep the clock on it.</>)
                        : <>A new photo every 10 minutes. <strong>Show now</strong> jumps to a photo, then the slideshow continues.
                            {mode.file && photos?.includes(mode.file) && <> At night the schedule shows <strong>{mode.file}</strong>; switch to Single photo to pick another.</>}</>}
                </p>

                <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); upload(droppedFiles(e.dataTransfer)); }}
                    onClick={() => !uploading && inputRef.current?.click()}
                    style={{
                        border: dragging ? "2px dashed var(--color-primary)" : "2px dashed var(--color-border)",
                        borderRadius: "var(--radius-md)",
                        padding: "var(--spacing-lg)",
                        textAlign: "center",
                        cursor: uploading ? "wait" : "pointer",
                        background: dragging ? "var(--color-background)" : "transparent",
                    }}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        hidden
                        multiple
                        accept={ACCEPT}
                        onChange={(e) => upload(e.target.files)}
                    />
                    <span style={{ fontSize: "24px" }}>🖼️</span>
                    <p style={{ margin: "var(--spacing-xs) 0 0" }}>
                        {uploading ? "Uploading…" : "Drag photos here or click to choose (you can pick several)"}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-textSecondary)" }}>
                        JPG, PNG, WebP or iPhone HEIC
                    </p>
                </div>

                {message && (
                    <p style={{ margin: "var(--spacing-sm) 0 0", fontSize: "14px", color: message.error ? "var(--color-error)" : "var(--color-success)" }}>
                        {message.text}
                    </p>
                )}

                <Collapsible
                    title="Photos"
                    summary={photos ? `${count} photo${count === 1 ? "" : "s"}` : "Loading…"}
                    style={{ marginTop: "var(--spacing-md)" }}
                >
                    {count === 0 ? (
                        <p style={{ color: "var(--color-textSecondary)", margin: 0 }}>
                            No photos yet. The clock shows a sky gradient until you add some.
                        </p>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "var(--spacing-md)" }}>
                            {photos.map((name) => (
                                <div key={name} style={{
                                    border: (mode.mode === "single" ? mode.file === name : showing === name)
                                        ? "2px solid var(--color-primary)"
                                        : "1px solid var(--color-border)",
                                    borderRadius: "var(--radius-md)",
                                    overflow: "hidden",
                                    background: "var(--color-background)",
                                }}>
                                    <img
                                        src={photoUrl(name)}
                                        alt=""
                                        loading="lazy"
                                        style={{ display: "block", width: "100%", aspectRatio: "3 / 5", objectFit: "cover", background: "#000" }}
                                    />
                                    <div style={{ padding: "var(--spacing-sm)" }}>
                                        <p title={name} style={{ fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: "0 0 6px" }}>
                                            {name}
                                        </p>
                                        <div style={{ display: "grid", gap: "4px" }}>
                                            {(() => {
                                                const active = mode.mode === "single" ? mode.file === name : showing === name;
                                                const label = mode.mode === "single"
                                                    ? (active ? "Selected" : "Use this photo")
                                                    : (active ? "On screen" : "Show now");
                                                return (
                                                    <Button
                                                        variant={active ? "primary" : "ghost"}
                                                        size="sm"
                                                        style={{ width: "100%", padding: "4px", fontSize: "12px", minHeight: "32px" }}
                                                        onClick={() => showNow(name)}
                                                        disabled={active}
                                                    >
                                                        {label}
                                                    </Button>
                                                );
                                            })()}
                                            <Button
                                                variant={confirmDelete === name ? "danger" : "ghost"}
                                                size="sm"
                                                style={{ width: "100%", padding: "4px", fontSize: "12px", minHeight: "32px" }}
                                                onClick={() => remove(name)}
                                            >
                                                {confirmDelete === name ? "Tap to delete" : "Delete"}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Collapsible>
            </Card>
        </div>
    );
}
