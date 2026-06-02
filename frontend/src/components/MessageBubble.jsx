// src/components/MessageBubble.jsx
// Individual message bubble for conversation history display.
// Supports user, assistant, and system roles with distinct styling.

import { format } from "date-fns";
import { Bot, User, Info } from "lucide-react";

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          margin: "8px 0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "20px",
            padding: "4px 12px",
            fontSize: "11px",
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <Info size={10} />
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        gap: "10px",
        alignItems: "flex-end",
        marginBottom: "16px",
        animation: "fadeIn 0.2s ease",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: isUser ? "var(--blue-dim)" : "var(--accent-dim)",
          border: `1px solid ${isUser ? "rgba(56,139,253,0.3)" : "rgba(0,212,170,0.3)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: isUser ? "var(--blue)" : "var(--accent)",
        }}
      >
        {isUser ? <User size={13} /> : <Bot size={13} />}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", gap: "3px", alignItems: isUser ? "flex-end" : "flex-start" }}>
        <div
          style={{
            background: isUser ? "var(--blue-dim)" : "var(--bg-elevated)",
            border: `1px solid ${isUser ? "rgba(56,139,253,0.2)" : "var(--border)"}`,
            borderRadius: isUser
              ? "12px 12px 3px 12px"
              : "12px 12px 12px 3px",
            padding: "10px 14px",
            fontSize: "14px",
            color: "var(--text-primary)",
            lineHeight: 1.6,
          }}
        >
          {message.content}
        </div>

        {/* Timestamp */}
        <span
          style={{
            fontSize: "10px",
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
            padding: "0 4px",
          }}
        >
          {message.timestamp
            ? format(new Date(message.timestamp), "HH:mm")
            : ""}
          {message.duration ? ` · ${message.duration.toFixed(1)}s` : ""}
        </span>
      </div>
    </div>
  );
}
