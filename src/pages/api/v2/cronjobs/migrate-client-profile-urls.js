import { gql } from 'apollo-boost';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { apiHandler } from '@/services/api-handler';
import logger from '@/logger';

const graph = new GraphProvider();

const DO_SPACES_ORIGIN = 'https://ambercashph.sgp1.digitaloceanspaces.com';
const DEFAULT_BATCH_SIZE = 5000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractKey(fullUrl) {
    if (!fullUrl || !fullUrl.startsWith(DO_SPACES_ORIGIN)) return null;
    try {
        const url = new URL(fullUrl);
        return url.pathname.replace(/^\//, ''); // lms/clients/uuid/file.png
    } catch {
        return null;
    }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Background Worker ────────────────────────────────────────────────────────

async function runMigration(batchSize) {
    logger.debug({ cron: 'migrate-client-profile-urls: start', batchSize });

    // Count remaining full URLs
    const countResult = await graph.apollo.query({
        query: gql`
            query CountClientProfileUrls {
                client_aggregate(where: { profile: { _like: "${DO_SPACES_ORIGIN}/%" } }) {
                    aggregate { count }
                }
            }
        `
    });

    const remaining = countResult?.data?.client_aggregate?.[0]?.aggregate?.count ?? 0;
    logger.debug({ cron: 'migrate-client-profile-urls: remaining', remaining });

    if (remaining === 0) {
        logger.debug({ cron: 'migrate-client-profile-urls: nothing to migrate — cron can be disabled' });
        return;
    }

    // Fetch one batch — always offset 0 since migrated records drop out of
    // the _like filter, so the next batch is always at the top
    const fetchResult = await graph.apollo.query({
        query: gql`
            query FetchClientProfileUrls($limit: Int) {
                client(
                    where: { profile: { _like: "${DO_SPACES_ORIGIN}/%" } }
                    limit: $limit
                    offset: 0
                    order_by: { dateAdded: desc }
                ) {
                    _id
                    profile
                }
            }
        `,
        variables: { limit: batchSize }
    });

    const clients = fetchResult?.data?.client ?? [];
    logger.debug({ cron: 'migrate-client-profile-urls: fetched batch', count: clients.length });

    if (clients.length === 0) {
        logger.debug({ cron: 'migrate-client-profile-urls: empty batch, done' });
        return;
    }

    let updated = 0;
    let skipped = 0;

    // Process in sub-batches of 500 to avoid oversized mutation payloads
    for (let i = 0; i < clients.length; i += 500) {
        const chunk = clients.slice(i, i + 500);
        const mutations = [];

        for (const client of chunk) {
            const key = extractKey(client.profile);
            if (!key) {
                logger.warn({ cron: 'migrate-client-profile-urls: could not parse key', profile: client.profile });
                skipped++;
                continue;
            }

            mutations.push(`
                update_${updated + mutations.length}: update_client_by_pk(
                    pk_columns: { _id: "${client._id}" }
                    _set: { profile: "${key}" }
                ) { _id }
            `);
        }

        if (mutations.length === 0) continue;

        await graph.apollo.mutate({
            mutation: gql`mutation MigrateClientProfiles { ${mutations.join('\n')} }`
        });

        updated += mutations.length;
        await sleep(300);
        logger.debug({ cron: 'migrate-client-profile-urls: sub-batch done', updated_so_far: updated });
    }

    logger.debug({
        cron:            'migrate-client-profile-urls: complete',
        updated,
        skipped,
        remaining_after: remaining - updated,
    });
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default apiHandler({
    post: migrateClientProfileUrls,
});

async function migrateClientProfileUrls(req, res) {
    const batchSize = req.body?.payload?.batchSize ?? req.body?.batchSize ?? DEFAULT_BATCH_SIZE;

    // Fire and forget — respond immediately so Hasura doesn't time out
    runMigration(batchSize).catch((err) => {
        logger.error({ cron: 'migrate-client-profile-urls: fatal error', error: err?.message ?? err });
    });

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({
            success: true,
            message: 'migrate-client-profile-urls running in background',
            batchSize,
        }));
}