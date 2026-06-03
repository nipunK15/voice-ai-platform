const {
 executeTool
}=require("./toolExecutor");


const TOOL_PATTERNS={

 send_lead:[

  "save lead",
  "save this lead",
  "record lead",
  "store lead",
  "capture lead",
  "create lead"

 ]

};


function detectToolIntent(
 text=""
){

 const lower=
 text.toLowerCase();

 for(
  const [tool,patterns]
  of Object.entries(
   TOOL_PATTERNS
  )
 ){

  const matched=
  patterns.some(
   p=>lower.includes(p)
  );

  if(
   matched
  ){

   return tool;

  }

 }

 return null;

}



const callStateStore=
require("./callStateStore")

async function processToolCalls(
 conversationId,
 text
){

 const tool=
 detectToolIntent(
  text
 );

 if(
  !tool
 ){

  return [];

 }

 console.log(
  "[toolRouter] detected:",
  tool
 );

 const state=
  callStateStore.getCall(
  conversationId
  );

  const result=
  await executeTool(
  tool,
  {

    transcript:text,

    ...(state?.collectedData||{})

  }
  );
 return [

  {

   tool,

   result

  }

 ];

}


module.exports={

 processToolCalls

};