const registry = new Map();

function registerTool(tool){

 registry.set(
  tool.name,
  tool
 );

}

function getTool(name){

 return registry.get(name);

}

function listTools(){

 return [...registry.values()];

}

module.exports={

 registerTool,

 getTool,

 listTools

};