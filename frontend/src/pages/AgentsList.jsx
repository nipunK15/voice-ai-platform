// src/pages/AgentsList.jsx
// CHANGES:
//  - Added search state + filtered list (name, prompt, personality)
//  - Fixed API URL to port 3001
//  - Preserved all existing functionality

import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:3001";

export default function AgentsList() {
  const [agents,  setAgents]  = useState([]);
  const [search,  setSearch]  = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    try {
      const res = await axios.get(`${API}/agents`);
      setAgents(res.data);
    } catch (err) {
      console.log(err);
    }
  }

  // Client-side filter — runs on every render, no extra API calls
  const filtered = agents.filter((agent) => {
    const q = search.toLowerCase();
    return (
      agent.name.toLowerCase().includes(q) ||
      agent.prompt.toLowerCase().includes(q) ||
      (agent.personality || "").toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: "40px" }}>
      <h1 style={{ marginBottom: "20px" }}>Agents</h1>

      {/* ── Search bar ─────────────────────────────────────────────── */}
      <input
        type="text"
        placeholder="Search by name, prompt, personality..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          maxWidth: "500px",
          padding: "10px 16px",
          marginBottom: "24px",
          background: "#1f2937",
          border: "1px solid #374151",
          borderRadius: "8px",
          color: "white",
          fontSize: "16px",
          outline: "none",
        }}
      />

      <p style={{ marginBottom: "16px", color: "#9ca3af" }}>
        {search
          ? `${filtered.length} of ${agents.length} agents`
          : `${agents.length} agent${agents.length !== 1 ? "s" : ""}`}
      </p>

      {/* ── Agent cards ────────────────────────────────────────────── */}
      {filtered.length === 0 && search ? (
        <p style={{ color: "#6b7280" }}>No agents match "{search}"</p>
      ) : (
        filtered.map((agent) => (
          <div
            key={agent.id}
            onClick={() => navigate(`/agents/${agent.id}`)}
            style={{
              border: "1px solid gray",
              padding: "20px",
              margin: "0 0 16px 0",
              cursor: "pointer",
              borderRadius: "8px",
              background: "#111827",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = "#6b7280")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = "gray")
            }
          >
            <h2 style={{ marginBottom: "8px" }}>{agent.name}</h2>
            <p style={{ color: "#9ca3af", marginBottom: "6px" }}>
              {agent.prompt}
            </p>
            <p style={{ color: "#6b7280", fontSize: "14px" }}>
              {agent.voiceProvider} · {agent.personality}
            </p>
          </div>
        ))
      )}
    </div>
  );
}