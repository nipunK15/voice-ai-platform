// src/pages/TalkToAgent.jsx
//
// FIXES IN THIS VERSION:
//
// FIX 1 — vapi.start() argument shape (ROOT CAUSE of "Something went wrong")
//   BEFORE: vapi.start(vapiCallConfig)
//     where vapiCallConfig = { assistantId: "...", assistantOverrides: {...} }
//     Vapi SDK v2 does NOT accept a plain object with these keys directly.
//     It expects either a string assistantId OR a structured params object.
//
//   AFTER:  vapi.start(assistantId, assistantOverrides)
//     The backend POST /agents/:id/start-call now returns:
//       { assistantId, conversationId, assistantOverrides }
//     We call: vapi.start(result.assistantId, result.assistantOverrides)
//     This is the correct Vapi v2 Web SDK call signature.
//
// FIX 2 — Use POST /agents/:id/start-call instead of GET /agents/:id/vapi-config
//   The start-call endpoint: verifies the assistant still exists on Vapi,
//   creates the conversation DB record server-side, and returns the
//   conversationId so we don't need a separate POST /conversations call.
//
// FIX 3 — vapiRef cleanup on re-call
//   If the user clicks "Start New Call" after a previous call ended,
//   the old Vapi instance is still in vapiRef. We now explicitly null it
//   and create a fresh instance each time to avoid listener accumulation.
//
// FIX 4 — removeAllListeners() guard
//   Vapi SDK v2 may not expose removeAllListeners(). We now guard this
//   call so unmount doesn't throw a TypeError.
//
// FIX 5 — conversationId closure problem in call-end handler
//   call-end fires asynchronously after the state update from call-start.
//   Using a ref (conversationIdRef) instead of state ensures call-end
//   always sees the latest conversationId, not a stale closure value.

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Vapi from "@vapi-ai/web";

const API = "http://localhost:3001/api";

const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY || "";

const STATUS = {
  LOADING:    "loading",
  READY:      "ready",
  CONNECTING: "connecting",
  ACTIVE:     "active",
  ENDING:     "ending",
  ENDED:      "ended",
  ERROR:      "error",
};

