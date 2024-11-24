import { apiHandler } from "@/services/api-handler";
import logger from "@/logger";
import { formatPricePhp } from "@/lib/utils";
import { transferBranchDetailsTotal } from "@/lib/transfer-util";
import { findDivisions, findUsers } from "@/lib/graph.functions";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { gql } from "apollo-boost";

const graph = new GraphProvider();

export default apiHandler({
    get: getData
});

async function getData (req, res) {
    let statusCode = 200;
    let response = {};

    const { date, currentUserId, selectedBranchGroup, dayName, currentDate } = req.query;

    const data = [];

    const user = await findUsers({ _id: { _eq: currentUserId } });
    if (user?.length > 0) {
        let divisionIds = [];
        if (selectedBranchGroup === 'mine' && user[0].role.rep !== 1) {
            if (user[0].divisionId && user[0].role.shortCode === 'regional_manager') {
                const divisions = await findDivisions({ _id: { _eq: user[0].divisionId } });
                divisionIds = divisions.map(division => division._id.toString());
            } else if (user[0].divisionId && user[0].role.shortCode === 'deputy_director') {
                const divisions = await findDivisions({ _id: { _eq: user[0].divisionId } });
                divisionIds = divisions.map(division => division._id.toString());
            }
        } else {
            const divisions = await findDivisions({ });
            divisionIds = divisions.map(division => division._id.toString());
        }
        
        const result = await Promise.all(divisionIds.map(async (divisionId) => {
            logger.debug({page: 'Division Collections', message: `Getting data for division id: ${divisionId}`});
            data.push.apply(data, await getAllLoanTransactionsByDivision(divisionId, date, dayName, currentDate));
        }));

        if (result) {
            data.sort((a, b) => {
                if (a.code > b.code) {
                    return 1;
                }

                if (b.code > a.code) {
                    return -1;
                }
                
                return 0;
            });

            const processedData = await processData(data, date, currentDate);

            response = { success: true, rawData: data, data: processedData };
        } else {
            statusCode = 500;
            response = { error: true, message: "Error fetching data" };
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function getAllLoanTransactionsByDivision(divisionId, date, dayName, currentDate) {
    let cashCollection;
    
    if (currentDate === date) {
      const query = gql`
          query get($divisionId: String!, $date: date!, $dayName: String!) {
              cashCollections: get_all_loans_per_division_current_date(args: {
                  divisionId: $divisionId,
                  date: $date,
                  dayName: $dayName
              }) {
                  data
              }
          }
      `;
      const variables = { divisionId, date, dayName };
      cashCollection = await graph.apollo.query({ query, variables})
        .then(res => res.data?.cashCollections?.map(({ data }) => data) ?? []);

    } else {
      const query = gql`
          query get($divisionId: String!, $date: date!, $dayName: String!) {
              cashCollections: get_all_loans_per_division(args: {
                  divisionId: $divisionId,
                  date: $date,
                  dayName: $dayName
              }) {
                  data
              }
          }
      `;
      const variables = { divisionId, date, dayName };
      cashCollection = await graph.apollo.query({ query, variables})
        .then(res => res.data?.cashCollections?.map(({ data }) => data) ?? []);
    }
     
    return cashCollection;
}

async function processData(data, date, currentDate) {
    const collectionDailyTransferred = [];
    const collectionDailyReceived = [];
    const collectionWeeklyTransferred = [];
    const collectionWeeklyReceived = [];
    let collectionData = [];

    const filter = date !== currentDate;

    let noOfClients = 0;
    let noOfBorrowers = 0;
    let noOfPendings = 0;
    let totalsLoanRelease = 0;
    let totalsLoanBalance = 0;
    let noOfNewCurrentRelease = 0;
    let noOfReCurrentRelease = 0;
    let currentReleaseAmount = 0;
    let targetLoanCollection = 0;
    let excess = 0;
    let totalLoanCollection = 0;
    let noOfFullPayment = 0;
    let fullPaymentAmount = 0;
    let mispayment = 0;
    let totalPastDue = 0;
    let totalNoPastDue = 0;
    let totalMcbu = 0;
    let totalMcbuCol = 0;
    let totalMcbuWithdrawal = 0;
    let totalMcbuReturnNo = 0;
    let totalMcbuReturnAmt = 0;
    let totalMcbuDailyWithdrawal = 0;
    let totalTransfer = 0;
    let totalCOH = 0;

    data.map(division => {
        let groupStatus = 'open';

        let branchNoOfClients = 0;
        let branchNoOfBorrowers = 0;
        let branchNoOfPendings = 0;
        let branchTotalsLoanRelease = 0;
        let branchTotalsLoanBalance = 0;
        let branchNoOfNewCurrentRelease = 0;
        let branchNoOfReCurrentRelease = 0;
        let branchCurrentReleaseAmount = 0;
        let branchTargetLoanCollection = 0;
        let branchExcess = 0;
        let branchTotalLoanCollection = 0;
        let branchNoOfFullPayment = 0;
        let branchFullPaymentAmount = 0;
        let branchMispayment = 0;
        let branchTotalPastDue = 0;
        let branchTotalNoPastDue = 0;
        let branchTotalMcbu = 0;
        let branchTotalMcbuCol = 0;
        let branchTotalMcbuWithdrawal = 0;
        let branchTotalMcbuReturnNo = 0;
        let branchTotalMcbuReturnAmt = 0;
        let branchTotalTransfer = 0;
        let branchTotalMcbuDailyWithdrawal = 0;
        let branchTotalCOH = 0;

        division?.branchCollection?.map(branch => {
            if (branch?.draftCollections?.length > 0) {
                const transactionStatus = branch.draftCollections[0].groupStatusArr?.filter(status => status === "pending") ?? [];
                const draft = branch.draftCollections[0].hasDraftsArr?.filter(d => d === true) ?? [];
                if (transactionStatus?.length == 0 && draft?.length == 0) {
                    groupStatus = 'close';
                }
            } else if (branch.cashCollections?.length > 0) {
                const transactionStatus = branch.cashCollections[0].groupStatusArr?.filter(status => status === "pending") ?? [];
                const draft = branch.cashCollections[0].hasDraftsArr?.filter(d => d === true) ?? [];
                if (transactionStatus?.length == 0 && draft?.length == 0) {
                    groupStatus = 'close';
                }
            }

            if (!filter) {
                let mcbu = 0;
                if (branch.activeLoans?.length > 0) {
                    branchNoOfClients += branch.activeLoans[0].activeClients;
                    branchNoOfBorrowers += branch.activeLoans[0].activeBorrowers;
                    branchNoOfPendings += branch.activeLoans[0].pendingClients;
                }

                if (branch.loans?.length > 0) {
                    branchTotalsLoanRelease += branch.loans[0].totalRelease;
                    branchTotalsLoanBalance += branch.loans[0].totalLoanBalance;
                    branchTargetLoanCollection += branch.loans[0].loanTarget;
                    branchTotalPastDue += branch.loans[0].pastDue;
                    branchTotalNoPastDue += branch.loans[0].noPastDue;
                    mcbu = branch.loans[0].mcbu;
                }

                if (branch.cashCollections?.length > 0 && branch.cashCollections[0].collection > 0) {
                    branchTargetLoanCollection = branchTargetLoanCollection - branch.cashCollections[0].loanTarget;
                    branchExcess += branch.cashCollections[0].excess;
                    branchTotalLoanCollection += branch.cashCollections[0].collection;
                    branchMispayment += branch.cashCollections[0].mispayment;
                    mcbu = branch.cashCollections[0].mcbu;
                    branchTotalMcbuCol += branch.cashCollections[0].mcbuCol;
                    branchTotalMcbuWithdrawal += branch.cashCollections[0].mcbuWithdrawal;
                    branchTotalMcbuReturnNo += branch.cashCollections[0].mcbuReturnNo;
                    branchTotalMcbuReturnAmt += branch.cashCollections[0].mcbuReturnAmt;
                    branchTotalMcbuDailyWithdrawal += branch.cashCollections[0].mcbuDailyWithdrawal;
                }

                if (branch.currentRelease?.length > 0) {
                    const newReleasePerson = branch.currentRelease[0].newCurrentRelease ? branch.currentRelease[0].newCurrentRelease : 0;
                    branchNoOfNewCurrentRelease += branch.currentRelease[0].newCurrentRelease;
                    branchNoOfReCurrentRelease += branch.currentRelease[0].reCurrentRelease;
                    branchCurrentReleaseAmount += branch.currentRelease[0].currentReleaseAmount;

                    if (newReleasePerson > 0 && branch.activeLoans[0].activeClients == 0) {
                        branchNoOfClients += newReleasePerson;
                    }
                }

                if (branch.fullPayment?.length > 0) {
                    branchFullPaymentAmount += branch.fullPayment[0].fullPaymentAmount;
                    branchNoOfFullPayment += branch.fullPayment[0].noOfFullPayment;
                }

                branchTotalMcbu += mcbu;
            } else {
                if (branch.cashCollections?.length > 0) {
                    branchNoOfClients += branch.cashCollections[0].activeClients;
                    branchNoOfBorrowers += branch.cashCollections[0].activeBorrowers;
                    branchNoOfPendings += branch.cashCollections[0].pendingClients;

                    branchTotalsLoanRelease += branch.cashCollections[0].totalRelease;
                    branchTotalsLoanBalance += branch.cashCollections[0].totalLoanBalance;
                    branchTargetLoanCollection += branch.cashCollections[0].loanTarget;

                    branchExcess += branch.cashCollections[0].excess;
                    branchTotalLoanCollection += branch.cashCollections[0].collection;
                    branchMispayment += branch.cashCollections[0].mispayment;
                    branchTotalPastDue += branch.cashCollections[0].pastDue ? branch.cashCollections[0].pastDue : 0;
                    branchTotalNoPastDue += branch.cashCollections[0].noPastDue ? branch.cashCollections[0].noPastDue : 0;

                    branchTotalMcbu += branch.cashCollections[0].mcbu ? branch.cashCollections[0].mcbu: 0;
                    branchTotalMcbuCol += branch.cashCollections[0].mcbuCol ? branch.cashCollections[0].mcbuCol: 0;
                    branchTotalMcbuWithdrawal += branch.cashCollections[0].mcbuWithdrawal ? branch.cashCollections[0].mcbuWithdrawal: 0;
                    branchTotalMcbuReturnNo += branch.cashCollections[0].mcbuReturnNo ? branch.cashCollections[0].mcbuReturnNo: 0;
                    branchTotalMcbuReturnAmt += branch.cashCollections[0].mcbuReturnAmt ? branch.cashCollections[0].mcbuReturnAmt: 0;
                    branchTotalMcbuDailyWithdrawal += branch.cashCollections[0].mcbuDailyWithdrawal ? branch.cashCollections[0].mcbuDailyWithdrawal : 0;

                    branchNoOfNewCurrentRelease += branch.cashCollections[0].newCurrentRelease;
                    branchNoOfReCurrentRelease += branch.cashCollections[0].reCurrentRelease;
                    branchCurrentReleaseAmount += branch.cashCollections[0].currentReleaseAmount;

                    branchNoOfFullPayment += branch.cashCollections[0].noOfFullPayment;
                    branchFullPaymentAmount += branch.cashCollections[0].fullPaymentAmount;
                }
            }

            if (branch.cashOnHand?.length > 0) {
                branchTotalCOH = branch.cashOnHand[0].amount ? branch.cashOnHand[0].amount : 0;
            }

            if (branch.transferDailyGiverDetails?.length > 0 || branch.transferDailyReceivedDetails?.length > 0 || branch.transferWeeklyGiverDetails?.length > 0 || branch.transferWeeklyReceivedDetails?.length > 0) {
                let transfer = 0;
                let totalTransferMcbu = 0;
                let totalTransferTargetCollection = 0;
                let totalTransferActualCollection = 0;

                if (branch.transferDailyGiverDetails?.length > 0) {
                    collectionDailyReceived.push.apply(collectionDailyReceived, branch.transferDailyGiverDetails);
                    transfer = transfer - branch.transferDailyGiverDetails?.length;

                    branch.transferDailyGiverDetails.map(giver => {
                        if (filter) {
                            branchNoOfClients -= 1;
                            if (giver.status !== "completed") {
                                branchNoOfBorrowers -= 1;
                            }
                        }

                        branchTotalMcbu -= giver.mcbu;
                        totalTransferMcbu -= giver.mcbu;

                        const details = giver.data[0];
                        const actualCollection = details?.actualCollection ? details?.actualCollection : 0;
                        totalTransferTargetCollection -= actualCollection;
                        totalTransferActualCollection -= actualCollection;

                        branchTotalsLoanRelease -= giver.amountRelease ? giver.amountRelease : 0;
                        branchTotalsLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;
                    });
                }

                if (branch.transferDailyReceivedDetails?.length > 0) {
                    collectionDailyTransferred.push.apply(collectionDailyTransferred, branch.transferDailyReceivedDetails);
                    transfer = transfer + branch.transferDailyReceivedDetails?.length;

                    branch.transferDailyReceivedDetails.map(rcv => {
                        totalTransferMcbu += rcv.mcbu;
                        const details = rcv.data[0];
                        const actualCollection = details?.actualCollection ? details?.actualCollection : 0;
                        totalTransferTargetCollection += actualCollection;
                        totalTransferActualCollection += actualCollection;

                        if (!filter) {
                            if (rcv.status !== 'pending') {
                                collection.activeClients += 1;
                                if (rcv.status !== "completed") {
                                    branchNoOfBorrowers += 1;
                                }
                                branchTotalMcbu += rcv.mcbu ? rcv.mcbu : 0;

                                branchTotalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                                branchTotalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                            }
                        } else {
                            if (rcv.status !== 'pending') {
                                branchTargetLoanCollection -= rcv.targetCollection;

                                if (rcv.status == 'tomorrow') {
                                    branchTotalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                                    branchTotalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                                }
                            }
                        }
                    });
                }

                if (branch.transferWeeklyGiverDetails?.length > 0) {
                    collectionWeeklyReceived.push.apply(collectionWeeklyReceived, branch.transferWeeklyGiverDetails);
                    transfer = transfer - branch.transferWeeklyGiverDetails?.length;

                    branch.transferWeeklyGiverDetails.map(giver => {
                        if (filter) {
                            branchNoOfClients -= 1;
                            if (giver.status !== "completed") {
                                branchNoOfBorrowers -= 1;
                            }
                        }

                        branchTotalMcbu -= giver.mcbu;
                        totalTransferMcbu -= giver.mcbu;

                        const details = giver.data[0];
                        const actualCollection = details?.actualCollection ? details?.actualCollection : 0;
                        totalTransferTargetCollection -= actualCollection;
                        totalTransferActualCollection -= actualCollection;

                        branchTotalsLoanRelease -= giver.amountRelease ? giver.amountRelease : 0;
                        branchTotalsLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;
                    });
                }

                if (branch.transferWeeklyReceivedDetails?.length > 0) {
                    collectionWeeklyTransferred.push.apply(collectionWeeklyTransferred, branch.transferWeeklyReceivedDetails);
                    transfer = transfer + branch.transferWeeklyReceivedDetails?.length;

                    branch.transferWeeklyReceivedDetails.map(rcv => {
                        totalTransferMcbu += rcv.mcbu;
                        const details = rcv.data[0];
                        const actualCollection = details?.actualCollection ? details?.actualCollection : 0;
                        totalTransferTargetCollection += actualCollection;
                        totalTransferActualCollection += actualCollection;

                        if (!filter) {
                            if (rcv.status !== 'pending') {
                                collection.activeClients += 1;
                                if (rcv.status !== "completed") {
                                    branchNoOfBorrowers += 1;
                                }
                                branchTotalMcbu += rcv.mcbu ? rcv.mcbu : 0;

                                branchTotalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                                branchTotalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                            }
                        } else {
                            if (rcv.status !== 'pending') {
                                branchTargetLoanCollection -= rcv.targetCollection;

                                if (rcv.status == 'tomorrow') {
                                    branchTotalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                                    branchTotalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                                }
                            }
                        }
                    });
                }

                if (branch.transferDailyReceivedDetails?.length > 0 || branch.transferDailyGiverDetails?.length > 0 || branch.transferWeeklyReceivedDetails?.length > 0 || branch.transferWeeklyGiverDetails?.length > 0) {
                    branchTotalMcbuCol += totalTransferMcbu;
                    branchTargetLoanCollection += totalTransferTargetCollection;
                    branchTotalLoanCollection += totalTransferActualCollection;
                }

                branchTotalTransfer += transfer;
            }
        });

        let collection = {
            _id: division._id,
            name: division.name,
            noCurrentReleaseStr: '-',
            currentReleaseAmountStr: '-',
            activeClients: '-',
            activeBorrowers: '-',
            pendingClients: '-',
            totalReleasesStr: '-',
            totalLoanBalanceStr: '-',
            loanTargetStr: '-',
            mcbuStr: '-',
            mcbuColStr: '-',
            mcbuWithdrawalStr: '-',
            mcbuReturnAmtStr: '-',
            mcbuDailyWithdrawalStr: '-',
            excessStr: '-',
            totalStr: '-',
            mispaymentStr: '-',
            fullPaymentAmountStr: '-',
            noOfFullPayment: '-',
            pastDueStr: '-',
            noPastDue: '-',
            transfer: '-',
            cohStr: '-',
            page: 'division-summary',
            status: '-'
        }

        if (division?.branchCollection?.length > 0) {
            collection.activeClients = branchNoOfClients;
            collection.activeBorrowers = branchNoOfBorrowers;
            collection.pendingClients = branchNoOfPendings;
            collection.noNewCurrentRelease = branchNoOfNewCurrentRelease;
            collection.noReCurrentRelease = branchNoOfReCurrentRelease;
            collection.noCurrentReleaseStr = branchNoOfNewCurrentRelease + ' / ' + branchNoOfReCurrentRelease;
            collection.currentReleaseAmount = branchCurrentReleaseAmount;
            collection.currentReleaseAmountStr = branchCurrentReleaseAmount > 0 ? formatPricePhp(branchCurrentReleaseAmount) : '-';
            collection.totalReleases = branchTotalsLoanRelease;
            collection.totalReleasesStr = branchTotalsLoanRelease > 0 ? formatPricePhp(branchTotalsLoanRelease) : '-';
            collection.totalLoanBalance = branchTotalsLoanBalance;
            collection.totalLoanBalanceStr = branchTotalsLoanBalance > 0 ? formatPricePhp(branchTotalsLoanBalance) : '-';
            collection.loanTarget = branchTargetLoanCollection;
            collection.loanTargetStr = branchTargetLoanCollection > 0 ? formatPricePhp(branchTargetLoanCollection) : '-';
            collection.mcbu = branchTotalMcbu;
            collection.mcbuStr = branchTotalMcbu > 0 ? formatPricePhp(branchTotalMcbu) : '-';
            collection.mcbuCol = branchTotalMcbuCol;
            collection.mcbuColStr = branchTotalMcbuCol > 0 ? formatPricePhp(branchTotalMcbuCol) : '-';
            collection.mcbuWithdrawal = branchTotalMcbuWithdrawal;
            collection.mcbuWithdrawalStr = branchTotalMcbuWithdrawal > 0 ? formatPricePhp(branchTotalMcbuWithdrawal) : '-';
            collection.mcbuDailyWithdrawal = branchTotalMcbuDailyWithdrawal;
            collection.mcbuDailyWithdrawalStr = branchTotalMcbuDailyWithdrawal > 0 ? formatPricePhp(branchTotalMcbuDailyWithdrawal) : '-';
            collection.mcbuReturnAmt = branchTotalMcbuReturnAmt;
            collection.mcbuReturnAmtStr = branchTotalMcbuReturnAmt > 0 ? formatPricePhp(branchTotalMcbuReturnAmt) : '-';
            collection.excess = branchExcess;
            collection.excessStr = branchExcess > 0 ? formatPricePhp(branchExcess) : '-';
            collection.total = branchTotalLoanCollection;
            collection.totalStr = branchTotalLoanCollection > 0 ? formatPricePhp(branchTotalLoanCollection) : '-';
            collection.mispayment = branchMispayment;
            collection.fullPaymentAmount = branchFullPaymentAmount;
            collection.fullPaymentAmountStr = branchFullPaymentAmount > 0 ? formatPricePhp(branchFullPaymentAmount) : '-';
            collection.noOfFullPayment = branchNoOfFullPayment;
            collection.pastDue = branchTotalPastDue;
            collection.pastDueStr = branchTotalPastDue > 0 ? formatPricePhp(branchTotalPastDue) : '-';
            collection.noPastDue = branchTotalNoPastDue;
            collection.transfer = branchTotalTransfer;
            collection.transferStr = branchTotalTransfer >=0 ? branchTotalTransfer : `(${branchTotalTransfer * -1})`;
            collection.coh = branchTotalCOH;
            collection.cohStr = branchTotalCOH > 0 ? formatPricePhp(branchTotalCOH) : '-';
            collection.status = groupStatus;
        }

        collectionData.push(collection);
    });

    collectionData.map(collection => {
        if (collection.activeClients != '-') {
            noOfClients += collection.activeClients;
            noOfBorrowers += collection.activeBorrowers;
            noOfPendings += collection.pendingClients;
            noOfNewCurrentRelease += collection.noNewCurrentRelease;
            noOfReCurrentRelease += collection.noReCurrentRelease;
            currentReleaseAmount += collection.currentReleaseAmount;
            totalsLoanRelease += collection.totalReleases;
            totalsLoanBalance += collection.totalLoanBalance;
            targetLoanCollection += collection.loanTarget;
            excess += collection.excess;
            totalLoanCollection += collection.total;
            noOfFullPayment += collection.noOfFullPayment;
            fullPaymentAmount += collection.fullPaymentAmount;
            mispayment += collection.mispayment;
            totalPastDue += collection.pastDue;
            totalNoPastDue += collection.noPastDue;
            totalMcbu += collection.mcbu;
            totalMcbuCol += collection.mcbuCol;
            totalMcbuWithdrawal += collection.mcbuWithdrawal;
            totalMcbuReturnNo += collection.mcbuReturnAmt;
            totalMcbuReturnAmt += collection.mcbuReturnAmt;
            totalMcbuDailyWithdrawal += collection.mcbuDailyWithdrawal;
            totalTransfer += collection.transfer;
            totalCOH += collection.coh;
        }
    });

    const transferGvr = transferBranchDetailsTotal(collectionDailyTransferred, collectionWeeklyTransferred, 'Transfer GVR');
    const transferRcv = transferBranchDetailsTotal(collectionDailyReceived, collectionWeeklyReceived, 'Transfer RCV');
    if (collectionDailyTransferred?.length > 0 || collectionWeeklyTransferred?.length > 0) {
        collectionData.push(transferGvr);
    }
    if (collectionDailyReceived?.length > 0 || collectionWeeklyReceived?.length > 0) {
        collectionData.push(transferRcv);
    }

    const totals = {
        name: 'GRAND TOTALS',
        transfer: totalTransfer,
        noCurrentReleaseStr: noOfNewCurrentRelease + ' / ' + noOfReCurrentRelease,
        currentReleaseAmountStr: formatPricePhp(currentReleaseAmount),
        activeClients: noOfClients,
        activeBorrowers: noOfBorrowers,
        pendingClients: noOfPendings,
        totalReleasesStr: formatPricePhp(totalsLoanRelease),
        totalLoanBalanceStr: formatPricePhp(totalsLoanBalance),
        loanTargetStr: targetLoanCollection > 0 ? formatPricePhp(targetLoanCollection) : 0,
        excessStr: formatPricePhp(excess),
        totalStr: formatPricePhp(totalLoanCollection),
        mispaymentStr: mispayment + ' / ' + noOfClients,
        fullPaymentAmountStr: formatPricePhp(fullPaymentAmount),
        noOfFullPayment: noOfFullPayment,
        pastDueStr: formatPricePhp(totalPastDue),
        noPastDue: totalNoPastDue,
        mcbu: totalMcbu,
        mcbuStr: formatPricePhp(totalMcbu),
        mcbuCol: totalMcbuCol,
        mcbuColStr: formatPricePhp(totalMcbuCol),
        mcbuWithdrawal: totalMcbuWithdrawal,
        mcbuWithdrawalStr: formatPricePhp(totalMcbuWithdrawal),
        mcbuDailyWithdrawal: totalMcbuDailyWithdrawal,
        mcbuDailyWithdrawalStr: formatPricePhp(totalMcbuDailyWithdrawal),
        noMcbuReturn: totalMcbuReturnNo,
        mcbuReturnAmt: totalMcbuReturnAmt,
        mcbuReturnAmtStr: formatPricePhp(totalMcbuReturnAmt),
        cohStr: formatPricePhp(totalCOH),
        totalData: true
    };

    collectionData.push(totals);

    return collectionData;
}