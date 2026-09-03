// src/lib/duplicate-check.js
// Shared name-similarity duplicate check, used by both laf/promote/[refCode].js
// (enforcement at promotion time) and laf/detail.js (preview-time warning).
// Extracted so both call sites can never drift out of sync with each other.

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { CLIENT_FIELDS } from '@/lib/graph.fields';

const graph = new GraphProvider();
const CLIENT_TYPE = createGraphType('client', CLIENT_FIELDS)('clients');

function calculateSimilarity(search, client) {
    const firstNameMatch = search.firstName === client.firstName ? 1
        : client.firstName?.includes(search.firstName) ? 0.8 : 0;
    const lastNameMatch  = search.lastName  === client.lastName  ? 1
        : client.lastName?.includes(search.lastName)   ? 0.8 : 0;
    return (firstNameMatch + lastNameMatch) / 2;
}

export async function checkDuplicates(firstName, lastName) {
    if (!firstName || !lastName) return [];
    const firstNameUpper = firstName.trim().toUpperCase();
    const lastNameUpper  = lastName.trim().toUpperCase();
    const clients = await graph.query(
        queryQl(CLIENT_TYPE, {
            where: {
                _or: [
                    { firstName: { _ilike: `%${firstNameUpper}%` } },
                    { lastName:  { _ilike: `%${lastNameUpper}%`  } },
                ],
                status: { _neq: 'offset' },
            },
            limit: 20,
        })
    ).then(r => r.data?.clients ?? []);

    return clients
        .map(c => {
            const score = calculateSimilarity(
                { firstName: firstNameUpper, lastName: lastNameUpper },
                { firstName: c.firstName?.toUpperCase() || '', lastName: c.lastName?.toUpperCase() || '' }
            );
            return { ...c, similarityScore: score };
        })
        .filter(c => c.similarityScore > 0.8)
        .sort((a, b) => b.similarityScore - a.similarityScore);
}