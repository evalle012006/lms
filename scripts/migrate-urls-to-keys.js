/**
 * migrate-urls-to-keys.js
 *
 * One-time migration script to convert stored full DigitalOcean Spaces URLs
 * to path-only storage keys across all affected tables.
 *
 * BEFORE: https://ambercashph.sgp1.digitaloceanspaces.com/lms/clients/uuid/filename.png
 * AFTER:  lms/clients/uuid/filename.png
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  TABLE COVERAGE (verified against database/db-schema.sql)       │
 * │                                                                  │
 * │  1. client.profile                   origin: "clients"          │
 * │  2. users.profile                    origin: "profiles"         │
 * │  3. unclaimed_amount_transactions    origin: "unclaimed-        │
 * │        .document_url                  transactions"             │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * ─── Usage ────────────────────────────────────────────────────────
 *
 *  # 1. See total counts across all tables (no changes)
 *  HASURA_URL=https://dev-graph.ambercashph.com/v1/graphql DRY_RUN=true node scripts/migrate-urls-to-keys.js
 *
 *  # 2. Dry run first batch of 50
 *  HASURA_URL=https://dev-graph.ambercashph.com/v1/graphql DRY_RUN=true BATCH_SIZE=50 BATCH_OFFSET=0 node scripts/migrate-urls-to-keys.js
 *
 *  # 3. Apply first batch of 50
 *  HASURA_URL=https://dev-graph.ambercashph.com/v1/graphql DRY_RUN=false BATCH_SIZE=50 BATCH_OFFSET=0 node scripts/migrate-urls-to-keys.js
 *
 *  # 4. Apply next batch (offset moves forward by BATCH_SIZE)
 *  HASURA_URL=https://dev-graph.ambercashph.com/v1/graphql DRY_RUN=false BATCH_SIZE=500 BATCH_OFFSET=50 node scripts/migrate-urls-to-keys.js
 *
 *  # 5. No BATCH_SIZE = migrate ALL remaining in one go
 *  HASURA_URL=https://dev-graph.ambercashph.com/v1/graphql DRY_RUN=false node scripts/migrate-urls-to-keys.js
 *
 * ─── Env Vars ─────────────────────────────────────────────────────
 *
 *  HASURA_URL          Hasura GraphQL endpoint  (with /v1/graphql)
 *  HASURA_ADMIN_SECRET Hasura admin secret
 *  DRY_RUN             true (default) | false
 *  BATCH_SIZE          Records to process per run  (default: ALL)
 *  BATCH_OFFSET        Skip this many records first (default: 0)
 *
 * ─── Offset tip ───────────────────────────────────────────────────
 *  NOTE: BATCH_OFFSET is NOT a simple row-number skip across tables.
 *  It applies independently per table. So with BATCH_SIZE=50 and
 *  BATCH_OFFSET=50, each table skips its own first 50 matching rows.
 *  The script prints "Next run offset" after each table to guide you.
 */

require('dotenv').config();
// Node.js v18+ has native fetch built-in — no node-fetch needed

const HASURA_ENDPOINT = process.env.HASURA_URL;
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;
const DRY_RUN       = process.env.DRY_RUN !== 'false';
const BATCH_SIZE    = process.env.BATCH_SIZE   ? parseInt(process.env.BATCH_SIZE, 10)   : null;
const BATCH_OFFSET  = process.env.BATCH_OFFSET ? parseInt(process.env.BATCH_OFFSET, 10) : 0;

// ─── Hasura Helper ────────────────────────────────────────────────────────────

