import type {MockRule} from '../spec/schema.js';import type {GatewayCase,RequestObservation} from '../runtime/types.js';
export type Awaitable<T>=T|Promise<T>;
export interface GatewaySnapshot {requests:RequestObservation[];errors:string[];modelCalls?:import('../llm/types.js').ModelCall[];}
export interface GatewayTransport {register(runId:string,testId:string,mocks:MockRule[],ttlMs:number,models?:import('../llm/gateway.js').ModelGatewayConfig):Awaitable<GatewayCase>;drain(runId:string,testId:string):Promise<void>;snapshot(runId:string,testId:string):Awaitable<GatewaySnapshot>;seal(runId:string,testId:string):Awaitable<void>;close():Promise<void>;}
