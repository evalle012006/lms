import { GraphProvider } from '@/lib/graph/graph.provider';
import { apiHandler } from '@/services/api-handler';
import { formatPricePhp, safeNumber, UppercaseFirstLetter } from '@/lib/utils';
import moment from 'moment';
import { gql } from 'node_modules/apollo-boost/lib/index';
import logger from '@/logger';

const graph = new GraphProvider();

export default apiHandler({
    get: getData
});

const sleep = (millis) => {
    return new Promise((resolve) => {
        setTimeout(() => { resolve(true) }, millis)
    })
}

async function getData(req, res) {
    let statusCode = 200;
    let response = {};

    const { date, mode, groupIds, dayName, currentDate } = req.query;
    const groupIdsObj = JSON.parse(groupIds);
    const data = [];

    try {
        const promise = await new Promise(async (resolve, reject) => {
            try {
                let batch_ids = [];
                for (const id of groupIdsObj) {
                    batch_ids.push(id);
                    if (batch_ids.length === 10) {
                        await Promise.all(batch_ids.map(async (groupId) => {
                            data.push.apply(data, await getAllLoansPerGroup(date, mode, groupId, dayName, currentDate));
                        }));
                        await sleep(100); // Small delay to prevent overwhelming the system
                        batch_ids = [];
                    }
                }

                if (batch_ids.length) {
                    await Promise.all(batch_ids.map(async (groupId) => {
                        data.push.apply(data, await getAllLoansPerGroup(date, mode, groupId, dayName, currentDate));
                    }));
                    batch_ids = [];
                }

                resolve(true);
            } catch (err) {
                reject(err);
            }
        });

        if (promise) {
            data.sort((a, b) => { return a.groupNo - b.groupNo });
            
            // Process the data with all the business logic moved from frontend
            const processedData = await processData(data, date, mode, dayName, currentDate);
            
            response = { success: true, data: processedData };
        } else {
            statusCode = 500;
            response = { error: true, message: "Error fetching data" };
        }
    } catch (error) {
        console.error(error);
        logger.error('Error in cash collection API:', error);
        statusCode = 500;
        response = { error: true, message: "Error processing cash collection data" };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function getAllLoansPerGroup(date, mode, groupId, dayName, currentDate) {
    try {
        let cashCollection;

        if (currentDate === date) {
            cashCollection = await graph.apollo.query({
                query: gql`
                query loan_group ($day_name: String!, $curr_date: date!, $groupId: String!) {
                    collections: get_all_loans_per_group_by_curr_date_and_day_name(limit: 1, args: {
                      day_name: $day_name,
                      curr_date: $curr_date
                    }, where: {
                      _id: {
                        _eq: $groupId
                      }
                    }) {
                      _id
                      data
                    }
                }
                `,
                variables: {
                    day_name: dayName,
                    curr_date: date,
                    groupId,
                }
            }).then(res => res.data.collections.map(c => c.data));
        } else {
            cashCollection = await graph.apollo.query({
                query: gql`
                query loan_group ($day_name: String!, $date_added: date!, $groupId: String!) {
                    collections: get_all_loans_per_group_by_date_added_and_day_name(limit: 1, args: {
                      day_name: $day_name,
                      date_added: $date_added
                    }, where: {
                      _id: {
                        _eq: $groupId
                      }
                    }) {
                      _id
                      data
                    }
                }
                `,
                variables: {
                    day_name: dayName,
                    date_added: date,
                    groupId,
                }
            }).then(res => res.data.collections.map(c => c.data));
        }

        return cashCollection.map(c => ({
            ...c,
            cashCollections: c.cashCollections ?? [],
            loans: c.loans ?? [],
            activeLoans: c.activeLoans ?? [],
            currentRelease: c.currentRelease ?? [],
            fullPayment: c.fullPayment ?? [],
            transferGiverDetails: c.transferGiverDetails ?? [],
            transferReceivedDetails: c.transferReceivedDetails ?? []
        }))
    } catch (error) {
        logger.error(`Error fetching data for group ${groupId}:`, error);
        return [];
    }
}

async function processData(data, date, mode, dayName, currentDate) {
    const collectionTransferred = [];
    const collectionReceived = [];
    const collectionTransferredByGroup = [];
    const collectionReceivedByGroup = [];
    let collectionData = [];
    
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
    let totalPastDue = 0;
    let totalNoPastDue = 0;
    let mispayment = 0;
    let offsetPerson = 0;
    let totalMcbu = 0;
    let totalMcbuCol = 0;
    let totalMcbuWithdrawal = 0;
    let totalMcbuReturnNo = 0;
    let totalMcbuReturnAmt = 0;
    let totalMcbuTarget = 0;
    let totalMcbuInterest = 0;
    let totalTransfer = 0;
    let totalPendingLoans = 0;
    let totalAdmissionFee = 0;
    let totalLrf = 0;
    let totalCbhb = 0;
    let totalOtherIncome = 0;
    let totalCsf = 0;
    let totalCsfCollection = 0;
    let totalPaymentCollection = 0;
    let totalCsfWithdrawal = 0;
    let totalNetCollections = 0;
    let totalCsfReturnAmt = 0;

    const filter = date !== currentDate;
    const dayNameFilter = moment(date).format('dddd').toLowerCase();
    
    // Weekend and holiday logic would need to be passed from frontend or determined here
    const isWeekend = false; // This should be determined based on system settings
    const isHoliday = false; // This should be determined based on system settings

    for (const cc of data) {
        let collection = {
            groupId: cc._id,
            group: cc.name,
            groupNo: cc.groupNo,
            noOfClients: cc.noOfClients,
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
            mcbuInterestStr: '-',
            excessStr: '-',
            totalStr: '-',
            collectionStr: '-',
            mispayment: '-',
            fullPaymentAmountStr: '-',
            pastDueStr: '-',
            noPastDue: '-',
            noOfFullPayment: '-',
            offSetPerson: '-',
            transfer: 0,
            transferStr: '-',
            status: '-',
            admissionCollectionStr: '-',
            lrfCollectionStr: '-',
            cbhbCollectionStr: '-',
            otherIncomeStr: '-',
            csfStr: '-',
            csfCollectionStr: '-',
            csfWithdrawalStr: '-',
            csfReturnAmtStr: '-',
            totalNetCollectionStr: '-'
        };

        let selectedBranch = cc.branchId;
        let noCurrentRelease = '0 / 0';
        let groupStatus = 'pending';
        let isDraft = false;

        if (cc.cashCollections.length > 0) {
            if (cc.cashCollections[0].groupStatusArr && cc.cashCollections[0].groupStatusArr.length > 0) {
                const transactionStatus = cc.cashCollections[0].groupStatusArr.filter(status => status === "pending");
                if (transactionStatus.length === 0) {
                    groupStatus = 'closed';
                }

                const draft = cc.cashCollections[0].hasDraftsArr && cc.cashCollections[0].hasDraftsArr.filter(d => d === true);
                if (draft && draft.length > 0) {
                    isDraft = true;
                }
            }
        }
        
        if (!filter && (isWeekend || isHoliday)) {
            groupStatus = 'closed';
        }

        if (!filter) {
            // Process current data logic
            if (cc.loans.length > 0) {
                let loanTarget = 0;
                if ((cc.occurence === 'weekly' && cc.day === dayNameFilter) || cc.occurence === 'daily') {
                    loanTarget = cc.loans[0].loanTarget || 0;
                }

                collection = {
                    ...collection,
                    newCurrentRelease: 0,
                    reCurrentRelease: 0,
                    currentReleaseAmount: 0,
                    currentReleaseAmountStr: 0,
                    activeClients: 0,
                    activeBorrowers: 0,
                    pendingClients: 0,
                    loanTarget: loanTarget,
                    loanTargetStr: loanTarget > 0 ? formatPricePhp(loanTarget) : '-',
                    collection: cc.loans[0].collection || 0,
                    collectionStr: cc.loans[0].collection ? formatPricePhp(cc.loans[0].collection) : '-',
                    excess: cc.loans[0].excess || 0,
                    excessStr: cc.loans[0].excess ? formatPricePhp(cc.loans[0].excess) : 0,
                    total: cc.loans[0].total,
                    totalStr: formatPricePhp(cc.loans[0].total),
                    totalReleases: cc.loans[0].totalRelease || 0,
                    totalReleasesStr: cc.loans[0].totalRelease ? formatPricePhp(cc.loans[0].totalRelease) : '-',
                    totalLoanBalance: cc.loans[0].totalLoanBalance || 0,
                    totalLoanBalanceStr: cc.loans[0].totalLoanBalance ? formatPricePhp(cc.loans[0].totalLoanBalance) : '-',
                    fullPaymentAmount: '-',
                    fullPaymentAmountStr: '-',
                    noOfFullPayment: 0,
                    newFullPayment: 0,
                    reFullPayment: 0,
                    pastDue: cc.loans[0].pastDue,
                    pastDueStr: cc.loans[0].pastDue > 0 ? formatPricePhp(cc.loans[0].pastDue) : '-',
                    noPastDue: cc.loans[0].noPastDue > 0 ? cc.loans[0].noPastDue : '-',
                    mcbu: cc.loans[0].mcbu,
                    mcbuStr: cc.loans[0].mcbu > 0 ? formatPricePhp(cc.loans[0].mcbu) : '-',
                    mcbuCol: 0,
                    mcbuColStr: '-',
                    mcbuWithdrawal: 0,
                    mcbuWithdrawalStr: '-',
                    noMcbuReturn: 0,
                    mcbuReturnAmt: 0,
                    mcbuReturnAmtStr: '-',
                    mcbuInterest: 0,
                    mcbuInterestStr: '-',
                    transfer: 0,
                    transferStr: '-',
                    admissionCollection: 0,
                    admissionCollectionStr: '-',
                    lrfCollection: 0,
                    lrfCollectionStr: '-',
                    cbhbCollection: 0,
                    cbhbCollectionStr: '-',
                    otherIncome: 0,
                    otherIncomeStr: '-',
                    csf: cc.loans[0].csf,
                    csfStr: cc.loans[0].csf > 0 ? formatPricePhp(cc.loans[0].csf) : '-',
                    csfCollection: 0,
                    csfCollectionStr: '-',
                    csfWithdrawal: 0,
                    csfWithdrawalStr: '-',
                    csfReturnAmt: 0,
                    csfReturnAmtStr: '-',
                    totalNetCollection: 0,
                    totalNetCollectionStr: '-',
                    status: groupStatus,
                    isDraft: isDraft,
                    page: 'collection'
                };

                totalsLoanRelease += cc.loans[0].totalRelease ? cc.loans[0].totalRelease : 0;
                totalsLoanBalance += cc.loans[0].totalLoanBalance ? cc.loans[0].totalLoanBalance : 0;
                totalPastDue += cc.loans[0].pastDue;
                totalNoPastDue += cc.loans[0].noPastDue;
            }

            if (cc.activeLoans.length > 0) {
                collection = {
                    ...collection,
                    activeClients: cc.activeLoans[0].activeClients,
                    activeBorrowers: cc.activeLoans[0].activeBorrowers,
                    pendingClients: cc.activeLoans[0].pendingClients
                }

                noOfClients += cc.activeLoans[0].activeClients ? cc.activeLoans[0].activeClients : 0;
                noOfBorrowers += cc.activeLoans[0].activeBorrowers ? cc.activeLoans[0].activeBorrowers : 0;
                noOfPendings += cc.activeLoans[0].pendingClients ? cc.activeLoans[0].pendingClients : 0;
                totalPendingLoans += cc.activeLoans[0].pendingLoans ? cc.activeLoans[0].pendingLoans : 0;
            }
            
            // Process cash collections
            if (cc.cashCollections.length > 0) {
                let loanTarget = 0;
                if ((cc.occurence === 'weekly' && cc.day === dayNameFilter) || cc.occurence === 'daily') {
                    loanTarget = collection.loanTarget - cc.cashCollections[0].loanTarget;
                }

                let otherIncome = (cc.cashCollections[0].otherPassbookCollection || 0) + (cc.cashCollections[0].otherPictureCollection || 0);

                collection = { 
                    ...collection,
                    paymentCollection: cc.cashCollections[0].paymentCollection,
                    mispayment: cc.cashCollections[0].mispayment ? cc.cashCollections[0].mispayment : 0,
                    collection: cc.cashCollections[0].collection || 0,
                    collectionStr: cc.cashCollections[0].collection ? formatPricePhp(cc.cashCollections[0].collection) : '-',
                    excess: cc.cashCollections[0].excess || 0,
                    excessStr: cc.cashCollections[0].excess ? formatPricePhp(cc.cashCollections[0].excess) : '-',
                    loanTarget: loanTarget,
                    loanTargetStr: loanTarget > 0 ? formatPricePhp(loanTarget) : 0,
                    offsetPerson: cc.cashCollections[0].offsetPerson ? cc.cashCollections[0].offsetPerson : 0,
                    mcbuCol: cc.cashCollections[0].mcbuCol ? cc.cashCollections[0].mcbuCol : 0,
                    mcbuColStr: cc.cashCollections[0].mcbuCol > 0 ? formatPricePhp(cc.cashCollections[0].mcbuCol) : '-',
                    mcbuWithdrawal: cc.cashCollections[0].mcbuWithdrawal ? cc.cashCollections[0].mcbuWithdrawal : 0,
                    mcbuWithdrawalStr: cc.cashCollections[0].mcbuWithdrawal > 0 ? formatPricePhp(cc.cashCollections[0].mcbuWithdrawal) : '-',
                    mcbuInterest: cc.cashCollections[0].mcbuInterest ? cc.cashCollections[0].mcbuInterest : 0,
                    mcbuInterestStr: cc.cashCollections[0].mcbuInterest > 0 ? formatPricePhp(cc.cashCollections[0].mcbuInterest) : '-',
                    noMcbuReturn: cc.cashCollections[0].mcbuReturnNo ? cc.cashCollections[0].mcbuReturnNo : 0,
                    mcbuReturnAmt: cc.cashCollections[0].mcbuReturnAmt ? cc.cashCollections[0].mcbuReturnAmt : 0,
                    mcbuReturnAmtStr: cc.cashCollections[0].mcbuReturnAmt > 0 ? formatPricePhp(cc.cashCollections[0].mcbuReturnAmt) : '-',
                    admissionCollection: cc.cashCollections[0].admissionCollection,
                    admissionCollectionStr: cc.cashCollections[0].admissionCollection > 0 ? formatPricePhp(cc.cashCollections[0].admissionCollection) : '-',
                    lrfCollection: cc.cashCollections[0].lrfCollection,
                    lrfCollectionStr: cc.cashCollections[0].lrfCollection > 0 ? formatPricePhp(cc.cashCollections[0].lrfCollection) : '-',
                    cbhbCollection: cc.cashCollections[0].cbhbCollection,
                    cbhbCollectionStr: cc.cashCollections[0].cbhbCollection > 0 ? formatPricePhp(cc.cashCollections[0].cbhbCollection) : '-',
                    otherIncome: otherIncome,
                    otherIncomeStr: otherIncome > 0 ? formatPricePhp(otherIncome) : '-',
                    csfCollection: cc.cashCollections[0].csfCollection,
                    csfCollectionStr: cc.cashCollections[0].csfCollection > 0 ? formatPricePhp(cc.cashCollections[0].csfCollection) : '-',
                    csfWithdrawal: cc.cashCollections[0].csfWithdrawal,
                    csfWithdrawalStr: cc.cashCollections[0].csfWithdrawal > 0 ? formatPricePhp(cc.cashCollections[0].csfWithdrawal) : '-',
                    csfReturnAmt: cc.cashCollections[0].csfReturnAmt,
                    csfReturnAmtStr: cc.cashCollections[0].csfReturnAmt > 0 ? formatPricePhp(cc.cashCollections[0].csfReturnAmt) : '-',
                    transfer: 0,
                    transferStr: '-',
                };
                
                if (cc.cashCollections[0].mcbu > 0) {
                    collection.mcbu = cc.cashCollections[0].mcbu;
                    collection.mcbuStr = collection.mcbu > 0 ? formatPricePhp(collection.mcbu) : '-';
                }

                if (cc.cashCollections[0].csf > 0) {
                    collection.csf = cc.cashCollections[0].csf;
                    collection.csfStr = collection.csf > 0 ? formatPricePhp(collection.csf) : '-';
                }

                // Update totals
                excess += cc.cashCollections[0].excess ? cc.cashCollections[0].excess : 0;
                mispayment += cc.cashCollections[0].mispayment ? cc.cashCollections[0].mispayment : 0;
                offsetPerson += cc.cashCollections[0].offsetPerson ? cc.cashCollections[0].offsetPerson : 0;
                totalMcbuCol += cc.cashCollections[0].mcbuCol ? cc.cashCollections[0].mcbuCol : 0;
                totalMcbuWithdrawal += cc.cashCollections[0].mcbuWithdrawal ? cc.cashCollections[0].mcbuWithdrawal : 0;
                totalMcbuReturnNo += collection.noMcbuReturn;
                totalMcbuReturnAmt += cc.cashCollections[0].mcbuReturnAmt ? cc.cashCollections[0].mcbuReturnAmt : 0;
                totalTransfer += collection.transfer !== '-' ? collection.transfer : 0;
                totalMcbuTarget += cc.cashCollections[0].mcbuTarget ? cc.cashCollections[0].mcbuTarget : 0;
                totalMcbuInterest += cc.cashCollections[0].mcbuInterest;

                totalAdmissionFee += collection.admissionCollection;
                totalLrf += collection.lrfCollection;
                totalCbhb += collection.cbhbCollection;
                totalOtherIncome += collection.otherIncome;
                totalCsfCollection += collection.csfCollection;
                totalCsfWithdrawal += collection.csfWithdrawal;
                totalCsfReturnAmt += collection.csfReturnAmt;
                totalPaymentCollection += collection.paymentCollection;

                // Handle transferred amounts
                if (cc.cashCollections[0].transferredAmountRelease > 0) {
                    totalsLoanRelease += cc.cashCollections[0].transferredAmountRelease;
                    collection.totalReleases += cc.cashCollections[0].transferredAmountRelease;
                    collection.totalReleasesStr = formatPricePhp(collection.totalReleases);
                }

                if (cc.cashCollections[0].transferredLoanBalance > 0) {
                    totalsLoanBalance += cc.cashCollections[0].transferredLoanBalance;
                    collection.totalLoanBalance += cc.cashCollections[0].transferredLoanBalance;
                    collection.totalLoanBalanceStr = formatPricePhp(collection.totalLoanBalance);
                }

                if (cc.cashCollections[0].transferMCBU > 0) {
                    collection.mcbu -= cc.cashCollections[0].transferMCBU;
                    collection.mcbuStr = formatPricePhp(collection.mcbu);
                }

                if (cc.cashCollections[0].transfer > 0) {
                    collection.activeBorrowers -= cc.cashCollections[0].transfer;
                    collection.activeClients -= cc.cashCollections[0].transfer;
                }
            }

            // Process current releases
            if (cc.currentRelease.length > 0) {
                const totalCurrentRelease = cc.currentRelease[0].noOfCurrentRelease;
                noCurrentRelease = cc.currentRelease[0].newCurrentRelease + ' / ' + cc.currentRelease[0].reCurrentRelease;
                collection = {
                    ...collection,
                    noCurrentReleaseStr: noCurrentRelease,
                    newCurrentRelease: cc.currentRelease[0].newCurrentRelease ? cc.currentRelease[0].newCurrentRelease : 0,
                    reCurrentRelease: cc.currentRelease[0].reCurrentRelease ? cc.currentRelease[0].reCurrentRelease : 0,
                    currentReleaseAmount: cc.currentRelease[0].currentReleaseAmount ? cc.currentRelease[0].currentReleaseAmount : 0,
                    currentReleaseAmountStr: cc.currentRelease[0].currentReleaseAmount ? formatPricePhp(cc.currentRelease[0].currentReleaseAmount) : '-'
                };

                noOfNewCurrentRelease += cc.currentRelease[0].newCurrentRelease ? cc.currentRelease[0].newCurrentRelease : 0;
                noOfReCurrentRelease += cc.currentRelease[0].reCurrentRelease ? cc.currentRelease[0].reCurrentRelease : 0;
                currentReleaseAmount += cc.currentRelease[0].currentReleaseAmount ? cc.currentRelease[0].currentReleaseAmount : 0;
                
                if ((!collection.hasOwnProperty('status') || collection.status === '-')) {
                    collection.activeClients = collection.newCurrentRelease;
                    collection.status = "closed";
                    collection.page = "collection";
                    noOfClients += collection.newCurrentRelease;
                }

                if (collection.activeClients == 0 && (collection.activeBorrowers > 0 || totalCurrentRelease > 0)) {
                    collection.activeClients = totalCurrentRelease;
                    collection.status = "closed";
                }
            }

            // Process full payments
            if (cc.fullPayment.length > 0) {
                collection = {
                    ...collection,
                    fullPaymentAmount: cc.fullPayment.length > 0 ? cc.fullPayment[0].fullPaymentAmount : 0,
                    fullPaymentAmountStr: cc.fullPayment.length > 0 ? formatPricePhp(cc.fullPayment[0].fullPaymentAmount) : 0,
                    noOfFullPayment: cc.fullPayment.length > 0 ? cc.fullPayment[0].noOfFullPayment : 0,
                    newFullPayment: cc.fullPayment.length > 0 ? cc.fullPayment[0].newFullPayment : 0,
                    reFullPayment: cc.fullPayment.length > 0 ? cc.fullPayment[0].reFullPayment : 0
                };

                fullPaymentAmount += cc.fullPayment[0].fullPaymentAmount ? cc.fullPayment[0].fullPaymentAmount : 0;
                noOfFullPayment += cc.fullPayment[0].noOfFullPayment ? cc.fullPayment[0].noOfFullPayment : 0;
            }
        } else {
            // Handle filtered data (historical dates)
            if (cc.cashCollections.length > 0) {
                noCurrentRelease = cc.cashCollections[0].newCurrentRelease + ' / ' + cc.cashCollections[0].reCurrentRelease;
                const dayNameFilter = moment(date).format('dddd').toLowerCase();
                let loanTarget = 0;
                if ((cc.occurence === 'weekly' && cc.day === dayNameFilter) || cc.occurence === 'daily') {
                    loanTarget = cc.cashCollections[0].loanTarget || 0;
                }

                let otherIncome = (cc.cashCollections[0].otherPassbookCollection || 0) + (cc.cashCollections[0].otherPictureCollection || 0);

                collection = {
                    groupId: cc._id,
                    group: cc.name,
                    groupNo: cc.groupNo,
                    noCurrentReleaseStr: noCurrentRelease,
                    newCurrentRelease: cc.cashCollections[0].newCurrentRelease,
                    reCurrentRelease: cc.cashCollections[0].reCurrentRelease,
                    currentReleaseAmount: cc.cashCollections[0].currentReleaseAmount,
                    currentReleaseAmountStr: formatPricePhp(cc.cashCollections[0].currentReleaseAmount),
                    activeClients: cc.cashCollections[0].activeClients,
                    activeBorrowers: cc.cashCollections[0].activeBorrowers,
                    pendingClients: cc.cashCollections[0].pendingClients,
                    mispayment: cc.cashCollections[0].mispayment,
                    collection: cc.cashCollections[0].collection,
                    collectionStr: formatPricePhp(cc.cashCollections[0].collection),
                    excess: cc.cashCollections[0].excess,
                    excessStr: formatPricePhp(cc.cashCollections[0].excess),
                    loanTarget: loanTarget,
                    loanTargetStr: formatPricePhp(loanTarget),
                    pastDue: cc.cashCollections[0].pastDue,
                    pastDueStr: formatPricePhp(cc.cashCollections[0].pastDue),
                    noPastDue: cc.cashCollections[0].noPastDue,
                    totalReleases: cc.cashCollections[0].totalRelease,
                    totalReleasesStr: formatPricePhp(cc.cashCollections[0].totalRelease),
                    totalLoanBalance: cc.cashCollections[0].totalLoanBalance,
                    totalLoanBalanceStr: formatPricePhp(cc.cashCollections[0].totalLoanBalance),
                    fullPaymentAmount: cc.cashCollections[0].fullPaymentAmount,
                    fullPaymentAmountStr: formatPricePhp(cc.cashCollections[0].fullPaymentAmount),
                    noOfFullPayment: cc.cashCollections[0].noOfFullPayment,
                    newFullPayment: cc.cashCollections[0].newFullPayment,
                    reFullPayment: cc.cashCollections[0].reFullPayment,
                    mcbu: cc.cashCollections[0].mcbu ? cc.cashCollections[0].mcbu : 0,
                    mcbuStr: cc.cashCollections[0].mcbu ? formatPricePhp(cc.cashCollections[0].mcbu) : 0,
                    mcbuCol: cc.cashCollections[0].mcbuCol ? cc.cashCollections[0].mcbuCol : 0,
                    mcbuColStr: cc.cashCollections[0].mcbuCol ? formatPricePhp(cc.cashCollections[0].mcbuCol) : 0,
                    mcbuWithdrawal: cc.cashCollections[0].mcbuWithdrawal ? cc.cashCollections[0].mcbuWithdrawal : 0,
                    mcbuWithdrawalStr: cc.cashCollections[0].mcbuWithdrawal ? formatPricePhp(cc.cashCollections[0].mcbuWithdrawal) : 0,
                    noMcbuReturn: cc.cashCollections[0].mcbuReturnNo ? cc.cashCollections[0].mcbuReturnNo : 0,
                    mcbuReturnAmt: cc.cashCollections[0].mcbuReturnAmt ? cc.cashCollections[0].mcbuReturnAmt : 0,
                    mcbuReturnAmtStr: cc.cashCollections[0].mcbuReturnAmt ? formatPricePhp(cc.cashCollections[0].mcbuReturnAmt) : 0,
                    mcbuInterest: cc.cashCollections[0].mcbuInterest,
                    mcbuInterestStr: cc.cashCollections[0].mcbuInterest > 0 ? formatPricePhp(cc.cashCollections[0].mcbuInterest) : '-',
                    admissionCollection: cc.cashCollections[0].admissionCollection,
                    admissionCollectionStr: cc.cashCollections[0].admissionCollection > 0 ? formatPricePhp(cc.cashCollections[0].admissionCollection) : '-',
                    lrfCollection: cc.cashCollections[0].lrfCollection,
                    lrfCollectionStr: cc.cashCollections[0].lrfCollection > 0 ? formatPricePhp(cc.cashCollections[0].lrfCollection) : '-',
                    cbhbCollection: cc.cashCollections[0].cbhbCollection,
                    cbhbCollectionStr: cc.cashCollections[0].cbhbCollection > 0 ? formatPricePhp(cc.cashCollections[0].cbhbCollection) : '-',
                    otherIncome: otherIncome,
                    otherIncomeStr: otherIncome > 0 ? formatPricePhp(otherIncome) : '-',
                    csf: cc.cashCollections[0].csf,
                    csfStr: cc.cashCollections[0].csf > 0 ? formatPricePhp(cc.cashCollections[0].csf) : '-',
                    csfCollection: cc.cashCollections[0].csfCollection,
                    csfCollectionStr: cc.cashCollections[0].csfCollection > 0 ? formatPricePhp(cc.cashCollections[0].csfCollection) : '-',
                    csfWithdrawal: cc.cashCollections[0].csfWithdrawal,
                    csfWithdrawalStr: cc.cashCollections[0].csfWithdrawal > 0 ? formatPricePhp(cc.cashCollections[0].csfWithdrawal) : '-',
                    csfReturnAmt: cc.cashCollections[0].csfReturnAmt,
                    csfReturnAmtStr: cc.cashCollections[0].csfReturnAmt > 0 ? formatPricePhp(cc.cashCollections[0].csfReturnAmt) : '-',
                    transfer: 0,
                    transferStr: '-',
                    status: groupStatus,
                    isDraft: isDraft,
                    page: 'collection'
                };

                // Update totals for filtered data
                noOfNewCurrentRelease += cc.cashCollections[0].newCurrentRelease;
                noOfReCurrentRelease += cc.cashCollections[0].reCurrentRelease;
                currentReleaseAmount += cc.cashCollections[0].currentReleaseAmount;
                noOfClients += cc.cashCollections[0].activeClients;
                noOfBorrowers += cc.cashCollections[0].activeBorrowers;
                noOfPendings += cc.cashCollections[0].pendingClients;
                excess += cc.cashCollections[0].excess;
                mispayment += cc.cashCollections[0].mispayment;
                totalPastDue += cc.cashCollections[0].pastDue;
                totalNoPastDue += cc.cashCollections[0].noPastDue;
                totalsLoanRelease += cc.cashCollections[0].totalRelease;
                totalsLoanBalance += cc.cashCollections[0].totalLoanBalance;
                fullPaymentAmount += cc.cashCollections[0].fullPaymentAmount;
                noOfFullPayment += cc.cashCollections[0].noOfFullPayment;
                totalMcbuCol += cc.cashCollections[0].mcbuCol;
                totalMcbuWithdrawal += cc.cashCollections[0].mcbuWithdrawal;
                totalMcbuReturnNo += collection.noMcbuReturn;
                totalMcbuReturnAmt += cc.cashCollections[0].mcbuReturnAmt;
                totalMcbuTarget += cc.cashCollections[0].mcbuTarget ? cc.cashCollections[0].mcbuTarget : 0;
                totalMcbuInterest += cc.cashCollections[0].mcbuInterest;
                totalAdmissionFee += collection.admissionCollection;
                totalLrf += collection.lrfCollection;
                totalCbhb += collection.cbhbCollection;
                totalOtherIncome += collection.otherIncome;
                totalCsfCollection += collection.csfCollection;
                totalPaymentCollection += collection.paymentCollection;
                totalCsfWithdrawal += collection.csfWithdrawal;
                totalCsfReturnAmt += collection.csfReturnAmt;
            }
        }

        // Process transfers
        let transfer = 0;
        if (cc.transferGiverDetails && cc.transferGiverDetails.length > 0) {
            collectionTransferred.push(...cc.transferGiverDetails);
            transfer = transfer - cc.transferGiverDetails.length;

            cc.transferGiverDetails.forEach(giver => {
                if (giver.sameLo) {
                    collectionTransferredByGroup.push(giver);
                }

                if (filter) {
                    collection.activeClients -= 1;
                    if (giver.status !== "completed") {
                        collection.activeBorrowers -= 1;
                    }
                }

                collection.mcbu -= giver.mcbu;
                collection.csf -= giver.csf;
                collection.totalReleases = collection.totalReleases ? collection.totalReleases : 0;
                collection.totalReleases -= giver.amountRelease ? giver.amountRelease : 0;
                collection.totalLoanBalance = collection.totalLoanBalance ? collection.totalLoanBalance : 0;
                collection.totalLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;

                totalsLoanRelease -= giver.amountRelease ? giver.amountRelease : 0;
                totalsLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;
            });
        }

        if (cc.transferReceivedDetails && cc.transferReceivedDetails.length > 0) {
            collectionReceived.push(...cc.transferReceivedDetails);
            transfer = transfer + cc.transferReceivedDetails.length;

            cc.transferReceivedDetails.forEach(rcv => {
                if (rcv.sameLo) {
                    collectionReceivedByGroup.push(rcv);
                }

                if (!filter) {
                    if (rcv.status !== 'pending') {
                        collection.activeClients += 1;
                        if (rcv.status !== "completed") {
                            collection.activeBorrowers += 1;
                        }
                        collection.mcbu += rcv.mcbu ? rcv.mcbu : 0;
                        collection.csf += rcv.csf;

                        collection.totalReleases = collection.totalReleases ? collection.totalReleases : 0;
                        collection.totalReleases += rcv.amountRelease ? rcv.amountRelease : 0;
                        collection.totalLoanBalance = collection.totalLoanBalance ? collection.totalLoanBalance : 0;
                        collection.totalLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;

                        totalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                        totalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                    }
                } else {
                    if (rcv.status !== 'pending') {
                        if (rcv.remarks?.value != 'excused advance payment') {
                            collection.loanTarget -= rcv.targetCollection;
                            collection.loanTargetStr = formatPricePhp(collection.loanTarget);
                        }

                        if (rcv.status == 'tomorrow') {
                            collection.totalReleases += rcv.amountRelease ? rcv.amountRelease : 0;
                            collection.totalLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;

                            totalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                            totalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                        }
                    }
                }
            });
        }

        if (cc.transferGiverDetails?.length > 0 || cc.transferReceivedDetails?.length > 0) {
            collection.mcbuStr = formatPricePhp(collection.mcbu);
            collection.totalReleasesStr = formatPricePhp(collection.totalReleases);
            collection.totalLoanBalanceStr = formatPricePhp(collection.totalLoanBalance);

            collection.activeClients = collection.activeClients > -1 ? collection.activeClients : 0;
            collection.activeBorrowers = collection.activeBorrowers > -1 ? collection.activeBorrowers : 0;
        }

        collection.transfer = transfer;
        collection.transferStr = transfer >= 0 ? transfer : `(${transfer * -1})`;
        totalTransfer += transfer;

        // Calculate total net collection
        const totalNetCollection = (
            safeNumber(collection.mcbuCol) + 
            safeNumber(collection.csfCollection) + 
            safeNumber(collection.paymentCollection) + 
            safeNumber(collection.admissionCollection) + 
            safeNumber(collection.lrfCollection) + 
            safeNumber(collection.cbhbCollection) + 
            safeNumber(collection.otherIncome)
        ) - (
            safeNumber(collection.mcbuWithdrawal) + 
            safeNumber(collection.csfWithdrawal) + 
            safeNumber(collection.mcbuReturnAmt)
        );

        collection.totalNetCollection = totalNetCollection;
        collection.totalNetCollectionStr = formatPricePhp(totalNetCollection);

        collectionData.push(collection);
    }

    // Sort by group number
    collectionData.sort((a, b) => a.groupNo - b.groupNo);
    
    // Recalculate totals after sorting
    noOfClients = 0;
    noOfBorrowers = 0;
    collectionData.forEach(c => {
        totalLoanCollection += (c.collection && c.collection !== '-') ? c.collection : 0;
        targetLoanCollection += (c.loanTarget && c.loanTarget !== '-') ? c.loanTarget : 0;
        totalMcbu += c.mcbu ? c.mcbu : 0;
        noOfClients += c.activeClients !== '-' ? c.activeClients : 0;
        noOfBorrowers += c.activeBorrowers !== '-' ? c.activeBorrowers : 0;
        totalCsf += c.csf;
        totalNetCollections += c.totalNetCollection;
    });

    if (collectionData.length > 0) {
        // Sort transfers
        collectionTransferred.sort((a, b) => a.slotNo - b.slotNo);
        collectionReceived.sort((a, b) => a.slotNo - b.slotNo);
        collectionTransferredByGroup.sort((a, b) => a.slotNo - b.slotNo);
        collectionReceivedByGroup.sort((a, b) => a.slotNo - b.slotNo);
        
        const transferGvr = transferDetailsTotal(collectionTransferred, 'Transfer GVR');
        const transferRcv = transferDetailsTotal(collectionReceived, 'Transfer RCV');
        const transferGvrByGroup = transferDetailsTotal(collectionTransferredByGroup, 'Transfer GVR');
        const transferRcvByGroup = transferDetailsTotal(collectionReceivedByGroup, 'Transfer RCV');
        
        let totals = {
            group: 'GRAND TOTALS',
            transfer: totalTransfer >= 0 ? totalTransfer : -Math.abs(totalTransfer),
            transferStr: totalTransfer >= 0 ? totalTransfer : `(${totalTransfer * -1})`,
            noOfNewCurrentRelease: noOfNewCurrentRelease,
            noCurrentRelease: noOfNewCurrentRelease + noOfReCurrentRelease,
            noCurrentReleaseStr: noOfNewCurrentRelease + ' / ' + noOfReCurrentRelease,
            currentReleaseAmount: currentReleaseAmount,
            currentReleaseAmountStr: currentReleaseAmount ? formatPricePhp(currentReleaseAmount) : 0,
            activeClients: noOfClients >= 0 ? noOfClients : 0,
            activeBorrowers: noOfBorrowers >= 0 ? noOfBorrowers : 0,
            pendingClients: noOfPendings,
            totalLoanRelease: totalsLoanRelease,
            totalReleasesStr: totalsLoanRelease ? formatPricePhp(totalsLoanRelease) : 0,
            totalLoanBalance: totalsLoanBalance,
            totalLoanBalanceStr: totalsLoanBalance ? formatPricePhp(totalsLoanBalance) : 0,
            targetLoanCollection: targetLoanCollection,
            loanTargetStr: targetLoanCollection ? formatPricePhp(targetLoanCollection) : 0,
            excess: excess,
            excessStr: excess ? formatPricePhp(excess) : 0,
            collection: totalLoanCollection,
            collectionStr: totalLoanCollection ? formatPricePhp(totalLoanCollection) : 0,
            mispaymentPerson: mispayment,
            mispayment: mispayment + ' / ' + noOfClients,
            fullPaymentAmount: fullPaymentAmount,
            fullPaymentAmountStr: fullPaymentAmount ? formatPricePhp(fullPaymentAmount) : 0,
            noOfFullPayment: noOfFullPayment,
            pastDue: totalPastDue,
            pastDueStr: formatPricePhp(totalPastDue),
            noPastDue: totalNoPastDue,
            offsetPerson: offsetPerson,
            mcbu: totalMcbu,
            mcbuStr: formatPricePhp(totalMcbu),
            mcbuCol: totalMcbuCol,
            mcbuColStr: formatPricePhp(totalMcbuCol),
            mcbuWithdrawal: totalMcbuWithdrawal,
            mcbuWithdrawalStr: formatPricePhp(totalMcbuWithdrawal),
            noMcbuReturn: totalMcbuReturnNo,
            mcbuReturnAmt: totalMcbuReturnAmt,
            mcbuReturnAmtStr: formatPricePhp(totalMcbuReturnAmt),
            mcbuTarget: totalMcbuTarget,
            mcbuInterest: totalMcbuInterest,
            mcbuInterestStr: formatPricePhp(totalMcbuInterest),
            admissionCollection: totalAdmissionFee,
            admissionCollectionStr: totalAdmissionFee > 0 ? formatPricePhp(totalAdmissionFee) : '-',
            lrfCollection: totalLrf,
            lrfCollectionStr: totalLrf > 0 ? formatPricePhp(totalLrf) : '-',
            cbhbCollection: totalCbhb,
            cbhbCollectionStr: totalCbhb > 0 ? formatPricePhp(totalCbhb) : '-',
            otherIncome: totalOtherIncome,
            otherIncomeStr: totalOtherIncome > 0 ? formatPricePhp(totalOtherIncome) : '-',
            csf: totalCsf,
            csfStr: totalCsf > 0 ? formatPricePhp(totalCsf) : '-',
            csfCollection: totalCsfCollection,
            paymentCollection: totalPaymentCollection,
            csfCollectionStr: totalCsfCollection > 0 ? formatPricePhp(totalCsfCollection) : '-',
            csfWithdrawal: totalCsfWithdrawal,
            csfWithdrawalStr: totalCsfWithdrawal > 0 ? formatPricePhp(totalCsfWithdrawal) : '-',
            csfReturnAmt: totalCsfReturnAmt,
            csfReturnAmtStr: totalCsfReturnAmt > 0 ? formatPricePhp(totalCsfReturnAmt) : '-',
            totalNetCollection: totalNetCollections,
            totalNetCollectionStr: totalNetCollections > 0 ? formatPricePhp(totalNetCollections) : '-',
            totalData: true,
            status: '-',
            totalPendingLoans: totalPendingLoans
        };

        const consolidateTotalData = consolidateTotals(totals, transferGvr, transferRcv);
        if (collectionTransferred.length > 0 || collectionReceived.length > 0) {
            collectionData.push(consolidateTotalData);
        }

        // Adjust totals based on transfers
        if (transferGvr?.totalLoanRelease > 0) {
            totals.mcbuCol -= transferGvr.mcbuCol;
            totals.mcbuColStr = formatPricePhp(totals.mcbuCol);
            totals.targetLoanCollection -= transferGvr.targetLoanCollection;
            totals.loanTargetStr = formatPricePhp(totals.targetLoanCollection);
            totals.excess -= transferGvr.excess;
            totals.excessStr = totals.excess > 0 ? formatPricePhp(totals.excess) : '-';
            totals.collection -= transferGvr.collection;
            totals.collectionStr = formatPricePhp(totals.collection);
            totals.mcbuWithdrawal -= transferGvr.mcbuWithdrawal;
            totals.mcbuWithdrawalStr = formatPricePhp(totals.mcbuWithdrawal);
            totals.mcbuReturnAmt -= transferGvr.mcbuReturnAmt;
            totals.mcbuReturnAmtStr = formatPricePhp(totals.mcbuReturnAmt);
            totals.pastDue -= transferGvr.pastDue;
            totals.pastDueStr = formatPricePhp(totals.pastDue);
            totals.csfCollection -= transferGvr.csfCollection;
        }

        if (transferRcv?.totalLoanRelease > 0) {
            totals.mcbuCol += transferRcv.mcbuCol;
            totals.mcbuColStr = formatPricePhp(totals.mcbuCol);
            totals.targetLoanCollection += transferRcv.targetLoanCollection;
            totals.loanTargetStr = formatPricePhp(totals.targetLoanCollection);
            totals.excess += transferRcv.excess;
            totals.excessStr = totals.excess > 0 ? formatPricePhp(totals.excess) : '-';
            totals.collection += transferRcv.collection;
            totals.collectionStr = formatPricePhp(totals.collection);
            totals.mcbuWithdrawal += transferRcv.mcbuWithdrawal;
            totals.mcbuWithdrawalStr = formatPricePhp(totals.mcbuWithdrawal);
            totals.mcbuReturnAmt += transferRcv.mcbuReturnAmt;
            totals.mcbuReturnAmtStr = formatPricePhp(totals.mcbuReturnAmt);
            totals.pastDue += transferRcv.pastDue;
            totals.pastDueStr = formatPricePhp(totals.pastDue);
        }

        if (collectionTransferred.length > 0) {
            collectionData.push(transferGvr);
        }
        if (collectionReceived.length > 0) {
            collectionData.push(transferRcv);
        }
        collectionData.push(totals);
    }

    return collectionData;
}

const consolidateTotals = (totals, transferGvr, transferRcv) => {
    let totalTransfer = 0;
    let totalMcbu = totals.mcbu;
    let totalLoanRelease = totals.totalLoanRelease;
    let totalLoanBalance = totals.totalLoanBalance;
    let totalTargetCollection = totals.targetLoanCollection;
    let totalPastDue = totals.pastDue;
    let totalNoPastDue = totals.noPastDue;

    if (transferGvr) {
        let transfer = transferGvr.transfer;

        if (transfer && typeof transfer === 'string' && transfer !== "-") {
            transfer = transfer.replace("(", "").replace(")", "");
            transfer = parseInt(transfer);
        }

        transfer = Math.abs(transfer);
        totalTransfer += transfer !== "-" ? transfer : 0;
        totalMcbu += transferGvr.mcbu;
        totalPastDue += (transferGvr.pastDue && transferGvr.pastDue !== '-') ? transferGvr.pastDue : 0;
        totalNoPastDue += (transferGvr.noPastDue && transferGvr.noPastDue !== '-') ? transferGvr.noPastDue : 0;
    }

    if (transferRcv) {
        let transfer = transferRcv.transfer;
        totalTransfer -= transfer !== "-" ? transfer : 0;
        totalMcbu -= transferRcv.mcbu;
        totalPastDue -= (transferRcv.pastDue && transferRcv.pastDue !== '-') ? transferRcv.pastDue : 0;
        totalNoPastDue -= (transferRcv.noPastDue && transferRcv.noPastDue !== '-') ? transferRcv.noPastDue : 0;
    }

    const activeClients = totals.activeClients + totalTransfer;
    const activeBorrowers = totals.activeBorrowers + totalTransfer;
    totalTargetCollection = totalTargetCollection > 0 ? totalTargetCollection : 0;
    totalPastDue = totalPastDue > 0 ? totalPastDue : 0;
    totalNoPastDue = totalNoPastDue > 0 ? totalNoPastDue : 0;

    return {
        ...totals,
        group: 'TOTALS',
        transfer: 0,
        transferStr: "-",
        activeClients: activeClients > 0 ? activeClients : 0,
        activeBorrowers: activeBorrowers > 0 ? activeBorrowers : 0,
        totalLoanRelease: totalLoanRelease,
        totalReleasesStr: totalLoanRelease ? formatPricePhp(totalLoanRelease) : 0,
        totalLoanBalance: totalLoanBalance,
        totalLoanBalanceStr: totalLoanBalance ? formatPricePhp(totalLoanBalance) : 0,
        targetLoanCollection: totalTargetCollection,
        loanTargetStr: totalTargetCollection ? formatPricePhp(totalTargetCollection) : 0,
        excessStr: '-',
        pastDue: totalPastDue,
        pastDueStr: formatPricePhp(totalPastDue),
        noPastDue: totalNoPastDue,
        mcbu: totalMcbu,
        mcbuStr: formatPricePhp(totalMcbu),
        totalData: true,
        status: '-'
    }
}

const transferDetailsTotal = (details, type) => {
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
    let totalCurrentReleaseAmount = 0;
    let totalCsf = 0;
    let totalCsfCollection = 0;
    let totalCsfWithdrawal = 0;
    let totalCsfReturnAmt = 0;

    details.forEach(transfer => {
        totalTransfer++;
        totalMcbu += transfer.mcbu;
        totalLoanRelease += transfer.amountRelease;
        totalLoanBalance += transfer.loanBalance;
        totalCurrentReleaseAmount += transfer.currentReleaseAmount;
        totalCsf += transfer.csf;

        if (type == 'Transfer RCV') {
            if (transfer.status == 'completed') {
                totalTdaClients += 1;
            } else if (transfer.status == 'pending') {
                totalPendingClients += 1;
            }
        }

        const details = transfer?.data && transfer.data[0];
        if (details) {
            totalMcbuTarget += details.mcbuTarget;
            totalMcbuCol += details.mcbuCol;
            totalTargetCollection += details.actualCollection;
            totalActualCollection += details.actualCollection;
            totalPastDue += details.pastDue;
            totalNoPastDue += details.noPastDue;
            totalCsfCollection += details.csfCollection;
        }
    });

    return {
        group: type.toUpperCase(),
        transfer: (type === 'Transfer GVR' && totalTransfer > 0) ? -Math.abs(totalTransfer) : totalTransfer,
        transferStr: (type === 'Transfer GVR' && totalTransfer > 0) ? `(${totalTransfer})` : totalTransfer,
        noOfNewCurrentRelease: '-',
        noCurrentReleaseStr: '-',
        currentReleaseAmount: (type === 'Transfer GVR' && totalCurrentReleaseAmount > 0) ? -Math.abs(totalCurrentReleaseAmount) : totalCurrentReleaseAmount,
        currentReleaseAmountStr: '-',
        activeClients: '-',
        activeBorrowers: '-',
        totalLoanRelease: totalLoanRelease,
        totalReleasesStr: '-',
        totalLoanBalance: totalLoanBalance,
        totalLoanBalanceStr: '-',
        targetLoanCollection: totalTargetCollection,
        loanTargetStr: (type === 'Transfer GVR' && totalTargetCollection > 0) ? `(${formatPricePhp(totalTargetCollection)})` : formatPricePhp(totalTargetCollection),
        excess: 0,
        excessStr: '-',
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
        totalTdaClients: (type === 'Transfer RCV') ? totalTdaClients : 0,
        totalPendingClients: (type === 'Transfer RCV') ? totalPendingClients : 0,
        csf: 0,
        csfStr: '-',
        csfCollection: totalCsf,
        csfCollectionStr: (type === 'Transfer GVR' && totalCsf > 0) ? `(${formatPricePhp(totalCsf)})` : formatPricePhp(totalCsf),
        csfWithdrawal: totalCsfWithdrawal,
        csfWithdrawalStr: (type === 'Transfer GVR' && totalCsfWithdrawal > 0) ? `(${formatPricePhp(totalCsfWithdrawal)})` : formatPricePhp(totalCsfWithdrawal),
        csfReturnAmt: totalCsfReturnAmt,
        csfReturnAmtStr: (type === 'Transfer GVR' && totalCsfReturnAmt > 0) ? `(${formatPricePhp(totalCsfReturnAmt)})` : formatPricePhp(totalCsfReturnAmt),
        totalNetCollection: 0,
        totalNetCollectionStr: '-',
        totalData: true,
        status: '-'
    }
}