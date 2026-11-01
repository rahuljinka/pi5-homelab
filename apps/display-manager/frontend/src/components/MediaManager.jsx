import React, { useEffect, useState } from "react";
import { Card, Button, SectionHeader, Collapsible } from "./ui";

import { API, apiFetch } from "../api";
const mediaUrl = (filename) => `${API}/media/${encodeURIComponent(filename)}`;

export default function MediaManager() {
    const [files, setFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [current, setCurrent] = useState(null);
    const [dragging, setDragging] = useState(false);

    async function loadFiles() {
        try {
            const res = await apiFetch(`${API}/media`);
            const data = await res.json();
            setFiles(data.files);
        } catch (error) {
            console.error("Failed to load files:", error);
        }
    }

    async function loadCurrent() {
        try {
            const res = await apiFetch(`${API}/media/current`);
            const data = await res.json();
            setCurrent(data.file);
        } catch (error) {
            console.error("Failed to load current media:", error);
        }
    }

    useEffect(() => {
        loadFiles();
        loadCurrent();
    }, []);

    function handleFile(file) {
        if (!file) return;
        setSelectedFile(file);
    }

    async function upload() {
        if (!selectedFile) return;
        const form = new FormData();
        form.append("file", selectedFile);
        try {
            await apiFetch(`${API}/media/upload`, {
                method: "POST",
                body: form
            });
            setSelectedFile(null);
            loadFiles();
        } catch (error) {
            console.error("Upload failed:", error);
        }
    }

    async function show(filename) {
        try {
            await apiFetch(`${API}/media/current`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ file: filename })
            });
            await apiFetch(`${API}/screen`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ screen: "media" })
            });
            setCurrent(filename);
        } catch (error) {
            console.error("Show failed:", error);
        }
    }

    async function stop() {
        try {
            await apiFetch(`${API}/media/current`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ file: null })
            });
            setCurrent(null);
        } catch (error) {
            console.error("Stop failed:", error);
        }
    }

    async function remove(filename) {
        try {
            await apiFetch(mediaUrl(filename), { method: "DELETE" });
            loadFiles();
            if (current === filename) setCurrent(null);
        } catch (error) {
            console.error("Delete failed:", error);
        }
    }

    return (
        <div style={{ marginBottom: "var(--spacing-xl)" }}>
            <SectionHeader title="Media Library" />
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--spacing-lg)" }}>
                <Card>
                    <h3>Upload New Media</h3>
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                        style={{
                            border: dragging ? "2px dashed var(--color-primary)" : "2px dashed var(--color-border)",
                            borderRadius: "var(--radius-md)",
                            padding: "var(--spacing-xl)",
                            textAlign: "center",
                            background: dragging ? "var(--color-surface)" : "transparent",
                            transition: "0.2s",
                            cursor: "pointer",
                            marginBottom: "var(--spacing-md)"
                        }}
                        onClick={() => document.getElementById("mediaUpload").click()}
                    >
                        <input
                            id="mediaUpload"
                            type="file"
                            hidden
                            accept=".gif,.mp4,.webm,.png,.jpg,.jpeg"
                            onChange={(e) => handleFile(e.target.files[0])}
                        />
                        {selectedFile ? (
                            <div>
                                <p style={{ fontWeight: "600" }}>{selectedFile.name}</p>
                                <p style={{ fontSize: "12px", color: "var(--color-textSecondary)" }}>{(selectedFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                        ) : (
                            <div>
                                <span style={{ fontSize: "24px" }}>📁</span>
                                <p>Drag media here or click to browse</p>
                            </div>
                        )}
                    </div>
                    <Button 
                        disabled={!selectedFile} 
                        onClick={upload} 
                        style={{ width: "100%", opacity: selectedFile ? 1 : 0.5 }}
                    >
                        Upload to Pi
                    </Button>
                </Card>

                <Card>
                    <h3>Currently Displaying</h3>
                    {current ? (
                        <div style={{ textAlign: "center" }}>
                            <div style={{ 
                                height: "120px", 
                                background: "var(--color-background)", 
                                borderRadius: "var(--radius-md)", 
                                marginBottom: "var(--spacing-md)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden"
                            }}>
                                <img 
                                    src={mediaUrl(current)} 
                                    alt="Preview" 
                                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                                />
                            </div>
                            <p style={{ fontWeight: "600" }}>{current}</p>
                            <Button variant="ghost" size="sm" onClick={stop}>Stop Displaying</Button>
                        </div>
                    ) : (
                        <div style={{ height: "150px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-textSecondary)" }}>
                            Nothing playing
                        </div>
                    )}
                </Card>
            </div>

            <Card style={{ marginTop: "var(--spacing-lg)" }}>
                <Collapsible
                    title="Stored Files"
                    summary={`${files.length} file${files.length === 1 ? "" : "s"}`}
                >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "var(--spacing-md)" }}>
                    {files.length === 0 ? (
                        <p style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--color-textSecondary)", padding: "var(--spacing-lg)" }}>No media uploaded</p>
                    ) : (
                        files.map((file) => (
                            <div key={file.filename || file} style={{ 
                                border: "1px solid var(--color-border)", 
                                borderRadius: "var(--radius-md)", 
                                overflow: "hidden",
                                background: "var(--color-background)"
                            }}>
                                <div style={{ height: "100px", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <img src={mediaUrl(file.filename || file)} loading="lazy" style={{ maxWidth: "100%", maxHeight: "100%" }} alt="" />
                                </div>
                                <div style={{ padding: "var(--spacing-sm)" }}>
                                    <p style={{ fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: "0 0 8px 0" }}>{file.filename || file}</p>
                                    <div style={{ display: "flex", gap: "4px" }}>
                                        <Button 
                                            variant={current === (file.filename || file) ? "primary" : "ghost"} 
                                            size="sm" 
                                            style={{ flex: 1, padding: "4px", fontSize: "12px" }} 
                                            onClick={() => show(file.filename || file)}
                                        >
                                            {current === (file.filename || file) ? "LIVE" : "Show"}
                                        </Button>
                                        <Button variant="danger" size="sm" style={{ padding: "4px" }} onClick={() => remove(file.filename || file)}>🗑</Button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                </Collapsible>
            </Card>
        </div>
    );
}
