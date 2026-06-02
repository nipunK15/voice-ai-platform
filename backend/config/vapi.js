// config/vapi.js
// Centralizes all Vapi configuration.
// Keeping provider config in one place means swapping out Vapi for another
// voice infrastructure provider (Bland, Retell, etc.) only requires changes here.

const vapiConfig = {
  apiKey: process.env.VAPI_API_KEY,
  baseUrl: process.env.VAPI_BASE_URL || "https://api.vapi.ai",

  // Default voice options available on Vapi
  voices: {
    "11labs": [
      { id: "rachel", name: "Rachel" },
      { id: "adam", name: "Adam" },
      { id: "bella", name: "Bella" },
      { id: "josh", name: "Josh" },
      { id: "elli", name: "Elli" },
    ],
    deepgram: [
      { id: "luna", name: "Luna" },
      { id: "stella", name: "Stella" },
      { id: "athena", name: "Athena" },
      { id: "hera", name: "Hera" },
      { id: "orion", name: "Orion" },
    ],
    openai: [
      { id: "alloy", name: "Alloy" },
      { id: "echo", name: "Echo" },
      { id: "fable", name: "Fable" },
      { id: "onyx", name: "Onyx" },
      { id: "nova", name: "Nova" },
      { id: "shimmer", name: "Shimmer" },
    ],
    azure: [
      { id: "en-US-JennyNeural", name: "Jenny (US)" },
      { id: "en-US-GuyNeural", name: "Guy (US)" },
      { id: "en-GB-SoniaNeural", name: "Sonia (UK)" },
    ],
  },

  // Personality -> prompt prefix mapping
  // This is how we translate our agent personality into Vapi-compatible system prompts
  personalityPrefixes: {
    professional:
      "You are a professional and formal AI assistant. Speak clearly and concisely.",
    friendly:
      "You are a warm, friendly AI assistant. Be conversational and approachable.",
    casual:
      "You are a casual, laid-back AI assistant. Use relaxed language and be fun.",
    formal:
      "You are a highly formal AI assistant. Use precise language and maintain strict professionalism.",
    empathetic:
      "You are an empathetic AI assistant. Show genuine care and understanding.",
    technical:
      "You are a technical AI assistant. Focus on accuracy and technical precision.",
  },
};

module.exports = vapiConfig;