// src/lib/face-recapture-settings.js  (server only)
// Reads the System Settings switch "Allow Client Face Re-enrollment". Off unless it is exactly `true`.
// A failed read throws, so a settings outage keeps the feature OFF rather than silently on.
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();
const SETTINGS_TYPE = createGraphType('settings', 'allowFaceRecapture');

export async function isFaceRecaptureEnabled() {
    const [row] = await graph
        .query(queryQl(SETTINGS_TYPE('faceRecaptureSetting'), { limit: 1 }))
        .then((r) => r.data?.faceRecaptureSetting ?? []);
    return row?.allowFaceRecapture === true;
}