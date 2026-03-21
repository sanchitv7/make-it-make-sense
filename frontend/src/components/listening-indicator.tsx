"use client";

interface ListeningIndicatorProps {
  isConnected: boolean;
  isPaused: boolean;
}

const BAR_HEIGHTS = [0.4, 0.6, 1, 0.7, 0.9, 0.5, 0.8, 1, 0.6, 0.9, 0.5, 0.7, 1, 0.4];

export function ListeningIndicator({ isConnected, isPaused }: ListeningIndicatorProps) {
  const isLive = isConnected && !isPaused;

  const barColor = isPaused
    ? "var(--accent-amber)"
    : isConnected
    ? "var(--accent-blue)"
    : "var(--border-active)";

  const statusText = isPaused
    ? "Paused"
    : isConnected
    ? "Listening…"
    : "Connecting…";

  return (
    <>
      <style>{`
        @keyframes bar-pulse {
          0%, 100% { opacity: 0.5; transform: scaleY(0.6); }
          50% { opacity: 1; transform: scaleY(1); }
        }
      `}</style>

      <div
        style={{
          borderRadius: "16px",
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-card)",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "12px",
          flexShrink: 0,
          marginBottom: "12px",
        }}
      >
        {/* Waveform bars */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "3px",
            height: "32px",
          }}
        >
          {BAR_HEIGHTS.map((h, i) => (
            <div
              key={i}
              style={{
                width: "3px",
                height: `${h * 32}px`,
                borderRadius: "2px",
                background: barColor,
                opacity: isConnected ? 1 : 0.3,
                transformOrigin: "center",
                animation: isLive
                  ? `bar-pulse ${0.7 + i * 0.08}s ease-in-out ${i * 0.06}s infinite`
                  : "none",
                transition: "background 0.4s ease, opacity 0.4s ease",
              }}
            />
          ))}
        </div>

        {/* Status label */}
        <span
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: "0.65rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          {statusText}
        </span>
      </div>
    </>
  );
}
