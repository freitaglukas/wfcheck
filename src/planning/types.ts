import type {WorkflowAnalysis,PlanRequirement,Diagnostic,Provenance} from '../analysis/types.js';
import type {AssertionV2,SuiteV2} from '../spec/schema-v2.js';
export interface BehaviorContract {id:string;fixtureId:string;assertion:AssertionV2;provenance:Provenance;}
export interface DraftPlan {suggestions?:import('./assistant.js').PlanProposal[];assistance?:{status:'proposed'|'error';projectionHash?:string;message?:string};schemaVersion:1;sourceHash:string;analysisHash:string;catalogHash?:string;analysis:WorkflowAnalysis;selectedTrigger?:string;proposedSuite:SuiteV2;unresolved:PlanRequirement[];verificationKind:'smoke'|'baseline'|'behavior';scenarios:Array<{id:string;kind:string;nodeId?:string;provenance:Provenance}>;}
export interface PlanConfiguration {workflowSource?:string;candidateSuite:unknown;validatedInputs:Array<{path:string;sha256:string;kind:string}>;authoredContracts:BehaviorContract[];runtimeCapabilities?:{kind:string;triggerKinds:string[];operations:string[];nodeCatalogHash?:string};}
export interface PlanValidation {ready:boolean;executable:SuiteV2|null;diagnostics:Diagnostic[];}
