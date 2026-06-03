const axios =
require("axios");

const {
 getTool
}=
require("./toolRegistry");


async function executeTool(
 toolName,
 payload={}
){

 try{

  const tool=
  getTool(
   toolName
  );

  if(
   !tool
  ){

   throw new Error(
    `Tool not found: ${toolName}`
   );

  }


  console.log(
   "[toolExecutor] executing:",
   toolName
  );

  console.log(
   "[toolExecutor] payload:",
   payload
  );


  if(
   tool.type==="webhook"
  ){

   const response=
   await axios({

    method:
    tool.method ||
    "POST",

    url:
    tool.url,

    data:
    payload,

    timeout:
    10000,

    headers:{

     "Content-Type":
     "application/json"

    }

   });


   console.log(
    "[toolExecutor] success:",
    response.data
   );


   return{

    success:true,

    tool:
    toolName,

    data:
    response.data

   };

  }


  throw new Error(
   "Unsupported tool type"
  );

 }catch(
  err
 ){

  console.error(
   "[toolExecutor] FAILED:",
   err.message
  );


  if(
   err.response
  ){

   console.error(
    "[toolExecutor] response:",
    err.response.data
   );

  }


  return{

   success:false,

   tool:
   toolName,

   error:
   err.message

  };

 }

}


module.exports={

 executeTool

};