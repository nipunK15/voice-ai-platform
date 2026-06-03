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
    const Groq = require("groq-sdk");

    const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
    });

    async function evaluateCondition(
    condition,
    transcript
    ){

    const completion =
    await groq.chat.completions.create({

    model:"llama-3.3-70b-versatile",

    messages:[

    {
        role:"system",
        content:
        `You are a condition evaluator.
    Return ONLY true or false.`
    },

    {
        role:"user",
        content:
        `
    Condition:

    ${condition}

    Transcript:

    ${transcript}
    `
    }

    ],

    temperature:0

    });

    const result=
    completion.choices[0]
    .message
    .content
    .trim()
    .toLowerCase();

    return result.includes("true");

    }

    module.exports={
    evaluateCondition
    };

    const recentText = transcriptBuffer
      .slice(-10)
      .map((t) => `${t.role}: ${t.text}`)
      .join('\n');

    try {
      const res = await groq.chat.completions.create({

        model:"llama-3.3-70b-versatile",

        temperature:0,

        max_tokens:60,

        messages:[

        {

        role:"system",

        content:
        `You are a conversation stage evaluator.

        Return ONLY JSON:

        {
        "met": true/false,
        "reason": "short reason"
        }`
        },

        {

        role:"user",

        content:
        `${llmPrompt}

        Recent conversation:

        ${recentText}`

        }

        ]

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