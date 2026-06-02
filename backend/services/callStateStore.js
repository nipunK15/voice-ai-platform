// In-memory store for active call orchestration state.
// Keyed by conversationId. Flushed to DB on stage change and call end.

const store = new Map();

function initCall(conversationId, flowDefinition) {
  const firstStage = flowDefinition.stages[0];
  const state = {
    conversationId,
    flowDefinition,
    currentStageName: firstStage.name,
    currentStageIndex: 0,
    turnCount: 0,           // turns in current stage
    transcriptBuffer: [],   // last N utterances
    collectedData: {},      // any data extracted by stages
    startedAt: Date.now(),
  };
  store.set(conversationId, state);
  return state;
}

function getCall(conversationId) {
  return store.get(conversationId) || null;
}

function updateCall(conversationId, patch) {
  const existing = store.get(conversationId);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  store.set(conversationId, updated);
  return updated;
}

function pushTranscript(conversationId, role, text) {
  const state = store.get(conversationId);
  if (!state) return;
  state.transcriptBuffer.push({ role, text, ts: Date.now() });
  // Keep a rolling window of last 20 utterances for condition eval
  if (state.transcriptBuffer.length > 20) {
    state.transcriptBuffer.shift();
  }
  state.turnCount += role === 'user' ? 1 : 0;
}

function endCall(conversationId) {
  store.delete(conversationId);
}

module.exports = { initCall, getCall, updateCall, pushTranscript, endCall };