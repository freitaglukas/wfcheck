import {HarnessError} from '../security/errors.js';
export function requireActive(signal?:AbortSignal){if(signal?.aborted)throw new HarnessError('INTERRUPTED','Resource preparation interrupted or case deadline expired');}
