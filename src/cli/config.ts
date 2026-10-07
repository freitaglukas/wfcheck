import { config } from 'dotenv';
import { resolve } from 'node:path';
import { HarnessError } from '../security/errors.js';
config({quiet:true});
export function configuration():{baseUrl:string;apiKey:string;stateDirectory:string;gatewayUrl?:string;gatewayPort:number} {
  const baseUrl=process.env.N8N_BASE_URL,apiKey=process.env.N8N_API_KEY;
  if(!baseUrl||!apiKey)throw new HarnessError('CONFIG','Set N8N_BASE_URL and N8N_API_KEY in the local environment or a private .env; never pass keys on the command line');
  const gatewayPort=Number(process.env.WFCHECK_GATEWAY_PORT??0);
  if(!Number.isInteger(gatewayPort)||gatewayPort<0||gatewayPort>65535)throw new HarnessError('CONFIG','Invalid WFCHECK_GATEWAY_PORT');
  const gatewayUrl=process.env.WFCHECK_GATEWAY_URL;
  if(gatewayUrl){const u=new URL(gatewayUrl);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new HarnessError('CONFIG','WFCHECK_GATEWAY_URL must be an HTTPS origin');}
  return {baseUrl,apiKey,stateDirectory:resolve(process.env.WFCHECK_STATE_DIR??'.wfcheck'),gatewayUrl:gatewayUrl?.replace(/\/$/,''),gatewayPort};
}
