// src/lib/face-uniqueness-settings.js  (server only)
// Reads the System Settings switch "Enforce Face Uniqueness". Default is ON: only a stored boolean `false`
// turns it off. A missing row / null / failed read keeps it ON (the safe direction for a duplicate guard —
// the face look-up itself already fails soft, see lib/face-duplicate.js).
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();
const SETTINGS_TYPE = createGraphType('settings', 'enforceFaceUniqueness');

export async function isFaceUniquenessEnforced() {
    try {
        const [row] = await graph
            .query(queryQl(SETTINGS_TYPE('faceUniquenessSetting'), { limit: 1 }))
            .then((r) => r.data?.faceUniquenessSetting ?? []);
        return row?.enforceFaceUniqueness !== false;
    } catch (e) {
        console.warn('[face-uniqueness] settings read failed, enforcing:', String(e?.message ?? e).slice(0, 200));
        return true;
    }
}
