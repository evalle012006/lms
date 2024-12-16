import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { gql } from 'node_modules/apollo-boost/lib/index';

const graph = new GraphProvider();

export default apiHandler({
    get: getLastPNNumber
});

async function getLastPNNumber(req, res) {

    let statusCode = 200;
    let response = {};

    const { branchId, currentDate } = req.query;

    const result = await graph.apollo.query({
      query: gql`
      query last_pn ($args: get_last_pn_number_by_branch_arguments!) {
          last_pn: get_last_pn_number_by_branch(args: $args) {
            _id
            data
          }
      }
      `,
      variables: {
         args: {
              currDate: currentDate,
              branchId,
         }
      }
    })
    .then(res => res.data.last_pn.map(c => ({
      data: c.data,
      maxNumber: +(c.data.maxNumber || '-1'),
    })));


    response = { success: true, data: result };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}