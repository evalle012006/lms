// A client activated by a loan approval must belong to that loan's group and LO.
// Used by every approval path (batch approve and single approve) so a returning (balik)
// client can never end up active with a null groupId/loId.
export function applyLoanAssignmentToClient(client, loan, groupName) {
    if (!client || !loan?.groupId || !loan?.loId) return client; // never write undefined

    const isReturning =
        client.status === 'offset' ||
        (client.status === 'pending' && !!(client.oldGroupId || client.oldLoId));
    const unassigned = !client.groupId || !client.loId;

    if (isReturning || unassigned) {
        client.groupId = loan.groupId;
        client.loId = loan.loId;
        client.groupName = groupName ?? loan.groupName ?? client.groupName;
        client.branchId = loan.branchId ?? client.branchId;
    }
    if (isReturning) {
        client.oldGroupId = null;
        client.oldLoId = null;
    }
    return client;
}
