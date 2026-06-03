// services/callStateStore.js
//
// CHANGES:
//   1. Removed implicit turnCount increment from pushTranscript.
//      pushTranscript was incrementing turnCount for every role==='user' push,
//      AND orchestrationService was calling incrementTurnCount() (which didn't exist),
//      causing a TypeError crash on every transcript webhook event.
//   2. Added incrementTurnCount(conversationId) — explicit, exported function.
//      orchestrationService calls this after confirmed final user turns only.
//   3. Added recoverCall(conversationId, snapshot, flowDefinition) — allows
//      callStateStore to be rehydrated from DB if the Node process restarts
//      mid-call (crash recovery, rolling deploys).

"use strict";

const store = new Map();

/**
 * Initialize state for a new call.
 * Called once at call-start by orchestrationService.startOrchestration.
 */
function initCall(conversationId, flowDefinition) {
  const firstStage = flowDefinition.stages[0];
  const state = {
    conversationId,
    flowDefinition,
    currentStageName:  firstStage.name,
    currentStageIndex: 0,
    turnCount:         0,          // turns in current stage (user turns only)
    transcriptBuffer:  [],         // rolling window of last 20 utterances
    collectedData:     {},         // data extracted by stages
    startedAt:         Date.now(),
  };
  store.set(conversationId, state);
  return state;
}

/**
 * Rehydrate call state from a DB snapshot after a crash/restart.
 * Called by orchestrationService.processTranscriptTurn on a cache miss.
 *
 * @param {string} conversationId
 * @param {object} snapshot  Row from orchestrationSnapshot table
 * @param {object} flowDefinition  Agent flowDefinition JSON
 * @returns {object} Rehydrated state
 */
function recoverCall(conversationId, snapshot, flowDefinition) {
  const state = {
    conversationId,
    flowDefinition,
    currentStageName:  snapshot.currentStage,
    currentStageIndex: snapshot.stageIndex,
    turnCount:         0,          // turnCount resets — we lost the in-memory count
    transcriptBuffer:  [],         // transcript buffer also lost — acceptable tradeoff
    collectedData:     snapshot.collectedData || {},
    startedAt:         Date.now(),
    recoveredFromDB:   true,       // flag for debugging
  };
  store.set(conversationId, state);
  console.log(
    "[callStateStore] Recovered call from DB snapshot.",
    "conversationId:", conversationId,
    "stage:", snapshot.currentStage,
  );
  return state;
}

/**
 * Get current state for a call.
 * Returns null if not in store (call not initialized or already ended).
 */
function getCall(conversationId) {
  return store.get(conversationId) || null;
}

/**
 * Merge a patch object into existing call state.
 */
function updateCall(conversationId, patch) {
  const existing = store.get(conversationId);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  store.set(conversationId, updated);
  return updated;
}

/**
 * Append a transcript utterance to the rolling buffer.
 * Does NOT increment turnCount — that is now done explicitly
 * by orchestrationService.incrementTurnCount after confirmed final user turns.
 *
 * @param {string} conversationId
 * @param {string} role  "user" | "assistant"
 * @param {string} text
 */
function pushTranscript(conversationId, role, text) {
  const state = store.get(conversationId);
  if (!state) return;
  state.transcriptBuffer.push({ role, text, ts: Date.now() });
  // Keep a rolling window of last 20 utterances for condition evaluation.
  if (state.transcriptBuffer.length > 20) {
    state.transcriptBuffer.shift();
  }
  // NOTE: turnCount is NOT incremented here.
  // Call incrementTurnCount() explicitly for final user turns.
}

/**
 * Increment turnCount for the current stage.
 * Called by orchestrationService only for confirmed final user utterances.
 *
 * @param {string} conversationId
 */
function incrementTurnCount(conversationId) {
  const state = store.get(conversationId);
  if (!state) return;
  state.turnCount += 1;
}

/**
 * Remove call state when call ends.
 * Called by orchestrationService.endOrchestration.
 */
function endCall(conversationId) {
  store.delete(conversationId);
}

/**
 * Return the number of active calls currently in store.
 * Useful for health-check endpoints and debugging.
 */
function activeCallCount() {
  return store.size;
}

module.exports = {
  initCall,
  recoverCall,
  getCall,
  updateCall,
  pushTranscript,
  incrementTurnCount,   // NEW — was missing, caused TypeError crash
  endCall,
  activeCallCount,
};