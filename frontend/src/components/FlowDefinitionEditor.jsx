import { useState } from 'react';

const EMPTY_STAGE = () => ({
  name: '',
  prompt: '',
  goal: '',
  maxTurns: '',
  transitions: [],
});

const EMPTY_TRANSITION = () => ({
  toStage: '',
  handoffAssistantId: '',
  condition: { type: 'keyword', keywords: '', llmPrompt: '' },
  priority: 0,
});

export default function FlowDefinitionEditor({ value, onChange }) {
  const flow = value || { stages: [] };
  const stages = flow.stages || [];

  const setStages = (newStages) => onChange({ ...flow, stages: newStages });

  const addStage = () => setStages([...stages, EMPTY_STAGE()]);

  const updateStage = (i, patch) => {
    const next = [...stages];
    next[i] = { ...next[i], ...patch };
    setStages(next);
  };

  const removeStage = (i) => setStages(stages.filter((_, idx) => idx !== i));

  const addTransition = (si) => {
    const next = [...stages];
    next[si].transitions = [...(next[si].transitions || []), EMPTY_TRANSITION()];
    setStages(next);
  };

  const updateTransition = (si, ti, patch) => {
    const next = [...stages];
    const transitions = [...next[si].transitions];
    transitions[ti] = { ...transitions[ti], ...patch };
    next[si] = { ...next[si], transitions };
    setStages(next);
  };

  const removeTransition = (si, ti) => {
    const next = [...stages];
    next[si].transitions = next[si].transitions.filter((_, idx) => idx !== ti);
    setStages(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {stages.map((stage, si) => (
        <div key={si} style={{
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 16,
          background: 'var(--surface)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <strong>Stage {si + 1}</strong>
            <button onClick={() => removeStage(si)} style={{ color: 'var(--danger)' }}>Remove</button>
          </div>

          <label>Name</label>
          <input value={stage.name} onChange={e => updateStage(si, { name: e.target.value })}
            placeholder="e.g. greeting" style={{ width: '100%', marginBottom: 8 }} />

          <label>Stage prompt</label>
          <textarea value={stage.prompt} onChange={e => updateStage(si, { prompt: e.target.value })}
            rows={4} placeholder="What should the agent say/do in this stage?"
            style={{ width: '100%', marginBottom: 8 }} />

          <label>Goal (optional description)</label>
          <input value={stage.goal} onChange={e => updateStage(si, { goal: e.target.value })}
            placeholder="e.g. Qualify the lead" style={{ width: '100%', marginBottom: 8 }} />

          <label>Auto-advance after N user turns (optional)</label>
          <input type="number" value={stage.maxTurns}
            onChange={e => updateStage(si, { maxTurns: e.target.value })}
            style={{ width: 80, marginBottom: 12 }} />

          <div style={{ marginTop: 8 }}>
            <strong style={{ fontSize: 13 }}>Transitions</strong>
            {(stage.transitions || []).map((t, ti) => (
              <div key={ti} style={{
                marginTop: 8, padding: 12,
                background: 'var(--surface-alt)',
                borderRadius: 6,
              }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12 }}>Go to stage</label>
                    <input value={t.toStage}
                      onChange={e => updateTransition(si, ti, { toStage: e.target.value })}
                      placeholder="stage name" style={{ width: '100%' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12 }}>Or handoff assistant ID</label>
                    <input value={t.handoffAssistantId}
                      onChange={e => updateTransition(si, ti, { handoffAssistantId: e.target.value })}
                      placeholder="Vapi assistant ID" style={{ width: '100%' }} />
                  </div>
                </div>

                <label style={{ fontSize: 12 }}>Condition type</label>
                <select value={t.condition.type}
                  onChange={e => updateTransition(si, ti, {
                    condition: { ...t.condition, type: e.target.value }
                  })}
                  style={{ marginBottom: 6 }}>
                  <option value="keyword">Keyword match</option>
                  <option value="llm_eval">LLM evaluation</option>
                  <option value="always">Always (immediate)</option>
                </select>

                {t.condition.type === 'keyword' && (
                  <>
                    <label style={{ fontSize: 12 }}>Keywords (comma separated)</label>
                    <input value={t.condition.keywords}
                      onChange={e => updateTransition(si, ti, {
                        condition: { ...t.condition, keywords: e.target.value }
                      })}
                      placeholder="yes, confirm, ready" style={{ width: '100%' }} />
                  </>
                )}

                {t.condition.type === 'llm_eval' && (
                  <>
                    <label style={{ fontSize: 12 }}>Evaluation prompt</label>
                    <textarea
                      value={t.condition.llmPrompt}
                      onChange={e => updateTransition(si, ti, {
                        condition: { ...t.condition, llmPrompt: e.target.value }
                      })}
                      rows={3}
                      placeholder="Has the user confirmed their name and email address?"
                      style={{ width: '100%' }} />
                  </>
                )}

                <button onClick={() => removeTransition(si, ti)}
                  style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                  Remove transition
                </button>
              </div>
            ))}
            <button onClick={() => addTransition(si)}
              style={{ marginTop: 8, fontSize: 12 }}>
              + Add transition
            </button>
          </div>
        </div>
      ))}

      <button onClick={addStage}>+ Add stage</button>
    </div>
  );
}