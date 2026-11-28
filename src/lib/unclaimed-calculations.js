const toCents = (value) => {
    const amount = Number(value ?? 0);

    return Number.isFinite(amount)
        ? Math.round(amount * 100)
        : 0;
};

export function calculateOffsetAmounts(collection = {}) {
    const totalReturnCents = toCents(collection.mcbuReturnAmt);
    const csfCents = toCents(collection.csfReturnAmt);
    const paymentCollectionCents = toCents(collection.paymentCollection);
    const mcbuCents = totalReturnCents - csfCents;
    const unclaimedAmountCents = totalReturnCents - paymentCollectionCents;

    return {
        mcbu: mcbuCents / 100,
        csf: csfCents / 100,
        totalReturn: totalReturnCents / 100,
        paymentCollection: paymentCollectionCents / 100,
        unclaimedAmount: unclaimedAmountCents / 100,

        mcbuCents,
        csfCents,
        totalReturnCents,
        paymentCollectionCents,
        unclaimedAmountCents,
    };
}