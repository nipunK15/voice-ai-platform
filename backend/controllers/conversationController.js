"use strict";

/**
 * conversationController.js
 * backend/controllers/conversationController.js
 *
 * FIXES:
 * FIX 1 — processTranscriptTurn() was called with a single object arg.
 *   The service expects (conversationId, role, text) as positional args.
 *   Changed to: processTranscriptTurn(req.params.id, role, content)
 *
 * FIX 2 — Orchestration was only triggered for role === "user".
 *   Both user AND assistant turns are now fed to the engine so LLM eval
 *   conditions can read the full conversation context.
 *
 * FIX 3 — callId forwarded correctly to vapiService.updateCallAssistant().
 *   callId comes from req.body and is passed straight through.
 */
const {
 processToolCalls
}=require(
 "../services/toolRouter"
);
const service              = require("../services/conversationService");
const orchestrationService = require("../services/orchestrationService");
const vapiService          = require("../services/vapiService");

// GET /conversations
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
    const { role, content, callId } = req.body;
    let finalContent=content;

    if (!role || !content) {
      return res.status(400).json({ error: "role and content are required" });
    }

    // Save the message first
    const message = await service.addMessage(req.params.id, { role, content });

    // FIX 1 + 2: feed BOTH user and assistant turns to orchestration engine.
    // Previous code only ran for role === "user" AND passed a single object
    // instead of positional args — orchestration never fired.
    // Correct signature: processTranscriptTurn(conversationId, role, text)
    console.log(`[orchestration] processing turn — role: ${role}, text: ${content.slice(0, 60)}`);
    if(
    role==="user"
    ){

    const toolResults =
    await processToolCalls(
    req.params.id,
    content
    );

    if(
    toolResults.length > 0
    ){

    console.log(
    "[tool results]",
    toolResults
    );

    const toolResponse =
    `Tool ${toolResults[0].tool} executed successfully`;

    // save assistant message
    

    return res.json({

    success:true,

    toolExecuted:true,

    message:
    toolResponse,

    assistantResponse:
    toolResponse,

    stopFurtherProcessing:
    true

    });

    }
}

    

    const result = await orchestrationService.processTranscriptTurn(
      req.params.id,  // conversationId  ← was buried inside an object before
      role,           // role            ← was never passed before
      finalContent         // text            ← was named "transcript" inside the object before
    );

    console.log("[orchestration result]", result);

    // FIX 3: callId is now correctly used for the Vapi runtime update.
    // callId comes from the request body (sent by TalkToAgent after BUG 1 fix).
    if (result?.advanced && !result?.handoff && callId) {
      try {
        await vapiService.updateCallAssistant(callId, {
          model: {
            provider:     "openai",
            model:        "gpt-4o-mini",
            systemPrompt: result.stagePrompt,
          },
        });
        console.log("[runtime updated] new stage:", result.newStage);
      } catch (vapiErr) {
        // Log but don't fail the message save — call continues even if
        // runtime prompt update fails
        console.warn("[runtime update failed]", vapiErr.message);
      }
    }

    res.status(201).json(message);

  } catch (err) {
    console.error("[addMessage]", err);
    res.status(500).json({ error: err.message });
  }
};

// PATCH /conversations/:id/end
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