import { USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { transferBranchDetailsTotal } from '@/lib/transfer-util';
import { formatPricePhp } from '@/lib/utils';
import logger from '@/logger';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'node_modules/apollo-boost/lib/index';

export default apiHandler({
    get: getData
});

const graph = new GraphProvider();
const USER_TYPE = createGraphType('users', `${USER_FIELDS}`)('users');
const BRANCH_TYPE = createGraphType('branches', `_id`)('branches');

const sleep = (millis) => {
    return new Promise((resolve) => {
        setTimeout(() => { resolve(true)}, millis)
    })
}

async function getData (req, res) {
    let statusCode = 200;
    let response = {};

    const { date, currentUserId, selectedBranchGroup, dayName, currentDate } = req.query;
    const user = await graph.query(
        queryQl(USER_TYPE, { where: { _id: { _eq: currentUserId } } })
    ).then(res => res.data.users);
    // filtered out B000 branch id
    const getBranchIds = (where) => graph.query(queryQl(BRANCH_TYPE, {where})).then(res => res.data.branches.filter(b => b._id != '668de44b2b02009ec7b806f1').map(b => b._id));

    if (user.length > 0) {
        let branchIds = [];
        if (selectedBranchGroup == 'mine' && user[0].role.rep !== 1) {
            if (user[0].areaId && user[0].role.shortCode === 'area_admin') {
                branchIds = await getBranchIds({ areaId: { _eq: user[0].areaId } })
            } else if (user[0].regionId && user[0].role.shortCode === 'regional_manager') {
                branchIds = await getBranchIds({ regionId: { _eq: user[0].regionId } })
            } else if (user[0].divisionId && user[0].role.shortCode === 'deputy_director') {
                branchIds = await getBranchIds({ divisionId: { _eq: user[0].divisionId } })
            }
        } else {
            branchIds = await getBranchIds({ });
        }
        
        const data = [];
        const promise = await new Promise(async (resolve, reject) => {
            try {
                let batch_ids = [];
                for(const id of branchIds) {
                    batch_ids.push(id);
                    if(batch_ids.length == 10) {
                        await Promise.all(batch_ids.map(async (branchId) => {
                            console.log('calling branch transaction for id ', branchId);
                            data.push.apply(data, await getAllLoanTransactionsByBranch(branchId, date, dayName, currentDate));
                        }));

                        await sleep(500);
                        batch_ids = [];
                    }
                    
                }

                if(batch_ids.length) {
                    await Promise.all(batch_ids.map(async (branchId) => {
                        data.push.apply(data, await getAllLoanTransactionsByBranch(branchId, date, dayName, currentDate));
                    }));

                    await sleep(500);
                    batch_ids = [];
                }

                resolve(true);
            } catch(err) {
                reject(err)
            }
        }).catch(err => {
            console.error(err)
            throw err;
        })

        if (promise) {
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
            response = { success: true, data: processedData };
        } else {
            statusCode = 500;
            response = { error: true, message: "Error fetching data" };
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function getAllLoanTransactionsByBranch(branchId, date, dayName, currentDate) {
    try {

    
    const version = 2; // change here to use old query
    let cashCollection;
    if (currentDate === date) {

        if(version == 2) {
            cashCollection = await graph.apollo.query({
                query: gql`
                query get_all_loans_per_branch_a($branch_id: String!, $curr_date: date!, $day_name: String!) {
                    branches: get_all_loans_per_branch_a(args: {
                        branch_id: $branch_id, curr_date: $curr_date
                    }) { _id data }
                    
                    cashCollections: get_all_loans_per_branch_a_cashCollections(args: {
                        branch_id: $branch_id, curr_date: $curr_date, day_name: $day_name
                    }) { _id data }

                    loans: get_all_loans_per_branch_a_loans(args: {
                        branch_id: $branch_id, curr_date: $curr_date, day_name: $day_name
                    }) { _id data }
                    
                    activeLoans: get_all_loans_per_branch_a_activeLoans(args: {
                        branch_id: $branch_id, curr_date: $curr_date
                    }) { _id data }
                    
                    currentRelease: get_all_loans_per_branch_a_currentRelease(args: {
                        branch_id: $branch_id, curr_date: $curr_date,
                    }) { _id data }
                    
                    fullPayment: get_all_loans_per_branch_a_fullPayment(args: {
                        branch_id: $branch_id, curr_date: $curr_date
                    }) { _id data }
                    
                    transferDailyReceivedDetails: get_all_loans_per_branch_a_tdrd(args: {
                        branch_id: $branch_id, curr_date: $curr_date
                    }) { _id data }
                    
                    transferDailyGiverDetails: get_all_loans_per_branch_a_tdgd(args: {
                        branch_id: $branch_id, curr_date: $curr_date
                    }) { _id data }
                    
                    transferWeeklyReceivedDetails: get_all_loans_per_branch_a_twrd(args: {
                        branch_id: $branch_id, curr_date: $curr_date
                    }) { _id data }
                    
                    transferWeeklyGiverDetails: get_all_loans_per_branch_a_twgd(args: {
                        branch_id: $branch_id, curr_date: $curr_date
                    }) { _id data }
                }
                `,
                variables: {
                    day_name: dayName,
                    curr_date: date,
                    branch_id: branchId,
                }
            })
            .then(res => res.data.branches?.map(c => ({
                ... c.data,
                cashCollections: res.data.cashCollections.map(c => c.data),
                activeLoans: res.data.activeLoans.map(c => c.data),
                currentRelease: res.data.currentRelease.map(c => c.data),
                loans: res.data.loans.map(c => c.data),
                fullPayment: res.data.fullPayment.map(c => c.data),
                transferDailyReceivedDetails: res.data.transferDailyReceivedDetails.map(c => c.data),
                transferDailyGiverDetails: res.data.transferDailyGiverDetails.map(c => c.data),
                transferWeeklyReceivedDetails: res.data.transferWeeklyReceivedDetails.map(c => c.data),
                transferWeeklyGiverDetails: res.data.transferWeeklyGiverDetails.map(c => c.data),
            })));
        } else {
            cashCollection = await graph.apollo.query({
                query: gql`
                query loan_group ($day_name: String!, $curr_date: date!, $branchId: String!) {
                    collections: get_all_loans_per_branch_by_curr_date_and_day_name(limit: 1, args: {
                      day_name: $day_name,
                      curr_date: $curr_date
                    }, where: {
                      _id: {
                        _eq: $branchId
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
                    branchId,
                }
            })
            .then(res => res.data.collections.map(c => c.data));
        }
       
    } else {
        cashCollection = await graph.apollo.query({
            query: gql`
            query loan_group ($day_name: String!, $date_added: date!, $branchId: String!) {
                collections: get_all_loans_per_branch_by_date_added_and_day_name_v2(limit: 1, args: {
                  day_name: $day_name,
                  date_added: $date_added
                }, where: {
                  _id: {
                    _eq: $branchId
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
                branchId,
            }
        }).then(res => res.data.collections.map(c => c.data));
    }
     
    return cashCollection.map(c => ({
        ... c,
        cashCollections: c.cashCollections ?? [],
        loans: c.loans ?? [],
        activeLoans: c.activeLoans ?? [],
        currentRelease: c.currentRelease ?? [],
        fullPayment: c.fullPayment ?? [],
        transferGiverDetails: c.transferGiverDetails ?? [],
        transferReceivedDetails: c.transferReceivedDetails ?? []
      }))

    } catch (err) {
        console.log('error ', branchId, date, dayName, currentDate)
        return [];
      }
}



async function processData(data, date, currentDate) {
    let collectionDailyTransferred = [];
    let collectionDailyReceived = [];
    let collectionWeeklyTransferred = [];
    let collectionWeeklyReceived = [];
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
    let mispayment = 0;
    let totalPastDue = 0;
    let totalNoPastDue = 0;
    let totalMcbu = 0;
    let totalMcbuCol = 0;
    let totalMcbuWithdrawal = 0;
    let totalMcbuReturnNo = 0;
    let totalMcbuReturnAmt = 0;
    // let totalMcbuDailyWithdrawal = 0;
    let totalTransfer = 0;
    let totalCOH = 0;

    const filter = date !== currentDate;
    
    console.log(data.length);
    data.map(branch => {
        let collection = {
            _id: branch._id,
            name: branch.code + ' - ' + branch.name,
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
            mcbuDailyWithdrawalStr: '-',
            mcbuReturnAmtStr: '-',
            excessStr: '-',
            totalStr: '-',
            mispaymentStr: '-',
            fullPaymentAmountStr: '-',
            noOfFullPayment: '-',
            pastDueStr: '-',
            noPastDue: '-',
            transfer: '-',
            cohStr: '-',
            page: 'branch-summary',
            status: '-'
        };

        let groupStatus = 'open';
        if (branch?.draftCollections?.length > 0) {
            const transactionStatus = branch.draftCollections[0].groupStatusArr.filter(status => status === "pending");
            const draft = branch.draftCollections[0].hasDraftsArr.filter(d => d === true);
            if (transactionStatus.length == 0 && draft.length == 0) {
                groupStatus = 'close';
            }
        } else if (branch.cashCollections.length > 0) {
            const transactionStatus = branch.cashCollections[0].groupStatusArr.filter(status => status === "pending");
            const draft = branch.cashCollections[0].hasDraftsArr.filter(d => d === true);
            if (transactionStatus.length == 0 && draft.length == 0) {
                groupStatus = 'close';
            }
        }

        if (!filter) {
            if (branch.activeLoans.length > 0) {
                collection.activeClients = branch.activeLoans[0].activeClients; 
                collection.activeBorrowers = branch.activeLoans[0].activeBorrowers;
                collection.pendingClients = branch.activeLoans[0].pendingClients;
                noOfClients += branch.activeLoans[0].activeClients;
                noOfBorrowers += branch.activeLoans[0].activeBorrowers;
                noOfPendings += branch.activeLoans[0].pendingClients;
            }

            if (branch.loans.length > 0) {
                collection.totalReleases = branch.loans[0].totalRelease;
                collection.totalReleasesStr = collection.totalReleases > 0 ? formatPricePhp(collection.totalReleases) : '-';
                collection.totalLoanBalance = branch.loans[0].totalLoanBalance;
                collection.totalLoanBalanceStr = collection.totalLoanBalance > 0 ? formatPricePhp(collection.totalLoanBalance) : '-';
                collection.loanTarget = branch.loans[0].loanTarget;
                collection.loanTargetStr = branch.loans[0].loanTarget > 0 ? formatPricePhp(branch.loans[0].loanTarget) : '-';
                collection.pastDue = branch.loans[0].pastDue;
                collection.pastDueStr = collection.pastDue > 0 ? formatPricePhp(collection.pastDue) : '-';
                collection.noPastDue = branch.loans[0].noPastDue;
                collection.mcbu = branch.loans[0].mcbu;
                collection.mcbuStr = branch.loans[0].mcbu > 0 ? formatPricePhp(branch.loans[0].mcbu) : '-';
                collection.mcbuCol = 0;
                collection.mcbuColStr = '-';
                collection.mcbuWithdrawal = 0;
                collection.mcbuWithdrawalStr = '-';
                collection.mcbuDailyWithdrawal = 0;
                collection.mcbuDailyWithdrawalStr = '-';
                collection.noMcbuReturn = 0;
                collection.mcbuReturnAmt = 0;
                collection.mcbuReturnAmtStr = '-';
                collection.status = groupStatus;

                totalsLoanRelease += collection.totalReleases;
                totalsLoanBalance += collection.totalLoanBalance;
                totalPastDue += collection.pastDue;
                totalNoPastDue += collection.noPastDue;
                // totalMcbu += collection.mcbu;
            }
            
            // if (branch?.draftCollections?.length > 0) {
            //     const draftCollection = branch.draftCollections[branch.draftCollections.length - 1];
            //     const loanTarget = collection.loanTarget - draftCollection.loanTarget;

            //     collection.loanTarget = loanTarget;
            //     collection.loanTargetStr = loanTarget > 0 ? formatPricePhp(loanTarget) : '-';
            //     collection.excessStr = draftCollection.excess > 0 ? formatPricePhp(draftCollection.excess) : '-';
            //     collection.total = draftCollection.collection;
            //     collection.totalStr = draftCollection.collection > 0 ? formatPricePhp(draftCollection.collection) : '-';
            //     collection.mispaymentStr = draftCollection.mispayment > 0 ? draftCollection.mispayment : '-';
            //     collection.mcbu = draftCollection.mcbu;
            //     collection.mcbuStr = collection.mcbu > 0 ? formatPricePhp(collection.mcbu) : '-';
            //     collection.mcbuCol = draftCollection.mcbuCol;
            //     collection.mcbuColStr = collection.mcbuCol > 0 ? formatPricePhp(collection.mcbuCol) : '-';
            //     collection.mcbuWithdrawal = draftCollection.mcbuWithdrawal;
            //     collection.mcbuWithdrawalStr = collection.mcbuWithdrawal ? formatPricePhp(collection.mcbuWithdrawal) : '-';
            //     collection.noMcbuReturn = draftCollection.mcbuReturnNo;
            //     collection.mcbuReturnAmt = draftCollection.mcbuReturnAmt;
            //     collection.mcbuReturnAmtStr = collection.mcbuReturnAmt ? formatPricePhp(collection.mcbuReturnAmt) : '-';
            //     collection.transfer = 0;
            //     collection.transferStr = '-';

            //     excess += draftCollection.excess;
            //     totalLoanCollection += draftCollection.collection;
            //     mispayment += draftCollection.mispayment;
            //     totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
            //     totalMcbuWithdrawal += collection.mcbuWithdrawal ? collection.mcbuWithdrawal : 0;
            //     totalMcbuReturnNo += collection.noMcbuReturn ? collection.noMcbuReturn : 0;
            //     totalMcbuReturnAmt += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
            //     totalTransfer += collection.transfer !== '-' ? collection.transfer : 0;
            // } else 
            if (branch.cashCollections.length > 0 && branch.cashCollections[0].collection > 0) {
                const loanTarget = collection.loanTarget - branch.cashCollections[0].loanTarget;

                collection.loanTarget = loanTarget;
                collection.loanTargetStr = loanTarget > 0 ? formatPricePhp(loanTarget) : '-';
                collection.excessStr = branch.cashCollections[0].excess > 0 ? formatPricePhp(branch.cashCollections[0].excess) : '-';
                collection.total = branch.cashCollections[0].collection;
                collection.totalStr = branch.cashCollections[0].collection > 0 ? formatPricePhp(branch.cashCollections[0].collection) : '-';
                collection.mispaymentStr = branch.cashCollections[0].mispayment > 0 ? branch.cashCollections[0].mispayment : '-';
                collection.mcbu = branch.cashCollections[0].mcbu;
                collection.mcbuStr = collection.mcbu > 0 ? formatPricePhp(collection.mcbu) : '-';
                collection.mcbuCol = branch.cashCollections[0].mcbuCol;
                collection.mcbuColStr = collection.mcbuCol > 0 ? formatPricePhp(collection.mcbuCol) : '-';
                collection.mcbuWithdrawal = branch.cashCollections[0].mcbuWithdrawal;
                collection.mcbuWithdrawalStr = collection.mcbuWithdrawal ? formatPricePhp(collection.mcbuWithdrawal) : '-';
                collection.mcbuDailyWithdrawal = branch.cashCollections[0].mcbuDailyWithdrawal;
                collection.mcbuDailyWithdrawalStr = collection.mcbuDailyWithdrawal ? formatPricePhp(collection.mcbuDailyWithdrawal) : '-';
                collection.noMcbuReturn = branch.cashCollections[0].mcbuReturnNo;
                collection.mcbuReturnAmt = branch.cashCollections[0].mcbuReturnAmt;
                collection.mcbuReturnAmtStr = collection.mcbuReturnAmt ? formatPricePhp(collection.mcbuReturnAmt) : '-';
                collection.transfer = 0;
                collection.transferStr = '-';

                excess += branch.cashCollections[0].excess;
                totalLoanCollection += branch.cashCollections[0].collection;
                mispayment += branch.cashCollections[0].mispayment;
                // totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
                totalMcbuWithdrawal += collection.mcbuWithdrawal ? collection.mcbuWithdrawal : 0;
                // totalMcbuDailyWithdrawal += collection.mcbuDailyWithdrawal ? collection.mcbuDailyWithdrawal : 0;
                totalMcbuReturnNo += collection.noMcbuReturn ? collection.noMcbuReturn : 0;
                totalMcbuReturnAmt += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
                totalTransfer += collection.transfer !== '-' ? collection.transfer : 0;
            }

            if (branch.currentRelease.length > 0) {
                const newReleasePerson = branch.currentRelease[0].newCurrentRelease ? branch.currentRelease[0].newCurrentRelease : 0;
                const reReleasePerson = branch.currentRelease[0].reCurrentRelease ? branch.currentRelease[0].reCurrentRelease : 0;
                collection.noCurrentReleaseStr = newReleasePerson + ' / ' + reReleasePerson;
                collection.currentReleaseAmountStr = formatPricePhp(branch.currentRelease[0].currentReleaseAmount);

                noOfNewCurrentRelease += branch.currentRelease[0].newCurrentRelease;
                noOfReCurrentRelease += branch.currentRelease[0].reCurrentRelease;
                currentReleaseAmount += branch.currentRelease[0].currentReleaseAmount;

                if (newReleasePerson > 0 && collection.activeClients === '-') {
                    collection.allNew = true;
                    noOfClients += newReleasePerson;
                }
            }

            if (branch.fullPayment.length > 0) {
                collection.noOfFullPayment = branch.fullPayment[0].noOfFullPayment;
                collection.fullPaymentAmountStr = formatPricePhp(branch.fullPayment[0].fullPaymentAmount);

                fullPaymentAmount += branch.fullPayment[0].fullPaymentAmount;
                noOfFullPayment += branch.fullPayment[0].noOfFullPayment;
            }

            targetLoanCollection += collection.loanTarget ? collection.loanTarget : 0;
        } else {
            if (branch.cashCollections.length > 0) {
                collection.activeClients = branch.cashCollections[0].activeClients; 
                collection.activeBorrowers = branch.cashCollections[0].activeBorrowers;
                collection.pendingClients = branch.cashCollections[0].pendingClients;

                collection.totalReleases = branch.cashCollections[0].totalRelease;
                collection.totalReleasesStr = collection.totalReleases > 0 ? formatPricePhp(collection.totalReleases) : '-';
                collection.totalLoanBalance = branch.cashCollections[0].totalLoanBalance;
                collection.totalLoanBalanceStr = collection.totalLoanBalance > 0 ? formatPricePhp(collection.totalLoanBalance) : '-';
                collection.loanTarget = branch.cashCollections[0].loanTarget;
                collection.loanTargetStr = branch.cashCollections[0].loanTarget > 0 ? formatPricePhp(branch.cashCollections[0].loanTarget) : '-';
                
                collection.excessStr = branch.cashCollections[0].excess > 0 ? formatPricePhp(branch.cashCollections[0].excess) : '-';
                collection.total = branch.cashCollections[0].collection;
                collection.totalStr = branch.cashCollections[0].collection > 0 ? formatPricePhp(branch.cashCollections[0].collection) : '-';
                collection.mispaymentStr = branch.cashCollections[0].mispayment;
                collection.pastDue = branch.cashCollections[0].pastDue ? branch.cashCollections[0].pastDue : 0;
                collection.pastDueStr = collection.pastDue > 0 ? formatPricePhp(collection.pastDue) : '-';
                collection.noPastDue = branch.cashCollections[0].noPastDue ? branch.cashCollections[0].noPastDue : 0;

                collection.mcbu = branch.cashCollections[0].mcbu ? branch.cashCollections[0].mcbu: 0;
                collection.mcbuStr = collection.mcbu > 0 ? formatPricePhp(collection.mcbu): '-';
                collection.mcbuCol = branch.cashCollections[0].mcbuCol ? branch.cashCollections[0].mcbuCol: 0;
                collection.mcbuColStr = collection.mcbuCol > 0 ? formatPricePhp(collection.mcbuCol): '-';
                collection.mcbuWithdrawal = branch.cashCollections[0].mcbuWithdrawal ? branch.cashCollections[0].mcbuWithdrawal: 0;
                collection.mcbuWithdrawalStr = collection.mcbuWithdrawal > 0 ? formatPricePhp(collection.mcbuWithdrawal): '-';
                collection.noMcbuReturn = branch.cashCollections[0].mcbuReturnNo ? branch.cashCollections[0].mcbuReturnNo: 0;
                collection.mcbuReturnAmt = branch.cashCollections[0].mcbuReturnAmt ? branch.cashCollections[0].mcbuReturnAmt: 0;
                collection.mcbuReturnAmtStr = collection.mcbuReturnAmt > 0 ? formatPricePhp(collection.mcbuReturnAmt): '-';
                collection.mcbuDailyWithdrawal = branch.cashCollections[0].mcbuDailyWithdrawal;
                collection.mcbuDailyWithdrawalStr = collection.mcbuDailyWithdrawal ? formatPricePhp(collection.mcbuDailyWithdrawal) : '-';

                const newReleasePerson = branch.cashCollections[0].newCurrentRelease;
                const reReleasePerson = branch.cashCollections[0].reCurrentRelease;
                collection.noCurrentReleaseStr = newReleasePerson + ' / ' + reReleasePerson;
                collection.currentReleaseAmountStr = formatPricePhp(branch.cashCollections[0].currentReleaseAmount);

                collection.noOfFullPayment = branch.cashCollections[0].noOfFullPayment;
                collection.fullPaymentAmountStr = formatPricePhp(branch.cashCollections[0].fullPaymentAmount);
                collection.status = groupStatus;

                collection.transfer = 0;
                collection.transferStr = '-';

                noOfClients += branch.cashCollections[0].activeClients;
                noOfBorrowers += branch.cashCollections[0].activeBorrowers;
                noOfPendings += branch.cashCollections[0].pendingClients;
                totalsLoanRelease += branch.cashCollections[0].totalRelease;
                totalsLoanBalance += branch.cashCollections[0].totalLoanBalance;
                targetLoanCollection += branch.cashCollections[0].loanTarget ? branch.cashCollections[0].loanTarget : 0;
                excess += branch.cashCollections[0].excess;
                totalLoanCollection += branch.cashCollections[0].collection;
                mispayment += branch.cashCollections[0].mispayment;
                totalPastDue += collection.pastDue;
                totalNoPastDue += collection.noPastDue;
                noOfNewCurrentRelease += branch.cashCollections[0].newCurrentRelease;
                noOfReCurrentRelease += branch.cashCollections[0].reCurrentRelease;
                currentReleaseAmount += branch.cashCollections[0].currentReleaseAmount;
                fullPaymentAmount += branch.cashCollections[0].fullPaymentAmount;
                noOfFullPayment += branch.cashCollections[0].noOfFullPayment;
                // totalMcbu += collection.mcbu ? collection.mcbu : 0;
                // totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
                totalMcbuWithdrawal += collection.mcbuWithdrawal ? collection.mcbuWithdrawal : 0;
                // totalMcbuDailyWithdrawal += collection.mcbuDailyWithdrawal ? collection.mcbuDailyWithdrawal : 0;
                totalMcbuReturnNo += collection.noMcbuReturn ? collection.noMcbuReturn : 0;
                totalMcbuReturnAmt += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
                totalTransfer += collection.transfer !== '-' ? collection.transfer : 0;
            }
        }

        if (branch.cashOnHand.length > 0) {
            collection.coh = branch.cashOnHand[0].amount ? branch.cashOnHand[0].amount : 0;
            collection.cohStr = collection.coh > 0 ? formatPricePhp(collection.coh) : '-';

            totalCOH += collection.coh;
        }

        if (branch.transferDailyGiverDetails.length > 0 || branch.transferDailyReceivedDetails.length > 0 || branch.transferWeeklyGiverDetails.length > 0 || branch.transferWeeklyReceivedDetails.length > 0) {
            let transfer = 0;
            let totalTransferMcbu = 0;
            let totalTransferTargetCollection = 0;
            let totalTransferActualCollection = 0;

            if (branch.transferDailyGiverDetails.length > 0) {
                collectionDailyReceived = [
                    ... collectionDailyReceived,
                    ... branch.transferDailyGiverDetails
                ]
                // collectionDailyReceived.push.apply(collectionDailyReceived, branch.transferDailyGiverDetails);
                transfer = transfer - branch.transferDailyGiverDetails.length;

                branch.transferDailyGiverDetails.map(giver => {    
                    if (filter) {
                        collection.activeClients -= 1;
                        if (giver.status !== "completed") {
                            collection.activeBorrowers -= 1;
                        }
                    }

                    collection.mcbu -= giver.mcbu;
                    totalTransferMcbu -= giver.mcbu;

                    const details = giver.data[0];
                    const actualCollection = details?.actualCollection ? details?.actualCollection : 0;
                    totalTransferTargetCollection -= actualCollection;
                    totalTransferActualCollection -= actualCollection;

                    collection.totalReleases = collection.totalReleases ? collection.totalReleases : 0;
                    collection.totalReleases -= giver.amountRelease ? giver.amountRelease : 0;
                    collection.totalLoanBalance = collection.totalLoanBalance ? collection.totalLoanBalance : 0;
                    collection.totalLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;

                    totalsLoanRelease -= giver.amountRelease ? giver.amountRelease : 0;
                    totalsLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;
                });
            }

            if (branch.transferDailyReceivedDetails.length > 0) {
                collectionDailyTransferred = [
                    ... collectionDailyTransferred,
                    ... branch.transferDailyReceivedDetails
                ];

                // collectionDailyTransferred.push.apply(collectionDailyTransferred, branch.transferDailyReceivedDetails);
                transfer = transfer + branch.transferDailyReceivedDetails.length;
                
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
                                collection.activeBorrowers += 1;
                            }
                            collection.mcbu += rcv.mcbu ? rcv.mcbu : 0;

                            collection.totalReleases = collection.totalReleases ? collection.totalReleases : 0;
                            collection.totalReleases += rcv.amountRelease ? rcv.amountRelease : 0;
                            collection.totalLoanBalance = collection.totalLoanBalance ? collection.totalLoanBalance : 0;
                            collection.totalLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;

                            totalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                            totalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                        }
                    } else {
                        if (rcv.status !== 'pending') {
                            collection.loanTarget -= rcv.targetCollection;
                            collection.loanTargetStr = formatPricePhp(collection.loanTarget);

                            if (rcv.status == 'tomorrow') {
                                collection.totalReleases += rcv.amountRelease ? rcv.amountRelease : 0;
                                collection.totalLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;

                                totalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                                totalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                            }
    
                            targetLoanCollection -= rcv.targetCollection;
                        }
                    }
                });
            }

            if (branch.transferWeeklyGiverDetails.length > 0) {
                collectionWeeklyReceived = [
                    ... collectionWeeklyReceived,
                    ... branch.transferWeeklyGiverDetails,
                ]
                // collectionWeeklyReceived.push.apply(collectionWeeklyReceived, branch.transferWeeklyGiverDetails);
                transfer = transfer - branch.transferWeeklyGiverDetails.length;

                branch.transferWeeklyGiverDetails.map(giver => {
                    if (filter) {
                        collection.activeClients -= 1;
                        if (giver.status !== "completed") {
                            collection.activeBorrowers -= 1;
                        }
                    }
                    collection.mcbu -= giver.mcbu;
                    totalTransferMcbu -= giver.mcbu;

                    const details = giver.data[0];
                    const actualCollection = details?.actualCollection ? details?.actualCollection : 0;
                    totalTransferTargetCollection -= actualCollection;
                    totalTransferActualCollection -= actualCollection;

                    collection.totalReleases = collection.totalReleases ? collection.totalReleases : 0;
                    collection.totalReleases -= giver.amountRelease ? giver.amountRelease : 0;
                    collection.totalLoanBalance = collection.totalLoanBalance ? collection.totalLoanBalance : 0;
                    collection.totalLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;

                    totalsLoanRelease -= giver.amountRelease ? giver.amountRelease : 0;
                    totalsLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;
                });
            }
            
            if (branch.transferWeeklyReceivedDetails.length > 0) {
                collectionWeeklyTransferred = [
                    ... collectionWeeklyTransferred,
                    ... branch.transferWeeklyReceivedDetails,
                ]
                // collectionWeeklyTransferred.push.apply(collectionWeeklyTransferred, branch.transferWeeklyReceivedDetails);
                transfer = transfer + branch.transferWeeklyReceivedDetails.length;

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
                                collection.activeBorrowers += 1;
                            }
                            collection.mcbu += rcv.mcbu ? rcv.mcbu : 0;

                            collection.totalReleases = collection.totalReleases ? collection.totalReleases : 0;
                            collection.totalReleases += rcv.amountRelease ? rcv.amountRelease : 0;
                            collection.totalLoanBalance = collection.totalLoanBalance ? collection.totalLoanBalance : 0;
                            collection.totalLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;

                            totalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                            totalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                        }
                    } else {
                        if (rcv.status !== 'pending') {
                            collection.loanTarget -= rcv.targetCollection;
                            collection.loanTargetStr = formatPricePhp(collection.loanTarget);

                            if (rcv.status == 'tomorrow') {
                                collection.totalReleases += rcv.amountRelease ? rcv.amountRelease : 0;
                                collection.totalLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;

                                totalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                                totalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                            }
    
                            targetLoanCollection -= rcv.targetCollection;
                        }
                    }
                });
            }

            if (branch.transferDailyReceivedDetails.length > 0 || branch.transferDailyGiverDetails.length > 0 || branch.transferWeeklyReceivedDetails.length > 0 || branch.transferWeeklyGiverDetails.length > 0) {
                collection.mcbuStr = formatPricePhp(collection.mcbu);
                collection.totalReleasesStr = formatPricePhp(collection.totalReleases);
                collection.totalLoanBalanceStr = formatPricePhp(collection.totalLoanBalance);
                collection.mcbuCol += totalTransferMcbu;
                collection.mcbuColStr = formatPricePhp(collection.mcbuCol);
                collection.loanTarget += totalTransferTargetCollection;
                collection.loanTargetStr = formatPricePhp(collection.loanTarget);
                collection.total += totalTransferActualCollection;
                collection.totalStr = formatPricePhp(collection.total);

                collection.activeClients = collection.activeClients > -1 ? collection.activeClients : 0;
                collection.activeBorrowers = collection.activeBorrowers > -1 ? collection.activeBorrowers : 0;
            }
            
            collection.transfer = transfer;
            collection.transferStr = transfer >= 0 ? transfer : `(${transfer * -1})`;
            totalTransfer += transfer;
        }

        collectionData.push(collection);
    });

    collectionData.map(c => {
        totalMcbu += c.mcbu ? c.mcbu : 0;
        totalMcbuCol += c.mcbuCol ? c.mcbuCol : 0;
    });

    const transferGvr = transferBranchDetailsTotal(collectionDailyTransferred, collectionWeeklyTransferred, 'Transfer GVR');
    const transferRcv = transferBranchDetailsTotal(collectionDailyReceived, collectionWeeklyReceived, 'Transfer RCV');
    if (collectionDailyTransferred.length > 0 || collectionWeeklyTransferred.length > 0) {
        collectionData.push(transferGvr);
    }
    if (collectionDailyReceived.length > 0 || collectionWeeklyReceived.length > 0) {
        collectionData.push(transferRcv);
    }

    const branchTotals = {
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
        // mcbuDailyWithdrawal: totalMcbuDailyWithdrawal,
        // mcbuDailyWithdrawalStr: formatPricePhp(totalMcbuDailyWithdrawal),
        noMcbuReturn: totalMcbuReturnNo,
        mcbuReturnAmt: totalMcbuReturnAmt,
        mcbuReturnAmtStr: formatPricePhp(totalMcbuReturnAmt),
        coh: totalCOH,
        cohStr: formatPricePhp(totalCOH),
        totalData: true
    };

    collectionData.push(branchTotals);

    return collectionData;
}