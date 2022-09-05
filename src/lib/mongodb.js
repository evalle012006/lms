import { MongoClient } from "mongodb";

let MONGO_DB = '';
let MONGO_URL = '';

if (process.env.NODE_ENV == 'development') {
    MONGO_DB = process.env.LOCAL_DB_NAME;
    MONGO_URL = process.env.LOCAL_DB_URL;
} else {
    MONGO_DB = process.env.DB_NAME;
    MONGO_URL = process.env.DB_URL;
}


if (!MONGO_DB) {
    throw new Error('Define Mongo DB environment variable');
}

if (!MONGO_URL) {
    throw new Error('Define Mongo URL environment variable');
}

let cachedClient = null;
let cachedDB = null;

export async function connectToDatabase() {
    if (cachedClient && cachedDB) {
        return {
            client: cachedClient,
            db: cachedDB
        };
    }

    const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true
    };

    let client = new MongoClient(MONGO_URL, options);
    await client.connect();
    let db = client.db(MONGO_DB);

    // set cache
    cachedClient = client;
    cachedDB = db;

    return {
        client: cachedClient,
        db: cachedDB
    };
}