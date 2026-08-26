import { GROUP_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const GROUP_TYPE = createGraphType('groups', GROUP_FIELDS)('groups');

export default apiHandler({
    get: getGroup,
    post: updateGroup
});

async function getGroup(req, res) {
    const { _id = null } = req.query;

    let statusCode = 200;
    let response = {};

    const [group] = await graph.query(
        queryQl(GROUP_TYPE, {
            where: { _id: { _eq: _id } }
        })
    ).then(res => res.data.groups);

    response = { success: true, group };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateGroup(req, res) {
    let statusCode = 200;
    let response = {};

    const incoming = req.body;
    const groupId = incoming._id ?? null;

    if (!groupId) {
        response = { success: false, error: true, message: 'Missing group id.' };
        return res.status(statusCode)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify(response));
    }

    // Source of truth is the DB row, not the client payload.
    const [existingGroup] = await graph.query(
        queryQl(GROUP_TYPE, { where: { _id: { _eq: groupId } } })
    ).then(res => res.data.groups);

    if (!existingGroup) {
        response = { success: false, error: true, message: 'Group not found.' };
        return res.status(statusCode)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify(response));
    }

    const noOfClients = existingGroup.noOfClients ?? 0;
    const oldCapacity = existingGroup.capacity ?? 0;

    let capacity = incoming.capacity !== undefined
        ? parseInt(incoming.capacity, 10)
        : oldCapacity;

    if (!Number.isInteger(capacity) || capacity < 1) {
        response = { success: false, error: true, message: 'Capacity must be a whole number greater than 0.' };
        return res.status(statusCode)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify(response));
    }

    if (capacity < noOfClients) {
        response = {
            success: false,
            error: true,
            message: `Capacity cannot be less than the current number of clients (${noOfClients}).`
        };
        return res.status(statusCode)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify(response));
    }

    // Recompute availableSlots server-side. Never accept the client's array as-is:
    // occupied slot numbers (tied to real loans) must be preserved; only the
    // unoccupied pool grows or shrinks with capacity.
    const existingAvailableSlots = Array.isArray(existingGroup.availableSlots)
        ? existingGroup.availableSlots
        : [];
    const occupiedSlots = [];
    for (let i = 1; i <= oldCapacity; i++) {
        if (!existingAvailableSlots.includes(i)) occupiedSlots.push(i);
    }

    let availableSlots;
    if (capacity >= oldCapacity) {
        // grow: keep existing available slots, append new numbers above oldCapacity
        const newSlots = [];
        for (let i = oldCapacity + 1; i <= capacity; i++) newSlots.push(i);
        availableSlots = [...existingAvailableSlots, ...newSlots].sort((a, b) => a - b);
    } else {
        // shrink (already validated capacity >= noOfClients above): rebuild the
        // full 1..capacity range and drop occupied slots from it. This assumes
        // no occupied slot number exceeds the new capacity — guard for that.
        const maxOccupiedSlot = occupiedSlots.length ? Math.max(...occupiedSlots) : 0;
        if (maxOccupiedSlot > capacity) {
            response = {
                success: false,
                error: true,
                message: `Cannot shrink capacity below slot ${maxOccupiedSlot}, which is currently occupied by an active client.`
            };
            return res.status(statusCode)
                .setHeader('Content-Type', 'application/json')
                .end(JSON.stringify(response));
        }
        availableSlots = [];
        for (let i = 1; i <= capacity; i++) {
            if (!occupiedSlots.includes(i)) availableSlots.push(i);
        }
    }

    const status = noOfClients >= capacity ? 'full' : 'available';

    // Whitelist what a client is allowed to change; never spread req.body verbatim.
    const ALLOWED_FIELDS = ['name', 'branchId', 'branchName', 'day', 'dayNo', 'time',
        'groupNo', 'occurence', 'loanOfficerId', 'loanOfficerName', 'weeklyScheduleType'];

    const set = {};
    for (const field of ALLOWED_FIELDS) {
        if (incoming[field] !== undefined) set[field] = incoming[field];
    }
    set.capacity = capacity;
    set.availableSlots = availableSlots;
    set.status = status;
    set.noOfClients = noOfClients; // explicitly re-assert; never trust client's value

    await graph.mutation(
        updateQl(GROUP_TYPE, {
            set,
            where: {
                _id: { _eq: groupId }
            }
        })
    );

    response = { success: true, group: { ...existingGroup, ...set, _id: groupId } };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}