import { apiHandler } from '@/services/api-handler';
import formidable from "formidable";

import { USER_FIELDS } from '@/lib/graph.fields';
import { findAreas, findDivisions, findRegions } from '@/lib/graph.functions';
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl, updateQl } from "@/lib/graph/graph.util";

const graph = new GraphProvider();
const USER_TYPE = createGraphType('users', `
${USER_FIELDS}
`)('users');

export default apiHandler({
    get: getUser,
    post: updateUser
});

async function getUser(req, res) {
    const { _id } = req.query;
    let statusCode = 200;
    let response = {};
    const user = await findUserByID(_id)

    response = { success: true, user: user };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateUser(req, res) {
    let statusCode = 200;
    let response = { upload: true, success: false };

    const form = new formidable.IncomingForm({ keepExtensions: true });
    const promise = await new Promise((resolve, reject) => {
        form.parse(req, async function (err, payload, files) {
            try {
                const userData = await findUserByEmail(payload.email);

                let file = payload.profile;

                if (err) {
                    resolve({ formError: true });
                    return;
                }

                const profile = file || userData.profile;
                const userRole = JSON.parse(payload.role);

                let forUpdate = {
                    firstName: payload.firstName,
                    lastName: payload.lastName,
                    number: payload.number,
                    position: payload.position,
                    profile: profile === 'null' ? null : profile,
                    loNo: +payload.loNo,
                    areaId: payload.areaId,
                    divisionId: payload.divisionId,
                    regionId: payload.regionId,
                    designatedBranch: payload.designatedBranch,
                    transactionType: payload.transactionType
                };

                if (userRole.rep === 3 || userRole.rep === 4) {
                    if (payload.branchManagerName) {
                        forUpdate.branchManagerName = payload.branchManagerName;
                    }
                    
                    forUpdate.designatedBranch = (payload.designatedBranch && typeof payload.designatedBranch !== "string") ? 
                        JSON.parse(payload.designatedBranch) : payload.designatedBranch;
                    
                    forUpdate.designatedBranchId = (payload.designatedBranchId && typeof payload.designatedBranchId !== "string") ? 
                        JSON.parse(payload.designatedBranchId) : payload.designatedBranchId;

                } else if (userRole.rep === 2) {
                    if (userRole.shortCode === 'deputy_director' && forUpdate.divisionId !== userData.divisionId) {
                        const [prev] = await findDivisions({ _id: { _eq: userData.divisionId } }, '_id managerIds');
                        const [current] = await findDivisions({ _id: { _eq: forUpdate.divisionId } }, '_id managerIds');

                        const prevManagerIds = JSON.parse(prev.managerIds ?? '[]')?.filter(id => id != userData._id) ?? [];
                        const currentManagerIds = JSON.parse(current.managerIds ?? '[]') ?? [];

                        currentManagerIds.push(userData._id);

                        const createUpdateQl = (managerIds, _id, alias) => updateQl(createGraphType('divisions', `_id`)(alias), { 
                                set: {
                                    managerIds
                                },
                                where: {
                                    _id: { _eq: _id }
                                }
                            });
                        
                        await graph.mutation(
                            createUpdateQl(prevManagerIds, userData.divisionId, 'prevDivision'),
                            createUpdateQl(currentManagerIds, forUpdate.divisionId, 'currentDivision'),
                        );
                        
                    } else if (userRole.shortCode === 'regional_manager' && userData.regionId != payload.regionId) {
                        const [prev] = await findRegions({ _id: { _eq: userData.regionId } }, '_id managerIds');
                        const [current] = await findRegions({ _id: { _eq: forUpdate.regionId } }, '_id managerIds');

                        const prevManagerIds = JSON.parse(prev.managerIds ?? '[]')?.filter(id => id != userData._id) ?? [];
                        const currentManagerIds = JSON.parse(current.managerIds ?? '[]') ?? [];

                        currentManagerIds.push(userData._id);

                        const createUpdateQl = (managerIds, _id, alias) => updateQl(createGraphType('regions', `_id`)(alias), { 
                                set: {
                                    managerIds: JSON.stringify(managerIds),
                                },
                                where: {
                                    _id: { _eq: _id }
                                }
                            });
                        
                        await graph.mutation(
                            createUpdateQl(prevManagerIds, userData.regionId, 'prevRegion'),
                            createUpdateQl(currentManagerIds, forUpdate.regionId, 'currentRegion'),
                        );

                    } else if (userRole.shortCode === 'area_admin' && forUpdate.areaId != userData.areaId) {
                        const [prev] = await findAreas({ _id: { _eq: userData.areaId } }, '_id managerIds');
                        const [current] = await findAreas({ _id: { _eq: forUpdate.areaId } }, '_id managerIds');

                        const prevManagerIds = JSON.parse(prev.managerIds ?? '[]')?.filter(id => id != userData._id) ?? [];
                        const currentManagerIds = JSON.parse(current.managerIds ?? '[]') ?? [];

                        currentManagerIds.push(userData._id);

                        const createUpdateQl = (managerIds, _id, alias) => updateQl(createGraphType('areas', `_id`)(alias), { 
                                set: {
                                   managerIds: JSON.stringify(managerIds),
                                },
                                where: {
                                    _id: { _eq: _id }
                                }
                            });
                        
                        await graph.mutation(
                            createUpdateQl(prevManagerIds, userData.areaId, 'prevarea'),
                            createUpdateQl(currentManagerIds, forUpdate.areaId, 'currarea'),
                        );
                    }
                }

                const resp = await graph.mutation(
                    updateQl(USER_TYPE, {
                        set: forUpdate,
                        where: {
                            email: { _eq: payload.email }
                        }
                    })
                );

                console.log(resp);
                if(resp.errors) {
                    reject(resp.errors);
                    return;
                }

                // userData.profile = file ? file : userData.profile;
                delete userData._id;
                delete userData.password;
                resolve({ success: true, user: userData });
            } catch (error) {
                console.error('Error updating user:', error);
                reject(error);
            }
        });
    });

    response = { ...response, success: true, ...promise };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

const findUserByID = async (id) => {
    const [user] = await graph.query(
        queryQl(USER_TYPE, {
            where: {
                _id: { _eq: id }
            }
        })
    ).then(res => res.data.users);
    
    return user;
}

const findUserByEmail = async (email) => {
    const [user] = await graph.query(
        queryQl(USER_TYPE, {
            where: {
                email: { _eq: email }
            }
        })
    ).then(res => res.data.users);
    
    return user;
}

export const config = {
    api: {
        bodyParser: false,
    },
}