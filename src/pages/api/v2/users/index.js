import { apiHandler } from '@/services/api-handler';
import formidable from "formidable";

import { USER_FIELDS } from '@/lib/graph.fields';
import { findAreas, findDivisions, findRegions } from '@/lib/graph.functions';
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl, updateQl, insertQl } from "@/lib/graph/graph.util";

const graph = new GraphProvider();
const USER_TYPE = createGraphType('users', `
${USER_FIELDS}
`)('users');

const LOG_TYPE = createGraphType('user_activity_logs', `
id user_id action field old_value new_value created_at
`);

const WATCHED_FIELDS = [
    'firstName', 'lastName', 'areaId', 'regionId', 'divisionId',
    'designatedBranch', 'designatedBranchId', 'transactionType'
];

async function writeChangeLogs(userId, oldData, newData) {
    try {
        const logs = WATCHED_FIELDS
            .filter(f => String(oldData[f] ?? '') !== String(newData[f] ?? ''))
            .map(f => ({
                user_id: userId,
                action: 'update',
                field: f,
                old_value: String(oldData[f] ?? ''),
                new_value: String(newData[f] ?? '')
            }));

        if (logs.length === 0) return;

        await graph.mutation(
            insertQl(LOG_TYPE('log_update'), { objects: logs })
        );
    } catch (err) {
        console.error('Failed to write activity logs:', err);
    }
}

// ── ADDED: sanitizes any value that should be a real NULL in the DB ──────────
// Catches: actual null, undefined, the string "null", the string "undefined",
// and empty string.
const nullify = (val) => {
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    if (str === '' || str === 'null' || str === 'undefined') return null;
    return val;
};

// ── ADDED: enforces correct hierarchy fields per role on update ──────────────
// Mirrors the same logic in save.js so both paths are consistent.
const buildHierarchyFields = (userRole, payload) => {
    const shortCode = userRole.shortCode;
    const rep = userRole.rep;

    // admin / root — everything null
    if (rep === 1) {
        return {
            areaId: null,
            regionId: null,
            divisionId: null,
            designatedBranchId: null,
            designatedBranch: null,
        };
    }

    // deputy_director — only divisionId
    if (shortCode === 'deputy_director') {
        return {
            areaId: null,
            regionId: null,
            divisionId: nullify(payload.divisionId),
            designatedBranchId: null,
            designatedBranch: null,
        };
    }

    // regional_manager — divisionId + regionId
    if (shortCode === 'regional_manager') {
        return {
            areaId: null,
            regionId: nullify(payload.regionId),
            divisionId: nullify(payload.divisionId),
            designatedBranchId: null,
            designatedBranch: null,
        };
    }

    // area_admin — areaId + regionId + divisionId, designatedBranch allowed (multi-branch)
    if (shortCode === 'area_admin') {
        return {
            areaId: nullify(payload.areaId),
            regionId: nullify(payload.regionId),
            divisionId: nullify(payload.divisionId),
            designatedBranchId: null,
            designatedBranch: (payload.designatedBranch && typeof payload.designatedBranch !== 'string')
                ? JSON.parse(payload.designatedBranch)
                : (nullify(payload.designatedBranch) ?? '[]'),
        };
    }

    // branch_manager (rep 3) and loan_officer (rep 4) — full hierarchy
    if (rep === 3 || rep === 4) {
        return {
            areaId: nullify(payload.areaId),
            regionId: nullify(payload.regionId),
            divisionId: nullify(payload.divisionId),
            designatedBranchId: nullify(payload.designatedBranchId),
            designatedBranch: (payload.designatedBranch && typeof payload.designatedBranch !== 'string')
                ? JSON.parse(payload.designatedBranch)
                : (nullify(payload.designatedBranch) ?? null),
        };
    }

    // fallback — null everything
    return {
        areaId: null,
        regionId: null,
        divisionId: null,
        designatedBranchId: null,
        designatedBranch: null,
    };
};
// ────────────────────────────────────────────────────────────────────────────

export default apiHandler({
    get: getUser,
    post: updateUser
});

async function getUser(req, res) {
    const { _id } = req.query;
    let statusCode = 200;
    let response = {};
    const user = await findUserByID(_id);
    response = { success: true, user };
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

                // ── CHANGED: use buildHierarchyFields for sanitized, role-correct values ──
                const hierarchyFields = buildHierarchyFields(userRole, payload);

                let forUpdate = {
                    firstName: payload.firstName,
                    lastName: payload.lastName,
                    number: payload.number,
                    position: payload.position,
                    profile: profile === 'null' ? null : profile,
                    loNo: payload.loNo && payload.loNo !== 'null' ? +payload.loNo : null,
                    transactionType: payload.transactionType,
                    // ── CHANGED: spread sanitized hierarchy fields ──
                    ...hierarchyFields,
                };

                if (userRole.rep === 3 || userRole.rep === 4) {
                    if (payload.branchManagerName) {
                        forUpdate.branchManagerName = payload.branchManagerName;
                    }
                    // designatedBranch already set by buildHierarchyFields above,
                    // but designatedBranchId needs the object extraction for rep 3/4:
                    forUpdate.designatedBranchId = (payload.designatedBranchId && typeof payload.designatedBranchId !== 'string')
                        ? JSON.parse(payload.designatedBranchId)
                        : nullify(payload.designatedBranchId);

                } else if (userRole.rep === 2) {
                    // ── manager linking: same as before but now using nullify-safe values ──
                    if (userRole.shortCode === 'deputy_director' && forUpdate.divisionId !== userData.divisionId) {
                        const [prev] = await findDivisions({ _id: { _eq: userData.divisionId } }, '_id managerIds');
                        const [current] = await findDivisions({ _id: { _eq: forUpdate.divisionId } }, '_id managerIds');
                        const prevManagerIds = JSON.parse(prev.managerIds ?? '[]')?.filter(id => id != userData._id) ?? [];
                        const currentManagerIds = JSON.parse(current.managerIds ?? '[]') ?? [];
                        currentManagerIds.push(userData._id);
                        const createUpdateQl = (managerIds, _id, alias) => updateQl(createGraphType('divisions', `_id`)(alias), {
                            set: { managerIds },
                            where: { _id: { _eq: _id } }
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
                            set: { managerIds: JSON.stringify(managerIds) },
                            where: { _id: { _eq: _id } }
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
                            set: { managerIds: JSON.stringify(managerIds) },
                            where: { _id: { _eq: _id } }
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
                        where: { email: { _eq: payload.email } }
                    })
                );

                if (resp.errors) {
                    reject(resp.errors);
                    return;
                }

                if (!payload._skipLog) {
                    await writeChangeLogs(userData._id, userData, forUpdate);
                }

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
        queryQl(USER_TYPE, { where: { _id: { _eq: id } } })
    ).then(res => res.data.users);
    return user;
};

const findUserByEmail = async (email) => {
    const [user] = await graph.query(
        queryQl(USER_TYPE, { where: { email: { _eq: email } } })
    ).then(res => res.data.users);
    return user;
};

export const config = {
    api: { bodyParser: false }
};