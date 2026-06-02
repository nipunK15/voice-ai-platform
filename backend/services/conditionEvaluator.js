// CommonJS — lazy-initialize OpenAI client so missing env doesn't crash on require

async function evaluateCondition(condition, transcriptBuffer) {
  const { type, keywords, llmPrompt } = condition;

  if (type === 'always') {
    return { met: true, reason: 'always transition' };
  }

  if (type === 'keyword') {
    const recentText = transcriptBuffer
      .slice(-6)
      .map((t) => t.text.toLowerCase())
      .join(' ');

    const matched = (keywords || []).find((kw) =>
      recentText.includes(kw.toLowerCase())
    );

    return {
      met: !!matched,
      reason: matched ? `keyword_match: "${matched}"` : 'no keyword match',
    };
  }

  if (type === 'llm_eval') {
    if (!llmPrompt) return { met: false, reason: 'llm_eval missing llmPrompt' };

    // Lazy-load so missing API key doesn't crash the whole server on startup
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const recentText = transcriptBuffer
      .slice(-10)
      .map((t) => `${t.role}: ${t.text}`)
      .join('\n');

    try {
      const res = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 60,
        messages: [
          {
            role: 'system',
            content:
              'You are a conversation stage evaluator. Answer ONLY with JSON: {"met": true|false, "reason": "..."} — no other text.',
          },
          {
            role: 'user',
            content: `${llmPrompt}\n\nRecent conversation:\n${recentText}`,
          },
        ],
      });

      const raw = res.choices[0].message.content.trim();
      const parsed = JSON.parse(raw);
      return { met: !!parsed.met, reason: parsed.reason || 'llm_eval' };
    } catch (err) {
      console.error('[conditionEvaluator] LLM eval failed:', err.message);
      return { met: false, reason: 'llm_eval_error' };
    }
  }

  return { met: false, reason: `unknown condition type: ${type}` };
}

module.exports = { evaluateCondition };