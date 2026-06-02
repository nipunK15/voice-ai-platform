"use strict";

/**
 * conversationService.js
 * backend/services/conversationService.js
 *
 * All DB operations for conversations and their messages.
 *
 * THE CRITICAL PATH FOR MEMORY:
 *
 *   TalkToAgent  →  call ends
 *        ↓
 *   PATCH /conversations/:id/end
 *        ↓
 *   endConversation() sets status = "completed"
 *        ↓
 *   contextService.fetchRecentConversations() finds it
 *        ↓
 *   next call has context → agent remembers
 *
 * If endConversation() is never called or doesn't set status = "completed",
 * the conversation stays "active" and contextService returns nothing.
 */

const prisma = require("../config/database");

// ── getConversations ──────────────────────────────────────────────────────────
// Returns all conversations for the history page, newest first.
// Includes message count and agent name for the list view.
async function getConversations() {
  return prisma.conversation.findMany({
    orderBy: { startedAt: "desc" },
    include: {
      agent: {
        select: { id: true, name: true, personality: true },
      },
      _count: {
        select: { messages: true },
      },
    },
  });
}

// ── getConversationById ───────────────────────────────────────────────────────
// Returns a single conversation with all its messages for the detail view.
async function getConversationById(id) {
  return prisma.conversation.findUnique({
    where: { id },
    include: {
      agent: {
        select: { id: true, name: true, personality: true, voiceProvider: true, voiceId: true },
      },
      messages: {
        orderBy: { timestamp: "asc" },
      },
    },
  });
}

// ── addMessage ────────────────────────────────────────────────────────────────
// Saves a single transcript turn.
// Called on every "transcript" + "final" Vapi message event.
async function addMessage(conversationId, { role, content }) {
  // Verify conversation exists and is still active before writing
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, status: true },
  });

  if (!convo) {
    const err = new Error(`Conversation ${conversationId} not found`);
    err.statusCode = 404;
    throw err;
  }

  return prisma.message.create({
    data: {
      conversationId,
      role,
      content,
      // timestamp defaults to now() in schema — no need to set it
    },
  });
}

// ── endConversation ───────────────────────────────────────────────────────────
// Marks a conversation as completed and records its duration.
//
// THIS IS THE MEMORY GATE:
// contextService only queries WHERE status = "completed".
// A conversation that never gets ended stays "active" and is invisible
// to the context layer — the agent has no memory of it next call.
//
// Called by: PATCH /conversations/:id/end (from TalkToAgent call-end event)
async function endConversation(id, { duration } = {}) {
  const now = new Date();

  const updated = await prisma.conversation.update({
    where: { id },
    data: {
      status:  "completed",          // ← THE CRITICAL FIELD for context retrieval
      endedAt: now,
      ...(duration != null && { duration: Math.round(duration) }),
    },
    include: {
      _count: { select: { messages: true } },
    },
  });

  console.log(
    `[conversationService] Conversation ${id} completed.`,
    `Duration: ${duration}s.`,
    `Messages: ${updated._count.messages}`
  );

  return updated;
}

module.exports = {
  getConversations,
  getConversationById,
  addMessage,
  endConversation,
};