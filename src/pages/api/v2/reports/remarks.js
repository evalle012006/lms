import { CASH_COLLECTIONS_FIELDS, LOAN_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

export default apiHandler({
    get: list
});

async function list(req, res) {
    let statusCode = 200;
    let response = {};

    const { remarks, occurence, date, startDate, endDate, branchId, loId, groupId } = req.query;

    const filter = [];

    if(remarks === 'pending') {
        // filter for reloaner
        filter.push({ remarks_value: { _ilike: 'reloaner-%' }, status: { _eq: 'completed' } });
    } else {
        filter.push({ remarks_value: { _eq: remarks }  });
    }

    if(date) {
        filter.push({ dateAdded: { _eq: date } })
    } else if(startDate && endDate) {
        filter.push({ dateAdded: { _gte: startDate } })
        filter.push({ dateAdded: { _lte: endDate } })
    }

    filter.push({ occurence: { _eq: occurence } });

    if(!!branchId && branchId != 'undefined') {
        filter.push({ branchId: { _eq: branchId } });
    }

    if(!!loId && loId != 'undefined') {
        filter.push({ loId: { _eq: loId } });
    }

    if(!!groupId && groupId != 'undefined') {
        filter.push({ groupId: { _eq: groupId } });
    }

    const data = await graph.query(
        queryQl(createGraphType('cashCollections', `
            ${CASH_COLLECTIONS_FIELDS}
            group: groups { name } 
            client: clients { firstName lastName status delinquent }
            loan: loans { ${LOAN_FIELDS} }
            branch: branches { name, code }
        `)('results'), {
            where: {
                _and: filter
            }
        })
    ).then(res => res.data.results ?? [])
     .then(data => data.map(o => ({
        ... o,
        group: o.group ? [o.group] : [],
        client: o.client ? [o.client] : [],
        loan: o.loan ? [o.loan] : [],
        branch: o.branch ? [o.branch] : [],
     })))
    
    response = {
        success: true,
        data: data
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}