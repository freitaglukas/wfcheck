import type { MockRule } from '../spec/schema.js';
export interface RequestObservation {method:string;path:string;headers:Record<string,string>;body:string;json?:unknown;mockId?:string;unexpected:boolean;reason?:string;receivedAt:string;responseStatus?:number;}
export interface NodeRun {outputs:unknown[][];error?:unknown;}
export interface ExecutionObservation {id:string;workflowId:string;status:string;nodes:Record<string,NodeRun[]>;}
export interface Evidence {execution:ExecutionObservation;requests:RequestObservation[];gatewayErrors:string[];}
export interface WorkflowNode {id:string;name:string;type:string;typeVersion:number;position:number[];parameters:Record<string,any>;retryOnFail?:boolean;maxTries?:number;waitBetweenTries?:number;onError?:string;credentials?:unknown;[key:string]:unknown;}
export interface Workflow {name:string;nodes:WorkflowNode[];connections:Record<string,any>;settings?:Record<string,unknown>;[key:string]:unknown;}
export interface PreparedWorkflow {workflow:Workflow;sourceHash:string;changes:string[];webhookNodeId:string;webhookNodeName:string;webhookPath:string;}
export interface RuntimeHandle {workflowId:string;versionId?:string;prepared:PreparedWorkflow;}
export interface RuntimeAdapter {
  doctor():Promise<unknown>;
  importWorkflow(prepared:PreparedWorkflow,runId:string,testId:string):Promise<RuntimeHandle>;
  activate(handle:RuntimeHandle,signal?:AbortSignal):Promise<void>;
  trigger(handle:RuntimeHandle,input:Record<string,unknown>,marker:string,signal:AbortSignal):Promise<void>;
  observe(handle:RuntimeHandle,marker:string,signal:AbortSignal):Promise<ExecutionObservation>;
  cleanup(handle:RuntimeHandle):Promise<void>;
}
export interface GatewayCase {runId:string;testId:string;token:string;mocks:MockRule[];expiresAt:number;}
