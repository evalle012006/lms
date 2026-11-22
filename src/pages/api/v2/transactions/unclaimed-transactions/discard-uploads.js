//src/pages/api/v2/transactions/unclaimed-transactions/discard-uploads.js
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { UNCLAIMED_AMOUNT_TRANSACTIONS_FIELDS } from '@/lib/graph.fields';
import logger from '@/logger';

const graph = new GraphProvider();

const UNCLAIMED_TRANSACTION_TYPE = createGraphType(
    'unclaimed_amount_transactions',
    UNCLAIMED_AMOUNT_TRANSACTIONS_FIELDS
)('transaction');

const s3Client = new S3Client({
    endpoint: 'https://sgp1.digitaloceanspaces.com',
    region: 'sgp1',
    credentials: {
        accessKeyId: process.env.SPACES_ACCESS_KEY,
        secretAccessKey: process.env.SPACES_SECRET_KEY,
    },
    forcePathStyle: false,
});

const MAX_KEYS = 10;

export default apiHandler({
    post: discardUploads
});

/**
 * Rollback helper for a claim upload that only partially succeeded.
 * Deletes just-uploaded files that were never attached to a claim.
 *
 * Safety rules:
 *  - keys must live under <SPACES_ROOT>/unclaimed-transactions/
 *  - a key already referenced by any unclaimed_amount_transactions.document_url
 *    is NEVER deleted (protects documents of already-claimed rows)
 */
async function discardUploads(req, res) {
    const user_id = req?.auth?.sub;
    const { keys } = req.body || {};

    if (!Array.isArray(keys) || keys.length === 0 || keys.length > MAX_KEYS) {
        return res.status(400).json({ success: false, message: `keys must be an array of 1-${MAX_KEYS} items` });
    }

    const allowedPrefix = `${process.env.SPACES_ROOT}/unclaimed-transactions/`;
    const candidates = keys.filter(
        k => typeof k === 'string' && k.startsWith(allowedPrefix) && !k.includes('..')
    );

    const deleted = [];
    const skipped = [];

    try {
        for (const key of candidates) {
            const ref = await graph.query(
                queryQl(UNCLAIMED_TRANSACTION_TYPE, {
                    where: { document_url: { _like: `%${key}%` } },
                    limit: 1
                })
            );

            if (ref.data?.transaction?.length > 0) {
                skipped.push({ key, reason: 'referenced by a claim' });
                continue;
            }

            try {
                await s3Client.send(new DeleteObjectCommand({
                    Bucket: process.env.SPACES_BUCKET,
                    Key: key,
                }));
                deleted.push(key);
            } catch (err) {
                skipped.push({ key, reason: err.message });
            }
        }

        logger.info({
            user_id,
            page: 'Discard Unclaimed Uploads',
            deleted: deleted.length,
            skipped: skipped.length
        });

        return res.status(200).json({ success: true, deleted, skipped });
    } catch (error) {
        logger.error({
            user_id,
            page: 'Discard Unclaimed Uploads',
            error: error.message
        });
        return res.status(500).json({ success: false, message: error.message });
    }
}
