// services/memoryService.js
//
// NEW FILE — Phase 2: Conversational Memory
//
// Responsibilities:
//   1. After each call ends, summarize the conversation and persist it
//      to conversation.summary using Groq (the platform LLM — NOT OpenAI).
//   2. Expose the summary field so contextService can include it in the
//      context string injected at call start (already implemented in contextService).
//
// Why Groq and not a separate embedding/vector DB:
//   - Your stack already uses Groq for inference via Vapi.
//   - Summaries stored as text in Postgres are sufficient for the context
//     window sizes you're working with (2000 char budget in contextService).
//   - A vector DB (Phase 6) can be added later for semantic retrieval without
//     changing this service's interface.
//
// Integration points:
//   - webhooks.js calls summarizeConversationIfNeeded(conversationId) at call end.
//     Fire-and-forget — does not block the webhook response.
//   - contextService.compressConversations() already reads conversation.summary
//     and includes it in the context string. No changes needed there.
//
// Schema used (no migration required):
//   Conversation.summary  String?  @db.Text   ← written here
//   Message.role          String              ← read here (user | assistant)
//   Message.content       String              ← read here

"use strict";

const prisma = require("../config/database");

// ─── Config ───────────────────────────────────────────────────────────────────

/**
 * Minimum number of messages a conversation must have before we bother
 * summarizing. Conversations with 2-3 turns don't need a summary — the
 * full transcript is short enough to fit in context directly.
 */
const MIN_MESSAGES_TO_SUMMARIZE = 6;

/**
 * Maximum characters of transcript to send to the summarizer.
 * Groq's context window is large but we want fast, cheap summaries.
 * ~4000 chars ≈ ~1000 tokens of transcript input.
 */
const MAX_TRANSCRIPT_CHARS = 4000;

/**
 * The Groq model to use for summarization.
 * llama-3.1-8b-instant is fast and cheap — appropriate for a background task.
 * Switch to llama-3.3-70b-versatile if summary quality needs to improve.
 */
const SUMMARY_MODEL = "llama-3.1-8b-instant";

// ─── Summarization ────────────────────────────────────────────────────────────

/**
 * summarizeConversationIfNeeded(conversationId)
 *
 * Main entry point. Called by webhooks.js at call end (fire-and-forget).
 *
 * Steps:
 *   1. Load the conversation + messages from DB.
 *   2. Skip if already summarized, too short, or status isn't completed.
 *   3. Build a transcript string from messages.
 *   4. Call Groq to generate a concise summary.
 *   5. Persist the summary to conversation.summary.
 *
 * Never throws — all errors are caught and logged.
 *
 * @param {string} conversationId
 * @returns {Promise<void>}
 */
async function summarizeConversationIfNeeded(conversationId) {
  if (!conversationId) return;

  try {
    const conversation = await prisma.conversation.findUnique({
      where:   { id: conversationId },
      include: {
        messages: {
          where:   { role: { in: ["user", "assistant"] } },
          orderBy: { timestamp: "asc" },
          select:  { role: true, content: true },
        },
        agent: {
          select: { name: true, id: true },
        },
      },
    });

    if (!conversation) {
      console.warn("[memoryService] Conversation not found:", conversationId);
      return;
    }

    // Skip if already summarized
    if (conversation.summary) {
      console.log("[memoryService] Conversation already summarized:", conversationId);
      return;
    }

    // Skip if not completed (e.g. failed calls)
    if (conversation.status !== "completed") {
      console.log("[memoryService] Skipping non-completed conversation:", conversationId, conversation.status);
      return;
    }

    // Skip if too short — not worth summarizing
    if (conversation.messages.length < MIN_MESSAGES_TO_SUMMARIZE) {
      console.log(
        "[memoryService] Too few messages to summarize:",
        conversation.messages.length, "< ", MIN_MESSAGES_TO_SUMMARIZE,
      );
      return;
    }

    // Build transcript string
    const transcript = _buildTranscriptString(conversation.messages);
    if (!transcript) return;

    // Generate summary via Groq
    const summary = await _generateSummary(transcript, conversation.agent?.name);
    if (!summary) return;

    // Persist to DB
    await prisma.conversation.update({
      where: { id: conversationId },
      data:  { summary },
    });

    console.log(
      "[memoryService] Summary saved.",
      "conversationId:", conversationId,
      "summaryLength:", summary.length,
    );

  } catch (err) {
    // Non-fatal — summarization failure must not affect anything else
    console.error("[memoryService] summarizeConversationIfNeeded failed:", err.message);
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

/**
 * Build a transcript string from message rows.
 * Truncates to MAX_TRANSCRIPT_CHARS to keep Groq calls fast and cheap.
 *
 * @param {Array<{ role: string, content: string }>} messages
 * @returns {string}
 */
function _buildTranscriptString(messages) {
  const lines = messages.map((m) => {
    const role = m.role === "assistant" ? "Agent" : "User";
    const text = (m.content || "").replace(/\s+/g, " ").trim();
    return `${role}: ${text}`;
  });

  let transcript = lines.join("\n");

  // Truncate from the start (keep the most recent exchanges)
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    transcript = transcript.slice(transcript.length - MAX_TRANSCRIPT_CHARS);
    const boundary = transcript.indexOf("\n");
    if (boundary !== -1) transcript = transcript.slice(boundary + 1);
    transcript = "[...earlier turns omitted...]\n" + transcript;
  }

  return transcript.trim();
}

/**
 * Call Groq's API directly to generate a summary.
 * Uses the OpenAI-compatible endpoint that Groq exposes.
 *
 * We call Groq directly here (not through Vapi) because this is a
 * background task that should not consume Vapi call credits.
 *
 * @param {string} transcript
 * @param {string} agentName
 * @returns {Promise<string|null>}
 */
async function _generateSummary(transcript, agentName) {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    console.warn("[memoryService] GROQ_API_KEY not set — summarization disabled. Add it to .env to enable.");
    return null;
  }

  const systemPrompt = [
    "You are a conversation summarizer for a voice AI platform.",
    "Given a transcript between a user and an AI agent, write a concise factual summary.",
    "Focus on: what the user wanted, what was resolved, any key facts mentioned (names, dates, preferences, issues).",
    "Keep the summary under 150 words.",
    "Write in third person past tense.",
    "Do not include filler phrases like 'The conversation was about...'.",
    "Output only the summary text — no preamble, no labels.",
  ].join(" ");

  const userMessage = agentName
    ? `Agent name: ${agentName}\n\nTranscript:\n${transcript}`
    : `Transcript:\n${transcript}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model:       SUMMARY_MODEL,
        max_tokens:  200,
        temperature: 0.3,   // Low temperature for factual summaries
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("[memoryService] Groq API error:", response.status, body);
      return null;
    }

    const data    = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim();

    if (!summary) {
      console.warn("[memoryService] Groq returned empty summary");
      return null;
    }

    return summary;

  } catch (err) {
    console.error("[memoryService] Groq fetch failed:", err.message);
    return null;
  }
}

module.exports = {
  summarizeConversationIfNeeded,
};