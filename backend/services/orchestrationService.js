// services/orchestrationService.js
//
// CHANGES FROM PREVIOUS VERSION:
//   1. processTranscriptTurn: on cache miss (state === null), attempt DB recovery
//      via callStateStore.recoverCall before giving up. Previously returned
//      { advanced: false } silently, breaking all orchestration after a server restart.
//   2. callStateStore.incrementTurnCount is now called correctly (it exists).
//      pushTranscript no longer has its own internal increment — these are in sync.
//   3. No other logic changed. Stage transitions, maxTurns, handoffs — all identical.

"use strict";

const prisma               = require("../config/database");
const callStateStore       = require("./callStateStore");
const { evaluateCondition } = require("./conditionEvaluator");

/**
 * Called at the start of each call.
 * Initializes in-memory state and creates DB snapshot.
 */
async function startOrchestration(conversationId, agent) {
  const flow = agent.flowDefinition;

  if (!flow || !flow.stages || flow.stages.length === 0) {
    return { orchestrated: false };
  }

  const state = callStateStore.initCall(conversationId, flow);

  await _flushSnapshot(conversationId, state);
  await _logStageEntry(
    conversationId,
    state.currentStageName,
    0,
    null,
    null,
    _getStagePrompt(flow, 0)
  );

  return {
    orchestrated:  true,
    currentStage:  state.currentStageName,
    stagePrompt:   _getStagePrompt(flow, 0),
  };
}

/**
 * Called on every FINAL incoming transcript event from the Vapi webhook.
 * Partials are filtered upstream in webhooks.js — only final turns reach here.
 *
 * On cache miss (server restarted mid-call), attempts recovery from DB snapshot.
 *
 * @param {string} conversationId
 * @param {string} role   "user" | "assistant"
 * @param {string} text   Utterance text
 * @returns {object} { advanced, newStage, stagePrompt, handoff, handoffAssistantId }
 */
async function processTranscriptTurn(conversationId, role, text) {
  let state = callStateStore.getCall(conversationId);

  // ── Cache miss recovery ───────────────────────────────────────────────────
  // If state is null, the server may have restarted mid-call.
  // Attempt to rehydrate from the DB snapshot + agent flowDefinition.
  if (!state) {
    state = await _attemptRecovery(conversationId);
    if (!state) {
      console.warn(
        "[orchestration] processTranscriptTurn: no state for conversationId",
        conversationId,
        "— skipping turn.",
      );
      return { advanced: false };
    }
  }

  callStateStore.pushTranscript(conversationId, role, text);
  if(
    role==="user"
    ){

    const lower=
    text.toLowerCase();

    const state=
    callStateStore.getCall(
    conversationId
    );

    if(
    !state.collectedData
    ){

    state.collectedData={};

    }

    // name

    const nameMatch=
    text.match(
    /my name is\s+([a-zA-Z ]+)/i
    );

    if(
    nameMatch
    ){

    state.collectedData.name=
    nameMatch[1].trim();

    }

    // company

    const companyMatch=
    text.match(
    /(company is|work at)\s+([a-zA-Z0-9 ]+)/i
    );

    if(
    companyMatch
    ){

    state.collectedData.company=
    companyMatch[2].trim();

    }

    // email

    const normalized=
    text
    .toLowerCase()
    .replace(/\s+at\s+/g,"@")
    .replace(/\s+dot\s+/g,".");

    const emailMatch=
    normalized.match(
    /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/
    );

    if(
    emailMatch
    ){

    state.collectedData.email=
    emailMatch[1];

    }

    if(
    emailMatch
    ){

    state.collectedData.email=
    emailMatch[1];

    }

}

  // Only count final user utterances toward maxTurns.
  if (role === "user") {
    callStateStore.incrementTurnCount(conversationId);
  }

  const refreshed = callStateStore.getCall(conversationId);
  return await _evaluateTransitions(conversationId, refreshed);
}

/**
 * Called when the call ends. Flushes final state to DB and clears memory.
 */
async function endOrchestration(conversationId) {
  const state = callStateStore.getCall(conversationId);
  if (!state) return;

  await _flushSnapshot(conversationId, state);
  callStateStore.endCall(conversationId);
}

// ─── Internal ─────────────────────────────────────────────────────────────────

/**
 * Attempt to recover call state from DB snapshot on a cache miss.
 * Returns the recovered state object, or null if recovery is not possible.
 *
 * Recovery is possible when:
 *   - An orchestrationSnapshot row exists for this conversationId
 *   - The conversation's agent has a flowDefinition
 *
 * @param {string} conversationId
 * @returns {object|null}
 */
