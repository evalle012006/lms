// Remark-driven UI flags, derived from persisted row data so a draft reload
// can never leave a row without its MCBU input (see delinquent-mcbu deadlock).
export const remarkValueOf = (cc) => (typeof cc?.remarks === 'string' ? cc.remarks : cc?.remarks?.value) || '';

export const allowsMcbuInput = (cc) =>
    !!(cc?.dcmc || cc?.mpdc || remarkValueOf(cc) === 'delinquent-mcbu');

export const restoreRemarkFlags = (collection, current) => {
    if (allowsMcbuInput(current)) collection.allowMcbuCollection = true;
    return collection;
};

// "Lastname, Firstname: message" so a toast says which row is wrong
export const withClientName = (cc, msg) => (cc?.fullName && cc.fullName !== '-' ? `${cc.fullName}: ${msg}` : msg);
