// src/pages/api/v2/clients/duplicates/compare.js
// GET ?clusterId=...  — side-by-side profile details of the records in ONE duplicate group.
// Same audience as the list. The group must touch the caller's branches; all of its records are then shown (records of
// other branches are flagged inScope:false). The ids come from the stored group, never from the caller, so this cannot
// be used to read an arbitrary client. Biometric data is never returned and the government ID number is
// masked to its last 4 characters.

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { findUserById } from '@/lib/graph.functions';
import { resolveDuplicateScope } from '@/lib/duplicate-scope';
import { maskId } from '@/lib/mask-id';

const graph = new GraphProvider();

const CLUSTER_TYPE = createGraphType('duplicate_client_clusters', `_id view confidence members status`)('clusters');
const CLIENT_TYPE = createGraphType('client', `
  _id firstName middleName lastName birthdate contactNumber
  address addressStreetNo addressBarangayDistrict addressMunicipalityCity addressProvince addressZipCode landmark
  civilStatus yearsOfStay business governmentIdType governmentIdNumber
  profile status delinquent branchId branchName groupId groupName loId oldLoId dateAdded dateModified insertedBy ciName
`)('people');
const USER_TYPE = createGraphType('users', `_id firstName lastName`)('people');

export default apiHandler({ get: compare });

async function compare(req, res) {
    const user = await findUserById(req.auth.sub);
    const access = await resolveDuplicateScope(user);
    if (!access.level) return res.status(200).json({ success: false, message: 'Insufficient permissions.' });

    const clusterId = String(req.query.clusterId ?? '');
    if (!clusterId) return res.status(200).json({ success: false, message: 'clusterId is required.' });

    const cluster = await graph.query(queryQl(CLUSTER_TYPE, { where: { _id: { _eq: clusterId } }, limit: 1 }))
        .then(r => r.data?.clusters?.[0]);
    if (!cluster) return res.status(200).json({ success: false, message: 'Group not found (it may have been resolved by a newer scan).' });

    const scope = access.branchIds ? new Set(access.branchIds) : null;
    const allMembers = cluster.members ?? [];
    const inScope = (m) => !scope || scope.has(m.branchId);
    if (!allMembers.some(inScope)) return res.status(200).json({ success: false, message: 'Group not found.' });

    const ids = [...new Set(allMembers.map(m => m._id))];
    const clients = await graph.query(queryQl(CLIENT_TYPE, { where: { _id: { _in: ids } } }))
        .then(r => r.data?.people ?? []);

    const insertedBy = [...new Set(clients.map(c => c.insertedBy).filter(Boolean))];
    const users = insertedBy.length
        ? await graph.query(queryQl(USER_TYPE, { where: { _id: { _in: insertedBy } } })).then(r => r.data?.people ?? []).catch(() => [])
        : [];
    const userName = Object.fromEntries(users.map(u => [u._id, `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()]));
    const byId = Object.fromEntries(clients.map(c => [c._id, c]));

    const people = allMembers.map(m => {
        const c = byId[m._id] ?? {};
        return {
            _id: m._id,
            inScope: inScope(m),
            profile: c.profile ?? null,
            firstName: c.firstName ?? m.firstName ?? null,
            middleName: c.middleName ?? m.middleName ?? null,
            lastName: c.lastName ?? m.lastName ?? null,
            birthdate: c.birthdate ?? m.birthdate ?? null,
            contactNumber: c.contactNumber ?? m.contactNumber ?? null,
            civilStatus: c.civilStatus ?? null,
            yearsOfStay: c.yearsOfStay ?? null,
            business: c.business ?? null,
            governmentIdType: c.governmentIdType ?? null,
            governmentIdNumber: maskId(c.governmentIdNumber),
            addressStreet: c.addressStreetNo ?? null,
            addressBarangay: c.addressBarangayDistrict ?? null,
            addressCity: c.addressMunicipalityCity ?? null,
            addressProvince: c.addressProvince ?? null,
            addressZip: c.addressZipCode ?? null,
            address: c.address ?? m.address ?? null,
            landmark: c.landmark ?? null,
            branch: c.branchName ?? m.branchName ?? null,
            loanOfficer: m.loName ?? null,
            group: c.groupName ?? m.groupName ?? null,
            status: c.status ?? m.status ?? null,
            delinquent: !!(c.delinquent ?? m.delinquent),
            loanCount: m.loanCount ?? null,
            activeLoan: m.activeLoan ? { loanCycle: m.activeLoan.loanCycle, loanBalance: m.activeLoan.loanBalance, slotNo: m.activeLoan.slotNo ?? null } : null,
            dateAdded: c.dateAdded ?? m.dateAdded ?? null,
            dateModified: c.dateModified ?? null,
            addedBy: userName[c.insertedBy] ?? null,
            ciName: c.ciName ?? null,
        };
    });

    return res.status(200).json({
        success: true,
        clusterId,
        confidence: cluster.confidence,
        people,
    });
}
