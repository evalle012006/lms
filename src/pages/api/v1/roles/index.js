import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import formidable from "formidable";
import fs from "fs";

export default apiHandler({
    get: getRole,
    post: updateRole
});

async function getRole(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { id } = req.query;
    let statusCode = 200;
    let response = {};
    const role = await db.collection('roles')
        .aggregate([
            { $match: { _id: new ObjectId(id) } },
            {
                $lookup: {
                    from: "rolesPermissions",
                    localField: "rep",
                    foreignField: "role",
                    as: "rolesPermissions"
                }
            }
        ])
        .toArray();

    response = { success: true, role: role[0] };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateRole(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};

    const role = req.body;
    const roleId = role._id;
    delete role._id;

    const roleResp = await db
        .collection('roles')
        .updateOne(
            { _id: new ObjectId(roleId) }, 
            {
                $set: { ...role }
            }, 
            { upsert: false });

    response = { success: true, role: roleResp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}