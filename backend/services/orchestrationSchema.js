// CommonJS — orchestration flow definition validator + defaults

const DEFAULT_CONDITION_TYPE = 'keyword'; // 'keyword' | 'llm_eval' | 'always'

/**
 * Validate and normalize a raw flowDefinition JSON before saving.
 * Returns { valid: bool, errors: [], normalized: flowDef }
 */
function validateFlowDefinition(raw) {
  const errors = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['flowDefinition must be an object'], normalized: null };
  }

  if (!Array.isArray(raw.stages) || raw.stages.length === 0) {
    errors.push('flowDefinition.stages must be a non-empty array');
  }

  const stageNames = new Set();

  (raw.stages || []).forEach((stage, i) => {
    if (!stage.name) errors.push(`Stage[${i}] missing name`);
    if (!stage.prompt) errors.push(`Stage[${i}] missing prompt`);
    if (stage.name) stageNames.add(stage.name);

    (stage.transitions || []).forEach((t, j) => {
      if (!t.toStage && !t.handoffAssistantId) {
        errors.push(`Stage[${i}] transition[${j}] must have toStage or handoffAssistantId`);
      }
      if (!t.condition) {
        errors.push(`Stage[${i}] transition[${j}] missing condition`);
      }
    });
  });

  // Validate transition targets exist
  (raw.stages || []).forEach((stage) => {
    (stage.transitions || []).forEach((t) => {
      if (t.toStage && !stageNames.has(t.toStage)) {
        errors.push(`Stage "${stage.name}" transition targets unknown stage "${t.toStage}"`);
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    normalized: errors.length === 0 ? normalizeFlow(raw) : null,
  };
}

function normalizeFlow(raw) {
  return {
    ...raw,
    stages: raw.stages.map((stage, i) => ({
      name: stage.name,
      index: i,
      prompt: stage.prompt,
      goal: stage.goal || null,
      maxTurns: stage.maxTurns || null, // auto-advance after N turns
      transitions: (stage.transitions || []).map((t) => ({
        toStage: t.toStage || null,
        handoffAssistantId: t.handoffAssistantId || null,
        condition: {
          type: t.condition.type || DEFAULT_CONDITION_TYPE,
          keywords: t.condition.keywords || [],
          llmPrompt: t.condition.llmPrompt || null,
        },
        priority: t.priority || 0,
      })),
    })),
  };
}

module.exports = { validateFlowDefinition, normalizeFlow };