// routes/webhooks.js

const express = require("express");
const router = express.Router();

const conversationService = require("../services/conversationService");
const orchestrationService = require("../services/orchestrationService");

router.post("/vapi", async (req, res) => {
  try {
    const event = req.body;

    console.log(
      "Vapi webhook received:",
      event.type || event.message?.type
    );

    const messageType =
      event.type ||
      event.message?.type;

    switch (messageType) {

      case "call-started":
        console.log(
          "Call started:",
          event.call?.id
        );
        break;


      case "call-ended":
      case "end-of-call-report": {

        const callId =
          event.call?.id ||
          event.callId;

        const transcript =
          event.transcript ||
          event.artifact?.transcript;

        const duration =
          event.call?.duration;

        if (callId) {

          const { PrismaClient } =
            require("@prisma/client");

          const prisma =
            new PrismaClient();

          const conversation =
            await prisma.conversation.findFirst({
              where:{
                vapiCallId:callId
              }
            });

          if (conversation) {

            await conversationService.endConversation(
              conversation.id,
              conversation.userId,
              {
                duration,
                summary:event.summary
              }
            );

            if (
              transcript &&
              Array.isArray(transcript)
            ) {

              const messages =
                transcript.map((t)=>({
                  role:
                    t.role==="bot"
                    ? "assistant"
                    : t.role,

                  content:
                    t.content ||
                    t.message ||
                    "",

                  timestamp:
                    t.timestamp ||
                    new Date().toISOString()
                }));

              if(messages.length>0){

                await conversationService.addMessages(
                  conversation.id,
                  messages
                );

              }
            }

            /*
            NEW:
            cleanup orchestration
            */

            await orchestrationService.endOrchestration(
              conversation.id
            );

          }
        }

        break;
      }


      /*
      REAL TIME TRANSCRIPT EVENTS
      */

      case "transcript":
      case "transcript-update": {

        const conversationId =
          event.call?.metadata?.conversationId;

        const role =
          event.role ||
          event.transcript?.role;

        const text =
          event.transcript ||
          event.message ||
          event.text;

        if (
          conversationId &&
          role &&
          text
        ) {

          const result =
            await orchestrationService.processTranscriptTurn(
              conversationId,
              role,
              text
            );

          if(
            result?.advanced &&
            !result?.handoff
          ){

            console.log(
              "[orchestration] advanced ->",
              result.newStage
            );

            /*
            later:
            inject assistant overrides here
            */

          }

          if(
            result?.advanced &&
            result?.handoff
          ){

            console.log(
              "[orchestration] handoff ->",
              result.handoffAssistantId
            );

            /*
            later:
            call Vapi transfer API here
            */

          }

        }

        break;
      }


      case "function-call":

        return res.json({
          result:
            "Function not implemented in MVP"
        });


      default:

        console.log(
          "Unhandled webhook type:",
          messageType
        );

    }

    return res.json({
      received:true
    });

  }
  catch(error){

    console.error(
      "Webhook error:",
      error
    );

    return res.status(200).json({
      received:true,
      error:"Processing failed"
    });

  }

});

module.exports = router;