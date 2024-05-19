import { GraphProvider } from '@/lib/graph/graph.provider';
import { queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import moment from 'moment';


const graph = new GraphProvider();
const LOAN_TYPE = createGraphType('loans', `${LOAN_FIELDS}`)('loans');

let response = {};
let statusCode = 200;


export default apiHandler({
    post: syncLoans
});

async function syncLoans(req, res) {

    const { loId } = req.body;

    await tomorrowLoans(loId);

    response = { success: true };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function tomorrowLoans(loId) {
    const loans = await graph.query(
        queryQl(LOAN_TYPE, { where: { status: { _eq: "tomorow" }, loId: { _eq: loId } } })
    ).then(res => res.data.loans);

    const mutationList = [];

    await Promise.all(loans.map(async (loan) => {
        let temp = {...loan};
        const loanTerms = loan.loanTerms;

        temp.activeLoan = (loan.principalLoan * 1.20) / loanTerms;
        temp.loanBalance = loan.principalLoan * 1.20;
        temp.amountRelease = temp.loanBalance;
        temp.status = 'active';
        temp.remediated = moment(new Date()).format('YYYY-MM-DD') + ' - ' + 'WRONG_STATUS';
        
        delete temp._id;
        
        await db.collection('loans').updateOne({ _id: loan._id }, {$set: {...temp}});

        mutationList.push(
            updateQl(LOAN_TYPE, {
                set: temp,
                where: {
                    _id: { _eq: loan._id }
                }
            })
        );
    }));

    await graph.mutation(
        ... mutationList
    );

}