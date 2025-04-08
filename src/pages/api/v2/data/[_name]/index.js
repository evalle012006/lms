import { GraphProvider } from '@/lib/graph/graph.provider';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'node_modules/apollo-boost/lib/index';

const graph = new GraphProvider();

export default apiHandler({
    get: getData
});

async function getData(req, res) {
    const { _name, _limit, _offset,  ... args } = req.query;
    
    const { status, result } = await graph.apollo.query({
            query: gql`
            query ${_name} ($args: ${_name}_arguments!, $limit: Int, $offset: Int){
                results:${_name}(args: $args, limit: $limit, offset: $offset) {
                    data
                }
            }`,
            variables: {
                args: {
                    ... args
                },
                offset: isNaN(+_offset) ? null : +_offset,
                limit: isNaN(+_limit) ? null : +_limit,
            }
        })
        .catch(err => ({ 
            status: 500, 
            result: err
        }))
        .then(res => ({
            status: 200,
            result: res.data.results.map(c => c.data)
        }))
    
        res.status(status)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify({
                data: result
            }));
}