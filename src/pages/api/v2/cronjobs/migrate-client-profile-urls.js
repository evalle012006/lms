/**
 * /api/v2/cronjobs/migrate-client-profile-urls.js
 *
 * Hasura scheduled trigger — converts stored full DigitalOcean Spaces URLs
 * in client.profile to path-only storage keys.
 *
 * BEFORE: https://ambercashph.sgp1.digitaloceanspaces.com/lms/clients/uuid/file.png
 * AFTER:  lms/clients/uuid/file.png
 *
 * Runs in the background (fire-and-forget). Responds immediately so Hasura
 * doesn't time out. Processes up to batchSize records per trigger firing.
 *
 * ─── Hasura Scheduled Trigger Config ─────────────────────────────
 *  URL:      {{BASE_URL}}/api/v2/cronjobs/migrate-client-profile-urls
 *  Method:   POST
 *  Headers:  x-webhook-api-key: {{WEBHOOK_API_KEY}}
 *  Schedule: * * * * *  (every minute — disable once logs show "nothing to migrate")
 *  Payload:  { "batchSize": 5000 }   ← optional, defaults to 5000
 */

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import logger from '@/logger';

const graph = new GraphProvider();

const DO_SPACES_ORIGIN = 'https://ambercashph.sgp1.digitaloceanspaces.com';
const DEFAULT_BATCH_SIZE = 5000;

// ─── Graph Types ──────────────────────────────────────────────────────────────

const CLIENT_TYPE     = createGraphType('client',           '_id profile')('clients');
const CLIENT_AGG_TYPE = createGraphType('client_aggregate', 'aggregate { count }')('client_aggregate');
const CLIENT_MUT_TYPE = createGraphType('client',           '_id');

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

    // Count how many full URLs still remain
    const aggResult = await graph.query(
        queryQl(CLIENT_AGG_TYPE, {
            where: { profile: { _like: `${DO_SPACES_ORIGIN}/%` } }
        })
    );
    const remaining = aggResult?.data?.client_aggregate?.[0]?.aggregate?.count ?? 0;

    logger.debug({ cron: 'migrate-client-profile-urls: remaining', remaining });

    if (remaining === 0) {
        logger.debug({ cron: 'migrate-client-profile-urls: nothing to migrate — cron can be disabled' });
        return;
    }

    // Always offset: 0 — each run migrates records so they drop out of the
    // _like filter, meaning the next batch is always at the top
    const clientsResult = await graph.query(
        queryQl(CLIENT_TYPE, {
            where:    { profile: { _like: `${DO_SPACES_ORIGIN}/%` } },
            limit:    batchSize,
            offset:   0,
            order_by: { dateAdded: 'desc' },
        })
    );
    const clients = clientsResult?.data?.clients ?? [];

    logger.debug({ cron: 'migrate-client-profile-urls: fetched batch', count: clients.length });

    if (clients.length === 0) {
        logger.debug({ cron: 'migrate-client-profile-urls: empty batch, done' });
        return;
    }

    let updated = 0;
    let skipped = 0;
    let batch_update = [];

    for (const client of clients) {
        const key = extractKey(client.profile);

        if (!key) {
            logger.warn({ cron: 'migrate-client-profile-urls: could not parse key', profile: client.profile });
            skipped++;
            continue;
        }

        batch_update.push(
            updateQl(CLIENT_MUT_TYPE('client_migrate_' + batch_update.length), {
                set:   { profile: key },
                where: { _id: { _eq: client._id } },
            })
        );

        // Flush every 500 to avoid oversized mutation payloads
        if (batch_update.length === 500) {
            logger.debug({ cron: 'migrate-client-profile-urls: flushing sub-batch', batch_count: batch_update.length });
            const result = await graph.mutation(...batch_update);
            updated += batch_update.length;
            batch_update = [];
            await sleep(300);
            logger.debug({ cron: 'migrate-client-profile-urls: sub-batch done', error_count: result.errors?.length ?? 0 });
        }
    }

    // Flush remainder
    if (batch_update.length > 0) {
        logger.debug({ cron: 'migrate-client-profile-urls: flushing final batch', batch_count: batch_update.length });
        const result = await graph.mutation(...batch_update);
        updated += batch_update.length;
        await sleep(300);
        logger.debug({ cron: 'migrate-client-profile-urls: final batch done', error_count: result.errors?.length ?? 0 });
    }

    logger.debug({
        cron:      'migrate-client-profile-urls: complete',
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
    const batchSize = req.body?.batchSize ?? DEFAULT_BATCH_SIZE;

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