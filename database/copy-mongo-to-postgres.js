/*
 * Migration utility to copy data from MongoDB to PostgreSQL
 *
 * To migrate the master files:
 *   node database/copy-mongo-to-postgres.js migrate-master
 *
 * To migrate the transactions:
 *   node database/copy-mongo-to-postgres.js migrate-tx -branchId=[(required) the-specific-branch-ID or all]
 *
 * NOTE: Records that had been copied to PostgreSQL will not be overwritten when re-running this script.
 */
const { MongoClient } = require('mongodb');
const { Connection } = require('postgresql-client');
const env = require('@next/env');
const { masterFileTableNames, transactionTableNames } = require('./db-schema')

env.loadEnvConfig(__dirname + '/../');

const MONGODB_URL = process.env.LOCAL_DB_URL;
const MONGODB_NAME = process.env.LOCAL_DB_NAME;

const PG_CON_OPTIONS = {
  host: process.env.MIGRATION_TARGET_DB_HOST,
  port: +(process.env.MIGRATION_TARGET_DB_PORT || '5432'),
  database: process.env.MIGRATION_TARGET_DB_NAME,
  user: process.env.MIGRATION_TARGET_DB_USER,
  password: process.env.MIGRATION_TARGET_DB_PASSWORD,
};
const BATCH_SIZE = 100;
const BATCH_PARALLEL_SIZE = 50;

const cliArgs = require('args-parser')(process.argv);

const cliCommands = {
  'migrate-master': async () => {
    return migrate(masterFileTableNames);
  },
  'migrate-tx': async () => {
    const mongoFilter = {};
    if (!cliArgs.branchId || typeof cliArgs.branchId !== 'string') {
      console.error('Argument "-branchId=[ID or all]" is required.')
      return;
    }
    if (cliArgs.branchId !== 'all') {
      mongoFilter.branchId = { $eq: cliArgs.branchId };
    }
    return migrate(transactionTableNames, mongoFilter);
  },
  'print-new-fields-in-mongo': async () => {
    printNewFieldsInMongo();
  }
}

const cliCmd = process.argv?.[2];
const handler = cliCommands[cliCmd];
if (handler) {
  handler();
} else {
  console.log('CLI commands:\n' + Object.keys(cliCommands).map(s => `  ${s}`).join('\n'));
}

/**
 * @param {string[]} tableNames
 * @param {Record<string, any> | null} mongoFilter
 * @returns {Promise<void>}
 */
async function migrate(tableNames, mongoFilter = null) {
    const mClient = await MongoClient.connect(MONGODB_URL);
    const mDb = await mClient.db(MONGODB_NAME);

    const collectionNamesFilter = [];
    if (cliArgs.tables && typeof cliArgs.tables === 'string') {
      collectionNamesFilter.push(...cliArgs.tables
        .split(',')
        .map(s => s.trim())
        .filter(s => !!s));
    }

    doMigrate: for (const tableName of tableNames) {
        if (collectionNamesFilter?.length && !collectionNamesFilter.includes(tableName))
            continue;

        console.log(`migrating ${tableName}`);
        const columnDef = await getColumnNames(tableName);
        const columns = columnDef.map(cd => cd.name);

        let processed = 0;
        const cursor = mDb.collection(tableName).find(mongoFilter ?? {});

        let batch = [];
        let promises = [];

        const asyncBatchInsert = async (batchData) => {
          const batchResult = await batchInsert(tableName, columns, batchData);
          processed += batchData.length;
          return batchResult;
        };

        const waitResult = async (promises) => {
          const result = await Promise.all(promises);
          const rowsInserted = result.filter(r => r !== false).reduce((total, count) => total + count, 0);
          return { rowsInserted, hasError: !!result.find(r => r === false) };
        };

        for await (const doc of cursor) {
            batch.push(columnDef.map((cd) => mapValue(cd, doc[cd.name])));

            if (batch.length >= BATCH_SIZE) {
                promises.push(asyncBatchInsert(batch));
                batch = [];
            }

            if (promises.length >= BATCH_PARALLEL_SIZE) {
                const { rowsInserted, hasError } = await waitResult(promises);
                promises = [];
                printMigratedRows(tableName, processed, rowsInserted);
                if (hasError) {
                  break doMigrate;
                }
            }
        }

        if (batch.length) {
            promises.push(asyncBatchInsert(batch));
        }

        let rowsInserted = 0;
        let hasError = false;
        if (promises.length) {
          const res = await waitResult(promises);
          rowsInserted = res.rowsInserted;
          hasError = res.hasError;
        }

        printMigratedRows(tableName, processed, rowsInserted);
        console.log('');
        if (hasError) {
          break;
        }
    }

    await mClient.close();
}

function printMigratedRows(tableName, processedRows, rowsInserted) {
    console.log(`${tableName}: total rows scanned = ${processedRows}, rows inserted in batch = ${rowsInserted}`);
}

