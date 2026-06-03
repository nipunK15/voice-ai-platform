// src/pages/CreateAgent.jsx
// Create + Edit with React Flow canvas + right-panel detail editor.
// Requires: npm install @xyflow/react  (run once in frontend/)
//
// FIXES vs all previous versions:
// FIX 1 — useEffect now reads a.flowDefinition and calls setStages()
//          so existing stages appear when editing an agent.
// FIX 2 — showFlow auto-expands when loaded stages exist.
// FIX 3 — flowDefinition included in both create and update payloads.
// FIX 4 — stage IDs preserved on load so transitions resolve correctly.

import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const API = "http://localhost:3001";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name:          "",
  prompt:        "",
  personality:   "professional",
  voiceProvider: "11labs",
  voiceId:       "rachel",
  temperature:   0.7,
};

const PERSONALITIES   = ["professional","friendly","casual","formal","empathetic","technical"];
const VOICE_PROVIDERS = ["11labs","deepgram","openai","azure"];
const VOICES = {
  "11labs":  ["rachel","adam","bella","josh","elli"],
  deepgram:  ["luna","stella","athena","hera","orion"],
  openai:    ["alloy","echo","fable","onyx","nova","shimmer"],
  azure:     ["en-US-JennyNeural","en-US-GuyNeural","en-GB-SoniaNeural"],
};

const COND_LABELS = { keyword: "Keyword", llm_eval: "LLM eval", always: "Always" };

function makeId() { return "stage_" + Math.random().toString(36).slice(2, 8); }

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function stagesToGraph(stages) {
  if (!stages?.length) return { nodes: [], edges: [] };

  const nodes = stages.map((s, i) => ({
    id:       s.id,
    type:     "stageNode",
    position: { x: s._x ?? 80 + i * 280, y: s._y ?? 80 },
    data:     { stage: s, isFirst: i === 0 },
  }));

  const edges = [];
  stages.forEach((s) => {
    (s.transitions || []).forEach((t, ti) => {
      if (!t.toStage) return;
      const kws = Array.isArray(t.condition?.keywords)
        ? t.condition.keywords.slice(0, 2).join(", ")
        : (t.condition?.keywords || "").split(",").slice(0, 2).join(", ");
      edges.push({
        id:           `${s.id}->${t.toStage}-${ti}`,
        source:       s.id,
        target:       t.toStage,
        label:        t.condition?.type === "keyword" ? kws : (COND_LABELS[t.condition?.type] || ""),
        markerEnd:    { type: MarkerType.ArrowClosed, color: "#10b981" },
        style:        { stroke: "#10b981", strokeWidth: 1.5 },
        labelStyle:   { fill: "#9ca3af", fontSize: 11 },
        labelBgStyle: { fill: "#111827", fillOpacity: 0.85 },
      });
    });
  });

  return { nodes, edges };
}

// ─── Custom stage node ────────────────────────────────────────────────────────

