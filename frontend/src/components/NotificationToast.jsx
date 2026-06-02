// src/components/NotificationToast.jsx
// Global notification toast system.
// Renders notifications from AppContext in the top-right corner.

import { useApp } from "../context/AppContext";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

const icons = {
  success: { icon: CheckCircle, color: "var(--green)" },
  error: { icon: XCircle, color: "var(--red)" },
  info: { icon: Info, color: "var(--blue)" },
};

export default function NotificationToast() {
  const { notifications } = useApp();

  if (notifications.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        maxWidth: "360px",
      }}
    >
      {notifications.map((n) => {
        const config = icons[n.type] || icons.info;
        const IconComp = config.icon;

        return (
          <div
            key={n.id}
            style={{
              background: "var(--bg-elevated)",
              border: `1px solid var(--border-light)`,
              borderLeft: `3px solid ${config.color}`,
              borderRadius: "var(--radius-md)",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              boxShadow: "var(--shadow-lg)",
              animation: "slide-in-right 0.25s ease",
              minWidth: 280,
            }}
          >
            <IconComp size={16} color={config.color} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: "13px", color: "var(--text-primary)", flex: 1 }}>
              {n.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}
