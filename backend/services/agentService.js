// backend/services/agentService.js
//
// FIXES IN THIS VERSION:
//
// FIX 1 — vapiClient was built at module-load time using process.env.VAPI_API_KEY.
//   Node evaluates this before dotenv runs in server.js, so the Authorization
//   header was permanently set to "Bearer undefined".
//   Solution: getVapiClient() builds the client lazily on first use,
//   by which time dotenv has already populated process.env.
//
// FIX 2 — Added startCall() which creates a Vapi web call token via the
//   REST API. The frontend uses this token with vapi.start(), which is the
//   correct v2 flow for authenticated calls.
//
// All existing functions (createAgent, getAgents, etc.) are preserved exactly.
const { getRecentContext } = require("./contextService");
const { buildCompiledPrompt } = require("./promptService");


const axios = require("axios");
const prisma = require("../config/database");
const orchestrationService = require('./orchestrationService');

// ── Lazy Vapi client factory ──────────────────────────────────────────────────
// DO NOT build axios.create() at the top level of this file.
// This module is required before dotenv.config() runs in some load orders,
// which means process.env.VAPI_API_KEY would be undefined at construction time
// and the Authorization header would be set to "Bearer undefined" forever.
//
// Instead, call getVapiClient() inside each function that needs it.
// The first call after server startup will always have the env var populated.
let _vapiClient = null;

