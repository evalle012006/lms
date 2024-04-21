const { MongoClient, ObjectId } = require('mongodb');
const { Pool } = require('postgresql-client');
const env = require('@next/env');
const { tableNames } = require('./db-schema')

env.loadEnvConfig('../');

const MIGRATION_KEY = '__migrated';
const MIGRATION_ID = 2;
const MONGODB_URL = process.env.LOCAL_DB_URL;
const MONGODB_NAME = process.env.LOCAL_DB_NAME;
const PG_URL = process.env.HASURA_DB_URL;
const BATCH_SIZE = 500;

// run migration
migrate(['losTotals']);
// showDistinctColumnNames('losTotals');

async function migrate(collectionNamesFilter = []) {
    const mClient = await MongoClient.connect(MONGODB_URL);
    const mDb = await mClient.db(MONGODB_NAME);

    const pgPool = new Pool({
        host: PG_URL,
        pool: {
            min: 3,
            max: 3
        }
    });

    doMigrate: for (const tableName of tableNames) {
        const columns = await getColumnNames(tableName, pgPool);

        if (collectionNamesFilter.length && !collectionNamesFilter.includes(tableName))
            continue;

        console.log(`migrating ${tableName}`);
        let migrated = 0;
        const cursor = mDb.collection(tableName).find({[MIGRATION_KEY]: {$ne: MIGRATION_ID}});
        let batch = [];

        for await (const doc of cursor) {
            batch.push(columns.map((k) => mapValue(k, doc[k])));

            if (batch.length >= BATCH_SIZE) {
                const success = await batchInsert(tableName, columns, batch, mDb, pgPool);
                migrated += batch.length;
                if (!success) {
                    break doMigrate;
                }
                batch = [];
                printMigratedRows(tableName, migrated);
            }
        }

        if (batch.length) {
            const success = await batchInsert(tableName, columns, batch, mDb, pgPool);
            migrated += batch.length;
            if (!success) {
              break;
            }
        }

        printMigratedRows(tableName, migrated);
    }

    await mClient.close();
    await pgPool.close();
}

function printMigratedRows(tableName, migratedRows) {
    console.log(`${tableName}: migrated = ${migratedRows}`);
}

async function batchInsert(tableName, colNames, batchParams, mongoDb, pgPool) {
  const pgCon = await pgPool.acquire();

  let paramCtr = 0;
  const valuesSql = batchParams.map(params => `(${params.map(() => `$${++paramCtr}`).join(', ')})`).join(',\n');

  // language=SQL format=false
  const sql = `
    insert into
      "${tableName}" (${colNames.map(name => `"${name}"`).join(', ')})
    values
      ${valuesSql}
    on conflict (_id) 
      do update set ${colNames
             .filter(name => name !== '_id')
             .map(name => `"${name}" = EXCLUDED."${name}"`).join(', ')}
  `;

  try {
    const stm = await pgCon.prepare(sql);
    await stm.execute({ params: batchParams.flat() });

    const mongIds = batchParams.map(p => new ObjectId(p[0]));
    await mongoDb.collection(tableName).updateMany(
      {_id: { $in: mongIds }},
      {$set:{[MIGRATION_KEY]: MIGRATION_ID}}
    );
    return true;
  } catch (e) {
    console.error(JSON.stringify(params, null, 2));
    console.error(e.message, e);
    return false;
  } finally {
    await pgCon.close();
  }
}

const corrections = {
    'null': null,
    'undefined': null,
    'Invalid date': null,
};

const replacementPatterns = [
    [/(\d{4})-\s?.(\d{2}-\d{2})/, '$1-$2'],
    [/(\d{4}-\d)['\-](\d-\d{2})/, '$1$2'],
];

function mapValue(key, value) {
    if (key === '_id') {
        return value.toString();
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (!!value && typeof value === 'object' || Array.isArray(value)) {
        return JSON.stringify(value);
    }
    if (value in corrections) {
        return corrections[value];
    }
    if (key.match(/^(mcbu|noOfPayments|activeLoan|amountRelease|loanBalance)$/)) {
        return isNaN(value) ? null : value || 0;
    }
    for (const [pattern, replacement] of replacementPatterns) {
        if (typeof value === 'string' && value.match(pattern)) {
            return value.replace(pattern, replacement);
        }
    }
    return value;
}

// noinspection JSUnusedLocalSymbols
async function showDistinctColumnNames(collectionName) {
    const client = await MongoClient.connect(MONGODB_URL);
    const db = await client.db(MONGODB_NAME);
    const colNamesMap = new Map();

    for await (const doc of db.collection(collectionName).find()) {
        const keys = Object.keys(doc);
        for (const key of keys) {
            if (!colNamesMap.has(key)) {
                colNamesMap.set(key, doc[key]);
            }
        }
    }

    for (const [key, value] of colNamesMap.entries()) {
        console.log(JSON.stringify({key, value, type: (typeof value)}));
    }

    await client.close();
}

async function getColumnNames(table, pgPool) {
  const pgCon = await pgPool.acquire();
  try {
    const sql = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = $1
    `;
    const stm = await pgCon.prepare(sql)
    const result = await stm.execute({ params: [table] });
    return result?.rows?.map(r => r[0]);
  } finally {
    await pgCon.close();
  }
}