import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

// Minimal fields — only what the hierarchy page needs to render the tree + detail panel
const DIVISION_TREE_TYPE = createGraphType('divisions', `
    _id
    name
    managerIds
    regionIds
    dateAdded
    managers (where: { role: { _contains: { shortCode: "deputy_director" } } }) {
        _id firstName lastName
    }
    regions {
        _id
        name
        managerIds
        areaIds
        divisionId
        dateAdded
        managers (where: { role: { _contains: { shortCode: "regional_manager" } } }) {
            _id firstName lastName
        }
        areas {
            _id
            name
            managerIds
            branchIds
            regionId
            divisionId
            dateAdded
            managers (where: { role: { _contains: { shortCode: "area_admin" } } }) {
                _id firstName lastName
            }
            branches {
                _id
                name
                code
                areaId
                regionId
                divisionId
            }
        }
    }
`)('divisions');

// All unassigned branches (areaId is null) — for branch multi-select in area form
const UNASSIGNED_BRANCHES_TYPE = createGraphType('branches', `
    _id name code areaId regionId divisionId
`)('branches');

// All users eligible as managers — fetched per role type
const MANAGER_USERS_TYPE = createGraphType('users', `
    _id firstName lastName role areaId regionId divisionId status
`)('users');

export default apiHandler({
    get: getHierarchy
});

async function getHierarchy(req, res) {
    const [divisionsResp, branchesResp, managersResp] = await Promise.all([
        graph.query(
            queryQl(DIVISION_TREE_TYPE, {
                order_by: [{ name: 'asc' }]
            })
        ),
        // All branches — area form needs full list to show warning if already assigned
        graph.query(
            queryQl(UNASSIGNED_BRANCHES_TYPE, {
                order_by: [{ code: 'asc' }]
            })
        ),
        // All rep=2 users (deputy_director, regional_manager, area_admin)
        graph.query(
            queryQl(MANAGER_USERS_TYPE, {
                where: {
                    _and: [
                        { role: { _contains: { rep: 2 } } },
                        { status: { _eq: 'active' } }
                    ]
                },
                order_by: [{ lastName: 'asc' }]
            })
        )
    ]);

    const divisions = divisionsResp.data.divisions ?? [];
    const branches  = branchesResp.data.branches ?? [];
    const managers  = managersResp.data.users ?? [];

    // Normalise manager shape — derive shortCode safely
    const normaliseManagers = (list) =>
        list.map(u => ({
            ...u,
            shortCode: (typeof u.role === 'string' ? JSON.parse(u.role) : u.role)?.shortCode ?? null
        }));

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({
            success: true,
            divisions,
            branches,
            managers: normaliseManagers(managers)
        }));
}