async function _attemptRecovery(conversationId) {
  try {
    const snapshot = await prisma.orchestrationSnapshot.findUnique({
      where: { conversationId },
    });
    if (!snapshot) return null;

    const conversation = await prisma.conversation.findUnique({
      where:   { id: conversationId },
      include: { agent: true },
    });

    const flow = conversation?.agent?.flowDefinition;
    if (!flow?.stages?.length) return null;

    return callStateStore.recoverCall(conversationId, snapshot, flow);
  } catch (err) {
    console.error("[orchestration] Recovery attempt failed:", err.message);
    return null;
  }
}

async function _evaluateTransitions(conversationId, state) {
  const { flowDefinition, currentStageIndex, transcriptBuffer, turnCount } = state;
  const currentStage = flowDefinition.stages[currentStageIndex];

  if (!currentStage) return { advanced: false };

  // maxTurns auto-advance
  if (currentStage.maxTurns && turnCount >= currentStage.maxTurns) {
    const nextIndex = currentStageIndex + 1;
    if (nextIndex < flowDefinition.stages.length) {
      return await _advanceStage(
        conversationId,
        state,
        nextIndex,
        "max_turns",
        `Reached maxTurns: ${currentStage.maxTurns}`
      );
    }
  }

  // Evaluate transitions in priority order
  const sorted = [...(currentStage.transitions || [])].sort(
    (a, b) => (b.priority || 0) - (a.priority || 0)
  );

  for (const transition of sorted) {
    const { met, reason } = await evaluateCondition(
      transition.condition,
      transcriptBuffer
    );

    if (met) {
      if (transition.handoffAssistantId) {
        return await _triggerHandoff(conversationId, state, transition, reason);
      }

      const nextIndex = flowDefinition.stages.findIndex(
        (s) => s.name === transition.toStage
      );
      if (nextIndex !== -1) {
        return await _advanceStage(
          conversationId,
          state,
          nextIndex,
          "condition_met",
          reason
        );
      }
    }
  }

  return { advanced: false };
}

async function _advanceStage(conversationId, state, nextIndex, triggerReason, triggerDetail) {
  const { flowDefinition, currentStageName } = state;
  const nextStage = flowDefinition.stages[nextIndex];

  await prisma.conversationStage.updateMany({
    where: { conversationId, stageName: currentStageName, exitedAt: null },
    data:  { exitedAt: new Date(), triggerReason, triggerDetail },
  });

  callStateStore.updateCall(conversationId, {
    currentStageName:  nextStage.name,
    currentStageIndex: nextIndex,
    turnCount:         0,
  });

  const refreshed = callStateStore.getCall(conversationId);
  await _flushSnapshot(conversationId, refreshed);
  await _logStageEntry(
    conversationId,
    nextStage.name,
    nextIndex,
    triggerReason,
    triggerDetail,
    nextStage.prompt
  );

  return {
    advanced:    true,
    newStage:    nextStage.name,
    stagePrompt: nextStage.prompt || "",
    handoff:     false,
  };
}

async function _triggerHandoff(conversationId, state, transition, reason) {
  const { currentStageName } = state;

  await prisma.conversationStage.updateMany({
    where: { conversationId, stageName: currentStageName, exitedAt: null },
    data: {
      exitedAt:      new Date(),
      triggerReason: "handoff",
      triggerDetail: `Handing off to assistant: ${transition.handoffAssistantId}. Reason: ${reason}`,
    },
  });

  const refreshed = callStateStore.getCall(conversationId);
  await _flushSnapshot(conversationId, refreshed);

  return {
    advanced:           true,
    handoff:            true,
    handoffAssistantId: transition.handoffAssistantId,
    reason,
  };
}

async function _logStageEntry(
  conversationId,
  stageName,
  stageIndex,
  triggerReason,
  triggerDetail,
  promptSnapshot
) {
  await prisma.conversationStage.create({
    data: {
      conversationId,
      stageName,
      stageIndex,
      triggerReason:  triggerReason  || "initial",
      triggerDetail:  triggerDetail  || null,
      promptSnapshot: promptSnapshot || null,
    },
  });
}

async function _flushSnapshot(conversationId, state) {
  await prisma.orchestrationSnapshot.upsert({
    where:  { conversationId },
    create: {
      conversationId,
      currentStage:  state.currentStageName,
      stageIndex:    state.currentStageIndex,
      collectedData: state.collectedData,
    },
    update: {
      currentStage:  state.currentStageName,
      stageIndex:    state.currentStageIndex,
      collectedData: state.collectedData,
    },
  });
}

function _getStagePrompt(flow, index) {
  return flow.stages[index]?.prompt || "";
}

module.exports = {
  startOrchestration,
  processTranscriptTurn,
  endOrchestration,
};