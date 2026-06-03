"use strict";

/**
 * conversationService.js
 * backend/services/conversationService.js
 *
 * CHANGES FROM ORIGINAL:
 *   1. endConversation now correctly persists `summary` to the DB.
 *      Previously the signature was (id, { duration }) — summary was never accepted.
 *      The webhooks.js handler was calling endConversation(id, userId, { summary })
 *      which meant summary was passed as the second positional arg (not destructured)
 *      and silently dropped. Summary is the primary memory compression tool —
 *      if it's never written, contextService always falls back to raw message replay.
 *
 *   2. addMessages (bulk) added — webhooks.js end-of-call handler gets the full
 *      transcript array and needs to write all messages in one shot, not one at a time.
 *      The original addMessage (singular) still exists for real-time turn writes.
 *
 *   3. getConversationSummary added — used by memoryService to check if a
 *      conversation already has a summary before generating one.
 */

const prisma = require("../config/database");

// ── getConversations ──────────────────────────────────────────────────────────
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

// ── getConversationSummary ────────────────────────────────────────────────────
// Used by memoryService to check if summarization has already run for a call.
async function getConversationSummary(id) {
  const convo = await prisma.conversation.findUnique({
    where:  { id },
    select: { id: true, summary: true, status: true },
  });
  return convo;
}

// ── addMessage (singular) ─────────────────────────────────────────────────────
// Real-time turn write — called on each "transcript" + "final" Vapi event.
async function addMessage(conversationId, { role, content }) {
  const convo = await prisma.conversation.findUnique({
    where:  { id: conversationId },
    select: { id: true, status: true },
  });

  if (!convo) {
    const err = new Error(`Conversation ${conversationId} not found`);
    err.statusCode = 404;
    throw err;
  }

  return prisma.message.create({
    data: { conversationId, role, content },
  });
}

// ── addMessages (bulk) ────────────────────────────────────────────────────────
// FIX: Added to handle the end-of-call transcript batch from Vapi's webhook.
// The webhook receives the full transcript array in the end-of-call-report event
// and needs to persist all messages atomically.
//
// @param {string}   conversationId
// @param {Array}    messages  [{ role, content, timestamp? }]
async function addMessages(conversationId, messages) {
  if (!messages || messages.length === 0) return;

  const convo = await prisma.conversation.findUnique({
    where:  { id: conversationId },
    select: { id: true },
  });

  if (!convo) {
    const err = new Error(`Conversation ${conversationId} not found`);
    err.statusCode = 404;
    throw err;
  }

  // createMany is much faster than N individual creates for transcript bulk-write
  return prisma.message.createMany({
    data: messages.map((m) => ({
      conversationId,
      role:      m.role,
      content:   m.content || "",
      timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
    })),
    skipDuplicates: true, // safe for idempotent webhook retries
  });
}

// ── endConversation ───────────────────────────────────────────────────────────
// MEMORY GATE — contextService only queries WHERE status = "completed".
//
// FIX: summary is now accepted and persisted.
// Previous signature: endConversation(id, { duration })
// New signature:      endConversation(id, { duration, summary })
//
// The webhook was calling endConversation(conversation.id, conversation.userId, { summary })
// — userId was the second positional arg which this function received as the options
// object, meaning { duration } destructuring got nothing. Fixed in webhooks.js too.
async function endConversation(id, { duration, summary } = {}) {
  const now = new Date();

  const updated = await prisma.conversation.update({
    where: { id },
    data: {
      status:  "completed",
      endedAt: now,
      ...(duration != null && { duration: Math.round(duration) }),
      // FIX: persist summary — critical for memory compression in contextService
      ...(summary  != null && { summary: summary.trim() }),
    },
    include: {
      _count: { select: { messages: true } },
    },
  });

  console.log(
    `[conversationService] Conversation ${id} completed.`,
    `Duration: ${duration ?? "?"}s.`,
    `Messages: ${updated._count.messages}.`,
    `Summary: ${summary ? "✓ persisted" : "✗ none"}`
  );

  return updated;
}

module.exports = {
  getConversations,
  getConversationById,
  getConversationSummary,
  addMessage,
  addMessages,
  endConversation,
};