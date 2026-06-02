import { useEffect,useState } from "react";

import { useParams } from "react-router-dom";

import { conversationsApi } from "../services/api";


export default function ConversationDetail(){

const {id}=useParams();

const [loading,setLoading]=useState(true);

const [conversation,setConversation]=useState(null);

const [error,setError]=useState("");


useEffect(()=>{

loadConversation();

},[id]);


async function loadConversation(){

try{

setLoading(true);

const data=

await conversationsApi.getById(id);

console.log(
"[ConversationDetail]",
data
);

setConversation(data);

}catch(err){

console.error(err);

setError(

err.message ||

"Could not load conversation"

);

}

finally{

setLoading(false);

}

}


if(loading){

return(

<div style={styles.center}>

Loading Conversation...

</div>

)

}


if(error){

return(

<div style={styles.center}>

{error}

</div>

)

}


if(!conversation){

return(

<div style={styles.center}>

Conversation not found

</div>

)

}


return(

<div style={styles.page}>


<h1>

{

conversation.agent?.name ||

"Conversation"

}

</h1>


<div style={styles.meta}>


<div>

Status:

{conversation.status}

</div>


<div>

Duration:

{

conversation.duration ||

0

}s

</div>


<div>

Started:

{

new Date(

conversation.startedAt

).toLocaleString()

}

</div>


</div>



<div style={styles.messages}>


{

conversation.messages?.length===0 ?

(

<div>

No messages

</div>

)

:

(

conversation.messages.map(

(msg,index)=>(

<div

key={index}

style={

msg.role==="assistant"

?

styles.assistant

:

styles.user

}

>

<div style={styles.role}>

{msg.role}

</div>

<div>

{msg.content}

</div>

</div>

)

)

)

}


</div>


</div>

)

}


const styles={

page:{

padding:"32px",

background:"#0b1220",

minHeight:"100vh",

color:"white"

},

center:{

padding:"60px",

color:"white"

},

meta:{

display:"flex",

gap:"24px",

marginBottom:"24px",

opacity:.8

},

messages:{

display:"flex",

flexDirection:"column",

gap:"16px"

},

assistant:{

padding:"16px",

borderRadius:"12px",

background:"#1f2937",

maxWidth:"70%"

},

user:{

padding:"16px",

borderRadius:"12px",

background:"#2563eb",

alignSelf:"flex-end",

maxWidth:"70%"

},

role:{

fontSize:"12px",

opacity:.7,

marginBottom:"8px"

}

};