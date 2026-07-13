"use client";

// Root-layout error boundary. It replaces the whole document, so it must
// render its own <html>/<body> and can't rely on app styles/components.
export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.25rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0a0a0a",
          color: "#fafafa",
        }}
      >
        <p style={{ fontSize: "2.5rem", fontWeight: 900, margin: 0 }}>
          Total Failure
        </p>
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>
          The whole rack tipped over
        </h1>
        <p style={{ color: "#a1a1a1", maxWidth: "28rem", margin: 0 }}>
          Something broke below the app itself. Reload to set it back up.
        </p>
        <button
          onClick={() => unstable_retry()}
          style={{
            borderRadius: "0.75rem",
            border: "none",
            background: "#f29e23",
            color: "#0a0a0a",
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
