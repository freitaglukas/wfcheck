import {isDeepStrictEqual} from 'node:util';import type {JsonSchemaNode} from '../spec/schema-v2.js';
export function matchesSchema(value:unknown,schema:JsonSchemaNode):boolean{const type=(t:string)=>t==='null'?value===null:t==='array'?Array.isArray(value):t==='object'?!!value&&typeof value==='object'&&!Array.isArray(value):t==='integer'?typeof value==='number'&&Number.isInteger(value):t==='number'?typeof value==='number'&&Number.isFinite(value):typeof value===t;if(schema.type&&!(Array.isArray(schema.type)?schema.type:[schema.type]).some(type))return false;if(schema.enum&&!schema.enum.some(v=>isDeepStrictEqual(v,value)))return false;
 if(typeof value==='string'&&(schema.minLength!==undefined&&[...value].length<schema.minLength||schema.maxLength!==undefined&&[...value].length>schema.maxLength))return false;
 if(typeof value==='number'&&(schema.minimum!==undefined&&value<schema.minimum||schema.maximum!==undefined&&value>schema.maximum))return false;
 if(Array.isArray(value)){if(schema.minItems!==undefined&&value.length<schema.minItems||schema.maxItems!==undefined&&value.length>schema.maxItems)return false;if(schema.items&&!value.every(v=>matchesSchema(v,schema.items!)))return false;}
 else if(value&&typeof value==='object'){if(schema.required?.some(k=>!Object.hasOwn(value,k)))return false;if(schema.additionalProperties===false&&Object.keys(value).some(k=>!Object.hasOwn(schema.properties??{},k)))return false;for(const[k,s]of Object.entries(schema.properties??{}))if(Object.hasOwn(value,k)&&!matchesSchema((value as any)[k],s))return false;}
 return true;
}
