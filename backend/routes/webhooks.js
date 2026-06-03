// routes/webhooks.js
//
// CHANGES FROM PREVIOUS VERSION:
//   1. call-started handler now saves vapiCallId to the conversation record.
//      Previously the handler only logged. vapiCallId was never written to DB,
//      so _pushStagePromptUpdate always had a null vapiCallId and every runtime
//      prompt update silently failed — stage transitions had zero effect on behavior.
//   2. memoryService import is now conditional (wrapped in try/catch) so the server
//      starts even before memoryService.js is created. Once memoryService exists,
//      the import works automatically with no further changes needed here.

"use strict";

const express              = require("express");
const router               = express.Router();
const prisma               = require("../config/database");
const conversationService  = require("../services/conversationService");
const orchestrationService = require("../services/orchestrationService");
const promptService        = require("../services/promptService");
const vapiService          = require("../services/vapiService");

// Safe import of memoryService — server starts even if file doesn't exist yet.
// Remove the try/catch once memoryService.js is deployed.
let memoryService = null;
try {
  memoryService = require("../services/memoryService");
} catch (e) {
  console.warn("[webhook] memoryService not found — summarization disabled. Create services/memoryService.js to enable.");
}

router.post("/vapi", async (req, res) => {
  const messageType = req.body?.message?.type || req.body?.type;
  console.log("[WEBHOOK]", messageType);

  try {
    const event = req.body;

    switch (messageType) {

      // ── Call started ──────────────────────────────────────────────────────
      // FIX: Save vapiCallId to the conversation record.
      // Without this, _pushStagePromptUpdate has no vapiCallId and every
      // runtime prompt update silently fails — stage transitions don't work.
      case "call-started": {
        const vapiCallId     = event.call?.id;
        const conversationId = event.call?.metadata?.conversationId
                            || event.call?.metadata?.platformConversationId;

        console.log("[webhook] Call started. vapiCallId:", vapiCallId, "conversationId:", conversationId);

        if (vapiCallId && conversationId) {
          await prisma.conversation.update({
            where: { id: conversationId },
            data:  { vapiCallId },
          });
          console.log("[webhook] vapiCallId saved to conversation:", conversationId);
        } else {
          console.warn("[webhook] call-started: missing vapiCallId or conversationId in metadata. Prompt updates will not work for this call.");
        }
        break;
      }

      // ── End of call ───────────────────────────────────────────────────────
      case "call-ended":
      case "end-of-call-report": {
        const callId   = event.call?.id || event.callId;
        const duration = event.call?.duration;
        const summary  = event.summary || null;

        if (!callId) break;

        const conversation = await prisma.conversation.findFirst({
          where: { vapiCallId: callId },
        });

        if (!conversation) {
          console.warn("[webhook] end-of-call: no conversation for callId", callId);
          break;
        }

        await conversationService.endConversation(conversation.id, {
          duration,
          summary,
        });

        const transcript = event.transcript || event.artifact?.transcript;
        if (transcript && Array.isArray(transcript) && transcript.length > 0) {
          const messages = transcript.map((t) => ({
            role:      t.role === "bot" ? "assistant" : t.role,
            content:   t.content || t.message || "",
            timestamp: t.timestamp ? new Date(t.timestamp) : new Date(),
          }));
          await conversationService.addMessages(conversation.id, messages);
        }

        await orchestrationService.endOrchestration(conversation.id);

        // Fire-and-forget summarization for memory layer
        if (memoryService?.summarizeConversationIfNeeded) {
          memoryService.summarizeConversationIfNeeded(conversation.id).catch((err) => {
            console.error("[webhook] summarization failed:", err.message);
          });
        }

        break;
      }

      // ── Real-time transcript ──────────────────────────────────────────────
      case "transcript":
      case "transcript-update": {
        // Guard: only process final (complete) utterances
        const isFinal = event.transcript?.isFinal ?? event.isFinal ?? true;
        if (!isFinal) break;

        const conversationId = event.call?.metadata?.conversationId
                            || event.call?.metadata?.platformConversationId;
        const role = event.role || event.transcript?.role;
        const text = typeof event.transcript === "string"
          ? event.transcript
          : event.transcript?.text || event.message || event.text;

        if (!conversationId || !role || !text) break;

        const result = await orchestrationService.processTranscriptTurn(
          conversationId,
          role,
          text,
        );

        if (result?.advanced && !result?.handoff) {
          // Load the saved vapiCallId from DB — it was written on call-started
          const conversation = await prisma.conversation.findUnique({
            where:  { id: conversationId },
            select: { vapiCallId: true },
          });
          await _pushStagePromptUpdate(
            conversation?.vapiCallId,
            conversationId,
            result,
          );
        }

        if (result?.advanced && result?.handoff) {
          console.log("[webhook] handoff → assistantId:", result.handoffAssistantId);
          // TODO Phase 5: await vapiService.transferCall(event.call.id, result.handoffAssistantId);
        }

        break;
      }

      // ── Function / tool calls ─────────────────────────────────────────────
      case "function-call": {
        return res.json({ result: "Tool calling not yet implemented" });
      }

      default: {
        console.log("[webhook] Unhandled type:", messageType);
      }
    }

    return res.json({ received: true });

  } catch (error) {
    console.error("[webhook] Error:", error.message, error.stack);
    // Always return 200 — a 500 causes Vapi to retry indefinitely
    return res.status(200).json({ received: true, error: "Processing failed" });
  }
});

// ─── Internal: push updated stage prompt to live call ────────────────────────
async function _pushStagePromptUpdate(vapiCallId, conversationId, orchResult) {
  if (!vapiCallId) {
    console.warn("[webhook] _pushStagePromptUpdate: no vapiCallId — call-started may not have fired or metadata was missing");
    return;
  }

  try {
    const conversation = await prisma.conversation.findUnique({
      where:   { id: conversationId },
      include: { agent: true },
    });

    if (!conversation?.agent) {
      console.warn("[webhook] _pushStagePromptUpdate: conversation or agent not found");
      return;
    }

    const agent = conversation.agent;

    const compiledPrompt = promptService.buildCompiledPrompt(agent, {
      taskOverride: orchResult.stagePrompt || orchResult.newStage,
      // Context is not re-fetched mid-call — it was injected at call start.
      // Mid-call context refresh is a Phase 6 concern.
    });

    await vapiService.updateCallAssistant(vapiCallId, compiledPrompt, agent.temperature);

    console.log(
      "[webhook] Stage prompt pushed.",
      "stage:", orchResult.newStage,
      "promptLength:", compiledPrompt.length,
    );

  } catch (err) {
    console.error("[webhook] _pushStagePromptUpdate failed:", err.message);
  }
}

module.exports = router;