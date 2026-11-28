// src/pages/api/v2/users/list-paginated.js
// Server-side paginated user list for Settings > Users.
// The classic users/list returns every user at once, which made the table ask
// signed-url-bulk for every profile photo in one request (max 200 keys).
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, aggregateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { findUserById } from '@/lib/graph.functions';

const graph = new GraphProvider();

// Only what the Users table and its row actions need — no password / biometric columns.
const LIST_FIELDS = `
  _id
  firstName
  lastName
  email
  number
  position
  designatedBranch
  designatedBranchId
  role
  loNo
  profile
  lastLogin
  root
  transactionType
  branchManagerName
  areaId
  regionId
  divisionId
`;

const USER_TYPE = createGraphType('users', LIST_FIELDS)('users');
const USER_COUNT_TYPE = createGraphType('users', '_id')('usersCount');
const POSITION_TYPE = createGraphType('users', 'position')('positions');

export default apiHandler({
    get: listPaginated,
});

async function listPaginated(req, res) {
    const {
        page = '1',
        limit = '20',
        search = '',
        role = '',            // "<rep>-<shortCode>", same value the role dropdown uses
        position = '',
        branch = '',          // designatedBranch (branch code)
        includePositions = '',
    } = req.query;

    const currentUser = await findUserById(req.auth?.sub);
    if (!currentUser) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const rep = currentUser.role?.rep;
    if (!currentUser.root && !(rep <= 3)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Scope shared by the list and the position options.
    const scope = [{ root: { _eq: false } }];
    if (!currentUser.root && rep === 3) {
        // Branch managers only ever see their own branch.
        scope.push({ designatedBranch: { _eq: currentUser.designatedBranch } });
    }

    const _and = [...scope];

    if (branch && !(!currentUser.root && rep === 3)) {
        _and.push({ designatedBranch: { _eq: branch } });
    }

    if (position) {
        _and.push({ position: { _eq: position } });
    }

    if (role) {
        const dash = role.indexOf('-');
        const roleRep = parseInt(dash === -1 ? role : role.slice(0, dash), 10);
        const shortCode = dash === -1 ? '' : role.slice(dash + 1);
        if (!Number.isNaN(roleRep)) {
            _and.push({ role: { _contains: shortCode ? { rep: roleRep, shortCode } : { rep: roleRep } } });
        }
    }

    // Every word must match first name, last name or email, so "juan dela" finds "Juan Dela Cruz".
    search.trim().split(/\s+/).filter(Boolean).forEach((term) => {
        const like = `%${term}%`;
        _and.push({
            _or: [
                { firstName: { _ilike: like } },
                { lastName: { _ilike: like } },
                { email: { _ilike: like } },
            ],
        });
    });

    const where = { _and };

    const statements = [
        queryQl(USER_TYPE, {
            where,
            order_by: [{ dateModified: 'desc_nulls_last' }, { dateAdded: 'desc_nulls_last' }, { _id: 'desc' }],
            limit: limitNum,
            offset,
        }),
        aggregateQl(USER_COUNT_TYPE, `aggregate { count }`, where),
    ];

    if (includePositions) {
        statements.push(
            queryQl(POSITION_TYPE, {
                where: { _and: scope },
                distinct_on: ['position'],
                order_by: [{ position: 'asc' }],
            })
        );
    }

    const data = await graph.query(...statements).then((r) => r.data);

    const total = data.usersCount?.aggregate?.count ?? 0;
    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
        success: true,
        users: data.users ?? [],
        ...(includePositions
            ? { positions: (data.positions ?? []).map((p) => p.position).filter(Boolean) }
            : {}),
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
        },
    });
}
