import { apiHandler } from '@/services/api-handler';

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { GROUP_FIELDS } from '@/lib/graph.fields';
import { getCurrentDate } from '@/lib/utils';
import moment from 'moment'

const graph = new GraphProvider();
const CLIENT_TYPE = createGraphType('client', `_id`)('clients');
const LOAN_TYPE = createGraphType('loans', `_id`)('loans');
const GROUP_TYPE =createGraphType('groups', `
${GROUP_FIELDS}
`)('groups');

export default apiHandler({
    post: updateClient
});


async function updateClient(req, res) {
    let statusCode = 200;
    let response = {};

    const loan = req.body;
    const [client] = await graph.query(
        queryQl(CLIENT_TYPE, { 
            where: {
                _id: { _eq: loan.clientId ?? null }
            }
        })
    ).then(res => res.data.clients);


    if (client) {
        await graph.mutation(
            updateQl(CLIENT_TYPE, {
                set: {
                    status: 'offset'
                },
                where: {
                    _id: client._id
                }
            })
        );
        
        updateLoan(loan);
        updateGroup(loan);

        response = { success: true, client: clientResp };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateLoan(loanData) {
    const [loan] = await graph.query(
        queryQl(LOAN_TYPE, {
            where: {
                _id: { _eq: loanData.loanId ?? null }
            }
        })
    ).then(res => res.data.loans);

    if (!!loan) {
        await graph.mutation(
            updateQl(LOAN_TYPE, {
                set: {
                    loanCycle: 0,
                    remarks: loanData.remarks,
                    status: 'closed',
                    dateModified: moment(getCurrentDate()).format('YYYY-MM-DD')
                },
                where: {
                    _id: loan._id
                }
            })
        );
    }
}

async function updateGroup(loan) {

    const [group] = await graph.query(
        queryQl(GROUP_TYPE, {
            where: {
                _id: { _eq: loan.groupId ?? null }
            }
        })
    ).then(res => res.data.groups);
    
    if (group) {

        if (group.status === 'full') {
            group.status = 'available';
        }

        group.availableSlots.push(loan.slotNo);
        group.availableSlots.sort((a, b) => { return a - b; });
        group.noOfClients = group.noOfClients - 1;

        await graph.mutation(
            updateQl(GROUP_TYPE, {
                set: {
                    availableSlots: group.availableSlots,
                    noOfClients: group.noOfClients,
                    status: group.status
                },
                where: {
                    _id: { _eq: group._id }
                }
            })
        )
    }
}