async function gql(query, variables = {}) {
  const res = await fetch(HASURA_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': HASURA_ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

// ─── Key Extraction ───────────────────────────────────────────────────────────

const DO_SPACES_ORIGIN = 'https://ambercashph.sgp1.digitaloceanspaces.com';

function extractKey(fullUrl) {
  if (!fullUrl || !fullUrl.startsWith(DO_SPACES_ORIGIN)) return null;
  try {
    const url = new URL(fullUrl);
    return url.pathname.replace(/^\//, ''); // strip leading slash → lms/clients/uuid/file.png
  } catch {
    return null;
  }
}

// ─── Migration Targets ────────────────────────────────────────────────────────

const MIGRATIONS = [

  // ── 1. Client profile photos ──────────────────────────────────────────────
  {
    label: 'client.profile  [origin: clients]',

    countQuery: `
      query CountClientProfiles {
        client_aggregate(where: { profile: { _like: "https://ambercashph.sgp1.digitaloceanspaces.com/%" } }) {
          aggregate { count }
        }
      }
    `,
    countPath: 'client_aggregate.aggregate.count',

    fetchQuery: `
      query FetchClientProfiles($limit: Int, $offset: Int!) {
        client(
          where: { profile: { _like: "https://ambercashph.sgp1.digitaloceanspaces.com/%" } }
          limit: $limit
          offset: $offset
          order_by: { dateAdded: desc }
        ) {
          _id
          profile
        }
      }
    `,

    updateMutation: `
      mutation UpdateClientProfile($_id: String!, $profile: String!) {
        update_client_by_pk(pk_columns: { _id: $_id }, _set: { profile: $profile }) {
          _id
        }
      }
    `,
    idField: '_id',
    valueField: 'profile',
    updateField: 'profile',
  },

  // ── 2. User profile photos ────────────────────────────────────────────────
  {
    label: 'users.profile  [origin: profiles]',

    countQuery: `
      query CountUserProfiles {
        users_aggregate(where: { profile: { _like: "https://ambercashph.sgp1.digitaloceanspaces.com/%" } }) {
          aggregate { count }
        }
      }
    `,
    countPath: 'users_aggregate.aggregate.count',

    fetchQuery: `
      query FetchUserProfiles($limit: Int, $offset: Int!) {
        users(
          where: { profile: { _like: "https://ambercashph.sgp1.digitaloceanspaces.com/%" } }
          limit: $limit
          offset: $offset
          order_by: { dateAdded: desc }
        ) {
          _id
          profile
        }
      }
    `,

    updateMutation: `
      mutation UpdateUserProfile($_id: String!, $profile: String!) {
        update_users_by_pk(pk_columns: { _id: $_id }, _set: { profile: $profile }) {
          _id
        }
      }
    `,
    idField: '_id',
    valueField: 'profile',
    updateField: 'profile',
  },

  // ── 3. Unclaimed transaction documents ────────────────────────────────────
  {
    label: 'unclaimed_amount_transactions.document_url  [origin: unclaimed-transactions]',

    countQuery: `
      query CountUnclaimedDocs {
        unclaimed_amount_transactions_aggregate(where: { document_url: { _like: "https://ambercashph.sgp1.digitaloceanspaces.com/%" } }) {
          aggregate { count }
        }
      }
    `,
    countPath: 'unclaimed_amount_transactions_aggregate.aggregate.count',

    fetchQuery: `
      query FetchUnclaimedDocs($limit: Int, $offset: Int!) {
        unclaimed_amount_transactions(
          where: { document_url: { _like: "https://ambercashph.sgp1.digitaloceanspaces.com/%" } }
          limit: $limit
          offset: $offset
          order_by: { inserted_date: desc }
        ) {
          _id
          document_url
        }
      }
    `,

    updateMutation: `
      mutation UpdateUnclaimedDoc($_id: uuid!, $document_url: String!) {
        update_unclaimed_amount_transactions_by_pk(
          pk_columns: { _id: $_id },
          _set: { document_url: $document_url }
        ) {
          _id
        }
      }
    `,
    idField: '_id',
    valueField: 'document_url',
    updateField: 'document_url',
  },

];

// ─── Count Helper ─────────────────────────────────────────────────────────────

function resolvePath(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj) ?? 0;
}

async function getCount(migration) {
  const data = await gql(migration.countQuery);
  return resolvePath(data, migration.countPath);
}

// ─── Per-table Runner ─────────────────────────────────────────────────────────

async function runMigration(migration) {
  console.log(`\n📋  ${migration.label}`);
  console.log('    ' + '─'.repeat(62));

  const totalRemaining = await getCount(migration);

  if (totalRemaining === 0) {
    console.log(`    ✅  Nothing to migrate.`);
    return { updated: 0, skipped: 0 };
  }

  const effectiveLimit = BATCH_SIZE ?? null; // null → Hasura returns all
  const willProcess    = BATCH_SIZE
    ? Math.max(0, Math.min(BATCH_SIZE, totalRemaining - BATCH_OFFSET))
    : totalRemaining;

  console.log(`    Total remaining (full URLs) : ${totalRemaining}`);

  if (BATCH_SIZE) {
    console.log(`    Batch size                  : ${BATCH_SIZE}`);
    console.log(`    Offset                      : ${BATCH_OFFSET}`);
    console.log(`    Processing this run         : ${willProcess}`);

    const afterThisRun = totalRemaining - BATCH_OFFSET - willProcess;
    if (afterThisRun > 0) {
      console.log(`    Remaining after this run    : ${afterThisRun}`);
      console.log(`    ➡️   Next run: BATCH_OFFSET=${BATCH_OFFSET + BATCH_SIZE}`);
    } else {
      console.log(`    Remaining after this run    : 0  (this will be the last batch)`);
    }
  }

  if (willProcess <= 0) {
    console.log(`\n    ⚠️   Offset (${BATCH_OFFSET}) is at or beyond total (${totalRemaining}). Nothing to process.`);
    return { updated: 0, skipped: 0 };
  }

  const data = await gql(migration.fetchQuery, {
    limit: effectiveLimit,
    offset: BATCH_OFFSET,
  });
  const rows = data[Object.keys(data)[0]];

  if (!rows || rows.length === 0) {
    console.log(`    ✅  No rows returned for this batch.`);
    return { updated: 0, skipped: 0 };
  }

  console.log('');

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const fullUrl = row[migration.valueField];
    const key     = extractKey(fullUrl);

    if (!key) {
      console.warn(`    ⚠️   Could not parse key from: ${fullUrl}`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`    [DRY RUN]  ${row[migration.idField]}`);
      console.log(`       FROM: ${fullUrl}`);
      console.log(`         TO: ${key}`);
    } else {
      await gql(migration.updateMutation, {
        [migration.idField]:   row[migration.idField],
        [migration.updateField]: key,
      });
      console.log(`    ✏️   ${row[migration.idField]}  →  ${key}`);
    }

    updated++;
  }

  return { updated, skipped };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!HASURA_ENDPOINT || !HASURA_ADMIN_SECRET) {
    console.error('❌  Missing env vars: HASURA_URL and/or HASURA_ADMIN_SECRET');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(66));
  console.log('  URL → Storage Key Migration');
  console.log(`  Mode    : ${DRY_RUN ? '🔍  DRY RUN  (no DB changes written)' : '✏️   LIVE    (changes WILL be written)'}`);
  console.log(`  Batch   : ${BATCH_SIZE ? `${BATCH_SIZE} records  (offset: ${BATCH_OFFSET})` : 'ALL remaining records'}`);
  console.log('='.repeat(66));

  if (DRY_RUN) {
    console.log('\n  ⚠️   DRY RUN — set DRY_RUN=false to apply changes.\n');
  }

  const totals = { updated: 0, skipped: 0 };

  for (const migration of MIGRATIONS) {
    const result = await runMigration(migration);
    totals.updated += result.updated;
    totals.skipped += result.skipped;
  }

  console.log('\n' + '='.repeat(66));
  console.log(`  Records ${DRY_RUN ? 'to update' : 'updated'}  : ${totals.updated}`);
  if (totals.skipped > 0) {
    console.log(`  Skipped (bad URL)           : ${totals.skipped}`);
  }
  console.log(`\n  ${DRY_RUN ? '🔍  Dry run complete. No changes written.' : '✅  Batch complete.'}`);
  console.log('='.repeat(66) + '\n');
}

main().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});