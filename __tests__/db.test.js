const { MongoClient } = require('mongodb');

describe('Mongo DB Connection', () => {
    const MONGO_URL = "mongodb+srv://hybridag-castledevs:s2es6wD6K7npuLPQ@castle-digital-cluster.gxuu3an.mongodb.net/?retryWrites=true&w=majority";
    const MONGO_DB = "hybridStagingDB";

    let connection;
    let db;

    const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true
    };

    beforeAll(async () => {
        connection = await MongoClient.connect(MONGO_URL, options);
        db = await connection.db(MONGO_DB);
    });

    afterAll(async () => {
        await connection.close();
    });

    const objectID = require('mongodb').ObjectId();

    it('should insert a document into a collection', async () => {
        const settings = db.collection('settings');

        // this is a manual mocking, no configuration is used. 
        const mockSettings = {
            _id: objectID.toString(),
            name: 'Mock Setting',
            value: true
        };
        await settings.insertOne(mockSettings);
        const insertedSetting = await settings.findOne({ _id: objectID.toString() });
        expect(insertedSetting).toEqual(mockSettings);
    });

    it('should update a documention from a collection', async () => {
        const settings = db.collection('settings');

        await settings.updateOne({
            _id: objectID.toString()
        }, {
            $set: {
                name: 'Updated Mock Setting',
            }
        });
        const updatedSettings = await settings.findOne({ _id: objectID.toString() });
        expect(updatedSettings.name).toEqual('Updated Mock Setting');
    });

    it('should return null for a deleted document', async () => {
        const settings = db.collection('settings');
        await settings.deleteOne({ _id: objectID.toString() });
        const nullSettings = await settings.findOne({ _id: objectID.toString() });
        expect(nullSettings).toEqual(null);
    });
});