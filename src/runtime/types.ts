import type { MockRule } from '../spec/schema.js';
export interface RequestObservation {method:string;path:string;headers:Record<string,string>;body:string;json?:unknown;mockId?:string;unexpected:boolean;reason?:string;receivedAt:string;responseStatus?:number;}
export interface NodeRun {outputs:unknown[][];error?:unknown;}
export interface ExecutionObservation {id:string;workflowId:string;status:string;nodes:Record<string,NodeRun[]>;}
export interface Evidence {execution:ExecutionObservation;requests:RequestObservation[];gatewayErrors:string[];trigger?:TriggerAttempt;tables?:TableEvidence[];modelCalls?:import('../llm/types.js').ModelCall[];}
export interface WorkflowNode {id:string;name:string;type:string;typeVersion:number;position:number[];parameters:Record<string,any>;retryOnFail?:boolean;maxTries?:number;waitBetweenTries?:number;onError?:string;credentials?:unknown;[key:string]:unknown;}
export interface Workflow {name:string;nodes:WorkflowNode[];connections:Record<string,any>;settings?:Record<string,unknown>;[key:string]:unknown;}
export interface PreparedWorkflow {workflow:Workflow;sourceHash:string;changes:string[];webhookNodeId:string;webhookNodeName:string;webhookPath:string;modelToken?:string;trigger?:TriggerDescriptor;resources?:{tables:import('../spec/normalized.js').LogicalTable[];bindings:import('../spec/normalized.js').TableBinding[]};}
export interface RuntimeHandle {workflowId:string;versionId?:string;prepared:PreparedWorkflow;}
export interface RuntimeAdapter {
  doctor():Promise<unknown>;
  importWorkflow(prepared:PreparedWorkflow,runId:string,testId:string,signal?:AbortSignal):Promise<RuntimeHandle>;
  activate(handle:RuntimeHandle,signal?:AbortSignal):Promise<void>;
  trigger(handle:RuntimeHandle,input:Record<string,unknown>|CompiledInput,marker:string,signal:AbortSignal):Promise<void|TriggerAttempt>;
  observe(handle:RuntimeHandle,marker:string,signal:AbortSignal):Promise<ExecutionObservation>;
  cleanup(handle:RuntimeHandle):Promise<void>;
}
export interface GatewayCase {runId:string;testId:string;token:string;mocks:MockRule[];expiresAt:number;}

export type CompiledInput={kind:'json';data:Record<string,unknown>;sha256:string}|{kind:'file';bytes:Uint8Array;field:string;fileName:string;mimeType:string;sha256:string};
export interface TriggerAttempt {responseStatus?:number;transport:'received'|'uncertain';}
export interface TriggerDescriptor {kind:'webhook-json'|'form-file';nodeId:string;nodeName:string;path:string;fileField?:string;transportField?:string;fileName?:string;}

export interface TableEvidence {tableId:string;resourceId:string;rows:Record<string,unknown>[];complete:true;capturedAt:string;}
