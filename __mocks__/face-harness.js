// Shared harness for __tests__/face/*.scenarios.test.js and security-contract.test.js.
// NOT a test file: Jest only runs __tests__/** and *.test.js, and nothing here matches a node module name.
const graph = { query: jest.fn(), mutation: jest.fn() };
const findUserById = jest.fn();
const findBranches = jest.fn();
const findGroups = jest.fn();
const resolveClientFlowStatus = jest.fn();
let uuidCounter = 0;

const ZERO = Array(128).fill(0);
const ONE  = Array(128).fill(1);

const user = (shortCode, extra = {}) => ({
    _id: `u-${shortCode}`, firstName: 'Test', lastName: String(shortCode), role: { shortCode }, ...extra,
});

const makeRes = () => {
    const res = { body: undefined };
    res.status = jest.fn(() => res);
    res.setHeader = jest.fn(() => res);
    res.json = jest.fn((b) => { res.body = b; return res; });
    res.send = jest.fn((b) => { res.body = b; return res; });
    res.end = jest.fn((s) => { res.body = typeof s === 'string' ? JSON.parse(s) : s; return res; });
    return res;
};
const call = async (handler, req) => { const res = makeRes(); await handler(req, res); return res; };
const run  = async (handler, req) => (await call(handler, req)).body;

// Queries are answered by ALIAS; aggregates default to count 0, everything else to []
const answer = (fx) => graph.query.mockImplementation(async (...qs) => ({
    data: Object.fromEntries(qs.map(q => [
        q.alias,
        q.alias in fx ? fx[q.alias] : (q.op === 'aggregate' ? { aggregate: { count: 0 } } : []),
    ])),
}));
const queried  = () => graph.query.mock.calls.flat();
const queryFor = (alias) => queried().find(q => q.alias === alias);
const ops      = () => graph.mutation.mock.calls[0];   // the spread list of one graph.mutation(...ops) call

module.exports = {
    graph, findUserById, findBranches, findGroups, resolveClientFlowStatus, ZERO, ONE,
    user, makeRes, call, run, answer, queried, queryFor, ops,
    graphProviderMock: () => ({ GraphProvider: function GraphProvider() { return graph; }, __shared: graph }),
    graphUtilMock: () => {
        const tag = (op) => (type, args) => ({ op, ...type, args });
        return {
            createGraphType: (table) => (alias) => ({ table, alias: alias || table }),
            queryQl: tag('query'), insertQl: tag('insert'), updateQl: tag('update'), deleteQl: tag('delete'),
            aggregateQl: (type, fields, where) => ({ op: 'aggregate', ...type, args: { where } }),
        };
    },
    graphFunctionsMock: () => ({ findUserById, findBranches, findGroups, resolveClientFlowStatus }),
    utilsMock: () => ({ generateUUID: () => `uuid-${++uuidCounter}` }),
};