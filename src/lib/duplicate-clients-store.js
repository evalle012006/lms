// src/lib/duplicate-clients-store.js
// Writes against the stored duplicate groups (duplicate_client_clusters):
//   - reviewCluster():   an admin's "confirmed duplicate" / "not a duplicate" decision (Phase 3)
//   - onClientMerged():  keeps stored groups in sync right after a merge, without waiting for the next scan
//
// Requires migrations 005 + 006.

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl, insertQl } from '@/lib/graph/graph.util';
import { logAudit } from '@/lib/audit';

const graph = new GraphProvider();
const CLUSTER_TYPE = createGraphType('duplicate_client_clusters', `
  _id status view members member_count active_count review_status
`);

const EXCLUSION_TYPE = createGraphType('duplicate_client_exclusions', `_id`);

export const REVIEW_DECISIONS = ['confirmed', 'not_duplicate', 'clear'];

/**
 * @returns {Promise<{ success: boolean, message?: string }>}
 * 'not_duplicate' suppresses the group from the default view; the scan re-opens it automatically
 * if a NEW record later joins the group (see persist() in duplicate-clients-job.js).
 */
export async function reviewCluster({ clusterId, decision, note, user, req }) {
    if (!REVIEW_DECISIONS.includes(decision)) return { success: false, message: 'Invalid decision.' };
    const cleanNote = String(note ?? '').trim().slice(0, 500);
    if (decision === 'not_duplicate' && !cleanNote) {
        return { success: false, message: 'A note is required when marking a group as not a duplicate.' };
    }

    const [cluster] = await graph.query(
        queryQl(CLUSTER_TYPE('c'), { where: { _id: { _eq: clusterId } }, limit: 1 })
    ).then(r => r.data?.c ?? []);
    if (!cluster) return { success: false, message: 'Duplicate group not found.' };

    const userName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || null;
    const clearing = decision === 'clear';
    await graph.mutation(updateQl(CLUSTER_TYPE('u'), {
        where: { _id: { _eq: clusterId } },
        set: clearing
            ? { review_status: null, review_note: null, reviewed_by: null, reviewed_by_name: null, reviewed_at: null, reviewed_member_ids: null }
            : {
                review_status: decision,
                review_note: cleanNote || null,
                reviewed_by: user._id,
                reviewed_by_name: userName,
                reviewed_at: new Date().toISOString(),
                reviewed_member_ids: cluster.members.map(m => m._id),
            },
    }));

    logAudit(req, {
        action: clearing ? 'DUPLICATE_REVIEW_CLEARED' : `DUPLICATE_MARKED_${decision.toUpperCase()}`,
        category: 'CLIENT',
        severity: 'INFO',
        entityType: 'client',
        entityId: cluster.members[0]?._id ?? null,
        userId: user._id,
        userName,
        description: `Duplicate group ${clusterId} (${cluster.members.length} record(s)): ${decision}${cleanNote ? ` — ${cleanNote}` : ''}`,
        metadata: { clusterId, decision, note: cleanNote || null, clientIds: cluster.members.map(m => m._id) },
    });

    return { success: true };
}

/** Best-effort — callers must not fail a merge because this failed; the next scan fixes it anyway. */
export async function onClientMerged({ duplicateId }) {
    const clusters = await graph.query(
        queryQl(CLUSTER_TYPE('cs'), {
            where: { status: { _eq: 'open' }, members: { _contains: [{ _id: duplicateId }] } },
            limit: 50,
        })
    ).then(r => r.data?.cs ?? []);

    for (const c of clusters) await dropMember(c, duplicateId);
}

async function dropMember(cluster, clientId) {
    const members = cluster.members.filter(m => m._id !== clientId);
    const stillAGroup = members.length >= 2 && cluster.view !== 'same_client';
    await graph.mutation(updateQl(CLUSTER_TYPE('u'), {
        where: { _id: { _eq: cluster._id } },
        set: stillAGroup
            ? {
                members,
                member_count: members.length,
                active_count: members.filter(m => m.hasActiveLoan).length,
            }
            : { status: 'resolved', resolved_at: new Date().toISOString() },
    }));
}

/**
 * Reviewer says one record in a group is a DIFFERENT person from the rest. Stores a pair-level exclusion against
 * every other member (the scan then never groups them again) and takes the record out of the stored group now.
 */
export async function markNotSamePerson({ clusterId, clientId, note, user, req }) {
    const [cluster] = await graph.query(
        queryQl(CLUSTER_TYPE('c'), { where: { _id: { _eq: clusterId } }, limit: 1 })
    ).then(r => r.data?.c ?? []);
    if (!cluster) return { success: false, message: 'Duplicate group not found.' };
    if (cluster.view === 'same_client') return { success: false, message: 'This group is one client with several loans.' };
    const others = cluster.members.map(m => m._id).filter(id => id !== clientId);
    if (others.length === cluster.members.length) return { success: false, message: 'That record is not in this group.' };

    const cleanNote = String(note ?? '').trim().slice(0, 500) || null;
    const userName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || null;
    const objects = others.map(o => {
        const [a, b] = clientId < o ? [clientId, o] : [o, clientId];
        return { _id: `${a}|${b}`, client_a: a, client_b: b, note: cleanNote, created_by: user._id, created_by_name: userName };
    });
    await graph.mutation(insertQl(EXCLUSION_TYPE('x'), {
        objects,
        on_conflict: { constraint: 'duplicate_client_exclusions_pkey', update_columns: [] },
    }));
    await dropMember(cluster, clientId);

    logAudit(req, {
        action: 'DUPLICATE_MARKED_NOT_SAME_PERSON',
        category: 'CLIENT',
        severity: 'INFO',
        entityType: 'client',
        entityId: clientId,
        userId: user._id,
        userName,
        description: `Client ${clientId} marked as a different person from ${others.length} other record(s) in duplicate group ${clusterId}${cleanNote ? ` — ${cleanNote}` : ''}`,
        metadata: { clusterId, clientId, otherClientIds: others, note: cleanNote },
    });
    return { success: true, message: 'Saved. The record was taken out of this group and will not be grouped with these records again.' };
}
