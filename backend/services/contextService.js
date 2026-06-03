// services/contextService.js
//
// CHANGES FROM PREVIOUS VERSION:
//   1. Replaced `new PrismaClient()` with shared `require("../config/database")`.
//      The old version created its own PrismaClient instance, fragmenting the
//      connection pool. Under load this caused "too many connections" errors.
//   2. Added optional callerId parameter to getAgentContext / getRecentContext.
//      Previously all context was scoped only to agentId — meaning every user
//      calling the same agent got a context blob mixing all users' conversations.
//      When callerId is provided, queries filter to that caller's sessions only.
//   3. fetchRecentConversations now accepts { agentId, callerId } options object.
//      Backward compatible — callerId is optional.

"use strict";

const prisma = require("../config/database");   // shared singleton — no new PrismaClient()

// ─── Tuneable constants ───────────────────────────────────────────────────────

/** Number of past completed conversations to include. */
const MAX_CONVERSATIONS = 5;

/**
 * Messages pulled per conversation.
 * Kept low intentionally — context is a hint, not a full replay.
 */
const MAX_MESSAGES_PER_CONVERSATION = 10;

/**
 * Hard character budget for the final context string.
 * 2 000 chars ≈ ~500 tokens — safe for most prompt windows.
 */
const MAX_CONTEXT_CHARS = 2000;

// ─── Retrieval ────────────────────────────────────────────────────────────────

/**
 * Fetch the N most recent COMPLETED conversations for an agent,
 * optionally scoped to a specific caller (user).
 *
 * @param {object} opts
 * @param {string} opts.agentId    Required.
 * @param {string} [opts.callerId] Optional. When provided, only fetches
 *                                  conversations where userId === callerId.
 *                                  This prevents mixing context from different users.
 * @returns {Promise<Array>}
 */
async function fetchRecentConversations({ agentId, callerId }) {
  const where = {
    agentId,
    status: "completed",
    ...(callerId ? { userId: callerId } : {}),
  };

  return prisma.conversation.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take:    MAX_CONVERSATIONS,
    include: {
      messages: {
        orderBy: { timestamp: "asc" },
        take:    MAX_MESSAGES_PER_CONVERSATION,
        select: {
          role:      true,
          content:   true,
          timestamp: true,
        },
      },
    },
  });
}

/**
 * Fetch a flat list of the most recent messages for an agent,
 * optionally scoped to a specific caller.
 *
 * Exported for future use (sliding-window summariser, task layer, etc).
 *
 * @param {string} agentId
 * @param {string} [callerId]
 * @returns {Promise<Array>}
 */
async function fetchRecentMessages(agentId, callerId) {
  const where = {
    conversation: {
      agentId,
      status: "completed",
      ...(callerId ? { userId: callerId } : {}),
    },
  };

  const messages = await prisma.message.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take:    MAX_CONVERSATIONS * MAX_MESSAGES_PER_CONVERSATION,
    select: {
      role:           true,
      content:        true,
      timestamp:      true,
      conversationId: true,
    },
  });

  // Reverse so callers get oldest → newest order.
  return messages.reverse();
}

// ─── Compression ─────────────────────────────────────────────────────────────

/**
 * Serialise a list of conversations into a compact context string.
 *
 * Output shape:
 *   [Session 2024-01-15]
 *   Summary: <summary if present>
 *   user: <message>
 *   assistant: <message>
 *
 * Oldest session appears first (natural reading order for LLM).
 * If full string exceeds MAX_CONTEXT_CHARS, oldest sessions are dropped.
 *
 * @param {Array} conversations  Pre-loaded with .messages[]
 * @returns {string}
 */
function compressConversations(conversations) {
  if (!conversations || conversations.length === 0) return "";

  // Reverse so oldest session appears first.
  const ordered = [...conversations].reverse();

  const blocks = ordered.map((convo) => {
    const date = convo.startedAt
      ? new Date(convo.startedAt).toISOString().slice(0, 10)
      : "unknown date";

    const lines = [`[Session ${date}]`];

    // Include AI-generated summary when present —
    // it's compressed and can represent an entire session in one line.
    if (convo.summary) {
      lines.push(`Summary: ${convo.summary.replace(/\s+/g, " ").trim()}`);
    }

    // Append individual turns. Skip system messages.
    for (const msg of convo.messages || []) {
      if (msg.role === "system") continue;
      const role = msg.role.toLowerCase();
      const text = (msg.content || "").replace(/\s+/g, " ").trim();
      if (text) lines.push(`${role}: ${text}`);
    }

    return lines.join("\n");
  });

  let full = blocks.join("\n\n");

  // Drop from the front (oldest sessions) to stay within budget.
  if (full.length > MAX_CONTEXT_CHARS) {
    full = full.slice(full.length - MAX_CONTEXT_CHARS);
    const boundary = full.indexOf("\n");
    if (boundary !== -1) full = full.slice(boundary + 1);
    full = "[...earlier sessions omitted...]\n\n" + full;
  }

  return full.trim();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * getAgentContext(agentId, callerId?)
 *
 * Returns a prompt-ready context string for an agent (and optionally a caller).
 * Returns "" when there is no history.
 *
 * Never throws — failures are logged and swallowed so a context failure
 * never breaks a live call.
 *
 * @param {string} agentId
 * @param {string} [callerId]   Optional. Scopes context to one caller.
 * @returns {Promise<string>}
 */
async function getAgentContext(agentId, callerId) {
  if (!agentId) return "";

  try {
    const conversations = await fetchRecentConversations({ agentId, callerId });
    if (!conversations.length) return "";
    return compressConversations(conversations);
  } catch (err) {
    console.error("[contextService] getAgentContext failed:", err.message);
    return "";
  }
}

/**
 * getRecentContext — alias used by agentService.startCall().
 * Signature extended to accept optional callerId without breaking existing calls.
 */
const getRecentContext = getAgentContext;

module.exports = {
  getAgentContext,
  getRecentContext,
  fetchRecentConversations,
  fetchRecentMessages,
  compressConversations,
};