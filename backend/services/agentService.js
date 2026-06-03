// backend/services/agentService.js
//
// CHANGES FROM ORIGINAL:
//   1. MODEL_CONFIG imported from vapiService — single source of truth for provider/model
//   2. startCall: compiled prompt is ALWAYS built with all layers (personality + memory
//      + context). When orchestrated, the stage prompt is injected as taskOverride
//      into buildCompiledPrompt rather than replacing the whole compiled prompt.
//      Previously: effectivePrompt = rawStagePrompt (all context lost for orchestrated calls)
//      Now:        effectivePrompt = buildCompiledPrompt(agent, { context, taskOverride: stagePrompt })
//   3. assistantOverrides.model uses vapiService.buildModelOverride — correct Vapi shape,
//      correct provider. Previously hardcoded "openai" in two places here.
//   4. PERSONALITY_PREFIXES removed from this file — was a duplicate of promptService.js.
//      getPersonalityPrefix from promptService is used instead.

const { getRecentContext }                    = require("./contextService");
const { buildCompiledPrompt, getPersonalityPrefix } = require("./promptService");
const vapiService                             = require("./vapiService");
const axios                                   = require("axios");
const prisma                                  = require("../config/database");
const orchestrationService                    = require("./orchestrationService");

// ── Lazy Vapi client ──────────────────────────────────────────────────────────
let _vapiClient = null;