function getVapiClient() {
  if (!process.env.VAPI_API_KEY) {
    const err = new Error(
      "VAPI_API_KEY is not set. Add it to backend/.env and restart the server."
    );
    err.statusCode = 500;
    throw err;
  }
  // Build once and cache — the API key doesn't change at runtime
  if (!_vapiClient) {
    _vapiClient = axios.create({
      baseURL: "https://api.vapi.ai",
      headers: {
        Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    // Log Vapi request/response for debugging — remove in production
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

// ── Personality → system prompt prefix ───────────────────────────────────────
const PERSONALITY_PREFIXES = {
  professional: "You are a professional and formal AI voice assistant. Speak clearly and concisely.",
  friendly:     "You are a warm, friendly AI voice assistant. Be conversational and approachable.",
  casual:       "You are a casual, laid-back AI voice assistant. Use relaxed language.",
  formal:       "You are a highly formal AI voice assistant. Use precise, structured language.",
  empathetic:   "You are an empathetic AI voice assistant. Show genuine care and understanding.",
  technical:    "You are a technical AI voice assistant. Be accurate and detail-oriented.",
};

// ── Helper: build Vapi assistant payload ─────────────────────────────────────
function buildVapiPayload(data) {
  const prefix       = PERSONALITY_PREFIXES[data.personality] || "";
  const systemPrompt = prefix ? `${prefix}\n\n${data.prompt}` : data.prompt;
  const elevenMap={

    rachel:

    "21m00Tcm4TlvDq8ikWAM",

    adam:

    "pNInz6obpgDQGcFmaJgB",

    bella:

    "EXAVITQu4vr4xnSDxMaL"

    }

  return {
    name:         data.name,
    firstMessage: `Hi, I'm ${data.name}. How can I help you today?`,
    model: {
      provider:    "openai",
      model:       "gpt-4o-mini",
      temperature: parseFloat(data.temperature),
      messages: [
        { role: "system", content: systemPrompt },
      ],
    },
    
    voice: {
      provider: data.voiceProvider,
      voiceId:

      data.voiceProvider==="11labs"

      ?

      elevenMap[
      data.voiceId.toLowerCase()
        ]

      ||

      data.voiceId

      :

      data.voiceId,
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
// Vapi-first atomic flow:
//   1. POST to Vapi → get assistantId
//   2. Write DB with vapiAgentId already set
//   If (1) fails → DB never touched
//   If (2) fails → cleanup Vapi assistant, re-throw
async function createAgent(data) {
  const vapi = getVapiClient(); // throws if VAPI_API_KEY missing

  // Step 1: Create on Vapi
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

  // Step 2: Save to DB with vapiAgentId
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
        user: {
          connectOrCreate: {
            where:  { email: "demo@voiceplatform.dev" },
            create: { email: "demo@voiceplatform.dev", name: "Demo Developer" },
          },
        },
      },
    });
    console.log("[createAgent] Agent saved to DB. ID:", agent.id, "vapiAgentId:", agent.vapiAgentId);
    return agent;
  } catch (dbErr) {
    // DB failed — clean up the Vapi assistant
    console.error("[createAgent] DB write failed. Cleaning up Vapi assistant", vapiAgentId);
    try {
      await vapi.delete(`/assistant/${vapiAgentId}`);
      console.log("[createAgent] Vapi cleanup successful.");
    } catch (cleanupErr) {
      console.error("[createAgent] ORPHANED VAPI ASSISTANT:", vapiAgentId, cleanupErr.message);
    }
    throw dbErr;
  }
}

// ── getAgents ─────────────────────────────────────────────────────────────────
async function getAgents() {
  return await prisma.agent.findMany({
    orderBy: { createdAt: "desc" },
  });
}

// ── getAgentById ──────────────────────────────────────────────────────────────
async function getAgentById(id) {
  return await prisma.agent.findUnique({ where: { id } });
}

// ── updateAgent ───────────────────────────────────────────────────────────────
async function updateAgent(id, data) {
  const updateData = {};
  if (data.name          !== undefined) updateData.name          = data.name;
  if (data.prompt        !== undefined) updateData.prompt        = data.prompt;
  if (data.personality   !== undefined) updateData.personality   = data.personality;
  if (data.voiceProvider !== undefined) updateData.voiceProvider = data.voiceProvider;
  if (data.voiceId       !== undefined) updateData.voiceId       = data.voiceId;
  if (data.temperature   !== undefined) updateData.temperature   = parseFloat(data.temperature);

  return await prisma.agent.update({ where: { id }, data: updateData });
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
      console.warn("[deleteAgent] Could not delete Vapi assistant:", agent.vapiAgentId, vapiErr.response?.status, vapiErr.message);
    }
  }

  return await prisma.agent.delete({ where: { id } });
}

// ── getVapiConfig ─────────────────────────────────────────────────────────────
async function getVapiConfig(id) {
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent) {
    const err     = new Error("Agent not found");
    err.statusCode = 404;
    throw err;
  }

  console.log("[getVapiConfig] Agent:", agent.id, "vapiAgentId:", agent.vapiAgentId || "NONE");

  const prefix       = PERSONALITY_PREFIXES[agent.personality] || "";
  const systemPrompt = prefix ? `${prefix}\n\n${agent.prompt}` : agent.prompt;

  if (agent.vapiAgentId) {
    // Path 1 — registered assistant
    return {
      assistantId:        agent.vapiAgentId,
      assistantOverrides: {
        metadata: { platformAgentId: agent.id },
      },
    };
  }

  // Path 2 — inline fallback for legacy agents
  console.warn("[getVapiConfig] Agent has no vapiAgentId — using inline config fallback");
  return {
    assistant: {
      name:         agent.name,
      firstMessage: `Hi, I'm ${agent.name}. How can I help you today?`,
      model: {
        provider:    "openai",
        model:       "gpt-4o-mini",
        temperature: agent.temperature,
        messages: [{ role: "system", content: systemPrompt }],
      },
      voice: {
        provider: agent.voiceProvider,
        voiceId:  agent.voiceId,
      },
      transcriber: {
        provider: "deepgram",
        model:    "nova-2",
        language: "en",
      },
      endCallFunctionEnabled: true,
    },
    assistantOverrides: {
      metadata: { platformAgentId: agent.id },
    },
  };
}

// ── startCall ─────────────────────────────────────────────────────────────────
// NEW — called by POST /agents/:id/start-call
//
// WHY THIS EXISTS:
// Vapi Web SDK v2 supports two patterns:
//   A) vapi.start(assistantId)  — simplest, works when assistant is pre-registered
//   B) vapi.start(assistantConfig) — inline config, no pre-registration needed
//
// In both cases, the frontend only needs the assistantId or config object.
// This endpoint verifies the assistant exists on Vapi before the call starts,
// returning a clear error if it doesn't (e.g. manually deleted from dashboard).
//
// It also creates the Conversation DB record server-side so the frontend
// doesn't need a separate POST /conversations call.
async function startCall(agentId) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) {
    const err     = new Error("Agent not found");
    err.statusCode = 404;
    throw err;
  }

  if (!agent.vapiAgentId) {
    const err     = new Error("This agent has no Vapi assistant ID. Delete it and create a new one.");
    err.statusCode = 400;
    throw err;
  }

  // Verify the assistant still exists on Vapi.
  // getRecentContext is called AFTER this block — it must never be inside
  // the Vapi try/catch or a context failure would surface as a false 502.
  let vapiAssistant;
  try {
    const vapi    = getVapiClient();
    const res     = await vapi.get(`/assistant/${agent.vapiAgentId}`);
    vapiAssistant = res.data;
    console.log("[startCall] Vapi assistant verified:", vapiAssistant.id);
  } catch (vapiErr) {
    const status = vapiErr.response?.status;
    if (status === 404) {
      // Assistant was deleted from Vapi dashboard — clear our stale ID
      await prisma.agent.update({
        where: { id: agentId },
        data:  { vapiAgentId: null },
      });
      const err     = new Error("Vapi assistant no longer exists. Delete this agent and create a new one.");
      err.statusCode = 404;
      throw err;
    }
    const err = new Error(`Could not verify Vapi assistant: ${vapiErr.message}`);
    err.statusCode = 502;
    throw err;
  }

  // Fetch recent context AFTER Vapi verification succeeds.
  // getRecentContext never throws — returns "" on any failure or no history.
  const recentContext = await getRecentContext(agent.id);
  console.log("[startCall] Context length:", recentContext.length);

  // Get or create demo user for conversation record
  const user = await prisma.user.upsert({
    where:  { email: "demo@voiceplatform.dev" },
    update: {},
    create: { email: "demo@voiceplatform.dev", name: "Demo Developer" },
  });

  // Create Conversation record — this is the DB record for this call session
  const conversation = await prisma.conversation.create({
    data: {
      agentId:    agent.id,
      userId:     user.id,
      status:     "active",
    },
  });

  console.log("[startCall] Conversation created:", conversation.id);

  const orchResult =
  await orchestrationService.startOrchestration(
    conversation.id,
    agent
  );

  // Build the compiled prompt via promptService.
  // buildCompiledPrompt handles both legacy agents (only agent.prompt set)
  // and new layered agents (systemPrompt, conversationPrompt, etc.) with
  // identical output for existing agents — backward compatibility guaranteed.
  const compiledPrompt = buildCompiledPrompt(agent, { context: recentContext });

  

  // Only set model.messages when we have something to inject —
  // if compiledPrompt equals agent.prompt verbatim, Vapi already has it
  // stored on the assistant, so we can skip the override entirely.
  // We always inject when recentContext is present (context changes per call).
  // Vapi assistantOverrides.model.systemPrompt is the correct field for
  // overriding the system prompt per-call. The model.messages array only
  // accepts "user" and "assistant" roles — sending role:"system" there
  // causes Vapi to reject the request with a 400.
  // When overriding model fields, Vapi requires `provider` to be present —
  // it cannot be a partial object. We mirror the provider already stored
  // on the Vapi assistant (openai / gpt-4o-mini) so nothing else changes.
  if (recentContext || compiledPrompt !== agent.prompt) {
    assistantOverrides.model = {
      provider:     "openai",
      model:        "gpt-4o-mini",
      systemPrompt: compiledPrompt,
    };
    console.log("[startCall] Compiled prompt injected. Length:", compiledPrompt.length);
  }

  const assistantOverrides = {

  metadata:{
    platformAgentId:agent.id,
    platformConversationId:conversation.id,

    // webhook orchestration needs this

    conversationId:conversation.id
    }

  };

  if (orchResult.orchestrated) {

    assistantOverrides.model =
    assistantOverrides.model || {};

    assistantOverrides.model.messages = [

    {
        role:"system",
        content:orchResult.stagePrompt
    }

    ];

    }



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
  startCall,       // NEW
};