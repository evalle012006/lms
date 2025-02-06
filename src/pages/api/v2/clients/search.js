import { CLIENT_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

export default apiHandler({
    get: list
});

const graph = new GraphProvider();
const CLIENT_TYPE = createGraphType('client', `
    ${CLIENT_FIELDS}
    group {
        name
    }
    branch {
        name
    }
    dateModified
`)('clients');

async function list(req, res) {
    let statusCode = 200;
    let response = {};

    const { 
        searchText, 
        firstName, 
        lastName,
        mode, 
        cursor, 
        limit = 20 
    } = req.query;

    let query;

    if (mode === 'duplicate') {
        // Normalize search parameters
        const normalizedFirstName = firstName?.trim().toUpperCase() || '';
        const normalizedLastName = lastName?.trim().toUpperCase() || '';

        // Build the duplicate detection query
        query = {
            where: {
                _or: [
                    // Exact match on first name and last name
                    {
                        _and: [
                            { firstName: { _ilike: `%${normalizedFirstName}%` } },
                            { lastName: { _ilike: `%${normalizedLastName}%` } }
                        ]
                    },
                    // Partial match on full name (to catch differently split names)
                    {
                        fullName: { 
                            _ilike: `%${normalizedFirstName}%${normalizedLastName}%` 
                        }
                    },
                    // Handle possible name swaps
                    {
                        _and: [
                            { firstName: { _ilike: `%${normalizedLastName}%` } },
                            { lastName: { _ilike: `%${normalizedFirstName}%` } }
                        ]
                    }
                ],
                // Add cursor-based pagination
                ...(cursor ? { dateModified: { _lt: cursor } } : {})
            },
            order_by: { dateModified: 'desc' },
            limit: parseInt(limit)
        };
    } else {
        // Keep existing non-duplicate search logic
        const fullNameCondition = `%${searchText}%`;
        query = {
            where: {
                status: mode === 'offset' ? { _eq: 'offset' } : { _neq: 'null' },
                fullName: { _ilike: fullNameCondition },
                ...(cursor ? { dateModified: { _lt: cursor } } : {})
            },
            order_by: { dateModified: 'desc' },
            limit: parseInt(limit)
        };
    }

    try {
        const clients = await graph.query(
            queryQl(CLIENT_TYPE, query)
        ).then(res => res.data.clients ?? []);

        // Post-process results for duplicate mode
        let processedClients = clients;
        if (mode === 'duplicate' && clients.length > 0) {
            processedClients = clients.map(client => {
                const similarityScore = calculateClientSimilarity(
                    { firstName, lastName },
                    client
                );
                
                return {
                    ...client,
                    group: client.group ?? {},
                    branch: client.branch ?? {},
                    similarityScore,
                    // Flag as potential duplicate if similarity score is high enough
                    duplicate: similarityScore > 0.8
                };
            })
            // Sort by similarity score in descending order
            .sort((a, b) => b.similarityScore - a.similarityScore);
        } else {
            processedClients = clients.map(c => ({
                ...c,
                group: c.group ?? {},
                branch: c.branch ?? {},
            }));
        }

        response = {
            success: true,
            clients: processedClients,
            nextCursor: clients.length === parseInt(limit) ? 
                clients[clients.length - 1].dateModified : null
        };
    } catch (error) {
        statusCode = 500;
        response = {
            success: false,
            error: 'Failed to fetch clients',
            details: error.message
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
        .setHeader('Pragma', 'no-cache')
        .setHeader('Expires', '0')
        .end(JSON.stringify(response));
}

function calculateClientSimilarity(searchCriteria, client) {
    const normalizedSearch = {
        firstName: searchCriteria.firstName?.trim().toUpperCase() || '',
        lastName: searchCriteria.lastName?.trim().toUpperCase() || ''
    };

    const normalizedClient = {
        firstName: client.firstName?.trim().toUpperCase() || '',
        lastName: client.lastName?.trim().toUpperCase() || '',
        fullName: client.fullName?.trim().toUpperCase() || ''
    };

    // Calculate name similarity scores
    const firstNameSimilarity = calculateStringSimilarity(
        normalizedSearch.firstName,
        normalizedClient.firstName
    );

    const lastNameSimilarity = calculateStringSimilarity(
        normalizedSearch.lastName,
        normalizedClient.lastName
    );

    // Calculate full name similarity as a backup
    const fullNameSimilarity = calculateStringSimilarity(
        `${normalizedSearch.firstName} ${normalizedSearch.lastName}`,
        normalizedClient.fullName
    );

    // Use the higher score between individual name matching and full name matching
    const nameSimilarity = Math.max(
        (firstNameSimilarity + lastNameSimilarity) / 2,
        fullNameSimilarity
    );

    return nameSimilarity;
}

function calculateStringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    str1 = str1.trim();
    str2 = str2.trim();
    
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    // Calculate Levenshtein distance
    const distance = levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    
    // Convert distance to similarity score (0 to 1)
    return 1 - (distance / maxLength);
}

function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j - 1] + 1,
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1
                );
            }
        }
    }

    return dp[m][n];
}