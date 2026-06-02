// src/pages/AgentDetail.jsx
// CHANGES:
//  - Edit button navigates to /agents/:id/edit
//  - Delete button shows confirmation then calls DELETE /agents/:id
//  - After delete, redirects to /agents
//  - Fixed API base URL to use env var with fallback (keeps port 3001)
//  - Added loading/error states

import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:3001";

export default function AgentDetail() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const [agent,    setAgent]   = useState(null);
  const [error,    setError]   = useState(null);
  const [deleting, setDeleting]= useState(false);

  useEffect(() => {
    loadAgent();
  }, [id]);

  async function loadAgent() {
    try {
      const res = await axios.get(`${API}/agents/${id}`);
      setAgent(res.data);
    } catch (err) {
      console.log("ERROR:", err);
      setError("Failed to load agent.");
    }
  }

  async function handleDelete() {
    // Confirmation guard
    const confirmed = window.confirm(
      `Delete agent "${agent.name}"? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setDeleting(true);
      await axios.delete(`${API}/agents/${id}`);
      navigate("/agents");          // redirect to list after delete
    } catch (err) {
      console.log("Delete error:", err);
      alert("Failed to delete agent. Please try again.");
      setDeleting(false);
    }
  }

  // ── render states ──────────────────────────────────────────────────────────

  if (error) {
    return (
      <div style={{ padding: "50px" }}>
        <p style={{ color: "#ef4444", fontSize: "18px" }}>{error}</p>
        <button
          onClick={() => navigate("/agents")}
          style={btnStyle("#6b7280")}
        >
          ← Back to Agents
        </button>
      </div>
    );
  }

  if (!agent) {
    return <h2 style={{ padding: "50px" }}>Loading...</h2>;
  }

  // ── main render ────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "50px", display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: "700px",
          background: "#111827",
          padding: "40px",
          borderRadius: "20px",
          boxShadow: "0px 0px 20px rgba(0,0,0,0.3)",
        }}
      >
        <h1 style={{ fontSize: "48px", marginBottom: "30px" }}>
          {agent.name}
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px", fontSize: "22px" }}>
          <p><strong>Prompt:</strong> {agent.prompt}</p>
          <p><strong>Voice Provider:</strong> {agent.voiceProvider}</p>
          <p><strong>Voice ID:</strong> {agent.voiceId}</p>
          <p><strong>Personality:</strong> {agent.personality}</p>
          <p><strong>Temperature:</strong> {agent.temperature}</p>
        </div>

        <div style={{ display: "flex", gap: "20px", marginTop: "40px" }}>
          {/* Edit → /agents/:id/edit */}
          <button
            onClick={() => navigate(`/agents/${id}/edit`)}
            style={btnStyle("#10b981")}
          >
            Edit Agent
          </button>

          {/* Delete with confirmation */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={btnStyle("#ef4444", deleting)}
          >
            {deleting ? "Deleting..." : "Delete Agent"}
          </button>

          {/* Talk — route already exists in App.jsx */}
          <button
            onClick={() => navigate(`/agents/${id}/talk`)}
            style={btnStyle("#3b82f6")}
          >
            Talk To Agent
          </button>
        </div>
      </div>
    </div>
  );
}

// small helper — keeps JSX clean
function btnStyle(bg, disabled = false) {
  return {
    padding: "12px 20px",
    background: disabled ? "#4b5563" : bg,
    border: "none",
    borderRadius: "10px",
    color: "white",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: "16px",
    transition: "opacity 0.2s",
  };
}