export default function TalkToAgent() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [agent,        setAgent]        = useState(null);
  const [callStatus,   setCallStatus]   = useState(STATUS.LOADING);
  const [errorMessage, setErrorMessage] = useState("");
  const [transcript,   setTranscript]   = useState([]);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted,      setIsMuted]      = useState(false);
  const [volumeLevel,  setVolumeLevel]  = useState(0);

  const vapiRef           = useRef(null);
  const callStartTime     = useRef(null);
  const durationTimer     = useRef(null);
  // FIX 5: use a ref for conversationId so async handlers always see current value
  const conversationIdRef = useRef(null);

  // ── Load agent ───────────────────────────────────────────────────────────────
  useEffect(() => {
    loadAgent();
    return () => {
      safeStopVapi();
      clearInterval(durationTimer.current);
    };
  }, [id]);

  async function loadAgent() {
    try {
      const res = await axios.get(`${API}/agents/${id}`);
      setAgent(res.data);

      // Warn in UI if agent was created before auto-Vapi-sync was added
      if (!res.data.vapiAgentId) {
        setErrorMessage(
          "This agent has no Vapi assistant linked. " +
          "Please delete it and create a new one for voice calls to work."
        );
        setCallStatus(STATUS.ERROR);
        return;
      }

      console.log("[TalkToAgent] Agent loaded. vapiAgentId:", res.data.vapiAgentId);
      setCallStatus(STATUS.READY);
    } catch (err) {
      console.error("[TalkToAgent] loadAgent failed:", err);
      setErrorMessage("Could not load agent. It may have been deleted.");
      setCallStatus(STATUS.ERROR);
    }
  }

  // ── FIX 4: safe Vapi stop that won't throw if instance is null or missing methods
  function safeStopVapi() {
    if (!vapiRef.current) return;
    try {
      vapiRef.current.stop();
    } catch (_) {}
    try {
      // removeAllListeners exists in some SDK versions, not all
      if (typeof vapiRef.current.removeAllListeners === "function") {
        vapiRef.current.removeAllListeners();
      }
    } catch (_) {}
    vapiRef.current = null;
  }

  // ── Init Vapi instance ────────────────────────────────────────────────────────
  // FIX 3: always creates a fresh instance, cleaning up any previous one first
  function initVapi() {
    if (!VAPI_PUBLIC_KEY) {
      setErrorMessage(
        "VITE_VAPI_PUBLIC_KEY is not set in frontend/.env. " +
        "Restart the dev server after adding it."
      );
      setCallStatus(STATUS.ERROR);
      return null;
    }

    // Clean up previous instance before creating a new one
    safeStopVapi();

    console.log("[TalkToAgent] Initialising Vapi SDK with public key:", VAPI_PUBLIC_KEY.slice(0, 8) + "...");
    const vapi = new Vapi(VAPI_PUBLIC_KEY);
    vapiRef.current = vapi;

    vapi.on("call-start", async () => {
      console.log("[Vapi event] call-start");
      setCallStatus(STATUS.ACTIVE);
      callStartTime.current = Date.now();

      durationTimer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime.current) / 1000);
        setCallDuration(elapsed);
      }, 1000);
    });

    vapi.on("call-end", async () => {
      console.log("[Vapi event] call-end");
      setCallStatus(STATUS.ENDED);
      clearInterval(durationTimer.current);

      const duration = callStartTime.current
        ? Math.floor((Date.now() - callStartTime.current) / 1000)
        : 0;
      setCallDuration(duration);

      // FIX 5: read from ref, not state — avoids stale closure
      const convId = conversationIdRef.current;
      if (convId) {
        console.log("[TalkToAgent] Ending conversation record:", convId);
        try {
          await axios.patch(`${API}/conversations/${convId}/end`, { duration });
        } catch (e) {
          console.warn("[TalkToAgent] Could not end conversation:", e.message);
        }
      }
    });

    vapi.on("message", (message) => {
      // Debug: log every message type to help diagnose issues
      console.log("[Vapi event] message:", message.type, message.transcriptType || "");

      if (message.type === "transcript" && message.transcriptType === "final") {
        const entry = {
          role:    message.role,
          content: message.transcript,
          ts:      Date.now(),
        };
        setTranscript((prev) => [...prev, entry]);

        const convId = conversationIdRef.current;
        if (convId) {
          axios
            .post(`${API}/conversations/${convId}/messages`, {
              role:    entry.role === "bot" ? "assistant" : entry.role,
              content: entry.content,
            })
            .catch((e) => console.warn("[TalkToAgent] Message save failed:", e.message));
        }
      }

      if (message.type === "function-call") {
        console.log("[Vapi event] function-call:", message.functionCall);
      }
    });

    vapi.on("volume-level", (level) => {
      setVolumeLevel(level);
    });

    vapi.on("error", (err) => {
      console.error("[Vapi event] error:", err);
      clearInterval(durationTimer.current);

      // err can be a plain object {message, error, statusCode} from Vapi's
      // REST layer, or an Error instance, or have nested objects.
      // We must always resolve to a string — rendering an object crashes React.
      const extractMessage = (e) => {
        if (!e) return null;
        // Vapi v2 shape: { error: { message: "..." } }
        if (typeof e?.error?.message === "string") return e.error.message;
        // Vapi v2 shape: { error: "string" }
        if (typeof e?.error === "string") return e.error;
        // Standard Error or { message: "string" }
        if (typeof e?.message === "string") return e.message;
        // Last resort — stringify the whole thing so React can render it
        try { return JSON.stringify(e); } catch (_) { return null; }
      };

      setErrorMessage(
        extractMessage(err) ||
        "A Vapi call error occurred. Check the browser console for details."
      );
      setCallStatus(STATUS.ERROR);
    });

    return vapi;
  }

  // ── Start Call ────────────────────────────────────────────────────────────────
  const handleStartCall = useCallback(async () => {
    if (!agent) return;

    setCallStatus(STATUS.CONNECTING);
    setTranscript([]);
    setCallDuration(0);
    setErrorMessage("");
    conversationIdRef.current = null;

    try {
      // FIX 1 + 2: use POST /agents/:id/start-call instead of GET /vapi-config
      // This endpoint: verifies assistant exists, creates conversation record,
      // returns { assistantId, conversationId, assistantOverrides }
      console.log("[TalkToAgent] Calling start-call endpoint for agent:", id);
      const res    = await axios.post(`${API}/agents/${id}/start-call`);
      const result = res.data;

      console.log("[TalkToAgent] start-call response:", {
        assistantId:    result.assistantId,
        conversationId: result.conversationId,
      });

      // Store conversationId in ref immediately so call-end handler sees it
      conversationIdRef.current = result.conversationId;

      // Init fresh Vapi instance with all listeners attached
      const vapi = initVapi();
      if (!vapi) return;

      // FIX 1 — CORRECT vapi.start() call for SDK v2:
      //   vapi.start(assistantId)
      //   — OR —
      //   vapi.start(assistantId, assistantOverrides)
      //
      // DO NOT pass the whole response object.
      // The assistantId must be a plain string.
      console.log("[TalkToAgent] Calling vapi.start() with assistantId:", result.assistantId);
      await vapi.start(result.assistantId, result.assistantOverrides);

      // STATUS.ACTIVE is set by the "call-start" event handler above.
      // If vapi.start() resolves but call-start never fires, the error handler fires instead.

    } catch (err) {
      console.error("[TalkToAgent] handleStartCall failed:", err);
      setErrorMessage(
        err?.response?.data?.error ||
        err?.message               ||
        "Failed to start the call. Check the browser console and backend logs."
      );
      setCallStatus(STATUS.ERROR);
    }
  }, [agent, id]);

  // ── End Call ──────────────────────────────────────────────────────────────────
  const handleEndCall = useCallback(() => {
    if (!vapiRef.current) return;
    console.log("[TalkToAgent] User ended call.");
    setCallStatus(STATUS.ENDING);
    vapiRef.current.stop();
  }, []);

  // ── Mute toggle ───────────────────────────────────────────────────────────────
  const handleToggleMute = useCallback(() => {
    if (!vapiRef.current) return;
    const next = !isMuted;
    vapiRef.current.setMuted(next);
    setIsMuted(next);
    console.log("[TalkToAgent] Mute:", next);
  }, [isMuted]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function formatDuration(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  // ── Render: Loading ───────────────────────────────────────────────────────────
  if (callStatus === STATUS.LOADING) {
    return (
      <div style={styles.centered}>
        <p style={styles.mutedText}>Loading agent...</p>
      </div>
    );
  }

  // ── Render: Error ─────────────────────────────────────────────────────────────
  if (callStatus === STATUS.ERROR) {
    return (
      <div style={styles.centered}>
        <div style={styles.errorBox}>
          <p style={styles.errorTitle}>Something went wrong</p>
          <p style={styles.errorMsg}>{errorMessage}</p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            {agent?.vapiAgentId && (
              <button
                onClick={() => { setCallStatus(STATUS.READY); setErrorMessage(""); }}
                style={btnStyle("#10b981")}
              >
                Try Again
              </button>
            )}
            <button onClick={() => navigate(`/agents/${id}`)} style={btnStyle("#6b7280")}>
              Back to Agent
            </button>
          </div>

          {/* Debug info — helps developers fix config issues */}
          <div style={styles.debugBox}>
            <p style={styles.debugTitle}>Debug Info</p>
            <p style={styles.debugLine}>Agent ID: {id}</p>
            <p style={styles.debugLine}>Vapi Assistant ID: {agent?.vapiAgentId || "NOT SET"}</p>
            <p style={styles.debugLine}>
              VITE_VAPI_PUBLIC_KEY: {VAPI_PUBLIC_KEY ? VAPI_PUBLIC_KEY.slice(0, 12) + "..." : "NOT SET ⚠️"}
            </p>
            <p style={styles.debugLine}>Backend: {API}</p>
          </div>
        </div>
      </div>
    );
  }

  const isLive       = callStatus === STATUS.ACTIVE;
  const isConnecting = callStatus === STATUS.CONNECTING || callStatus === STATUS.ENDING;
  const isEnded      = callStatus === STATUS.ENDED;

  // ── Render: Main ──────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.header}>
          <button onClick={() => navigate(`/agents/${id}`)} style={styles.backBtn}>
            ← Back
          </button>
          <span style={styles.headerLabel}>Voice Call</span>
        </div>

        {/* Agent Info */}
        <div style={styles.agentInfo}>
          <div style={styles.agentAvatar}>
            {agent?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div>
            <h2 style={styles.agentName}>{agent?.name}</h2>
            <p style={styles.agentMeta}>
              {agent?.voiceProvider} · {agent?.voiceId} · {agent?.personality}
            </p>
            <p style={styles.agentMeta}>
              Vapi ID: <span style={{ color: "#10b981", fontFamily: "monospace" }}>
                {agent?.vapiAgentId || "⚠️ NOT SET"}
              </span>
            </p>
          </div>
        </div>

        {/* Status row */}
        <div style={styles.statusRow}>
          <StatusDot status={callStatus} />
          <span style={styles.statusText}>
            {callStatus === STATUS.READY      && "Ready — click Start Call to begin"}
            {callStatus === STATUS.CONNECTING && "Connecting to Vapi..."}
            {callStatus === STATUS.ACTIVE     && "Call in progress"}
            {callStatus === STATUS.ENDING     && "Ending call..."}
            {callStatus === STATUS.ENDED      && "Call ended"}
          </span>
          {isLive && (
            <span style={styles.timer}>{formatDuration(callDuration)}</span>
          )}
        </div>

        {/* Waveform */}
        {isLive && <Waveform level={volumeLevel} />}

        {/* Controls */}
        <div style={styles.controls}>
          {(callStatus === STATUS.READY || isEnded) && (
            <button onClick={handleStartCall} style={btnStyle("#10b981", false, "180px")}>
              {isEnded ? "Start New Call" : "▶  Start Call"}
            </button>
          )}
          {isConnecting && (
            <button style={btnStyle("#4b5563", true, "180px")} disabled>
              {callStatus === STATUS.CONNECTING ? "Connecting..." : "Ending..."}
            </button>
          )}
          {isLive && (
            <>
              <button onClick={handleToggleMute} style={btnStyle(isMuted ? "#f59e0b" : "#374151", false, "120px")}>
                {isMuted ? "Unmute" : "Mute"}
              </button>
              <button onClick={handleEndCall} style={btnStyle("#ef4444", false, "120px")}>
                End Call
              </button>
            </>
          )}
        </div>

        {/* Transcript */}
        {transcript.length > 0 && (
          <div style={styles.transcriptSection}>
            <p style={styles.transcriptTitle}>
              Transcript ({transcript.length} messages)
            </p>
            <div style={styles.transcriptBox}>
              {transcript.map((entry, i) => (
                <TranscriptLine key={i} entry={entry} />
              ))}
            </div>
          </div>
        )}

        {/* Post-call summary */}
        {isEnded && (
          <div style={styles.summary}>
            <p style={styles.summaryTitle}>✓ Call Complete</p>
            <p style={styles.summaryMeta}>
              Duration: {formatDuration(callDuration)} · {transcript.length} message{transcript.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={() => navigate("/conversations")}
              style={{ ...btnStyle("#3b82f6"), marginTop: "12px" }}
            >
              View Conversation History
            </button>
          </div>
        )}

        {/* No public key warning (READY state) */}
        {callStatus === STATUS.READY && !VAPI_PUBLIC_KEY && (
          <div style={styles.warningBox}>
            <strong>⚠️ VITE_VAPI_PUBLIC_KEY not set</strong>
            <p style={{ margin: "6px 0 0", fontSize: "13px" }}>
              Add it to <code>frontend/.env</code>:
              <br />
              <code>VITE_VAPI_PUBLIC_KEY=your_public_key_here</code>
              <br />
              Then restart the Vite dev server.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusDot({ status }) {
  const colors = {
    [STATUS.READY]:      "#6b7280",
    [STATUS.CONNECTING]: "#f59e0b",
    [STATUS.ACTIVE]:     "#10b981",
    [STATUS.ENDING]:     "#f59e0b",
    [STATUS.ENDED]:      "#3b82f6",
    [STATUS.ERROR]:      "#ef4444",
  };
  const pulse = status === STATUS.ACTIVE || status === STATUS.CONNECTING;
  return (
    <span style={{
      display: "inline-block", width: 10, height: 10, borderRadius: "50%",
      background: colors[status] || "#6b7280", marginRight: 8,
      animation: pulse ? "pulse 1.5s ease-in-out infinite" : "none",
      boxShadow: pulse ? `0 0 6px ${colors[status]}` : "none",
    }} />
  );
}

function Waveform({ level }) {
  const bars = [0.4, 0.7, 1.0, 0.7, 0.4];
  return (
    <div style={styles.waveform}>
      {bars.map((m, i) => (
        <div key={i} style={{
          width: 6,
          height: Math.max(4, Math.round(level * 40 * m)),
          background: "#10b981",
          borderRadius: 3,
          transition: "height 0.08s ease",
        }} />
      ))}
    </div>
  );
}

function TranscriptLine({ entry }) {
  const isUser = entry.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 10 }}>
      <div style={{
        maxWidth: "75%",
        background: isUser ? "#1d4ed8" : "#1f2937",
        border: `1px solid ${isUser ? "#2563eb" : "#374151"}`,
        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        padding: "10px 14px", fontSize: 14, color: "#f3f4f6", lineHeight: 1.5,
      }}>
        <span style={{
          display: "block", fontSize: 11, marginBottom: 4, fontWeight: 600,
          textTransform: "uppercase", letterSpacing: "0.04em",
          color: isUser ? "#93c5fd" : "#6b7280",
        }}>
          {isUser ? "You" : "Agent"}
        </span>
        {entry.content}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

function btnStyle(bg, disabled = false, width = "auto") {
  return {
    padding: "12px 24px", width, background: disabled ? "#374151" : bg,
    border: "none", borderRadius: "10px", color: "white",
    fontSize: 16, fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1, transition: "opacity 0.15s",
  };
}

if (typeof document !== "undefined" && !document.getElementById("vapi-styles")) {
  const s = document.createElement("style");
  s.id = "vapi-styles";
  s.textContent = `@keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.3);opacity:0.6} }`;
  document.head.appendChild(s);
}

const styles = {
  page:        { padding: "40px 20px", display: "flex", justifyContent: "center", minHeight: "100vh", background: "#0d1117" },
  card:        { width: "100%", maxWidth: 620, background: "#111827", borderRadius: 20, padding: "36px", boxShadow: "0 0 40px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", gap: 24, height: "fit-content" },
  header:      { display: "flex", alignItems: "center", justifyContent: "space-between" },
  backBtn:     { background: "transparent", border: "1px solid #374151", borderRadius: 8, color: "#9ca3af", padding: "6px 14px", cursor: "pointer", fontSize: 14 },
  headerLabel: { fontSize: 13, color: "#6b7280", fontFamily: "monospace", letterSpacing: "0.06em", textTransform: "uppercase" },
  agentInfo:   { display: "flex", alignItems: "center", gap: 16, padding: "20px", background: "#1f2937", borderRadius: 12, border: "1px solid #374151" },
  agentAvatar: { width: 52, height: 52, borderRadius: "50%", background: "#065f46", border: "2px solid #10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#6ee7b7", flexShrink: 0 },
  agentName:   { fontSize: 22, fontWeight: 700, color: "#f3f4f6", margin: 0 },
  agentMeta:   { fontSize: 13, color: "#6b7280", margin: "4px 0 0", fontFamily: "monospace" },
  statusRow:   { display: "flex", alignItems: "center", padding: "12px 16px", background: "#0d1117", borderRadius: 8, border: "1px solid #1f2937" },
  statusText:  { fontSize: 14, color: "#9ca3af", flex: 1 },
  timer:       { fontFamily: "monospace", fontSize: 16, color: "#10b981", fontWeight: 600 },
  waveform:    { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 50, background: "#0d1117", borderRadius: 8, border: "1px solid #1f2937", padding: "0 20px" },
  controls:    { display: "flex", justifyContent: "center", gap: 12 },
  transcriptSection: { display: "flex", flexDirection: "column", gap: 10 },
  transcriptTitle:   { fontSize: 12, color: "#6b7280", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 },
  transcriptBox:     { maxHeight: 320, overflowY: "auto", padding: "12px", background: "#0d1117", borderRadius: 10, border: "1px solid #1f2937", display: "flex", flexDirection: "column" },
  summary:     { textAlign: "center", padding: "20px", background: "#0d1117", borderRadius: 10, border: "1px solid #1f2937" },
  summaryTitle:{ fontSize: 18, fontWeight: 700, color: "#f3f4f6", margin: "0 0 6px" },
  summaryMeta: { fontSize: 13, color: "#6b7280", fontFamily: "monospace", margin: 0 },
  centered:    { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" },
  mutedText:   { color: "#6b7280", fontSize: 16 },
  errorBox:    { background: "#1f2937", border: "1px solid #ef4444", borderRadius: 12, padding: "28px", maxWidth: 520, textAlign: "center" },
  errorTitle:  { color: "#f87171", fontSize: 18, fontWeight: 700, marginBottom: 10 },
  errorMsg:    { color: "#9ca3af", fontSize: 14, marginBottom: 20, lineHeight: 1.5 },
  debugBox:    { marginTop: 16, background: "#0d1117", borderRadius: 8, padding: "12px 16px", textAlign: "left", border: "1px solid #374151" },
  debugTitle:  { fontSize: 11, color: "#6b7280", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" },
  debugLine:   { fontSize: 12, color: "#4b5563", fontFamily: "monospace", margin: "4px 0" },
  warningBox:  { background: "#1c1400", border: "1px solid #92400e", borderRadius: 8, padding: "14px 16px", color: "#fbbf24", fontSize: 14, lineHeight: 1.5 },
};