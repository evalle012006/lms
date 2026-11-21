import { GROUP_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { handleCron } from '@/lib/cron-guard';
import { withRetry } from '@/lib/retry';
import logger from '@/logger';

const graph = new GraphProvider();
const GROUP_TYPE = createGraphType('groups', `
${GROUP_FIELDS}
branch {
    name
}
loans (where: { status: { _in: ["active", "pending", "completed"] } }) {
    slotNo
}
`)('groups');
const GROUP_MUTATION_TYPE = createGraphType('groups', `_id`);

const BATCH_SIZE = 2000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Hasura cron: recompute noOfClients / status / availableSlots for every group. Background; result in cron_runs.
export default apiHandler({
    post: (req, res) => handleCron(req, res, 'update-group-clients', updateGroups, {
        background: true, staleMinutes: 60, message: 'update groups run in background',
    }),
});

function buildUpdate(group) {
    const loans = group.loans;
    const update = {
        status: group.status,
        noOfClients: loans.length,
        availableSlots: group.availableSlots,
    };

    if (loans.length > 0) {
        let availableSlots = [];
        for (let i = 1; i <= 40; i++) availableSlots.push(i);
        loans.forEach(loan => { availableSlots = availableSlots.filter(as => as != loan.slotNo); });
        update.availableSlots = availableSlots;
    }

    update.status = update.noOfClients == group.capacity ? 'full' : 'available';
    return update;
}

async function updateGroups() {
    logger.debug({ cron: 'start fetching groups' });
    const groups = await withRetry(() => graph.query(queryQl(GROUP_TYPE, {})))
        .then(r => r.data.groups ?? []);
    logger.debug({ cron: 'fetch groups count', count: groups.length });

    let errors = 0;
    for (let i = 0; i < groups.length; i += BATCH_SIZE) {
        const batch = groups.slice(i, i + BATCH_SIZE).map((group, n) =>
            updateQl(GROUP_MUTATION_TYPE('group_update_' + n), { set: { ...buildUpdate(group) }, where: { _id: { _eq: group._id } } })
        );
        logger.debug({ cron: 'start update batch groups', batch_count: batch.length });
        const res = await withRetry(() => graph.mutation(...batch));
        errors += res.errors?.length ?? 0;
        logger.debug({ cron: 'done update batch groups', error_count: res.errors?.length ?? 0 });
        await sleep(500);
    }

    logger.debug({ cron: 'completed batch update groups' });
    return { groups: groups.length, errors };
}