/**
 * @param {string} tableName
 * @param {string[]} colNames
 * @param {any[]} batchParams
 * @returns {Promise<number|boolean>} If successful, returns the number of rows affected. Otherwise, returns false.
 */
async function batchInsert(tableName, colNames, batchParams) {
  const pgCon = new Connection(PG_CON_OPTIONS);
  await pgCon.connect();

  let paramCtr = 0;
  const valuesSql = batchParams.map(params => `(${params.map(() => `$${++paramCtr}`).join(', ')})`).join(',\n');

  // language=SQL format=false
  const sql = `
    insert into
      "${tableName}" (${colNames.map(name => `"${name}"`).join(', ')})
    values
      ${valuesSql}
    on conflict (_id) 
      do nothing
  `;

  try {
    const stm = await pgCon.prepare(sql);
    const result = await stm.execute({ params: batchParams.flat() });
    return result.rowsAffected;
  } catch (e) {
    console.error(batchParams.map(p => colNames.map((c, i) => [c, p[i]])).map(p => JSON.stringify(p)).join('\n'));
    console.error(e.message, e);
    return false;
  } finally {
    await pgCon.close();
  }
}

const dateInvalidValues = [
  '',
  'null',
  'undefined',
  'Invalid date',
];

/**
 * @type {[RegExp, string][]}
 */
const dateAutoCorrectionPattern = [
  [/(\d{4})-\s?.(\d{2}-\d{2})/, '$1-$2'],
  [/(\d{4}-\d)['\-](\d-\d{2})/, '$1$2'],
];

function mapValue({ name, dataType }, value) {
  if (name === '_id') {
    return value.toString();
  }
  if (dataType.match(/json/) || !!value && typeof value === 'object' || Array.isArray(value)) {
    return (value === null || value === undefined) ? null : JSON.stringify(value);
  }
  if (dataType.match(/numeric/)) {
    return isNaN(value) ? null : value || 0;
  }
  if (dataType.match(/boolean/)) {
    return value?.toString()?.toLowerCase() === 'true';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (dataType.match(/date|timestamp/)) {
    if (dateInvalidValues.includes(value)) {
      return null;
    }
    for (const [pattern, replacement] of dateAutoCorrectionPattern) {
      if (typeof value === 'string' && value.match(pattern)) {
        return value.replace(pattern, replacement);
      }
    }
  }
  return value;
}

/**
 * @param {string} collectionName
 * @returns {Promise<Map<string, { value: any, type: string }>>}
 */
async function getDistinctCollectionFields(collectionName) {
    const client = await MongoClient.connect(MONGODB_URL);
    const db = await client.db(MONGODB_NAME);
    const colNamesMap = new Map();
    const maxRows = 500_000; // just check the last records
    let ctr = 0;
    for await (const doc of db.collection(collectionName).find().sort({ dateAdded: -1 })) {
        const keys = Object.keys(doc);
        for (const key of keys) {
            if (!colNamesMap.has(key)) {
                colNamesMap.set(key, doc[key]);
            }
        }
        if (++ctr >= maxRows)
          break;
    }

    const fieldsMap = new Map();
    for (const [key, value] of colNamesMap.entries()) {
        fieldsMap.set(key, { value, type: (typeof value) });
    }

    await client.close();
    return fieldsMap;
}

/**
 * @param {string} table
 * @returns {Promise<{ name: string, dataType: string }[]>}
 */
async function getColumnNames(table) {
  const pgCon = new Connection(PG_CON_OPTIONS);

  try {
    await pgCon.connect();

    const sql = `
        select column_name, data_type
        from information_schema.columns
        where
            table_schema = 'public' and table_name = $1
    `;

    const stm = await pgCon.prepare(sql);
    const result = await stm.execute({ params: [table] });
    return result?.rows?.map(r => ({
      name: r[0],
      dataType: r[1]?.toLowerCase(),
    }));
  } catch (e) {
    console.error(e);
    throw e;
  } finally {
    await pgCon.close();
  }
}

/**
 * @param {string} collectionName
 * @returns {Promise<Map<string, {value: any, type: string}>>}
 */
async function getNewFieldsNotInRdbms(collectionName) {
  const fieldsMap = await getDistinctCollectionFields(collectionName);
  const tableColumns = await getColumnNames(collectionName)
    .then(cols => cols.map(c => c.name));

  for (const colName of tableColumns) {
    fieldsMap.delete(colName);
  }

  return fieldsMap;
}

async function printNewFieldsInMongo() {
  if (!cliArgs.tables || typeof cliArgs.tables !== 'string') {
    console.error('Argument "-tables=[table1,...]" is required.');
    return;
  }

  const tableNames = cliArgs.tables.split(',').map(s => s.trim()).filter(s => !!s);
  for (const tableName of tableNames) {
    const fieldsMap = await getNewFieldsNotInRdbms(tableName);
    console.log(tableName + ':');
    [...fieldsMap.keys()]
      .filter((key) => !key.startsWith("__"))
      .forEach((key) => {
        console.log({ key, ...fieldsMap.get(key) });
      });
  }
}