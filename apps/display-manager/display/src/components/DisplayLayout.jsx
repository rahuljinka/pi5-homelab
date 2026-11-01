import React from "react";

export default function DisplayLayout({ children, padding = "md" }) {
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                background: "var(--color-background)",
                color: "var(--color-text)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                userSelect: "none",
                padding: `var(--spacing-${padding})`,
            }}
        >
            <main style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
                {children}
            </main>
        </div>
    );
}
