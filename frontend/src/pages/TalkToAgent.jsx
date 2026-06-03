// src/pages/TalkToAgent.jsx
//
// FIXES IN THIS VERSION:
//
// FIX 1 — call?.id was undefined (call was never defined anywhere in the component).
//   Vapi SDK v2 does not expose a `call` object on the instance. The active call ID
//   is available via the "call-start" event payload. We capture it in callIdRef.
//   callId is now correctly sent to the backend on every message save, enabling
//   vapiService.updateCallAssistant() to target the live call when a stage advances.
//
// FIX 2 — Vapi transcript event shape guard.
//   Vapi SDK versions differ on whether transcriptType is always present.
//   Added a fallback: accept the message if transcriptType is "final" OR if
//   transcriptType is absent but message.transcript is a non-empty string.
//   This prevents "0 messages" when running older/newer SDK builds.
//
// All other logic is preserved exactly.

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Vapi from "@vapi-ai/web";

const API            = "http://localhost:3001/api";
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
  const conversationIdRef = useRef(null);
  // FIX 1: capture the live Vapi call ID from the call-start event
  const callIdRef         = useRef(null);

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

  function safeStopVapi() {
    if (!vapiRef.current) return;
    try { vapiRef.current.stop(); } catch (_) {}
    try {
      if (typeof vapiRef.current.removeAllListeners === "function") {
        vapiRef.current.removeAllListeners();
      }
    } catch (_) {}
    vapiRef.current = null;
  }

  function initVapi() {
    if (!VAPI_PUBLIC_KEY) {
      setErrorMessage(
        "VITE_VAPI_PUBLIC_KEY is not set in frontend/.env. " +
        "Restart the dev server after adding it."
      );
      setCallStatus(STATUS.ERROR);
      return null;
    }

    safeStopVapi();

    console.log("[TalkToAgent] Initialising Vapi SDK:", VAPI_PUBLIC_KEY.slice(0, 8) + "...");
    const vapi = new Vapi(VAPI_PUBLIC_KEY);
    vapiRef.current = vapi;

    // FIX 1: call-start payload contains the active call object with its ID.
    // Capture it in callIdRef so every message save can include the callId.
    vapi.on("call-start", async (callObject) => {
      console.log("[Vapi event] call-start", callObject);
      // SDK v2 passes the call object as the event payload
      if (callObject?.id) {
        callIdRef.current = callObject.id;
        console.log("[TalkToAgent] Live call ID captured:", callObject.id);
      }
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

      const convId = conversationIdRef.current;
      if (convId) {
        console.log("[TalkToAgent] Ending conversation record:", convId);
        try {
          await axios.patch(`${API}/conversations/${convId}/end`, { duration });
        } catch (e) {
          console.warn("[TalkToAgent] Could not end conversation:", e.message);
        }
      }

      // Clear call ID after call ends
      callIdRef.current = null;
    });

    vapi.on("message", (message) => {
      console.log("[Vapi event] message:", message.type, message.transcriptType || "");

      // FIX 2: guard against SDK version differences in transcriptType presence.
      // Accept the turn if:
      //   a) transcriptType is explicitly "final" (standard), OR
      //   b) transcriptType is absent/undefined but transcript is a non-empty string
      //      (some SDK builds omit transcriptType on final events)
      const isFinalTranscript =
        message.type === "transcript" &&
        (
          message.transcriptType === "final" ||
          (!message.transcriptType && typeof message.transcript === "string" && message.transcript.trim().length > 0)
        );

      if (isFinalTranscript) {
        console.log("[TRANSCRIPT EVENT]", message.role, message.transcript);

        const entry = {
          role:    message.role,
          content: message.transcript,
          ts:      Date.now(),
          // FIX 1: use callIdRef instead of the undefined `call?.id`
          callId:  callIdRef.current,
        };

        setTranscript((prev) => [...prev, entry]);

        const convId = conversationIdRef.current;
        if (convId) {
          axios
            .post(
            `${API}/conversations/${convId}/messages`,
            {
            role:
            entry.role==="bot"
            ? "assistant"
            : entry.role,

            content:
            entry.content,

            callId:
            entry.callId
            }
            )
            .then(async(res)=>{

            console.log(
            "[messages response]",
            res.data
            );

            if(
            res.data.toolExecuted ||
            res.data.stopFurtherProcessing
            ){

            console.log(
                "[TalkToAgent] Tool executed. Stopping Vapi continuation."
            );

            if(
                vapiRef.current
            ){

                try{

                await vapiRef.current.stop();

                }catch(err){

                console.log(err);

                }

            }

            return;

            }

            })
            .catch((e)=>
            console.warn(
            "[TalkToAgent] Message save failed:",
            e.message
            )
            );
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

      const extractMessage = (e) => {
        if (!e) return null;
        if (typeof e?.error?.message === "string") return e.error.message;
        if (typeof e?.error === "string") return e.error;
        if (typeof e?.message === "string") return e.message;
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

  const handleStartCall = useCallback(async () => {
    if (!agent) return;

    setCallStatus(STATUS.CONNECTING);
    setTranscript([]);
    setCallDuration(0);
    setErrorMessage("");
    conversationIdRef.current = null;
    callIdRef.current         = null;

    try {
      console.log("[TalkToAgent] Calling start-call endpoint for agent:", id);
      const res    = await axios.post(`${API}/agents/${id}/start-call`);
      const result = res.data;

      console.log("[TalkToAgent] start-call response:", {
        assistantId:    result.assistantId,
        conversationId: result.conversationId,
      });

      conversationIdRef.current = result.conversationId;

      const vapi = initVapi();
      if (!vapi) return;

      console.log("[TalkToAgent] Calling vapi.start() with assistantId:", result.assistantId);
      await vapi.start(result.assistantId, result.assistantOverrides);

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

  const handleEndCall = useCallback(() => {
    if (!vapiRef.current) return;
    console.log("[TalkToAgent] User ended call.");
    setCallStatus(STATUS.ENDING);
    vapiRef.current.stop();
  }, []);

  const handleToggleMute = useCallback(() => {
    if (!vapiRef.current) return;
    const next = !isMuted;
    vapiRef.current.setMuted(next);
    setIsMuted(next);
    console.log("[TalkToAgent] Mute:", next);
  }, [isMuted]);

  function formatDuration(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  if (callStatus === STATUS.LOADING) {
    return (
      <div style={styles.centered}>
        <p style={styles.mutedText}>Loading agent...</p>
      </div>
    );
  }

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

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        <div style={styles.header}>
          <button onClick={() => navigate(`/agents/${id}`)} style={styles.backBtn}>
            ← Back
          </button>
          <span style={styles.headerLabel}>Voice Call</span>
        </div>

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

        {isLive && <Waveform level={volumeLevel} />}

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

// ── Sub-components ────────────────────────────────────────────────────────────

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

// ── Styles ────────────────────────────────────────────────────────────────────

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
