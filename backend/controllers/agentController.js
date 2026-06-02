// backend/controllers/agentController.js
// ADDED: startCall handler
// All existing handlers are preserved exactly.

const service = require("../services/agentService");

exports.createAgent = async (req, res) => {
  try {
    const agent = await service.createAgent(req.body);
    res.status(201).json(agent);
  } catch (err) {
    console.error("[createAgent controller]", err.message);
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
};

exports.getAgents = async (req, res) => {
  try {
    const agents = await service.getAgents();
    res.json(agents);
  } catch (err) {
    console.error("[getAgents controller]", err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getAgentById = async (req, res) => {
  try {
    const agent = await service.getAgentById(req.params.id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    res.json(agent);
  } catch (err) {
    console.error("[getAgentById controller]", err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.updateAgent = async (req, res) => {
  try {
    const agent = await service.updateAgent(req.params.id, req.body);
    res.json(agent);
  } catch (err) {
    console.error("[updateAgent controller]", err.message);
    if (err.code === "P2025") return res.status(404).json({ error: "Agent not found" });
    res.status(500).json({ error: err.message });
  }
};

exports.deleteAgent = async (req, res) => {
  try {
    await service.deleteAgent(req.params.id);
    res.json({ success: true, message: "Agent deleted" });
  } catch (err) {
    console.error("[deleteAgent controller]", err.message);
    if (err.code === "P2025") return res.status(404).json({ error: "Agent not found" });
    res.status(500).json({ error: err.message });
  }
};

exports.getVapiConfig = async (req, res) => {
  try {
    const config = await service.getVapiConfig(req.params.id);
    res.json(config);
  } catch (err) {
    console.error("[getVapiConfig controller]", err.message);
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
};

// NEW — verifies the Vapi assistant exists, creates DB conversation record,
// returns assistantId + conversationId for the frontend to use directly
exports.startCall = async (req, res) => {
  try {
    console.log("[startCall controller] agentId:", req.params.id);
    const result = await service.startCall(req.params.id);
    res.json(result);
  } catch (err) {
    console.error("[startCall controller]", err.message);
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
};