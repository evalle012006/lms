import { apiHandler } from '@/services/api-handler';
import formidable from "formidable";
import fs from "fs";

import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl, updateQl } from "@/lib/graph/graph.util";
import { USER_FIELDS, AREA_FIELDS, REGION_FIELDS, DIVISION_FIELDS } from '@/lib/graph.fields';
import logger from '@/logger';

const graph = new GraphProvider();
const USER_TYPE = createGraphType('users', `
${USER_FIELDS}
`)('users');

const AREA_TYPE = createGraphType('areas', `
${AREA_FIELDS}
`);

const REGION_TYPE = createGraphType('regions', `
${REGION_FIELDS}
`);

const DIVISION_TYPE = createGraphType('divisions', `
${DIVISION_FIELDS}
`);

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
                    
                    // Get branch details to populate hierarchy IDs
                    const branchesResponse = await graph.query(
                        queryQl(createGraphType('branches', `_id areaId regionId divisionId`)('branches'), {
                            where: {
                                _id: { _eq: forUpdate.designatedBranchId }
                            }
                        })
                    );
                    
                    const branches = branchesResponse?.data?.branches || [];
                    
                    if (branches.length > 0) {
                        const branch = branches[0];
                        forUpdate.areaId = branch.areaId;
                        forUpdate.regionId = branch.regionId;
                        forUpdate.divisionId = branch.divisionId;
                    }
                } else if (userRole.rep === 2) {
                    if (userRole.shortCode === 'deputy_director') {
                        // Get all divisions and filter in JavaScript
                        const divisionsResponse = await graph.query(
                            queryQl(createGraphType('divisions', `_id managerIds`)('divisions'), {})
                        );
                        
                        const divisions = divisionsResponse?.data?.divisions || [];
                        
                        // Find division where user is in managerIds array
                        for (const division of divisions) {
                            const managerIds = Array.isArray(division.managerIds) ? 
                                division.managerIds : 
                                (typeof division.managerIds === 'string' ? 
                                    JSON.parse(division.managerIds) : []);
                                    
                            if (managerIds.includes(userData._id)) {
                                forUpdate.divisionId = division._id;
                                break;
                            }
                        }
                    } else if (userRole.shortCode === 'regional_manager') {
                        // Get all regions and filter in JavaScript
                        const regionsResponse = await graph.query(
                            queryQl(createGraphType('regions', `_id managerIds divisionId`)('regions'), {})
                        );
                        
                        const regions = regionsResponse?.data?.regions || [];
                        
                        // Find region where user is in managerIds array
                        for (const region of regions) {
                            const managerIds = Array.isArray(region.managerIds) ? 
                                region.managerIds : 
                                (typeof region.managerIds === 'string' ? 
                                    JSON.parse(region.managerIds) : []);
                                    
                            if (managerIds.includes(userData._id)) {
                                forUpdate.regionId = region._id;
                                forUpdate.divisionId = region.divisionId;
                                break;
                            }
                        }
                    } else if (userRole.shortCode === 'area_admin') {
                        // Get all areas and filter in JavaScript
                        const areasResponse = await graph.query(
                            queryQl(createGraphType('areas', `_id managerIds regionId divisionId`)('areas'), {})
                        );
                        
                        const areas = areasResponse?.data?.areas || [];
                        
                        // Find area where user is in managerIds array
                        for (const area of areas) {
                            const managerIds = Array.isArray(area.managerIds) ? 
                                area.managerIds : 
                                (typeof area.managerIds === 'string' ? 
                                    JSON.parse(area.managerIds) : []);
                                    
                            if (managerIds.includes(userData._id)) {
                                forUpdate.areaId = area._id;
                                forUpdate.regionId = area.regionId;
                                forUpdate.divisionId = area.divisionId;
                                break;
                            }
                        }
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