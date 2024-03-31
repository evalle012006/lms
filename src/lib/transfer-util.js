import { formatPricePhp } from "./utils";

export const transferBranchDetailsTotal = (detailsDaily, detailsWeekly, type) => {
    let totalTransfer = 0;
    let totalMcbu = 0;
    let totalMcbuTarget = 0;
    let totalMcbuCol = 0;
    let totalMcbuWithdrawal = 0;
    let totalMcbuReturnAmt = 0;
    let totalMcbuNoReturn = 0;
    let totalMcbuInterest = 0;
    let totalLoanRelease = 0;
    let totalLoanBalance = 0;
    let totalTargetCollection = 0;
    let totalExcess = 0;
    let totalActualCollection = 0;
    let totalPastDue = 0;
    let totalNoPastDue = 0;
    let totalMispay = 0;
    let totalTdaClients = 0;
    let totalPendingClients = 0;
    let totalCurrentReleaseAMount = 0;

    detailsDaily.map(transfer => {
        totalTransfer++;
        totalMcbu += transfer.mcbu;
        totalLoanRelease += transfer.amountRelease;
        totalLoanBalance += transfer.loanBalance;
        totalCurrentReleaseAMount += transfer.currentReleaseAmount;

        if (type == 'Transfer RCV') {
            if (transfer.status == 'completed') {
                totalTdaClients += 1;
            } else if (transfer.status == 'pending') {
                totalPendingClients += 1;
            }
        }

        const details = transfer?.data[0];
        if (details) {
            totalMcbuTarget += details.mcbuTarget;
            totalMcbuCol += details.mcbuCol;
            totalTargetCollection += details.actualCollection;
            totalActualCollection += details.actualCollection;
            totalPastDue += details.pastDue;
            totalNoPastDue += details.noPastDue;
        }
    });

    detailsWeekly.map(transfer => {
        totalTransfer++;
        totalMcbu += transfer.mcbu;
        totalLoanRelease += transfer.amountRelease;
        totalLoanBalance += transfer.loanBalance;
        totalCurrentReleaseAMount += transfer.currentReleaseAmount;

        if (type == 'Transfer RCV') {
            if (transfer.status == 'completed') {
                totalTdaClients += 1;
            } else if (transfer.status == 'pending') {
                totalPendingClients += 1;
            }
        }

        const details = transfer?.data[0];
        if (details) {
            totalMcbuTarget += details.mcbuTarget;
            totalMcbuCol += details.mcbuCol;
            totalTargetCollection += details.actualCollection;
            totalActualCollection += details.actualCollection;
            totalPastDue += details.pastDue;
            totalNoPastDue += details.noPastDue;
        }
    });
    
    return {
        name: type.toUpperCase(),
        transfer: (type === 'Transfer GVR' && totalTransfer > 0) ? -Math.abs(totalTransfer) : totalTransfer,
        transferStr: (type === 'Transfer GVR' && totalTransfer > 0) ? `(${totalTransfer})` : totalTransfer,
        noOfNewCurrentRelease: '-',
        noCurrentReleaseStr: '-',
        currentReleaseAmount: (type === 'Transfer GVR' && totalCurrentReleaseAMount > 0) ? -Math.abs(totalCurrentReleaseAMount) : totalCurrentReleaseAMount,
        currentReleaseAmountStr: '-', // don't display in group summary
        activeClients: '-',
        activeBorrowers: '-',
        totalLoanRelease: totalLoanRelease,
        totalReleasesStr: '-',
        totalLoanBalance: 0,
        totalLoanBalanceStr: '-',
        targetLoanCollection: totalTargetCollection,
        loanTargetStr: (type === 'Transfer GVR' && totalTargetCollection > 0) ? `(${formatPricePhp(totalTargetCollection)})` : formatPricePhp(totalTargetCollection),
        excess: 0,
        excessStr: '-', //(type === 'Transfer GVR' && totalExcess > 0) ? `(${formatPricePhp(totalExcess)})` : formatPricePhp(totalExcess),
        collection: totalActualCollection,
        collectionStr: (type === 'Transfer GVR' && totalActualCollection > 0) ? `(${formatPricePhp(totalActualCollection)})` : formatPricePhp(totalActualCollection),
        mispaymentPerson: totalMispay,
        mispayment: '-',
        fullPaymentAmountStr: '-',
        noOfFullPayment: '-',
        pastDue: totalPastDue,
        pastDueStr: (type === 'Transfer GVR' && totalPastDue > 0) ? `(${formatPricePhp(totalPastDue)})` : formatPricePhp(totalPastDue),
        noPastDue: (type === 'Transfer GVR' && totalNoPastDue > 0) ? `(${totalNoPastDue})` : totalNoPastDue,
        mcbuTarget: totalMcbuTarget,
        mcbu: 0,
        mcbuStr: '-',
        mcbuCol: totalMcbu,
        mcbuColStr: (type === 'Transfer GVR' && totalMcbu > 0) ? `(${formatPricePhp(totalMcbu)})` : formatPricePhp(totalMcbu),
        mcbuWithdrawal: totalMcbuWithdrawal,
        mcbuWithdrawalStr: (type === 'Transfer GVR' && totalMcbuWithdrawal > 0) ? `(${formatPricePhp(totalMcbuWithdrawal)})` : formatPricePhp(totalMcbuWithdrawal),
        noMcbuReturn: totalMcbuNoReturn,
        mcbuReturnAmt: totalMcbuReturnAmt,
        mcbuReturnAmtStr: (type === 'Transfer GVR' && totalMcbuReturnAmt > 0) ? `(${formatPricePhp(totalMcbuReturnAmt)})` : formatPricePhp(totalMcbuReturnAmt),
        mcbuTarget: '-',
        mcbuInterest: totalMcbuInterest,
        mcbuInterestStr: (type === 'Transfer GVR' && totalMcbuInterest > 0) ? `(${formatPricePhp(totalMcbuInterest)})` : formatPricePhp(totalMcbuInterest),
        totalData: true,
        status: '-'
    }
}