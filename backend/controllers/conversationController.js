"use strict";

/**
 * conversationController.js
 * backend/controllers/conversationController.js
 *
 * Handles all conversation lifecycle endpoints.
 * All routes that TalkToAgent.jsx calls land here.
 */

const service = require("../services/conversationService");

// GET /conversations
// Returns all conversations for the demo user, newest first.
exports.getConversations = async (req, res) => {
  try {
    const conversations = await service.getConversations();
    res.json(conversations);
  } catch (err) {
    console.error("[getConversations]", err.message);
    res.status(500).json({ error: err.message });
  }
};

// GET /conversations/:id
exports.getConversationById = async (req, res) => {
  try {
    const convo = await service.getConversationById(req.params.id);
    if (!convo) return res.status(404).json({ error: "Conversation not found" });
    res.json(convo);
  } catch (err) {
    console.error("[getConversationById]", err.message);
    res.status(500).json({ error: err.message });
  }
};

// POST /conversations/:id/messages
// Called by TalkToAgent on every final transcript event.
exports.addMessage = async (req, res) => {
  try {
    const { role, content } = req.body;
    if (!role || !content) {
      return res.status(400).json({ error: "role and content are required" });
    }
    const message = await service.addMessage(req.params.id, { role, content });
    res.status(201).json(message);
  } catch (err) {
    console.error("[addMessage]", err.message);
    res.status(500).json({ error: err.message });
  }
};

// PATCH /conversations/:id/end
// Called by TalkToAgent on call-end.
// CRITICAL: must set status = "completed" — this is what contextService
// queries for. If this doesn't run, the agent has no memory.
exports.endConversation = async (req, res) => {
  try {
    const { duration } = req.body;
    const convo = await service.endConversation(req.params.id, { duration });
    res.json(convo);
  } catch (err) {
    console.error("[endConversation]", err.message);
    res.status(500).json({ error: err.message });
  }
};