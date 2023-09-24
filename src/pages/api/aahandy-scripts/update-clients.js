import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: updateClients
});

async function updateClients(req, res) {
    const { db } = await connectToDatabase();
    let response;
    let statusCode = 200;

    const clients = await db.collection('client').find().toArray();

    clients.map(async client => {
        let temp = {...client};

        temp.firstName = temp.firstName ? temp.firstName.toUpperCase() : null;
        temp.middleName = temp.middleName ? temp.middleName.toUpperCase() : '';
        temp.lastName = temp.lastName ? temp.lastName.toUpperCase() : null;
        temp.fullName = temp.firstName + ' ' + temp.middleName + ' ' + temp.lastName;
        if (!temp.hasOwnProperty('address') && !temp.address) {
            temp.address = temp.addressStreetNo + ' ' + temp.addressBarangayDistrict + ' ' + temp.addressMunicipalityCity + ' ' + temp.addressProvince + ' ' + temp.addressZipCode;
        }

        delete temp._id;
        await db.collection('client').updateOne({ _id: client._id }, {$set: {...temp}});
    });

    response = { success: true };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}