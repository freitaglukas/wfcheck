import type {LlmDefaults} from '../spec/schema-v2.js';
export type {LlmDefaults};export type LlmOverrides=Partial<LlmDefaults>;
export interface ModelSelection {endpoint:string;model:string;digest:string;runtimeVersion:string;capabilities:string[];remote:false;provider?:'ollama'|'openai-compatible';contextBudgetField?:'context_tokens'|'num_ctx';supportsNoThinking?:boolean;}
export interface GenerationSettings {temperature:number;seed?:number;maxOutputTokens:number;contextTokens:number;timeoutMs:number;think?:false;}
export interface ChatRequest {messages:unknown[];responseFormat?:unknown;}
export interface InferenceContext {purpose:'workflow'|'planning';nodeId?:string;}
export interface ModelCall extends InferenceContext {mode:'mock'|'local'|'replay';status:'success'|'error'|'canceled';requestHash:string;responseHash?:string;selection?:ModelSelection;settings?:GenerationSettings;durationMs:number;response?:unknown;error?:{code:string;message:string};}
export interface ResolvedLlmPolicy {mode:'mock'|'local'|'replay';provider:'ollama'|'openai-compatible';endpoint:string;model:string;preferences:string[];settings:GenerationSettings;maxCalls:number;record?:string;replay?:string;replayHash?:string;identities?:string;}
