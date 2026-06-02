// src/pages/Dashboard.jsx
// Main dashboard page — first thing a developer sees after login.
// Shows platform stats, recent conversations, and quick actions.

import { useNavigate } from "react-router-dom";
import { Bot, MessageSquare, Mic2, Plus, ArrowRight, Clock, Activity } from "lucide-react";
import { useStats } from "../hooks/useConversations";
import { useAgents } from "../hooks/useAgents";
import { PageHeader, StatCard, Card, Button, EmptyState, Spinner } from "../components/ui";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const navigate = useNavigate();
  const { stats, loading: statsLoading } = useStats();
  const { agents, loading: agentsLoading } = useAgents();

  return (
    <div className="animate-in">
      <PageHeader
        title="Dashboard"
        subtitle="Monitor your voice agents and conversations"
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => navigate("/agents/new")}
          >
            New Agent
          </Button>
        }
      />

      {/* ─── Stats Row ─────────────────────────────────────────────────── */}
      {statsLoading ? (
        <Spinner />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "16px",
            marginBottom: "28px",
          }}
        >
          <StatCard
            label="Active Agents"
            value={stats?.totalAgents ?? 0}
            icon={Bot}
            accent
          />
          <StatCard
            label="Total Calls"
            value={stats?.totalConversations ?? 0}
            icon={Activity}
          />
          <StatCard
            label="Messages"
            value={stats?.totalMessages ?? 0}
            icon={MessageSquare}
          />
        </div>
      )}

      {/* ─── Main Grid ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
        }}
      >
        {/* Recent Conversations */}
        <Card>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "15px",
                color: "var(--text-primary)",
              }}
            >
              Recent Conversations
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/conversations")}
            >
              View all
              <ArrowRight size={12} />
            </Button>
          </div>

          {statsLoading ? (
            <Spinner size={20} />
          ) : stats?.recentConversations?.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {stats.recentConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => navigate(`/conversations/${conv.id}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 12px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    transition: "var(--transition)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-light)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      background: "var(--accent-dim)",
                      borderRadius: "var(--radius-sm)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Mic2 size={14} color="var(--accent)" />
                  </div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        marginBottom: "2px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {conv.agent?.name || "Unknown Agent"}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Clock size={9} />
                      {formatDistanceToNow(new Date(conv.startedAt), {
                        addSuffix: true,
                      })}
                      <span style={{ color: "var(--border-light)" }}>·</span>
                      {conv._count?.messages ?? 0} messages
                    </div>
                  </div>
                  <span
                    className={`badge badge-${
                      conv.status === "completed"
                        ? "green"
                        : conv.status === "active"
                        ? "accent"
                        : "red"
                    }`}
                  >
                    {conv.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={MessageSquare}
              title="No conversations yet"
              description="Start talking to one of your agents to see conversations here."
            />
          )}
        </Card>

        {/* Quick Agents */}
        <Card>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "15px",
                color: "var(--text-primary)",
              }}
            >
              Your Agents
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/agents")}
            >
              View all <ArrowRight size={12} />
            </Button>
          </div>

          {agentsLoading ? (
            <Spinner size={20} />
          ) : agents.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {agents.slice(0, 5).map((agent) => (
                <div
                  key={agent.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        background: "var(--bg-hover)",
                        borderRadius: "var(--radius-sm)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        color: "var(--accent)",
                      }}
                    >
                      <Bot size={14} />
                    </div>
                    <div style={{ overflow: "hidden" }}>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "var(--text-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {agent.name}
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {agent.voiceProvider} · {agent.personality}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Mic2}
                    onClick={() => navigate(`/agents/${agent.id}/talk`)}
                  >
                    Talk
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Bot}
              title="No agents yet"
              description="Create your first voice agent to get started."
              action={
                <Button
                  variant="primary"
                  icon={Plus}
                  onClick={() => navigate("/agents/new")}
                >
                  Create Agent
                </Button>
              }
            />
          )}
        </Card>
      </div>

      {/* ─── Getting Started Banner ────────────────────────────────────── */}
      {agents.length === 0 && !agentsLoading && (
        <Card
          style={{
            marginTop: "20px",
            background:
              "linear-gradient(135deg, var(--accent-dim) 0%, transparent 100%)",
            border: "1px solid rgba(0,212,170,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "24px 28px",
          }}
        >
          <div>
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "18px",
                color: "var(--text-primary)",
                marginBottom: "6px",
              }}
            >
              Build your first voice agent
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
              Configure a personality, prompt, and voice — then talk to it in seconds.
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            icon={Plus}
            onClick={() => navigate("/agents/new")}
          >
            Create Agent
          </Button>
        </Card>
      )}
    </div>
  );
}