function StageNode({ data, selected }) {
  const { stage, isFirst } = data;
  return (
    <div style={{
      background:   selected ? "#1e3a2f" : "#1f2937",
      border:       `1.5px solid ${selected ? "#10b981" : "#374151"}`,
      borderRadius: "12px",
      padding:      "14px 18px",
      minWidth:     "200px",
      maxWidth:     "240px",
      boxShadow:    selected ? "0 0 0 3px rgba(16,185,129,0.2)" : "none",
      cursor:       "pointer",
      transition:   "border-color 0.15s",
    }}>
      <Handle type="target" position={Position.Left}
        style={{ background: "#374151", border: "1px solid #6b7280", width: 10, height: 10 }} />

      {isFirst && (
        <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#10b981", marginBottom: "6px" }}>
          START
        </div>
      )}

      <div style={{ fontWeight: 600, fontSize: "14px", color: "#f9fafb", marginBottom: "4px" }}>
        {stage.name || <span style={{ color: "#6b7280", fontStyle: "italic" }}>Unnamed stage</span>}
      </div>

      {stage.goal && (
        <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>{stage.goal}</div>
      )}

      {stage.prompt && (
        <div style={{
          fontSize: "12px", color: "#9ca3af",
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.4,
        }}>{stage.prompt}</div>
      )}

      {(stage.transitions || []).length > 0 && (
        <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {stage.transitions.map((t, i) => (
            <span key={i} style={{
              fontSize: "10px", padding: "2px 6px", borderRadius: "999px",
              background: "#111827", color: "#6b7280", border: "1px solid #374151",
            }}>{COND_LABELS[t.condition?.type] || "?"}</span>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Right}
        style={{ background: "#10b981", border: "none", width: 10, height: 10 }} />
    </div>
  );
}

const nodeTypes = { stageNode: StageNode };

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ stage, allStages, onChange, onDelete }) {
  if (!stage) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100%", color: "#4b5563",
        textAlign: "center", padding: "28px", gap: "10px",
      }}>
        <div style={{ fontSize: "28px" }}>🎯</div>
        <div style={{ fontSize: "13px", lineHeight: 1.6 }}>
          Click a stage node to edit it.<br />
          Drag the green handle to connect stages.
        </div>
      </div>
    );
  }

  const set = (k, v) => onChange({ ...stage, [k]: v });

  const setT = (ti, patch) => {
    const t = [...(stage.transitions || [])];
    t[ti] = { ...t[ti], ...patch };
    set("transitions", t);
  };

  const setCond = (ti, patch) => {
    const t = [...(stage.transitions || [])];
    t[ti] = { ...t[ti], condition: { ...t[ti].condition, ...patch } };
    set("transitions", t);
  };

  const addT = () => set("transitions", [
    ...(stage.transitions || []),
    { toStage: "", handoffAssistantId: "", condition: { type: "keyword", keywords: [], llmPrompt: "" }, priority: 0 },
  ]);

  const removeT = (ti) => set("transitions", (stage.transitions || []).filter((_, i) => i !== ti));

  const others = allStages.filter((s) => s.id !== stage.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{
        padding: "14px 16px", borderBottom: "1px solid #1f2937",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
      }}>
        <span style={{ color: "#10b981", fontWeight: 700, fontSize: "11px", letterSpacing: "0.08em" }}>
          STAGE EDITOR
        </span>
        <button type="button" onClick={onDelete}
          style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "12px" }}>
          Delete
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>

        <label style={pL}>
          Stage name *
          <input style={pI} placeholder="e.g. greeting"
            value={stage.name} onChange={(e) => set("name", e.target.value)} />
        </label>

        <label style={pL}>
          Stage prompt *
          <textarea style={{ ...pI, height: "90px", resize: "vertical" }}
            placeholder="What should the agent say and do in this stage?"
            value={stage.prompt} onChange={(e) => set("prompt", e.target.value)} />
        </label>

        <label style={pL}>
          Goal (optional)
          <input style={pI} placeholder="e.g. Qualify the lead"
            value={stage.goal || ""} onChange={(e) => set("goal", e.target.value)} />
        </label>

        <label style={pL}>
          Auto-advance after N user turns
          <input type="number" min="1" style={{ ...pI, width: "70px" }}
            placeholder="—" value={stage.maxTurns || ""}
            onChange={(e) => set("maxTurns", e.target.value)} />
        </label>

        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#4b5563", letterSpacing: "0.07em", marginBottom: "8px" }}>
            TRANSITIONS
          </div>

          {(stage.transitions || []).map((t, ti) => (
            <div key={ti} style={{
              background: "#0d1117", border: "1px solid #1f2937",
              borderRadius: "8px", padding: "10px", marginBottom: "8px",
            }}>
              <label style={{ ...pL, marginBottom: "6px" }}>
                Go to stage
                <select style={pI} value={t.toStage || ""}
                  onChange={(e) => setT(ti, { toStage: e.target.value, handoffAssistantId: "" })}>
                  <option value="">— select —</option>
                  {others.map((s) => (
                    <option key={s.id} value={s.id}>{s.name || s.id}</option>
                  ))}
                </select>
              </label>

              <label style={{ ...pL, marginBottom: "6px" }}>
                Or handoff assistant ID
                <input style={pI} placeholder="Vapi asst ID"
                  value={t.handoffAssistantId || ""}
                  onChange={(e) => setT(ti, { handoffAssistantId: e.target.value, toStage: "" })} />
              </label>

              <label style={{ ...pL, marginBottom: "6px" }}>
                Condition
                <select style={pI} value={t.condition?.type || "keyword"}
                  onChange={(e) => setCond(ti, { type: e.target.value })}>
                  <option value="keyword">Keyword match</option>
                  <option value="llm_eval">LLM evaluation</option>
                  <option value="always">Always (immediate)</option>
                </select>
              </label>

              {t.condition?.type === "keyword" && (
                <label style={pL}>
                  Keywords (comma separated)
                  <input style={pI} placeholder="yes, confirm, ready"
                    value={Array.isArray(t.condition.keywords)
                      ? t.condition.keywords.join(", ")
                      : t.condition.keywords || ""}
                    onChange={(e) => setCond(ti, { keywords: e.target.value })} />
                </label>
              )}

              {t.condition?.type === "llm_eval" && (
                <label style={pL}>
                  Evaluation question
                  <textarea style={{ ...pI, height: "60px", resize: "vertical" }}
                    placeholder="Has the user confirmed their name?"
                    value={t.condition.llmPrompt || ""}
                    onChange={(e) => setCond(ti, { llmPrompt: e.target.value })} />
                </label>
              )}

              {t.condition?.type === "always" && (
                <p style={{ color: "#6b7280", fontSize: "12px", margin: "4px 0 0" }}>
                  Transitions immediately on stage entry.
                </p>
              )}

              <button type="button" onClick={() => removeT(ti)}
                style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "11px", marginTop: "6px", padding: 0 }}>
                Remove transition
              </button>
            </div>
          ))}

          <button type="button" onClick={addT}
            style={{
              width: "100%", padding: "7px", background: "none",
              border: "1px dashed #1f2937", borderRadius: "6px",
              color: "#6b7280", fontSize: "12px", cursor: "pointer",
            }}>
            + Add transition
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CreateAgent() {
  const navigate = useNavigate();
  const { id }   = useParams();
  const isEdit   = Boolean(id);

  const [form,       setForm]       = useState(EMPTY_FORM);
  const [stages,     setStages]     = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [nodes,      setNodes,      onNodesChange] = useNodesState([]);
  const [edges,      setEdges,      onEdgesChange] = useEdgesState([]);
  const [showFlow,   setShowFlow]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [fetching,   setFetching]   = useState(isEdit);
  const [error,      setError]      = useState(null);

  // Sync stages → canvas whenever stages change
  useEffect(() => {
    const { nodes: n, edges: e } = stagesToGraph(stages);
    setNodes(n);
    setEdges(e);
  }, [stages]);

  // ── FIX 1: Load agent including flowDefinition ──────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    axios
      .get(`${API}/agents/${id}`)
      .then((res) => {
        const a = res.data;
        setForm({
          name:          a.name          ?? "",
          prompt:        a.prompt        ?? "",
          personality:   a.personality   ?? "professional",
          voiceProvider: a.voiceProvider ?? "11labs",
          voiceId:       a.voiceId       ?? "rachel",
          temperature:   a.temperature   ?? 0.7,
        });

        // FIX 1: read flowDefinition from API response and populate stages
        const existingStages = a.flowDefinition?.stages;
        if (Array.isArray(existingStages) && existingStages.length > 0) {
          // FIX 4: preserve existing IDs; assign new ones only if missing
          const hydrated = existingStages.map((s) => ({
            ...s,
            id: s.id || makeId(),
          }));
          setStages(hydrated);
          // FIX 2: auto-expand the canvas section when stages exist
          setShowFlow(true);
        }
      })
      .catch(() => setError("Could not load agent data."))
      .finally(() => setFetching(false));
  }, [id, isEdit]);

  // ── Canvas event handlers ─────────────────────────────────────────────────────

  const onNodeDragStop = useCallback((_, node) => {
    setStages((prev) =>
      prev.map((s) => s.id === node.id ? { ...s, _x: node.position.x, _y: node.position.y } : s)
    );
  }, []);

  const onConnect = useCallback((connection) => {
    const { source, target } = connection;
    setStages((prev) =>
      prev.map((s) => {
        if (s.id !== source) return s;
        if ((s.transitions || []).some((t) => t.toStage === target)) return s;
        return {
          ...s,
          transitions: [
            ...(s.transitions || []),
            { toStage: target, handoffAssistantId: "", condition: { type: "keyword", keywords: [], llmPrompt: "" }, priority: 0 },
          ],
        };
      })
    );
    setEdges((eds) => addEdge({
      ...connection,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981" },
      style: { stroke: "#10b981", strokeWidth: 1.5 },
    }, eds));
  }, []);

  // ── Stage CRUD ────────────────────────────────────────────────────────────────

  const addStage = () => {
    const s = {
      id: makeId(), name: "", prompt: "", goal: "",
      maxTurns: null, transitions: [],
      _x: 80 + stages.length * 280, _y: 80,
    };
    setStages((prev) => [...prev, s]);
    setSelectedId(s.id);
    setShowFlow(true);
  };

  const updateStage = (updated) =>
    setStages((prev) => prev.map((s) => s.id === updated.id ? updated : s));

  const deleteStage = (sid) => {
    setStages((prev) =>
      prev.filter((s) => s.id !== sid)
          .map((s) => ({ ...s, transitions: (s.transitions || []).filter((t) => t.toStage !== sid) }))
    );
    setSelectedId(null);
  };

  // ── Form helpers ──────────────────────────────────────────────────────────────

  function setField(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  function handleProviderChange(e) {
    const p = e.target.value;
    setForm((prev) => ({ ...prev, voiceProvider: p, voiceId: VOICES[p]?.[0] ?? "" }));
  }

  // ── Submit ────────────────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim())   return setError("Name is required.");
    if (!form.prompt.trim()) return setError("System prompt is required.");

    for (let i = 0; i < stages.length; i++) {
      if (!stages[i].name.trim())   return setError(`Stage ${i + 1} needs a name.`);
      if (!stages[i].prompt.trim()) return setError(`Stage ${i + 1} needs a prompt.`);
    }
    setError(null);

    // Normalize keyword strings → arrays
    const normalizedStages = stages.map((s) => ({
      ...s,
      maxTurns: s.maxTurns ? parseInt(s.maxTurns) : null,
      transitions: (s.transitions || []).map((t) => ({
        ...t,
        condition: {
          ...t.condition,
          keywords: typeof t.condition.keywords === "string"
            ? t.condition.keywords.split(",").map((k) => k.trim()).filter(Boolean)
            : (t.condition.keywords || []),
        },
      })),
    }));

    // FIX 3: always include flowDefinition in payload
    const payload = {
      ...form,
      flowDefinition: stages.length === 0 ? null : { stages: normalizedStages },
    };

    try {
      setLoading(true);
      if (isEdit) {
        await axios.put(`${API}/agents/${id}`, payload);
        navigate(`/agents/${id}`);
      } else {
        const res = await axios.post(`${API}/agents`, payload);
        navigate(`/agents/${res.data.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Save failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (fetching) return <h2 style={{ padding: 50 }}>Loading agent...</h2>;

  const selectedStage = stages.find((s) => s.id === selectedId) || null;

  return (
    <div style={{ padding: "40px 50px", display: "flex", justifyContent: "center" }}>
      <div style={{
        width: "780px", background: "#111827", padding: "40px",
        borderRadius: "20px", boxShadow: "0 0 20px rgba(0,0,0,0.3)",
      }}>
        <h1 style={{ fontSize: "32px", marginBottom: "32px" }}>
          {isEdit ? "Edit Agent" : "Create Agent"}
        </h1>

        {error && <p style={{ color: "#ef4444", marginBottom: "16px", fontSize: "15px" }}>{error}</p>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            <label style={fL}>
              Agent Name *
              <input style={fI} placeholder="e.g. Support Bot"
                value={form.name} onChange={(e) => setField("name", e.target.value)} required />
            </label>

            <label style={fL}>
              System Prompt *
              <textarea style={{ ...fI, height: "120px", resize: "vertical" }}
                placeholder="You are a helpful assistant who..."
                value={form.prompt} onChange={(e) => setField("prompt", e.target.value)} required />
            </label>

            <label style={fL}>
              Personality
              <select style={fI} value={form.personality}
                onChange={(e) => setField("personality", e.target.value)}>
                {PERSONALITIES.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </label>

            <label style={fL}>
              Voice Provider
              <select style={fI} value={form.voiceProvider} onChange={handleProviderChange}>
                {VOICE_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>

            <label style={fL}>
              Voice
              <select style={fI} value={form.voiceId}
                onChange={(e) => setField("voiceId", e.target.value)}>
                {(VOICES[form.voiceProvider] ?? []).map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>

            <label style={fL}>
              Temperature: {parseFloat(form.temperature).toFixed(1)}
              <input type="range" min="0" max="1" step="0.1" value={form.temperature}
                onChange={(e) => setField("temperature", parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "#10b981" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#6b7280" }}>
                <span>Precise (0.0)</span><span>Creative (1.0)</span>
              </div>
            </label>

            {/* ── Prompt Orchestration ──────────────────────────────────── */}
            <div style={{ borderTop: "1px solid #1f2937", paddingTop: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <div style={{ color: "#d1d5db", fontWeight: 600, fontSize: "15px" }}>
                    Prompt Orchestration
                  </div>
                  <div style={{ color: "#6b7280", fontSize: "13px", marginTop: "2px" }}>
                    {stages.length === 0
                      ? "Optional — build multi-step conversation flows"
                      : `${stages.length} stage${stages.length !== 1 ? "s" : ""} configured`}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {stages.length > 0 && (
                    <span style={{
                      background: "#064e3b", color: "#10b981", fontSize: "11px",
                      fontWeight: 700, padding: "2px 8px", borderRadius: "999px", letterSpacing: "0.05em",
                    }}>ACTIVE</span>
                  )}
                  <button type="button" onClick={addStage}
                    style={{
                      padding: "6px 14px", background: "#10b981", border: "none",
                      borderRadius: "7px", color: "white", fontSize: "13px",
                      cursor: "pointer", fontWeight: 600,
                    }}>
                    + Add stage
                  </button>
                  {stages.length > 0 && (
                    <button type="button" onClick={() => setShowFlow((v) => !v)}
                      style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "18px" }}>
                      {showFlow ? "▲" : "▼"}
                    </button>
                  )}
                </div>
              </div>

              {showFlow && stages.length > 0 && (
                <>
                  <div style={{
                    border: "1px solid #1f2937", borderRadius: "12px",
                    overflow: "hidden", display: "flex", height: "480px",
                  }}>
                    {/* Canvas */}
                    <div style={{ flex: 1, background: "#0d1117" }}>
                      <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        nodeTypes={nodeTypes}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeDragStop={onNodeDragStop}
                        onNodeClick={(_, node) => setSelectedId(node.id)}
                        onPaneClick={() => setSelectedId(null)}
                        fitView
                        fitViewOptions={{ padding: 0.3 }}
                        proOptions={{ hideAttribution: true }}
                        style={{ background: "#0d1117" }}
                      >
                        <Background color="#1f2937" gap={20} size={1} />
                        <Controls style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
                      </ReactFlow>
                    </div>

                    {/* Detail panel */}
                    <div style={{
                      width: "280px", borderLeft: "1px solid #1f2937",
                      background: "#111827", flexShrink: 0,
                      overflow: "hidden", display: "flex", flexDirection: "column",
                    }}>
                      <DetailPanel
                        stage={selectedStage}
                        allStages={stages}
                        onChange={updateStage}
                        onDelete={() => selectedStage && deleteStage(selectedStage.id)}
                      />
                    </div>
                  </div>

                  <p style={{ fontSize: "12px", color: "#4b5563", margin: "8px 0 0" }}>
                    Click a stage to edit · Drag green handle → stage to connect · Drag nodes to rearrange
                  </p>
                </>
              )}
            </div>

            <button type="submit" disabled={loading}
              style={{
                padding: "14px", background: loading ? "#4b5563" : "#10b981",
                border: "none", borderRadius: "10px", color: "white",
                fontSize: "18px", cursor: loading ? "not-allowed" : "pointer", marginTop: "8px",
              }}>
              {loading ? (isEdit ? "Saving..." : "Creating...") : (isEdit ? "Save Changes" : "Create Agent")}
            </button>

            <button type="button"
              onClick={() => navigate(isEdit ? `/agents/${id}` : "/agents")}
              style={{
                padding: "12px", background: "transparent", border: "1px solid #374151",
                borderRadius: "10px", color: "#9ca3af", fontSize: "16px", cursor: "pointer",
              }}>
              Cancel
            </button>

          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

// Form field styles
const fL = { display:"flex", flexDirection:"column", gap:"8px", fontSize:"15px", color:"#d1d5db", fontWeight:500 };
const fI = { padding:"10px 14px", background:"#1f2937", border:"1px solid #374151", borderRadius:"8px", color:"white", fontSize:"15px", outline:"none", width:"100%" };

// Panel field styles
const pL = { display:"flex", flexDirection:"column", gap:"5px", fontSize:"12px", color:"#9ca3af", fontWeight:500 };
const pI = { padding:"7px 10px", background:"#1f2937", border:"1px solid #374151", borderRadius:"6px", color:"white", fontSize:"12px", outline:"none", width:"100%" };
