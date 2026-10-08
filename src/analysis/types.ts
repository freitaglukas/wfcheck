export type FactSource='deterministic'|'catalog'|'user'|'inferred'|'unknown';
export interface Provenance {source:FactSource;pointer?:string;artifactHash?:string;note?:string;}
export interface Diagnostic {code:string;severity:'error'|'warning'|'configuration';nodeId?:string;pointer?:string;summary:string;}
export interface Fact {kind:string;value:unknown;provenance:Provenance;}
export interface CapabilityDescriptor {type:string;versions:number[];operations?:string[];effect:'pure'|'read'|'write'|'llm'|'state'|'clock'|'sub-workflow'|'opaque';driver?:'webhook-json'|'form-file';analyzed:boolean;executable:boolean;mockable:boolean;observable:boolean;isolatable:boolean;}
export interface NodeAnalysis {id:string;type:string;typeVersion:number;summary:string;capabilityKey:string;credentialTypes:string[];facts:Fact[];diagnostics:Diagnostic[];capabilities?:CapabilityDescriptor;code?:{sha256:string;bytes:number};}
export interface TypedEdge {from:string;to:string;connectionType:string;outputIndex:number;inputIndex:number;}
export interface TriggerAnalysis {nodeId:string;kind:'webhook-json'|'form-file'|'unsupported';provenance:Provenance;}
export interface PlanRequirement {id:string;kind:string;nodeId?:string;pointer?:string;summary:string;provenance:Provenance;}
export interface NodeCatalog {runtimeVersion:string;sha256:string;nodes:Array<{type:string;versions:number[];description:unknown}>;}
export interface AnalysisOptions {catalog?:NodeCatalog;}
export interface WorkflowAnalysis {schemaVersion:1;sourceHash:string;catalogHash?:string;status:'ready'|'configuration-needed'|'unsupported';nodes:NodeAnalysis[];edges:TypedEdge[];triggers:TriggerAnalysis[];requirements:PlanRequirement[];diagnostics:Diagnostic[];}
