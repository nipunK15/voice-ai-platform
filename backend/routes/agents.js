const express=
require("express");

const router=
express.Router();

const agentController=
require(
"../controllers/agentController"
);

router.get(
"/",
agentController.getAgents
);

router.post(
"/",
agentController.createAgent
);
router.get("/:id/vapi-config",        agentController.getVapiConfig);  
router.post("/:id/start-call",       agentController.startCall);  

router.get(
"/:id",
agentController.getAgentById
);

router.put("/:id", agentController.updateAgent);      
router.delete("/:id", agentController.deleteAgent);   
module.exports=
router;








