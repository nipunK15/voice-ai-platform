"use strict";

/**
 * contextService.js
 * backend/services/contextService.js
 *
 * Conversation context retrieval layer.
 *
 * Responsibilities:
 *   1. Fetch recent completed conversations for an agent
 *   2. Retrieve recent messages per conversation
 *   3. Compress and return a prompt-ready context string
 *
 * Schema refs (prisma/schema.prisma):
 *   Conversation → id, agentId, status, startedAt, summary
 *   Message      → id, conversationId, role, content, timestamp
 *
 * Constraints:
 *   - CommonJS only
 *   - Read-only — no writes, no mutations
 *   - No memory layer, no embeddings
 *   - Never throws to caller — safe to call inside start-call route
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

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
 * Raise carefully; this goes into every start-call payload.
 */
const MAX_CONTEXT_CHARS = 2000;

// ─── Retrieval ────────────────────────────────────────────────────────────────

/**
 * Fetch the N most recent COMPLETED conversations for an agent,
 * with their messages pre-loaded in chronological order.
 *
 * We filter to status "completed" only — active/failed calls
 * are not useful context for a new session.
 *
 * @param {string} agentId
 * @returns {Promise<Array>}
 */
async function fetchRecentConversations(agentId) {
  return prisma.conversation.findMany({
    where: {
      agentId,
      status: "completed",
    },
    orderBy: { startedAt: "desc" },
    take: MAX_CONVERSATIONS,
    include: {
      messages: {
        // timestamp is the correct field on Message (not createdAt)
        orderBy: { timestamp: "asc" },
        take: MAX_MESSAGES_PER_CONVERSATION,
        select: {
          role: true,
          content: true,
          timestamp: true,
        },
      },
    },
  });
}

/**
 * Fetch a flat list of the most recent messages for an agent,
 * spanning all conversations, oldest-first.
 *
 * Exported for future use (sliding-window summariser, task layer, etc).
 * Not used by the main getAgentContext() path.
 *
 * @param {string} agentId
 * @returns {Promise<Array>}
 */
async function fetchRecentMessages(agentId) {
  const messages = await prisma.message.findMany({
    where: {
      conversation: {
        agentId,
        status: "completed",
      },
    },
    orderBy: { timestamp: "desc" },
    take: MAX_CONVERSATIONS * MAX_MESSAGES_PER_CONVERSATION,
    select: {
      role: true,
      content: true,
      timestamp: true,
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
 *
 *   [Session 2024-01-15]
 *   Summary: <summary if present>
 *   user: <message>
 *   assistant: <message>
 *   ...
 *
 *   [Session 2024-01-16]
 *   ...
 *
 * Conversations arrive newest-first from the DB query.
 * We reverse them so the string reads oldest → newest,
 * which is the natural reading order for a language model.
 *
 * If the full string exceeds MAX_CONTEXT_CHARS we drop the oldest
 * sessions from the front — the most recent exchanges are always kept.
 *
 * @param {Array} conversations  Pre-loaded with .messages[]
 * @returns {string}
 */
function compressConversations(conversations) {
  if (!conversations || conversations.length === 0) return "";

  // Reverse so oldest session appears first in the string.
  const ordered = [...conversations].reverse();

  const blocks = ordered.map((convo) => {
    const date = convo.startedAt
      ? new Date(convo.startedAt).toISOString().slice(0, 10)
      : "unknown date";

    const lines = [`[Session ${date}]`];

    // Include the AI-generated summary when present —
    // it's already compressed and can represent an entire session in one line.
    if (convo.summary) {
      lines.push(`Summary: ${convo.summary.replace(/\s+/g, " ").trim()}`);
    }

    // Append individual turns. Skip system messages — they add noise,
    // not signal, when injected back into a future prompt.
    for (const msg of convo.messages || []) {
      if (msg.role === "system") continue;
      const role = msg.role.toLowerCase();
      const text = (msg.content || "").replace(/\s+/g, " ").trim();
      if (text) lines.push(`${role}: ${text}`);
    }

    return lines.join("\n");
  });

  let full = blocks.join("\n\n");

  // ── Budget enforcement ────────────────────────────────────────────────────
  // Drop from the front (oldest sessions) not the back.
  // Guarantees the model always sees the most recent history.
  if (full.length > MAX_CONTEXT_CHARS) {
    full = full.slice(full.length - MAX_CONTEXT_CHARS);

    // Avoid starting mid-sentence — skip to the next clean line boundary.
    const boundary = full.indexOf("\n");
    if (boundary !== -1) full = full.slice(boundary + 1);

    full = "[...earlier sessions omitted...]\n\n" + full;
  }

  return full.trim();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * getAgentContext(agentId)
 *
 * Main entry point for the context layer.
 *
 * Returns a prompt-ready string describing recent conversation history
 * for the given agent. Returns "" when there is no history.
 *
 * NEVER throws — any internal failure is logged and swallowed.
 * This is intentional: context enrichment must not break a live call.
 *
 * @param {string} agentId
 * @returns {Promise<string>}
 */
async function getAgentContext(agentId) {
  if (!agentId) return "";

  try {
    const conversations = await fetchRecentConversations(agentId);
    if (!conversations.length) return "";
    return compressConversations(conversations);
  } catch (err) {
    console.error("[contextService] getAgentContext failed:", err.message);
    return "";
  }
}

/**
 * getRecentContext(agentId)
 *
 * Alias for getAgentContext — used by agentService.startCall().
 * Both names are exported so neither call site needs to change
 * if this service is extended in future layers.
 *
 * @param {string} agentId
 * @returns {Promise<string>}
 */
const getRecentContext = getAgentContext;

module.exports = {
  getAgentContext,           // Primary canonical name
  getRecentContext,          // Alias — matches agentService import
  fetchRecentConversations,  // Exported for future task/memory layers
  fetchRecentMessages,       // Exported for future sliding-window use
  compressConversations,     // Exported for unit testing
};