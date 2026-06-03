// services/vapiService.js
// Abstraction layer for all Vapi API interactions.
//
// CHANGES FROM ORIGINAL:
//   1. buildAssistantPayload now uses Groq (not OpenAI) — matches your stated stack
//   2. MODEL_CONFIG centralised — one place to change provider/model across all methods
//   3. updateCallAssistant now sends the correct Vapi runtime update shape:
//      assistantOverrides.model.messages[{role:"system", content}]
//      NOT assistantOverrides.model.systemPrompt (that field doesn't exist in Vapi's API)
//   4. buildRuntimeModelOverride extracted as a helper — used by both startCall
//      (in agentService) and the webhook transcript handler

const axios = require("axios");
const vapiConfig = require("../config/vapi");

// ─── Central model config ─────────────────────────────────────────────────────
// ONE place to change provider/model for the entire platform.
// WHY: Previously "openai" / "gpt-4o-mini" was hardcoded in 3 different places
// (buildAssistantPayload, agentService.startCall assistantOverrides, webhooks.js).
// A single constant prevents drift.
const MODEL_CONFIG = {
  provider:    process.env.LLM_PROVIDER    || "groq",
  model:       process.env.LLM_MODEL       || "llama3-70b-8192",
  temperature: parseFloat(process.env.LLM_TEMPERATURE || "0.7"),
};

// Create an axios instance pre-configured for Vapi's API
const vapiClient = axios.create({
  baseURL: vapiConfig.baseUrl,
  headers: {
    Authorization: `Bearer ${vapiConfig.apiKey}`,
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

const vapiService = {

  // ── Model config accessor ─────────────────────────────────────────────────
  // Exported so agentService can use the same constants when building
  // assistantOverrides without duplicating values.
  getModelConfig() {
    return { ...MODEL_CONFIG };
  },

  // ── Translate our agent model into Vapi's assistant format ────────────────
  async createVapiAssistant(agent) {
    const config = vapiService.buildAssistantPayload(agent);
    const response = await vapiClient.post("/assistant", config);
    return response.data;
  },

  async updateVapiAssistant(vapiAssistantId, agent) {
    const config = vapiService.buildAssistantPayload(agent);
    const response = await vapiClient.patch(`/assistant/${vapiAssistantId}`, config);
    return response.data;
  },

  async deleteVapiAssistant(vapiAssistantId) {
    const response = await vapiClient.delete(`/assistant/${vapiAssistantId}`);
    return response.data;
  },

  async getVapiAssistant(vapiAssistantId) {
    const response = await vapiClient.get(`/assistant/${vapiAssistantId}`);
    return response.data;
  },

  // ── Build the static Vapi assistant payload (used at agent create/update) ─
  // FIX: provider changed from "openai" to MODEL_CONFIG.provider (Groq)
  buildAssistantPayload(agent) {
    const personalityPrefix =
      vapiConfig.personalityPrefixes?.[agent.personality] || "";

    const fullSystemPrompt = personalityPrefix
      ? `${personalityPrefix}\n\n${agent.prompt}`
      : agent.prompt;

    return {
      name: agent.name,
      model: {
        provider:    MODEL_CONFIG.provider,
        model:       MODEL_CONFIG.model,
        temperature: agent.temperature ?? MODEL_CONFIG.temperature,
        messages: [
          { role: "system", content: fullSystemPrompt },
        ],
      },
      voice: {
        provider: agent.voiceProvider,
        voiceId:  agent.voiceId,
      },
      firstMessage: `Hi! I'm ${agent.name}. How can I help you today?`,
      endCallFunctionEnabled: true,
      recordingEnabled: false,
      transcriber: {
        provider: "deepgram",
        model:    "nova-2",
        language: "en",
      },
    };
  },

  // ── Build assistantOverrides.model block ──────────────────────────────────
  // This is the correct shape for BOTH startCall injection AND runtime updates.
  //
  // FIX: Previously the webhook handler was sending
  //   { model: { provider, model, systemPrompt } }
  // which is NOT a valid Vapi field. The correct shape is:
  //   { model: { provider, model, messages: [{ role: "system", content }] } }
  //
  // This helper is used by:
  //   - agentService.startCall (assistantOverrides.model)
  //   - webhooks.js transcript handler (runtime stage update)
  buildModelOverride(compiledPrompt, temperature) {
    return {
      provider:    MODEL_CONFIG.provider,
      model:       MODEL_CONFIG.model,
      temperature: temperature ?? MODEL_CONFIG.temperature,
      messages: [
        { role: "system", content: compiledPrompt },
      ],
    };
  },

  // ── Build the config for the Vapi Web SDK to start a call ─────────────────
  buildVapiCallConfig(agent) {
    return {
      ...(agent.vapiAgentId && { assistantId: agent.vapiAgentId }),
      ...(!agent.vapiAgentId && {
        assistant: vapiService.buildAssistantPayload(agent),
      }),
      assistantOverrides: {
        metadata: {
          platformAgentId: agent.id,
          agentName:       agent.name,
        },
      },
    };
  },

  // ── Runtime prompt update during an active call ───────────────────────────
  // FIX: Now uses buildModelOverride which sends the correct message array shape.
  // The original code sent `systemPrompt` as a top-level field on model — that
  // field does not exist in Vapi's PATCH /call/:id schema and was silently ignored.
  async updateCallAssistant(callId, compiledPrompt, temperature) {
    const modelOverride = vapiService.buildModelOverride(compiledPrompt, temperature);

    console.log(
      "[vapiService.updateCallAssistant] callId:", callId,
      "provider:", modelOverride.provider,
      "model:", modelOverride.model,
      "promptLength:", compiledPrompt.length
    );

    const response = await vapiClient.patch(`/call/${callId}`, {
      assistantOverrides: {
        model: modelOverride,
      },
    });

    return response.data;
  },

  async getCallDetails(vapiCallId) {
    const response = await vapiClient.get(`/call/${vapiCallId}`);
    return response.data;
  },

  async listAssistants() {
    const response = await vapiClient.get("/assistant");
    return response.data;
  },
};

module.exports = vapiService;