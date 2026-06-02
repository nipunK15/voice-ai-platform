"use strict";

/**
 * conversations.js
 * backend/routes/conversations.js
 *
 * All routes that TalkToAgent.jsx calls during and after a voice call.
 *
 * Route map (matches TalkToAgent.jsx exactly):
 *
 *   GET    /conversations                  → history page list
 *   GET    /conversations/:id              → conversation detail page
 *   POST   /conversations/:id/messages     → save transcript turn
 *   PATCH  /conversations/:id/end          → mark completed (MEMORY GATE)
 */

const express    = require("express");
const router     = express.Router();
const controller = require("../controllers/conversationController");

router.get(  "/",                    controller.getConversations);
router.get(  "/:id",                 controller.getConversationById);
router.post( "/:id/messages",        controller.addMessage);
router.patch("/:id/end",             controller.endConversation);

module.exports = router;