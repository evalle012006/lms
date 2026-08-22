import { GROUP_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util'
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const GROUP_TYPE = createGraphType('groups', GROUP_FIELDS)('groups');
const USER_TYPE = createGraphType('users', `designatedBranch`)('users');
// NEW: separate type for looking up the LO's current weekly theme.
// Kept distinct from USER_TYPE above (which only selects designatedBranch
// for the areaManagerId lookup) rather than widening that type, since
// GraphProvider aliasing means widening a shared type risks pulling
// unrelated fields into the areaManagerId code path too.
const LO_THEME_TYPE = createGraphType('users', `_id weeklyScheduleType acceleratedCategory`)('loTheme');

export default apiHandler({
    get: list
});

async function list(req, res) {
    let statusCode = 200;
    let response = {};

    const { areaManagerId, branchId, loId, occurence, mode } = req.query;
    const codes = await graph.query(
        queryQl(USER_TYPE, {
            where: { _id: areaManagerId ? { _eq: areaManagerId } : { _eq: 'null' } } // fetch non existing user if areaManagerId is null
        })
    )
    .then(res => res.data.users
            .map(u => jsonTryParse(u.designatedBranch, [u.designatedBranch]))
            .reduce((groups, codes) => [... groups, ... codes], [])
    );

    // NEW: for weekly + a specific loId, resolve that LO's current theme
    // so we can filter groups down to it. Without this, groups left over
    // from a prior standard<->accelerated (or category) switch — which
    // cleanupUnusedGroups intentionally never deletes once they have loan
    // history — leak into results alongside the LO's active theme.
    let weeklyScheduleTypeFilter = null;
    let acceleratedCategoryFilter = null;

    if (occurence === 'weekly' && loId) {
        const [loUser] = await graph.query(
            queryQl(LO_THEME_TYPE, {
                where: { _id: { _eq: loId } }
            })
        ).then(res => res.data.loTheme);

        if (!loUser) {
            // loId doesn't resolve to a user at all — surface this rather than
            // silently falling through to an unfiltered weekly query, which
            // would return every theme's groups for this LO.
            response = { success: false, error: true, message: `No user found for loId "${loId}"` };
            res.status(statusCode)
                .setHeader('Content-Type', 'application/json')
                .end(JSON.stringify(response));
            return;
        }

        weeklyScheduleTypeFilter = loUser.weeklyScheduleType || 'standard';
        if (weeklyScheduleTypeFilter === 'accelerated') {
            acceleratedCategoryFilter = loUser.acceleratedCategory || null;
        }
    }

    const where = {
        branchId: branchId ? { _eq: branchId } : { _neq: 'null' },
        loanOfficerId:  loId ? { _eq: loId } : { _neq: 'null' },
        branch: {
            code: codes.length ? { _in: codes } : { _neq: 'null' },
        },
        occurence: { _eq: occurence },
        status: (!branchId && !loId && !codes.length) || mode !== 'filter' ? { _eq: 'available' } : { _neq: 'null' }
    };

    // NEW: scope weekly results to the LO's current theme/category
    if (occurence === 'weekly' && weeklyScheduleTypeFilter) {
        where.weeklyScheduleType = { _eq: weeklyScheduleTypeFilter };
        if (weeklyScheduleTypeFilter === 'accelerated') {
            // acceleratedCategoryFilter may be null (legacy pre-migration LO)
            // — _eq: null is intentional here, not a bug, since that's what
            // matches un-backfilled legacy accelerated groups.
            where.acceleratedCategory = { _eq: acceleratedCategoryFilter };
        }
    }

    const groups = await graph.query(
        queryQl(GROUP_TYPE, {
            where,
            order_by: [{ groupNo: 'asc' }]
        })
    ).then(res => res.data.groups)
    
    response = {
        success: true,
        groups: groups
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}