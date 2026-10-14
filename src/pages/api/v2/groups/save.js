import { GROUP_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import { apiHandler } from '@/services/api-handler';
import { findUserById } from '@/lib/graph.functions';
import { canManageGroups } from '@/lib/group-permissions';
import moment from 'moment';


const graph = new GraphProvider();
const GROUP_TYPE = createGraphType('groups', `
${GROUP_FIELDS}
branch {
    name
}
`)('groups');

export default apiHandler({
    post: save
});

async function save(req, res) {
    // Only an admin (rep 1) / root can add groups.
    const user = await findUserById(req.auth?.sub);
    if (!canManageGroups(user)) {
        return res.status(200)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify({ success: false, error: true, message: 'Only an administrator can add groups.' }));
    }

    const groupData = req.body;

    // The loan officer must be an LO (rep 4) assigned to the selected branch.
    const officer = groupData.loanOfficerId ? await findUserById(groupData.loanOfficerId) : null;
    if (!officer || officer.role?.rep !== 4 || officer.designatedBranchId !== groupData.branchId) {
        return res.status(200)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify({ success: false, error: true, message: 'The selected loan officer does not belong to the selected branch.' }));
    }
    groupData.loanOfficerName = `${officer.firstName} ${officer.lastName}`;

    const [group] = await graph.query(
        queryQl(GROUP_TYPE, {
            where: { name: { _eq: groupData.name }, branchId: { _eq: groupData.branchId } }
        })
    ).then(res => res.data.groups);

    let response = {};
    let statusCode = 200;

    if (!!group) {
        response = {
            error: true,
            fields: ['name', 'branchId'],
            message: `Group with the name "${groupData.name}" already exists in branch "${group.branch.name}"`
        };
    } else {
        // csfEnabled is never set at creation (DB default = true); it changes only via groups/set-csf-enabled.
        const { csfEnabled: _ignoredCsfEnabled, ...newGroupData } = groupData;

        const group = await graph.mutation(
            insertQl(GROUP_TYPE, {
                objects: [
                    {
                        ... newGroupData,
                        _id: generateUUID(),
                        dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
                    }
                ]
            })
        ).then(res => res.data.groups.returning?.[0]);

        response = {
            success: true,
            group: group
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}