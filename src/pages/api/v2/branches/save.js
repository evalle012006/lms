import { BRANCH_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import { apiHandler } from '@/services/api-handler';
import { logAudit } from '@/lib/audit';
import moment from 'moment'
import { validateBranchCode } from '@/lib/branch-code';

const graph = new GraphProvider();
const BRANCH_TYPE = createGraphType('branches', `
    ${BRANCH_FIELDS}
`)('branches');


export default apiHandler({
    post: save
});

async function save(req, res) {
    const { name = null, code = null, phoneNumber = null, email = null, address = null, areaId = null, divisionId = null,  regionId = null } = req.body;
    let response = {};
    let statusCode = 200;

    const codeError = validateBranchCode(code);
    if (codeError) {
        return res.status(400)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify({ error: true, fields: ['code'], message: codeError }));
    }

    let [branch] = await graph.query(
        queryQl(BRANCH_TYPE, {
            where: {
                code: { _eq: code }
            }
        })
    ).then(res => res.data.branches);

    if(branch) {
        response = {
            error: true,
            fields: ['code'],
            message: `Branch with the code "${code}" already exists`
        };
    } else {
        [branch] = await graph.mutation(
            insertQl(BRANCH_TYPE, {
                objects: [{
                    _id: generateUUID(), // todo: generate id here
                    name: name,
                    code: code,
                    email: email,
                    phoneNumber: phoneNumber,
                    address: address,
                    areaId: areaId, 
                    divisionId: divisionId,
                    regionId: regionId,
                    dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
                }]
            })
        ).then(res => res.data.branches.returning);

        response = {
            success: true,
            branch: branch
        }
        logAudit(req, {
            action: 'BRANCH_CREATED',
            category: 'BRANCH',
            entityType: 'branch',
            entityId: branch?._id,
            branchId: branch?._id,
            branchName: name,
            description: `Branch "${name}" (${code}) created`,
            afterData: { name, code, areaId, regionId, divisionId },
        });
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}