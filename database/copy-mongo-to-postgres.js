const { MongoClient } = require('mongodb');
const { Pool } = require('postgresql-client');
const env = require('@next/env');

env.loadEnvConfig('../');

const MIGRATION_KEY = '__migrated';
const MIGRATION_ID = 0;
const MONGODB_URL = process.env.LOCAL_DB_URL;
const MONGODB_NAME = process.env.LOCAL_DB_NAME;
const PG_URL = process.env.HASURA_DB_URL;
const BATCH_SIZE = 100;

// run migration
migrate(['areas', 'regions']);
// showDistinctColumnNames('regions');

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


    const collectionNames = [
        'badDebtCollections',
        'branches',
        'cashCollections',
        'client',
        'groups',
        'holidays',
        'loans',
        'losTotals',
        'roles',
        'rolesPermissions',
        'settings',
        'transactionSettings',
        'transferClients',
        'users',
        'areas',
        'regions',
        'divisions'
    ];

    doMigrate: for (const tableName of collectionNames) {
        if (collectionNamesFilter.length && !collectionNamesFilter.includes(tableName))
            continue;

        console.log(`migrating ${tableName}`);
        let migrated = 0;
        const cursor = mDb.collection(tableName).find({[MIGRATION_KEY]: {$ne: MIGRATION_ID}});
        let promises = [];

        for await (const doc of cursor) {
            const keys = Object.keys(doc).filter(removeKeysNotForMigration);
            const params = keys
                .map((k) => ({key: k, value: mapValue(k, doc[k])}))
                .filter(p => !!p.value);

            if (params.length === 1 && params[0].key === '_id')
                continue;

            promises.push(migrateDoc(tableName, doc, params, mDb, pgPool));
            if (promises.length >= BATCH_SIZE) {
                const successCount = (await Promise.all(promises)).filter(r => !!r).length;
                migrated += successCount;
                if (successCount < promises.length) {
                    break doMigrate;
                }
                promises = [];
                if (global.gc) {
                    global.gc();
                }
                printMemUsage(tableName, migrated);
            }
        }

        if (promises.length) {
            const successCount = (await Promise.all(promises)).filter(r => !!r).length;
            migrated += successCount;
            if (successCount < promises.length) {
                break;
            }
            promises = null;
            if (global.gc) {
                global.gc();
            }
        }

        printMemUsage(tableName, migrated);
    }

    await mClient.close();
    await pgPool.close();
}

function printMemUsage(tableName, migratedRows) {
    const formatMemoryUsage = (data) => `${Math.round(data / 1024 / 1024 * 100) / 100} MB`;
    const memoryData = process.memoryUsage();
    console.log(
        `${tableName}: migrated = ${migratedRows}`,
        `| RSS = ${formatMemoryUsage(memoryData.rss)}`,
        `| Heap = ${formatMemoryUsage(memoryData.heapTotal)}`,
    );
}

async function migrateDoc(tableName, doc, params, mongoDb, pgPool) {
    const pgCon = await pgPool.acquire();

    const sql = `
              insert into
                "${tableName}" (${params.map((p) => `"${p.key}"`).join(', ')})
              values
                (${params.map((_, i) => `$${i + 1}`).join(', ')}) 
              on conflict (_id) do update
               set ${params.filter(p => p.key !== '_id').map(p => `"${p.key}" = EXCLUDED."${p.key}"`).join(', ')}
            `;
    try {
        const stm = await pgCon.prepare(sql);
        await stm.execute({ params: params.map(p => p.value) });
        await mongoDb.collection(tableName).updateOne({_id: doc._id},{$set:{[MIGRATION_KEY]: MIGRATION_ID}});
        return true;
    } catch (e) {
        console.error(JSON.stringify(params, null, 2));
        console.error(e.message, e);
        return false;
    } finally {
        await pgCon.close();
    }
}

function removeKeysNotForMigration(k) {
    return !k.startsWith('__') && k !== 'deisgnatedBranchId';
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

async function asyncTimeout(millis) {
    return new Promise(resolve => setTimeout(resolve, millis));
}