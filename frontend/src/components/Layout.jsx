// src/components/Layout.jsx
// Root layout with sidebar navigation.
// All authenticated pages render inside this layout.

import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Plus,
  Mic,
  ChevronRight,
  Zap,
} from "lucide-react";
import { useApp } from "../context/AppContext";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/conversations", label: "History", icon: MessageSquare },
];

export default function Layout() {
  const { user } = useApp();
  const location = useLocation();

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* ─── Sidebar ─────────────────────────────────────────────────────── */}
      <aside style={styles.sidebar}>
        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoIcon}>
            <Mic size={16} color="#080c10" strokeWidth={2.5} />
          </div>
          <div>
            <div style={styles.logoName}>VoiceAI</div>
            <div style={styles.logoSub}>Platform</div>
          </div>
        </div>

        {/* Quick Action */}
        <div style={{ padding: "0 12px 16px" }}>
          <NavLink to="/agents/new" style={styles.newAgentBtn}>
            <Plus size={14} />
            New Agent
          </NavLink>
        </div>

        <div style={styles.divider} />

        {/* Nav */}
        <nav style={{ padding: "12px 0", flex: 1 }}>
          {navItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                style={{
                  ...styles.navItem,
                  ...(isActive ? styles.navItemActive : {}),
                }}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
                {isActive && (
                  <ChevronRight
                    size={12}
                    style={{ marginLeft: "auto", opacity: 0.5 }}
                  />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={styles.sidebarFooter}>
          <div style={styles.divider} />
          <div style={styles.userCard}>
            <div style={styles.userAvatar}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={styles.userName}>{user.name}</div>
              <div style={styles.userEmail}>{user.email}</div>
            </div>
          </div>
          <div style={styles.versionTag}>
            <Zap size={10} />
            MVP v1.0
          </div>
        </div>
      </aside>

      {/* ─── Main Content ─────────────────────────────────────────────────── */}
      <main style={styles.main}>
        <div style={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

const styles = {
  sidebar: {
    width: "var(--sidebar-w)",
    minWidth: "var(--sidebar-w)",
    background: "var(--bg-surface)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "20px 16px 16px",
  },
  logoIcon: {
    width: 32,
    height: 32,
    background: "var(--accent)",
    borderRadius: "var(--radius-md)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxShadow: "var(--glow-accent)",
  },
  logoName: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "15px",
    color: "var(--text-primary)",
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  logoSub: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    color: "var(--text-muted)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  newAgentBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "var(--accent)",
    color: "#080c10",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: "13px",
    padding: "8px 12px",
    borderRadius: "var(--radius-md)",
    width: "100%",
    justifyContent: "center",
    transition: "var(--transition)",
    boxShadow: "var(--glow-accent)",
  },
  divider: {
    height: "1px",
    background: "var(--border)",
    margin: "0 16px",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "9px 16px",
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--text-secondary)",
    transition: "var(--transition)",
    borderRadius: "0",
    cursor: "pointer",
  },
  navItemActive: {
    color: "var(--accent)",
    background: "var(--accent-dim)",
    borderLeft: "2px solid var(--accent)",
    paddingLeft: "14px",
  },
  sidebarFooter: {
    padding: "0 0 8px",
  },
  userCard: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 16px",
  },
  userAvatar: {
    width: 28,
    height: 28,
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-light)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--accent)",
    flexShrink: 0,
  },
  userName: {
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--text-primary)",
    lineHeight: 1.3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 140,
  },
  userEmail: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 140,
  },
  versionTag: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 16px",
    fontSize: "10px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-muted)",
  },
  main: {
    flex: 1,
    overflow: "auto",
    background: "var(--bg-base)",
  },
  content: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "32px 32px",
    minHeight: "100%",
  },
};
