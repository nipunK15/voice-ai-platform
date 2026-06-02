// src/components/ui.jsx
// Reusable primitive UI components.
// Building a small component library in one file for MVP speed.
// In production: split into individual files, add Storybook documentation.

import { Loader2 } from "lucide-react";

// ─── Button ───────────────────────────────────────────────────────────────────
export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon: Icon,
  onClick,
  type = "button",
  style: extraStyle = {},
  danger = false,
}) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    borderRadius: "var(--radius-md)",
    border: "1px solid transparent",
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled || loading ? 0.6 : 1,
    transition: "var(--transition)",
    whiteSpace: "nowrap",
  };

  const sizes = {
    sm: { padding: "5px 12px", fontSize: "12px" },
    md: { padding: "8px 16px", fontSize: "13px" },
    lg: { padding: "11px 20px", fontSize: "14px" },
  };

  const variants = {
    primary: {
      background: danger ? "var(--red)" : "var(--accent)",
      color: "#080c10",
      boxShadow: danger ? "none" : "0 0 12px var(--accent-glow)",
    },
    secondary: {
      background: "var(--bg-elevated)",
      color: "var(--text-primary)",
      border: "1px solid var(--border-light)",
    },
    ghost: {
      background: "transparent",
      color: "var(--text-secondary)",
      border: "1px solid transparent",
    },
    danger: {
      background: "var(--red-dim)",
      color: "var(--red)",
      border: "1px solid rgba(248,81,73,0.3)",
    },
    outline: {
      background: "transparent",
      color: "var(--accent)",
      border: "1px solid var(--accent)",
    },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{ ...base, ...sizes[size], ...variants[variant], ...extraStyle }}
    >
      {loading ? (
        <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
      ) : Icon ? (
        <Icon size={14} />
      ) : null}
      {children}
    </button>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, style: extra = {}, onClick, hover = false }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "20px",
        cursor: onClick ? "pointer" : "default",
        transition: "var(--transition)",
        ...extra,
      }}
      onMouseEnter={
        hover && onClick
          ? (e) => {
              e.currentTarget.style.borderColor = "var(--border-light)";
              e.currentTarget.style.background = "var(--bg-elevated)";
            }
          : undefined
      }
      onMouseLeave={
        hover && onClick
          ? (e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.background = "var(--bg-surface)";
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
export function Input({
  label,
  hint,
  error,
  mono = false,
  style: extra = {},
  ...props
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {label && (
        <label style={inputStyles.label}>
          {label}
          {props.required && (
            <span style={{ color: "var(--red)", marginLeft: 2 }}>*</span>
          )}
        </label>
      )}
      <input
        style={{
          ...inputStyles.input,
          ...(mono ? { fontFamily: "var(--font-mono)", fontSize: "13px" } : {}),
          ...(error ? { borderColor: "var(--red)" } : {}),
          ...extra,
        }}
        {...props}
      />
      {hint && !error && <p style={inputStyles.hint}>{hint}</p>}
      {error && <p style={inputStyles.error}>{error}</p>}
    </div>
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────────────
export function Textarea({
  label,
  hint,
  error,
  rows = 4,
  style: extra = {},
  ...props
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {label && (
        <label style={inputStyles.label}>
          {label}
          {props.required && (
            <span style={{ color: "var(--red)", marginLeft: 2 }}>*</span>
          )}
        </label>
      )}
      <textarea
        rows={rows}
        style={{
          ...inputStyles.input,
          resize: "vertical",
          lineHeight: 1.6,
          ...(error ? { borderColor: "var(--red)" } : {}),
          ...extra,
        }}
        {...props}
      />
      {hint && !error && <p style={inputStyles.hint}>{hint}</p>}
      {error && <p style={inputStyles.error}>{error}</p>}
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────
export function Select({ label, hint, error, options = [], style: extra = {}, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {label && <label style={inputStyles.label}>{label}</label>}
      <select
        style={{
          ...inputStyles.input,
          appearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b949e' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 12px center",
          paddingRight: "32px",
          cursor: "pointer",
          ...extra,
        }}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && <p style={inputStyles.hint}>{hint}</p>}
      {error && <p style={inputStyles.error}>{error}</p>}
    </div>
  );
}

// ─── Slider ───────────────────────────────────────────────────────────────────
export function Slider({ label, hint, min = 0, max = 1, step = 0.1, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <label style={inputStyles.label}>{label}</label>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--accent)" }}>
            {parseFloat(value).toFixed(1)}
          </span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        style={{
          width: "100%",
          accentColor: "var(--accent)",
          height: "4px",
          cursor: "pointer",
          background: `linear-gradient(to right, var(--accent) ${((value - min) / (max - min)) * 100}%, var(--bg-elevated) 0%)`,
          borderRadius: "2px",
          outline: "none",
          border: "none",
          appearance: "none",
        }}
      />
      {hint && <p style={inputStyles.hint}>{hint}</p>}
    </div>
  );
}

// ─── Page Header ──────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: "28px",
        gap: "16px",
      }}
    >
      <div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "24px",
            color: "var(--text-primary)",
            letterSpacing: "-0.03em",
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              marginTop: "4px",
              fontSize: "14px",
              color: "var(--text-secondary)",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {actions}
        </div>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 20px",
        textAlign: "center",
      }}
    >
      {Icon && (
        <div
          style={{
            width: 56,
            height: 56,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "16px",
            color: "var(--text-muted)",
          }}
        >
          <Icon size={24} />
        </div>
      )}
      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "16px",
          color: "var(--text-primary)",
          marginBottom: "6px",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: "14px",
          color: "var(--text-secondary)",
          maxWidth: 360,
          lineHeight: 1.6,
          marginBottom: action ? "20px" : 0,
        }}
      >
        {description}
      </p>
      {action}
    </div>
  );
}

// ─── Loading Spinner ──────────────────────────────────────────────────────────
export function Spinner({ size = 24 }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
      }}
    >
      <Loader2
        size={size}
        color="var(--accent)"
        style={{ animation: "spin 1s linear infinite" }}
      />
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({ label, value, icon: Icon, accent = false }) {
  return (
    <Card
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "20px",
        ...(accent
          ? {
              background: "var(--accent-dim)",
              border: "1px solid rgba(0,212,170,0.2)",
            }
          : {}),
      }}
    >
      {Icon && (
        <div
          style={{
            width: 40,
            height: 40,
            background: accent ? "rgba(0,212,170,0.2)" : "var(--bg-elevated)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: accent ? "var(--accent)" : "var(--text-secondary)",
            flexShrink: 0,
          }}
        >
          <Icon size={20} />
        </div>
      )}
      <div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "28px",
            color: accent ? "var(--accent)" : "var(--text-primary)",
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-secondary)",
            marginTop: "3px",
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </div>
      </div>
    </Card>
  );
}

// ─── Shared input styles ──────────────────────────────────────────────────────
const inputStyles = {
  label: {
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--text-secondary)",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    fontFamily: "var(--font-mono)",
  },
  input: {
    width: "100%",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-md)",
    padding: "10px 12px",
    fontSize: "14px",
    color: "var(--text-primary)",
    outline: "none",
    transition: "var(--transition)",
    lineHeight: 1.5,
  },
  hint: {
    fontSize: "12px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
  },
  error: {
    fontSize: "12px",
    color: "var(--red)",
  },
};
