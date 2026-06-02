// src/components/AgentCard.jsx
// Card component for displaying a single agent in list views.

import { useNavigate } from "react-router-dom";
import { Mic, MessageSquare, Settings, Trash2, ChevronRight, Zap } from "lucide-react";
import { Card, Button } from "./ui";

const providerColors = {
  "11labs": "var(--accent)",
  deepgram: "var(--blue)",
  openai: "var(--green)",
  azure: "var(--yellow)",
};

const personalityEmoji = {
  professional: "💼",
  friendly: "😊",
  casual: "🤙",
  formal: "🎩",
  empathetic: "💙",
  technical: "⚙️",
};

export default function AgentCard({ agent, onDelete }) {
  const navigate = useNavigate();

  return (
    <Card
      hover
      style={{ padding: "0", overflow: "hidden" }}
    >
      {/* Top bar */}
      <div
        style={{
          height: "3px",
          background: `linear-gradient(90deg, ${providerColors[agent.voiceProvider] || "var(--accent)"} 0%, transparent 100%)`,
        }}
      />

      <div style={{ padding: "20px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Agent avatar */}
            <div
              style={{
                width: 40,
                height: 40,
                background: "var(--accent-dim)",
                border: "1px solid rgba(0,212,170,0.2)",
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                flexShrink: 0,
              }}
            >
              {personalityEmoji[agent.personality] || "🤖"}
            </div>
            <div>
              <h3
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "15px",
                  color: "var(--text-primary)",
                  letterSpacing: "-0.02em",
                }}
              >
                {agent.name}
              </h3>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  marginTop: "2px",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    color: providerColors[agent.voiceProvider] || "var(--accent)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {agent.voiceProvider}
                </span>
                <span style={{ color: "var(--border-light)" }}>·</span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    color: "var(--text-muted)",
                  }}
                >
                  {agent.voiceId}
                </span>
              </div>
            </div>
          </div>

          {/* Delete */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(agent.id);
            }}
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-muted)",
              cursor: "pointer",
              transition: "var(--transition)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--red-dim)";
              e.currentTarget.style.color = "var(--red)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Prompt preview */}
        <p
          style={{
            fontSize: "12px",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            marginBottom: "14px",
            fontStyle: "italic",
          }}
        >
          "{agent.prompt}"
        </p>

        {/* Meta tags */}
        <div
          style={{
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
            marginBottom: "16px",
          }}
        >
          <span className="badge badge-accent">
            {agent.personality}
          </span>
          <span className="badge badge-blue">
            temp: {agent.temperature}
          </span>
          {agent.vapiAgentId && (
            <span className="badge badge-green">
              <Zap size={9} /> vapi synced
            </span>
          )}
          {agent._count && (
            <span className="badge" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
              <MessageSquare size={9} />
              {agent._count.conversations} calls
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "8px" }}>
          <Button
            variant="primary"
            size="sm"
            icon={Mic}
            onClick={() => navigate(`/agents/${agent.id}/talk`)}
            style={{ flex: 1 }}
          >
            Talk
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Settings}
            onClick={() => navigate(`/agents/${agent.id}`)}
          >
            Details
          </Button>
        </div>
      </div>
    </Card>
  );
}
