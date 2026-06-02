import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { conversationsApi } from "../services/api";

export default function ConversationHistory() {

  const navigate = useNavigate();

  const [loading,setLoading]=useState(true);

  const [conversations,setConversations]=useState([]);

  const [error,setError]=useState("");

  useEffect(()=>{

    loadConversations();

  },[]);


  async function loadConversations(){

    try{

      setLoading(true);

      const data=

      await conversationsApi.getAll();

      console.log(
        "[History] conversations:",
        data
      );

      setConversations(
        data || []
      );

    }catch(err){

      console.error(err);

      setError(
        err.message
      );

    }finally{

      setLoading(false);

    }

  }


  if(loading){

    return(

      <div style={styles.center}>

        Loading conversations...

      </div>

    );

  }


  if(error){

    return(

      <div style={styles.center}>

        Error:

        {error}

      </div>

    );

  }


  return(

    <div style={styles.page}>

      <h1 style={styles.title}>

        Conversation History

      </h1>


      {

      conversations.length===0 ?

      (

        <div style={styles.empty}>

          No conversations found

        </div>

      )

      :

      (

        conversations.map(

          convo=>(

            <div

              key={convo.id}

              style={styles.card}

              onClick={()=>{

                navigate(

                  `/conversations/${convo.id}`

                );

              }}

            >

              <div>

                <h3>

                  {

                  convo.agent?.name ||

                  "Unknown Agent"

                  }

                </h3>

                <p>

                  Status:

                  {convo.status}

                </p>

                <p>

                  Messages:

                  {

                  convo._count?.messages ||

                  0

                  }

                </p>

              </div>

              <div>

                {

                new Date(

                  convo.startedAt

                ).toLocaleString()

                }

              </div>

            </div>

          )

        )

      )

      }

    </div>

  );

}


const styles={

page:{

padding:"32px",

background:"#0d1117",

minHeight:"100vh",

color:"white"

},

title:{

marginBottom:"24px"

},

center:{

padding:"60px",

color:"white"

},

empty:{

padding:"40px",

background:"#1f2937",

borderRadius:"12px"

},

card:{

padding:"20px",

marginBottom:"16px",

background:"#1f2937",

borderRadius:"12px",

display:"flex",

justifyContent:"space-between",

cursor:"pointer"

}

};