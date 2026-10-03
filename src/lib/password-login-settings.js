import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();
const TYPE = createGraphType('settings', `passwordLoginEnabled`)('settings');

let _cache = null;
let _at = 0;

export async function isPasswordLoginEnabled() {
    if (_cache !== null && Date.now() - _at < 30_000) return _cache;
    try {
        const settings = await graph.query(queryQl(TYPE, {})).then(r => r.data?.settings?.[0]);
        _cache = settings?.passwordLoginEnabled === true;
    } catch {
        _cache = false; // fail closed — an unreachable settings table should not silently enable a new auth method
    }
    _at = Date.now();
    return _cache;
}