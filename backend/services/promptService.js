"use strict";

/**
 * promptService.js
 * backend/services/promptService.js
 *
 * Owns the compiled-prompt logic for the multi-layer prompt architecture.
 *
 * Responsibility:
 *   Take an agent record (from Prisma) plus optional runtime strings
 *   (context, task override) and return a single compiled system prompt
 *   string ready for injection into Vapi's assistantOverrides.
 *
 * Layer order (top → bottom inside the compiled string):
 *
 *   ┌─────────────────────────────────────────────────────┐
 *   │  1. Personality prefix  (from PERSONALITY_PREFIXES) │
 *   │  2. System prompt       (agent.systemPrompt)        │
 *   │  3. Conversation prompt (agent.conversationPrompt)  │
 *   │  4. Task prompt         (agent.taskPrompt)          │
 *   │  5. Memory instructions (agent.memoryInstructions)  │
 *   │  6. Tool instructions   (agent.toolInstructions)    │
 *   │  7. Context block       (from contextService)       │
 *   └─────────────────────────────────────────────────────┘
 *
 * Backward compatibility:
 *   If none of the new layer fields (systemPrompt … toolInstructions) are
 *   set on an agent, the function falls back to agent.prompt exactly as
 *   the platform worked before. Existing agents produce identical output
 *   to what agentService previously built inline.
 *
 * This file has NO side effects — pure input/output, no Prisma, no Vapi.
 * It can be unit-tested without any infrastructure.
 */

// ─── Personality prefixes ─────────────────────────────────────────────────────
// Kept here (copied from agentService) so agentService can import from one
// place. Remove the duplicate from agentService once confirmed working.

const PERSONALITY_PREFIXES = {
  professional: "You are a professional and formal AI voice assistant. Speak clearly and concisely.",
  friendly:     "You are a warm, friendly AI voice assistant. Be conversational and approachable.",
  casual:       "You are a casual, laid-back AI voice assistant. Use relaxed language.",
  formal:       "You are a highly formal AI voice assistant. Use precise, structured language.",
  empathetic:   "You are an empathetic AI voice assistant. Show genuine care and understanding.",
  technical:    "You are a technical AI voice assistant. Be accurate and detail-oriented.",
};

// ─── Section headers ──────────────────────────────────────────────────────────
// Consistent labels so the model can orient itself within the compiled prompt.

const HEADERS = {
  system:       "## Core Instructions",
  conversation: "## Conversation Style",
  task:         "## Current Task",
  memory:       "## Memory & Context Usage",
  tools:        "## Tool Usage",
  context:      "## Prior Conversation Context",
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Returns true when at least one layered prompt field is set on the agent.
 * Used to decide whether to use the new multi-layer path or the legacy fallback.
 *
 * @param {object} agent  Prisma Agent record
 * @returns {boolean}
 */
function hasLayeredPrompts(agent) {
  return !!(
    agent.systemPrompt       ||
    agent.conversationPrompt ||
    agent.taskPrompt         ||
    agent.memoryInstructions ||
    agent.toolInstructions
  );
}

/**
 * Append a labelled section to the parts array, but only if the content
 * is a non-empty string. Trims whitespace before checking.
 *
 * @param {string[]} parts   Accumulator
 * @param {string}   header  Section header constant
 * @param {string}   content Raw content from DB or runtime
 */
function appendSection(parts, header, content) {
  if (!content || typeof content !== "string") return;
  const trimmed = content.trim();
  if (!trimmed) return;
  parts.push(`${header}\n${trimmed}`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * buildCompiledPrompt(agent, options)
 *
 * Compiles all active prompt layers into a single system prompt string.
 *
 * @param {object} agent               Prisma Agent record (all fields)
 * @param {object} [options]
 * @param {string} [options.context]   Pre-built context string from contextService.
 *                                     Pass "" or omit when no history exists.
 * @param {string} [options.taskOverride]  Runtime task string that replaces
 *                                     agent.taskPrompt for this call only.
 *                                     Used when orchestration sets a per-call goal.
 *
 * @returns {string}  Ready-to-inject system prompt.
 */
function buildCompiledPrompt(agent, options = {}) {
  const { context = "", taskOverride = null } = options;

  // ── Personality prefix ────────────────────────────────────────────────────
  const personalityPrefix = PERSONALITY_PREFIXES[agent.personality] || "";

  // ── Legacy path ───────────────────────────────────────────────────────────
  // If no layered fields are set, behave exactly as the old single-prompt
  // architecture did. This guarantees zero behaviour change for existing agents.
  if (!hasLayeredPrompts(agent)) {
    const base = personalityPrefix
      ? `${personalityPrefix}\n\n${agent.prompt}`
      : agent.prompt;

    if (!context) return base;

    return `${base}\n\n${HEADERS.context}\n${context}`;
  }

  // ── Multi-layer path ──────────────────────────────────────────────────────
  const parts = [];

  // Layer 0 — personality prefix (always first if set)
  if (personalityPrefix) {
    parts.push(personalityPrefix);
  }

  // Layer 1 — system prompt (identity + rules)
  // Falls back to agent.prompt if systemPrompt is not yet populated,
  // so partially-migrated agents still work correctly.
  appendSection(
    parts,
    HEADERS.system,
    agent.systemPrompt || agent.prompt
  );

  // Layer 2 — conversation prompt (tone + behaviour)
  appendSection(parts, HEADERS.conversation, agent.conversationPrompt);

  // Layer 3 — task prompt (current goal)
  // taskOverride takes precedence over the stored field when provided.
  appendSection(
    parts,
    HEADERS.task,
    taskOverride !== null ? taskOverride : agent.taskPrompt
  );

  // Layer 4 — memory instructions (how to use remembered context)
  appendSection(parts, HEADERS.memory, agent.memoryInstructions);

  // Layer 5 — tool instructions (function/tool usage rules)
  appendSection(parts, HEADERS.tools, agent.toolInstructions);

  // Layer 6 — context block (from contextService, injected at call time)
  // This is the only runtime layer — all others come from the DB.
  if (context) {
    parts.push(`${HEADERS.context}\n${context}`);
  }

  return parts.join("\n\n");
}

/**
 * getPersonalityPrefix(personality)
 *
 * Exported so agentService can use the same map when building
 * Vapi assistant payloads (createAgent, buildVapiPayload).
 *
 * @param {string} personality
 * @returns {string}
 */
function getPersonalityPrefix(personality) {
  return PERSONALITY_PREFIXES[personality] || "";
}

module.exports = {
  buildCompiledPrompt,
  getPersonalityPrefix,
  hasLayeredPrompts,      // exported for tests
  PERSONALITY_PREFIXES,  // exported so agentService can remove its duplicate
};