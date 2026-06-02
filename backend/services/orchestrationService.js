const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const callStateStore = require('./callStateStore');
const { evaluateCondition } = require('./conditionEvaluator');
const promptService = require('./promptService');

/**
 * Called at the start of each call.
 * Initializes in-memory state and creates DB snapshot.
 */
async function startOrchestration(conversationId, agent) {
  const flow = agent.flowDefinition;

  // No flow definition → no orchestration, use single-stage legacy mode
  if (!flow || !flow.stages || flow.stages.length === 0) {
    return { orchestrated: false };
  }

  const state = callStateStore.initCall(conversationId, flow);

  await _flushSnapshot(conversationId, state);
  await _logStageEntry(conversationId, state.currentStageName, 0, null, null, _getStagePrompt(flow, 0));

  return {
    orchestrated: true,
    currentStage: state.currentStageName,
    stagePrompt: _getStagePrompt(flow, 0),
  };
}

/**
 * Called on every incoming transcript event from the Vapi webhook.
 * Pushes to buffer, checks for transitions, returns new stage info if advanced.
 */
async function processTranscriptTurn(conversationId, role, text) {
  const state = callStateStore.getCall(conversationId);
  if (!state) return { advanced: false };

  callStateStore.pushTranscript(conversationId, role, text);

  const refreshed = callStateStore.getCall(conversationId);
  return await _evaluateTransitions(conversationId, refreshed);
}

/**
 * Called when the call ends. Flushes final state to DB.
 */
async function endOrchestration(conversationId) {
  const state = callStateStore.getCall(conversationId);
  if (!state) return;

  await _flushSnapshot(conversationId, state);
  callStateStore.endCall(conversationId);
}

// ─── Internal ──────────────────────────────────────────────

async function _evaluateTransitions(conversationId, state) {
  const { flowDefinition, currentStageIndex, transcriptBuffer, turnCount } = state;
  const currentStage = flowDefinition.stages[currentStageIndex];

  if (!currentStage) return { advanced: false };

  // Check maxTurns auto-advance first
  if (currentStage.maxTurns && turnCount >= currentStage.maxTurns) {
    const nextIndex = currentStageIndex + 1;
    if (nextIndex < flowDefinition.stages.length) {
      return await _advanceStage(conversationId, state, nextIndex, 'max_turns', `Reached maxTurns: ${currentStage.maxTurns}`);
    }
  }

  // Evaluate transitions in priority order
  const sorted = [...(currentStage.transitions || [])].sort((a, b) => b.priority - a.priority);

  for (const transition of sorted) {
    const { met, reason } = await evaluateCondition(transition.condition, transcriptBuffer);

    if (met) {
      // Handoff to a different Vapi assistant
      if (transition.handoffAssistantId) {
        return await _triggerHandoff(conversationId, state, transition, reason);
      }

      // Advance to next named stage
      const nextIndex = flowDefinition.stages.findIndex((s) => s.name === transition.toStage);
      if (nextIndex !== -1) {
        return await _advanceStage(conversationId, state, nextIndex, 'condition_met', reason);
      }
    }
  }

  return { advanced: false };
}

async function _advanceStage(conversationId, state, nextIndex, triggerReason, triggerDetail) {
  const { flowDefinition, currentStageName, currentStageIndex } = state;
  const nextStage = flowDefinition.stages[nextIndex];

  // Mark current stage exit in DB
  await prisma.conversationStage.updateMany({
    where: { conversationId, stageName: currentStageName, exitedAt: null },
    data: { exitedAt: new Date(), triggerReason, triggerDetail },
  });

  // Update in-memory state
  callStateStore.updateCall(conversationId, {
    currentStageName: nextStage.name,
    currentStageIndex: nextIndex,
    turnCount: 0,
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
    advanced: true,
    newStage: nextStage.name,
    stagePrompt: nextStage.prompt,
    handoff: false,
  };
}

async function _triggerHandoff(conversationId, state, transition, reason) {
  const { currentStageName } = state;

  await prisma.conversationStage.updateMany({
    where: { conversationId, stageName: currentStageName, exitedAt: null },
    data: {
      exitedAt: new Date(),
      triggerReason: 'handoff',
      triggerDetail: `Handing off to assistant: ${transition.handoffAssistantId}. Reason: ${reason}`,
    },
  });

  const refreshed = callStateStore.getCall(conversationId);
  await _flushSnapshot(conversationId, refreshed);

  return {
    advanced: true,
    handoff: true,
    handoffAssistantId: transition.handoffAssistantId,
    reason,
  };
}

async function _logStageEntry(conversationId, stageName, stageIndex, triggerReason, triggerDetail, promptSnapshot) {
  await prisma.conversationStage.create({
    data: {
      conversationId,
      stageName,
      stageIndex,
      triggerReason: triggerReason || 'initial',
      triggerDetail: triggerDetail || null,
      promptSnapshot: promptSnapshot || null,
    },
  });
}

async function _flushSnapshot(conversationId, state) {
  await prisma.orchestrationSnapshot.upsert({
    where: { conversationId },
    create: {
      conversationId,
      currentStage: state.currentStageName,
      stageIndex: state.currentStageIndex,
      collectedData: state.collectedData,
    },
    update: {
      currentStage: state.currentStageName,
      stageIndex: state.currentStageIndex,
      collectedData: state.collectedData,
    },
  });
}

function _getStagePrompt(flow, index) {
  return flow.stages[index]?.prompt || '';
}

module.exports = {
  startOrchestration,
  processTranscriptTurn,
  endOrchestration,
};