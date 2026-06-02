// services/vapiService.js
// Abstraction layer for all Vapi API interactions.
//
// ARCHITECTURE DECISION: This is the most critical architectural choice.
// By isolating ALL Vapi calls behind this service, we achieve provider independence.
// If we want to support Bland.ai, Retell, or our own voice infra later,
// we create a new service implementing the same interface and swap it out.
// Controllers and other services never call Vapi directly.

const axios = require("axios");
const vapiConfig = require("../config/vapi");

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
  // Translate our agent model into Vapi's assistant format and create it
  async createVapiAssistant(agent) {
    const config = vapiService.buildAssistantPayload(agent);

    const response = await vapiClient.post("/assistant", config);
    return response.data;
  },

  // Update an existing Vapi assistant
  async updateVapiAssistant(vapiAssistantId, agent) {
    const config = vapiService.buildAssistantPayload(agent);
    const response = await vapiClient.patch(
      `/assistant/${vapiAssistantId}`,
      config
    );
    return response.data;
  },

  // Delete a Vapi assistant
  async deleteVapiAssistant(vapiAssistantId) {
    const response = await vapiClient.delete(
      `/assistant/${vapiAssistantId}`
    );
    return response.data;
  },

  // Get a specific Vapi assistant
  async getVapiAssistant(vapiAssistantId) {
    const response = await vapiClient.get(
      `/assistant/${vapiAssistantId}`
    );
    return response.data;
  },

  // Build the Vapi assistant payload from our agent model.
  // This is the "translation layer" between our schema and Vapi's schema.
  buildAssistantPayload(agent) {
    const personalityPrefix =
      vapiConfig.personalityPrefixes[agent.personality] || "";

    const fullSystemPrompt = personalityPrefix
      ? `${personalityPrefix}\n\n${agent.prompt}`
      : agent.prompt;

    return {
      name: agent.name,
      model: {
        provider: "openai",
        model: "gpt-4o-mini",
        temperature: agent.temperature,
        messages: [
          {
            role: "system",
            content: fullSystemPrompt,
          },
        ],
      },
      voice: {
        provider: agent.voiceProvider,
        voiceId: agent.voiceId,
      },
      firstMessage: `Hi! I'm ${agent.name}. How can I help you today?`,
      endCallFunctionEnabled: true,
      recordingEnabled: false, // Default off for privacy
      transcriber: {
        provider: "deepgram",
        model: "nova-2",
        language: "en",
      },
    };
  },

  // Build the config object needed by the Vapi Web SDK to start a call.
  // This is what the frontend's "Talk to Agent" page uses.
  buildVapiCallConfig(agent) {
    return {
      // If synced to Vapi, use the Vapi assistant ID directly
      ...(agent.vapiAgentId && { assistantId: agent.vapiAgentId }),

      // If not synced, pass the full config inline (Vapi supports this)
      ...(!agent.vapiAgentId && {
        assistant: vapiService.buildAssistantPayload(agent),
      }),

      // Metadata to track this call in our system
      assistantOverrides: {
        metadata: {
          platformAgentId: agent.id,
          agentName: agent.name,
        },
      },
    };
  },

  // Fetch call details from Vapi (for updating conversation records)
  async getCallDetails(vapiCallId) {
    const response = await vapiClient.get(`/call/${vapiCallId}`);
    return response.data;
  },

  // List all Vapi assistants (for reconciliation / admin)
  async listAssistants() {
    const response = await vapiClient.get("/assistant");
    return response.data;
  },
};

module.exports = vapiService;