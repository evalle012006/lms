// src/lib/laf/qr-gate.js  (server only)
import moment from 'moment';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();
const GROUP_GATE_TYPE = createGraphType('groups', '_id branchId qrToken qrExpiresAt')('groups');

/** The group when qrToken is valid, unexpired and (if given) belongs to groupId; otherwise null. */
export async function resolveGroupFromQr(qrToken, groupId = null) {
    if (typeof qrToken !== 'string' || !qrToken.trim()) return null;
    const [group] = await graph.query(
        queryQl(GROUP_GATE_TYPE, { where: { qrToken: { _eq: qrToken } }, limit: 1 })
    ).then(r => r.data?.groups ?? []);
    if (!group) return null;
    if (group.qrExpiresAt && moment().isAfter(moment(group.qrExpiresAt))) return null;
    if (groupId && group._id !== groupId) return null;
    return group;
}