function getVapiClient() {
  if (!process.env.VAPI_API_KEY) {
    const err = new Error(
      "VAPI_API_KEY is not set. Add it to backend/.env and restart the server."
    );
    err.statusCode = 500;
    throw err;
  }
  if (!_vapiClient) {
    _vapiClient = axios.create({
      baseURL: "https://api.vapi.ai",
      headers: {
        Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    _vapiClient.interceptors.request.use((config) => {
      console.log(`[Vapi] → ${config.method.toUpperCase()} ${config.baseURL}${config.url}`);
      return config;
    });
    _vapiClient.interceptors.response.use(
      (res) => {
        console.log(`[Vapi] ← ${res.status} ${res.config.url}`);
        return res;
      },
      (err) => {
        console.error(
          `[Vapi] ← ERROR ${err.response?.status} ${err.config?.url}:`,
          err.response?.data || err.message
        );
        return Promise.reject(err);
      }
    );
  }
  return _vapiClient;
}

// ── Build Vapi payload (for agent create / update in Vapi dashboard) ──────────
// FIX: uses vapiService.buildModelOverride so provider is consistent
function buildVapiPayload(data) {
  const prefix       = getPersonalityPrefix(data.personality);
  const systemPrompt = prefix ? `${prefix}\n\n${data.prompt}` : data.prompt;

  const { provider, model } = vapiService.getModelConfig();

  const elevenMap = {
    rachel: "21m00Tcm4TlvDq8ikWAM",
    adam:   "pNInz6obpgDQGcFmaJgB",
    bella:  "EXAVITQu4vr4xnSDxMaL",
  };

  return {
    name:         data.name,
    firstMessage: `Hi, I'm ${data.name}. How can I help you today?`,
    model: {
      provider,
      model,
      temperature: parseFloat(data.temperature),
      messages: [{ role: "system", content: systemPrompt }],
    },
    voice: {
      provider: data.voiceProvider,
      voiceId:
        data.voiceProvider === "11labs"
          ? (elevenMap[data.voiceId?.toLowerCase()] || data.voiceId)
          : data.voiceId,
    },
    transcriber: {
      provider: "deepgram",
      model:    "nova-2",
      language: "en",
    },
    endCallFunctionEnabled: true,
  };
}

// ── createAgent ───────────────────────────────────────────────────────────────
async function createAgent(data) {
  const vapi = getVapiClient();

  let vapiAssistant;
  try {
    const payload  = buildVapiPayload(data);
    console.log("[createAgent] Creating Vapi assistant:", payload.name);
    const response = await vapi.post("/assistant", payload);
    vapiAssistant  = response.data;
    console.log("[createAgent] Vapi assistant created. ID:", vapiAssistant.id);
  } catch (vapiErr) {
    const status = vapiErr.response?.status;
    const detail = vapiErr.response?.data?.message || vapiErr.message;
    const err    = new Error(`Vapi assistant creation failed (${status}): ${detail}`);
    err.statusCode = 502;
    throw err;
  }

  const vapiAgentId = vapiAssistant.id;

  try {
    const agent = await prisma.agent.create({
      data: {
        name:          data.name,
        prompt:        data.prompt,
        personality:   data.personality,
        temperature:   parseFloat(data.temperature),
        voiceProvider: data.voiceProvider,
        voiceId:       data.voiceId,
        vapiAgentId,
        ...(data.flowDefinition ? { flowDefinition: data.flowDefinition } : {}),
        user: {
          connectOrCreate: {
            where:  { email: "demo@voiceplatform.dev" },
            create: { email: "demo@voiceplatform.dev", name: "Demo Developer" },
          },
        },
      },
    });
    console.log("[createAgent] Agent saved. ID:", agent.id, "vapiAgentId:", agent.vapiAgentId);
    return agent;
  } catch (dbErr) {
    console.error("[createAgent] DB write failed. Cleaning up Vapi assistant", vapiAgentId);
    try {
      await vapi.delete(`/assistant/${vapiAgentId}`);
    } catch (cleanupErr) {
      console.error("[createAgent] ORPHANED VAPI ASSISTANT:", vapiAgentId, cleanupErr.message);
    }
    throw dbErr;
  }
}

// ── getAgents ─────────────────────────────────────────────────────────────────
async function getAgents() {
  return prisma.agent.findMany({ orderBy: { createdAt: "desc" } });
}

// ── getAgentById ──────────────────────────────────────────────────────────────
async function getAgentById(id) {
  return prisma.agent.findUnique({ where: { id } });
}

// ── updateAgent ───────────────────────────────────────────────────────────────
async function updateAgent(id, data) {
  const updateData = {};
  if (data.name            !== undefined) updateData.name            = data.name;
  if (data.prompt          !== undefined) updateData.prompt          = data.prompt;
  if (data.personality     !== undefined) updateData.personality     = data.personality;
  if (data.voiceProvider   !== undefined) updateData.voiceProvider   = data.voiceProvider;
  if (data.voiceId         !== undefined) updateData.voiceId         = data.voiceId;
  if (data.temperature     !== undefined) updateData.temperature     = parseFloat(data.temperature);
  if (data.flowDefinition  !== undefined) updateData.flowDefinition  = data.flowDefinition;
  // Layered prompt fields
  if (data.systemPrompt      !== undefined) updateData.systemPrompt      = data.systemPrompt;
  if (data.conversationPrompt!== undefined) updateData.conversationPrompt= data.conversationPrompt;
  if (data.taskPrompt        !== undefined) updateData.taskPrompt        = data.taskPrompt;
  if (data.memoryInstructions!== undefined) updateData.memoryInstructions= data.memoryInstructions;
  if (data.toolInstructions  !== undefined) updateData.toolInstructions  = data.toolInstructions;

  return prisma.agent.update({ where: { id }, data: updateData });
}

// ── deleteAgent ───────────────────────────────────────────────────────────────
async function deleteAgent(id) {
  const agent = await prisma.agent.findUnique({ where: { id } });

  if (!agent) {
    const err  = new Error("Agent not found");
    err.code   = "P2025";
    throw err;
  }

  if (agent.vapiAgentId && process.env.VAPI_API_KEY) {
    try {
      const vapi = getVapiClient();
      await vapi.delete(`/assistant/${agent.vapiAgentId}`);
      console.log("[deleteAgent] Vapi assistant deleted:", agent.vapiAgentId);
    } catch (vapiErr) {
      console.warn("[deleteAgent] Could not delete Vapi assistant:", vapiErr.message);
    }
  }

  return prisma.agent.delete({ where: { id } });
}

// ── getVapiConfig ─────────────────────────────────────────────────────────────
async function getVapiConfig(id) {
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent) {
    const err      = new Error("Agent not found");
    err.statusCode = 404;
    throw err;
  }

  const prefix       = getPersonalityPrefix(agent.personality);
  const systemPrompt = prefix ? `${prefix}\n\n${agent.prompt}` : agent.prompt;
  const { provider, model } = vapiService.getModelConfig();

  if (agent.vapiAgentId) {
    return {
      assistantId:        agent.vapiAgentId,
      assistantOverrides: { metadata: { platformAgentId: agent.id } },
    };
  }

  return {
    assistant: {
      name:         agent.name,
      firstMessage: `Hi, I'm ${agent.name}. How can I help you today?`,
      model: {
        provider,
        model,
        temperature: agent.temperature,
        messages:    [{ role: "system", content: systemPrompt }],
      },
      voice:       { provider: agent.voiceProvider, voiceId: agent.voiceId },
      transcriber: { provider: "deepgram", model: "nova-2", language: "en" },
      endCallFunctionEnabled: true,
    },
    assistantOverrides: { metadata: { platformAgentId: agent.id } },
  };
}

// ── startCall ─────────────────────────────────────────────────────────────────
// FIX: Stage prompt is now injected as taskOverride into buildCompiledPrompt.
// Previously: effectivePrompt = rawStagePrompt (no personality, no memory, no context)
// Now:        effectivePrompt = buildCompiledPrompt(agent, { context, taskOverride: stagePrompt })
// This means orchestrated calls get full personality + memory + stage goal in one prompt.
async function startCall(agentId) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) {
    const err      = new Error("Agent not found");
    err.statusCode = 404;
    throw err;
  }

  if (!agent.vapiAgentId) {
    const err      = new Error("This agent has no Vapi assistant ID. Delete it and create a new one.");
    err.statusCode = 400;
    throw err;
  }

  // Verify Vapi assistant still exists
  try {
    const vapi = getVapiClient();
    await vapi.get(`/assistant/${agent.vapiAgentId}`);
    console.log("[startCall] Vapi assistant verified:", agent.vapiAgentId);
  } catch (vapiErr) {
    const status = vapiErr.response?.status;
    if (status === 404) {
      await prisma.agent.update({ where: { id: agentId }, data: { vapiAgentId: null } });
      const err      = new Error("Vapi assistant no longer exists. Delete this agent and create a new one.");
      err.statusCode = 404;
      throw err;
    }
    const err      = new Error(`Could not verify Vapi assistant: ${vapiErr.message}`);
    err.statusCode = 502;
    throw err;
  }
  const user= await prisma.user.upsert({
    where:  { email: "demo@voiceplatform.dev" },
    update: {},
    create: { email: "demo@voiceplatform.dev", name: "Demo Developer" },
  });

  // Retrieve memory context (never throws — returns "" on failure)
  const recentContext = await getRecentContext(agent.id, user.id);
  console.log("[startCall] Context chars:", recentContext.length);

   

  const conversation = await prisma.conversation.create({
    data: { agentId: agent.id, userId: user.id, status: "active" },
  });
  console.log("[startCall] Conversation created:", conversation.id);

  // Start orchestration (returns stagePrompt for stage 0, or orchestrated:false)
  const orchResult = await orchestrationService.startOrchestration(conversation.id, agent);

  // ── Compile the final prompt ───────────────────────────────────────────────
  // FIX: When orchestrated, use stagePrompt as taskOverride so all other layers
  // (personality, system, conversation, memory, context) are still included.
  // This was the core bug: orchestrated calls got only the raw stage string.
  const compiledPrompt = buildCompiledPrompt(agent, {
    context:      recentContext,
    taskOverride: orchResult.orchestrated ? orchResult.stagePrompt : null,
  });

  console.log(
    "[startCall] Prompt compiled.",
    "Orchestrated:", orchResult.orchestrated,
    "Stage:", orchResult.currentStage || "none",
    "TotalLength:", compiledPrompt.length
  );

  // ── Build assistantOverrides ───────────────────────────────────────────────
  // FIX: uses vapiService.buildModelOverride — correct Vapi shape, correct provider
  const assistantOverrides = {
    metadata: {
      platformAgentId:        agent.id,
      platformConversationId: conversation.id,
      conversationId:         conversation.id,
    },
    model: vapiService.buildModelOverride(compiledPrompt, agent.temperature),
  };

  return {
    assistantId:    agent.vapiAgentId,
    conversationId: conversation.id,
    assistantOverrides,
  };
}

module.exports = {
  createAgent,
  getAgents,
  getAgentById,
  updateAgent,
  deleteAgent,
  getVapiConfig,
  startCall,
};