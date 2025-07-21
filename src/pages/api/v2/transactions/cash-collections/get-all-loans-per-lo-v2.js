import { apiHandler } from '@/services/api-handler';
import { formatPricePhp, safeNumber } from '@/lib/utils';
import moment from 'moment';
import logger from '@/logger';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { gql } from 'node_modules/apollo-boost/lib/index';

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

    const { date, mode, loIds, dayName, currentDate } = req.query;
    const loIdsObj = JSON.parse(loIds);
    const data = [];

    try {
        const promise = await new Promise(async (resolve, reject) => {
            try {
                let batch_ids = [];
                for (const id of loIdsObj) {
                    batch_ids.push(id);
                    if (batch_ids.length === 10) {
                        await Promise.all(batch_ids.map(async (loId) => {
                            const loData = await getAllLoansPerLO(date, mode, loId, dayName, currentDate);
                            if (loData && loData.length > 0) {
                                data.push(loData[0]);
                            }
                        }));
                        await sleep(100);
                        batch_ids = [];
                    }
                }

                if (batch_ids.length) {
                    await Promise.all(batch_ids.map(async (loId) => {
                        const loData = await getAllLoansPerLO(date, mode, loId, dayName, currentDate);
                        if (loData && loData.length > 0) {
                            data.push(loData[0]);
                        }
                    }));
                    batch_ids = [];
                }

                resolve(true);
            } catch (err) {
                reject(err);
            }
        });

        if (promise) {
            data.sort((a, b) => a.loNo - b.loNo);
            
            // Process the data with all the business logic moved from frontend
            const processedData = await processLoanOfficerData(data, date, currentDate);
            
            response = { success: true, data: processedData };
        } else {
            statusCode = 500;
            response = { error: true, message: "Error fetching data" };
        }
    } catch (error) {
        logger.error('Error in loan officer cash collection API:', error);
        statusCode = 500;
        response = { error: true, message: "Error processing loan officer data" };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function getAllLoansPerLO(date, mode, loId, dayName, currentDate) {
    try {
        let cashCollection;

        if (currentDate === date) {
            cashCollection = await graph.apollo.query({
                query: gql`
                query loan_group ($day_name: String!, $curr_date: date!, $loId: String!) {
                    collections: get_all_loans_per_lo_by_curr_date_and_day_name(limit: 1,  args: {
                      day_name: $day_name,
                      curr_date: $curr_date
                    }, where: {
                      _id: {
                        _eq: $loId
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
                    loId
                }
            }).then(res => res.data.collections.map(c => c.data));
        } else {
            cashCollection = await graph.apollo.query({
                query: gql`
                query loan_group ($day_name: String!, $date_added: date!, $loId: String!) {
                    collections: get_all_loans_per_lo_by_date_added_and_day_name(limit: 1, args: {
                      day_name: $day_name,
                      date_added: $date_added
                    }, where: {
                      _id: {
                        _eq: $loId
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
                    loId
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
            transferDailyGiverDetails: c.transferDailyGiverDetails ?? [],
            transferDailyReceivedDetails: c.transferDailyReceivedDetails ?? [],
            transferWeeklyGiverDetails: c.transferWeeklyGiverDetails ?? [],
            transferWeeklyReceivedDetails: c.transferWeeklyReceivedDetails ?? []
        }));
    } catch (error) {
        logger.error(`Error fetching data for LO ${loId}:`, error);
        return [];
    }
}

async function processLoanOfficerData(data, date, currentDate) {
    const collectionDailyTransferred = [];
    const collectionDailyReceived = [];
    const collectionWeeklyTransferred = [];
    const collectionWeeklyReceived = [];
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
    let offsetPerson = 0;
    let totalMcbu = 0;
    let totalMcbuCol = 0;
    let totalMcbuWithdrawal = 0;
    let totalMcbuReturnNo = 0;
    let totalMcbuReturnAmt = 0;
    let totalMcbuInterest = 0;
    let totalTransfer = 0;
    let totalCsf = 0;
    let totalCsfCollection = 0;
    let totalCsfWithdrawal = 0;
    let totalCsfReturnAmt = 0;
    let totalAdmissionFee = 0;
    let totalLrf = 0;
    let totalCbhb = 0;
    let totalOtherIncome = 0;
    let totalNetCollections = 0;

    const filter = date !== currentDate;
    const dayNameFilter = moment(date).format('dddd').toLowerCase();
    
    // Weekend and holiday logic would need to be passed from frontend or determined here
    const isWeekend = false; // This should be determined based on system settings
    const isHoliday = false; // This should be determined based on system settings

    let selectedBranch;

    for (const lo of data) {
        selectedBranch = lo.designatedBranchId;
        const nameArr = lo.firstName.split(' ');
        
        let collection = {
            _id: lo._id,
            name: `${lo.firstName} ${lo.lastName}`,
            transactionType: lo.transactionType,
            order: nameArr[1],
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
            noMcbuReturn: '-',
            mcbuReturnAmtStr: '-',
            mcbuInterestStr: '-',
            excessStr: '-',
            totalStr: '-',
            mispaymentStr: '-',
            fullPaymentAmountStr: '-',
            noOfFullPayment: '-',
            pastDueStr: '-',
            noPastDue: '-',
            offsetPerson: '-',
            transfer: 0,
            transferStr: '-',
            // New columns
            csfStr: '-',
            csfCollectionStr: '-',
            csfWithdrawalStr: '-',
            csfReturnAmtStr: '-',
            admissionCollectionStr: '-',
            lrfCollectionStr: '-',
            cbhbCollectionStr: '-',
            otherIncomeStr: '-',
            totalNetCollectionStr: '-',
            page: 'loan-officer-summary',
            status: '-',
            hasData: lo?.loans?.length > 0
        };

        let groupStatus = 'open';
        if (lo.cashCollections.length > 0) {
            const groupStatusArr = lo.cashCollections[0].groupStatusArr;
            if (groupStatusArr?.length === 1) {
                const transactionStatus = groupStatusArr.filter(status => status === "pending");
                if (transactionStatus.length === 0) {
                    groupStatus = 'close';
                }
            }
        }

        if (!filter && (isWeekend || isHoliday)) {
            groupStatus = 'close';
        }

        if (!filter) {
            // Process current data logic
            if (lo.activeLoans.length > 0) {
                collection.activeClients = lo.activeLoans[0].activeClients;
                collection.activeBorrowers = lo.activeLoans[0].activeBorrowers;
                collection.pendingClients = lo.activeLoans[0].pendingClients;
                noOfClients += lo.activeLoans[0].activeClients;
                noOfBorrowers += lo.activeLoans[0].activeBorrowers;
                noOfPendings += lo.activeLoans[0].pendingClients;
            }

            if (lo.loans.length > 0) {
                collection.totalLoanRelease = lo.loans[0].totalRelease;
                collection.totalReleasesStr = lo.loans[0].totalRelease > 0 ? formatPricePhp(lo.loans[0].totalRelease) : '-';
                collection.totalLoanBalance = lo.loans[0].totalLoanBalance;
                collection.totalLoanBalanceStr = lo.loans[0].totalLoanBalance > 0 ? formatPricePhp(lo.loans[0].totalLoanBalance) : '-';
                collection.loanTarget = lo.loans[0].loanTarget;
                collection.loanTargetStr = lo.loans[0].loanTarget > 0 ? formatPricePhp(lo.loans[0].loanTarget) : '-';
                collection.pastDue = lo.loans[0].pastDue;
                collection.pastDueStr = collection.pastDue > 0 ? formatPricePhp(collection.pastDue) : '-';
                collection.noPastDue = lo.loans[0].noPastDue;
                collection.mcbu = lo.loans[0].mcbu;
                collection.mcbuStr = lo.loans[0].mcbu > 0 ? formatPricePhp(lo.loans[0].mcbu) : '-';
                collection.mcbuCol = 0;
                collection.mcbuColStr = '-';
                collection.mcbuWithdrawal = 0;
                collection.mcbuWithdrawalStr = '-';
                collection.noMcbuReturn = 0;
                collection.mcbuReturnAmt = 0;
                collection.mcbuReturnAmtStr = '-';
                collection.mcbuInterest = lo.loans[0].mcbuInterest;
                collection.mcbuInterestStr = lo.loans[0].mcbuInterest > 0 ? lo.loans[0].mcbuInterest : '-';
                
                // New columns - initialize with loan data
                collection.csf = lo.loans[0].csf || 0;
                collection.csfStr = collection.csf > 0 ? formatPricePhp(collection.csf) : '-';
                collection.csfCollection = 0;
                collection.csfCollectionStr = '-';
                collection.csfWithdrawal = 0;
                collection.csfWithdrawalStr = '-';
                collection.csfReturnAmt = 0;
                collection.csfReturnAmtStr = '-';
                collection.admissionCollection = 0;
                collection.admissionCollectionStr = '-';
                collection.lrfCollection = 0;
                collection.lrfCollectionStr = '-';
                collection.cbhbCollection = 0;
                collection.cbhbCollectionStr = '-';
                collection.otherIncome = 0;
                collection.otherIncomeStr = '-';
                collection.totalNetCollection = 0;
                collection.totalNetCollectionStr = '-';
                
                collection.status = groupStatus;

                totalsLoanRelease += collection.totalLoanRelease ? collection.totalLoanRelease : 0;
                totalsLoanBalance += collection.totalLoanBalance ? collection.totalLoanBalance : 0;
                if (lo.transactionType === 'daily') {
                    targetLoanCollection += collection.loanTarget ? collection.loanTarget : 0;
                }
                totalPastDue += collection.pastDue;
                totalNoPastDue += collection.noPastDue;
            }

            // Handle weekly transaction type specific logic
            if (lo.transactionType === "weekly") {
                let loLoanTarget = 0;
                let loMcbu = 0;

                if (lo.groups && lo.groups.length > 0) {
                    lo.groups.map(g => {
                        if (g.loanTarget.length > 0) {
                            loLoanTarget += g.loanTarget[0].loanTarget;
                            loMcbu += g.loanTarget[0].mcbu;
                        }
                    });
                }

                collection.loanTarget = loLoanTarget;
                collection.loanTargetStr = loLoanTarget > 0 ? formatPricePhp(loLoanTarget) : '-';
                targetLoanCollection += loLoanTarget;
            }
            
            // Process cash collections
            if (lo.cashCollections.length > 0) {
                const loanTarget = collection.loanTarget - lo.cashCollections[0].loanTarget;

                collection.loanTarget = loanTarget;
                collection.loanTargetStr = loanTarget > 0 ? formatPricePhp(loanTarget) : '-';
                collection.excess = lo.cashCollections[0].excess;
                collection.excessStr = lo.cashCollections[0].excess > 0 ? formatPricePhp(lo.cashCollections[0].excess) : '-';
                collection.total = lo.cashCollections[0].collection;
                collection.totalStr = lo.cashCollections[0].collection > 0 ? formatPricePhp(lo.cashCollections[0].collection) : '-';
                collection.mispayment = lo.cashCollections[0].mispayment;
                collection.mispaymentStr = lo.cashCollections[0].mispayment > 0 ? lo.cashCollections[0].mispayment : '-';
                collection.offsetPerson = lo.cashCollections[0].offsetPerson ? lo.cashCollections[0].offsetPerson : 0;
                collection.mcbu = lo.cashCollections[0].mcbu;
                collection.mcbuStr = collection.mcbu > 0 ? formatPricePhp(collection.mcbu) : '-';
                collection.mcbuCol = lo.cashCollections[0].mcbuCol;
                collection.mcbuColStr = collection.mcbuCol > 0 ? formatPricePhp(collection.mcbuCol) : '-';
                collection.mcbuWithdrawal = lo.cashCollections[0].mcbuWithdrawal;
                collection.mcbuWithdrawalStr = collection.mcbuWithdrawal ? formatPricePhp(collection.mcbuWithdrawal) : '-';
                collection.noMcbuReturn = lo.cashCollections[0].mcbuReturnNo;
                collection.mcbuReturnAmt = lo.cashCollections[0].mcbuReturnAmt;
                collection.mcbuReturnAmtStr = collection.mcbuReturnAmt ? formatPricePhp(collection.mcbuReturnAmt) : '-';
                collection.mcbuInterest = lo.cashCollections[0].mcbuInterest;
                collection.mcbuInterestStr = lo.cashCollections[0].mcbuInterest > 0 ? lo.cashCollections[0].mcbuInterest : '-';

                // Process new columns from cash collections
                collection.csf = lo.cashCollections[0].csf || collection.csf;
                collection.csfStr = collection.csf > 0 ? formatPricePhp(collection.csf) : '-';
                collection.csfCollection = lo.cashCollections[0].csfCollection || 0;
                collection.csfCollectionStr = collection.csfCollection > 0 ? formatPricePhp(collection.csfCollection) : '-';
                collection.csfWithdrawal = lo.cashCollections[0].csfWithdrawal || 0;
                collection.csfWithdrawalStr = collection.csfWithdrawal > 0 ? formatPricePhp(collection.csfWithdrawal) : '-';
                collection.csfReturnAmt = lo.cashCollections[0].csfReturnAmt || 0;
                collection.csfReturnAmtStr = collection.csfReturnAmt > 0 ? formatPricePhp(collection.csfReturnAmt) : '-';
                collection.admissionCollection = lo.cashCollections[0].admissionCollection || 0;
                collection.admissionCollectionStr = collection.admissionCollection > 0 ? formatPricePhp(collection.admissionCollection) : '-';
                collection.lrfCollection = lo.cashCollections[0].lrfCollection || 0;
                collection.lrfCollectionStr = collection.lrfCollection > 0 ? formatPricePhp(collection.lrfCollection) : '-';
                collection.cbhbCollection = lo.cashCollections[0].cbhbCollection || 0;
                collection.cbhbCollectionStr = collection.cbhbCollection > 0 ? formatPricePhp(collection.cbhbCollection) : '-';
                
                // Calculate other income
                const otherIncome = (lo.cashCollections[0].otherPassbookCollection || 0) + (lo.cashCollections[0].otherPictureCollection || 0);
                collection.otherIncome = otherIncome;
                collection.otherIncomeStr = otherIncome > 0 ? formatPricePhp(otherIncome) : '-';
                
                collection.transfer = 0;
                collection.transferStr = '-';
                collection.status = groupStatus;

                // Update totals
                excess += lo.cashCollections[0].excess;
                totalLoanCollection += lo.cashCollections[0].collection;
                mispayment += lo.cashCollections[0].mispayment;
                targetLoanCollection = targetLoanCollection - lo.cashCollections[0].loanTarget;
                offsetPerson += collection.offsetPerson;
                totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
                totalMcbuWithdrawal += collection.mcbuWithdrawal ? collection.mcbuWithdrawal : 0;
                totalMcbuReturnNo += collection.noMcbuReturn ? collection.noMcbuReturn : 0;
                totalMcbuReturnAmt += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
                totalTransfer += collection.transfer !== '-' ? collection.transfer : 0;
                
                // Update new column totals
                totalCsfCollection += collection.csfCollection;
                totalCsfWithdrawal += collection.csfWithdrawal;
                totalCsfReturnAmt += collection.csfReturnAmt;
                totalAdmissionFee += collection.admissionCollection;
                totalLrf += collection.lrfCollection;
                totalCbhb += collection.cbhbCollection;
                totalOtherIncome += collection.otherIncome;
            }
            
            totalMcbuInterest += collection.mcbuInterest ? collection.mcbuInterest : 0;

            // Process current releases
            if (lo.currentRelease.length > 0) {
                const newReleasePerson = lo.currentRelease[0].newCurrentRelease ? lo.currentRelease[0].newCurrentRelease : 0;
                const reReleasePerson = lo.currentRelease[0].reCurrentRelease ? lo.currentRelease[0].reCurrentRelease : 0;
                collection.newReleasePerson = newReleasePerson;
                collection.reReleasePerson = reReleasePerson;
                collection.noCurrentReleaseStr = newReleasePerson + ' / ' + reReleasePerson;
                collection.currentReleaseAmount = lo.currentRelease[0].currentReleaseAmount;
                collection.currentReleaseAmountStr = formatPricePhp(lo.currentRelease[0].currentReleaseAmount);

                noOfNewCurrentRelease += lo.currentRelease[0].newCurrentRelease;
                noOfReCurrentRelease += lo.currentRelease[0].reCurrentRelease;
                currentReleaseAmount += lo.currentRelease[0].currentReleaseAmount;

                if (newReleasePerson > 0 && collection.activeClients === '-') {
                    collection.activeClients = newReleasePerson;
                    collection.status = "close";
                    collection.page = 'loan-officer-summary';
                    collection.allNew = true;
                    noOfClients += newReleasePerson;
                }
            }

            // Process full payments
            if (lo.fullPayment.length > 0) {
                collection.noOfFullPayment = lo.fullPayment[0].noOfFullPayment;
                collection.fullPaymentAmount = lo.fullPayment[0].fullPaymentAmount;
                collection.fullPaymentAmountStr = lo.fullPayment[0].fullPaymentAmount > 0 ? formatPricePhp(lo.fullPayment[0].fullPaymentAmount) : '-';

                fullPaymentAmount += lo.fullPayment[0].fullPaymentAmount;
                noOfFullPayment += lo.fullPayment[0].noOfFullPayment;
            }
        } else {
            // Handle filtered data (historical dates)
            if (lo.cashCollections.length > 0) {
                collection.activeClients = lo.cashCollections[0].activeClients;
                collection.activeBorrowers = lo.cashCollections[0].activeBorrowers;
                collection.pendingClients = lo.cashCollections[0].pendingClients;
                collection.totalLoanRelease = lo.cashCollections[0].totalRelease;
                collection.totalReleasesStr = lo.cashCollections[0].totalRelease > 0 ? formatPricePhp(lo.cashCollections[0].totalRelease) : '-';
                collection.totalLoanBalance = lo.cashCollections[0].totalLoanBalance;
                collection.totalLoanBalanceStr = lo.cashCollections[0].totalLoanBalance > 0 ? formatPricePhp(lo.cashCollections[0].totalLoanBalance) : '-';
                collection.loanTarget = lo.cashCollections[0].loanTarget;
                collection.loanTargetStr = lo.cashCollections[0].loanTarget > 0 ? formatPricePhp(lo.cashCollections[0].loanTarget) : '-';
                collection.excess = lo.cashCollections[0].excess;
                collection.excessStr = lo.cashCollections[0].excess > 0 ? formatPricePhp(lo.cashCollections[0].excess) : '-';
                collection.total = lo.cashCollections[0].collection;
                collection.totalStr = lo.cashCollections[0].collection > 0 ? formatPricePhp(lo.cashCollections[0].collection) : '-';
                collection.mispayment = lo.cashCollections[0].mispayment;
                collection.mispaymentStr = lo.cashCollections[0].mispayment > 0 ? lo.cashCollections[0].mispayment : '-';
                collection.pastDue = lo.cashCollections[0].pastDue;
                collection.pastDueStr = lo.cashCollections[0].pastDue > 0 ? formatPricePhp(collection.pastDue) : '-';
                collection.noPastDue = lo.cashCollections[0].noPastDue;
                collection.offsetPerson = lo.cashCollections[0].offsetPerson;

                collection.mcbu = lo.cashCollections[0].mcbu ? lo.cashCollections[0].mcbu : 0;
                collection.mcbuStr = collection.mcbu ? formatPricePhp(collection.mcbu) : '-';
                collection.mcbuCol = lo.cashCollections[0].mcbuCol ? lo.cashCollections[0].mcbuCol : 0;
                collection.mcbuColStr = collection.mcbuCol > 0 ? formatPricePhp(collection.mcbuCol) : '-';
                collection.mcbuWithdrawal = lo.cashCollections[0].mcbuWithdrawal ? lo.cashCollections[0].mcbuWithdrawal : 0;
                collection.mcbuWithdrawalStr = collection.mcbuWithdrawal > 0 ? formatPricePhp(collection.mcbuWithdrawal) : '-';
                collection.noMcbuReturn = lo.cashCollections[0].mcbuReturnNo ? lo.cashCollections[0].mcbuReturnNo : 0;
                collection.mcbuReturnAmt = lo.cashCollections[0].mcbuReturnAmt ? lo.cashCollections[0].mcbuReturnAmt : 0;
                collection.mcbuReturnAmtStr = collection.mcbuReturnAmt > 0 ? formatPricePhp(collection.mcbuReturnAmt) : '-';
                collection.mcbuInterest = lo.cashCollections[0].mcbuInterest;
                collection.mcbuInterestStr = lo.cashCollections[0].mcbuInterest > 0 ? lo.cashCollections[0].mcbuInterest : '-';

                // Process new columns for filtered data
                collection.csf = lo.cashCollections[0].csf || 0;
                collection.csfStr = collection.csf > 0 ? formatPricePhp(collection.csf) : '-';
                collection.csfCollection = lo.cashCollections[0].csfCollection || 0;
                collection.csfCollectionStr = collection.csfCollection > 0 ? formatPricePhp(collection.csfCollection) : '-';
                collection.csfWithdrawal = lo.cashCollections[0].csfWithdrawal || 0;
                collection.csfWithdrawalStr = collection.csfWithdrawal > 0 ? formatPricePhp(collection.csfWithdrawal) : '-';
                collection.csfReturnAmt = lo.cashCollections[0].csfReturnAmt || 0;
                collection.csfReturnAmtStr = collection.csfReturnAmt > 0 ? formatPricePhp(collection.csfReturnAmt) : '-';
                collection.admissionCollection = lo.cashCollections[0].admissionCollection || 0;
                collection.admissionCollectionStr = collection.admissionCollection > 0 ? formatPricePhp(collection.admissionCollection) : '-';
                collection.lrfCollection = lo.cashCollections[0].lrfCollection || 0;
                collection.lrfCollectionStr = collection.lrfCollection > 0 ? formatPricePhp(collection.lrfCollection) : '-';
                collection.cbhbCollection = lo.cashCollections[0].cbhbCollection || 0;
                collection.cbhbCollectionStr = collection.cbhbCollection > 0 ? formatPricePhp(collection.cbhbCollection) : '-';
                
                const otherIncome = (lo.cashCollections[0].otherPassbookCollection || 0) + (lo.cashCollections[0].otherPictureCollection || 0);
                collection.otherIncome = otherIncome;
                collection.otherIncomeStr = otherIncome > 0 ? formatPricePhp(otherIncome) : '-';

                collection.status = groupStatus;

                const newReleasePerson = lo.cashCollections[0].newCurrentRelease;
                const reReleasePerson = lo.cashCollections[0].reCurrentRelease;
                collection.newReleasePerson = newReleasePerson;
                collection.reReleasePerson = reReleasePerson;
                collection.noCurrentReleaseStr = newReleasePerson + ' / ' + reReleasePerson;
                collection.currentReleaseAmount = lo.cashCollections[0].currentReleaseAmount;
                collection.currentReleaseAmountStr = lo.cashCollections[0].currentReleaseAmount > 0 ? formatPricePhp(lo.cashCollections[0].currentReleaseAmount) : '-';
                collection.noOfFullPayment = lo.cashCollections[0].noOfFullPayment;
                collection.fullPaymentAmount = lo.cashCollections[0].fullPaymentAmount;
                collection.fullPaymentAmountStr = lo.cashCollections[0].fullPaymentAmount > 0 ? formatPricePhp(lo.cashCollections[0].fullPaymentAmount) : '-';

                collection.transfer = 0;
                collection.transferStr = '-';

                // Update totals for filtered data
                noOfClients += lo.cashCollections[0].activeClients;
                noOfBorrowers += lo.cashCollections[0].activeBorrowers;
                noOfPendings += lo.cashCollections[0].pendingClients;
                totalsLoanRelease += collection.totalLoanRelease;
                totalsLoanBalance += lo.cashCollections[0].totalLoanBalance;
                targetLoanCollection += lo.cashCollections[0].loanTarget;
                excess += lo.cashCollections[0].excess;
                totalLoanCollection += lo.cashCollections[0].collection;
                mispayment += lo.cashCollections[0].mispayment;
                totalPastDue += collection.pastDue;
                totalNoPastDue += collection.noPastDue;
                noOfNewCurrentRelease += lo.cashCollections[0].newCurrentRelease;
                noOfReCurrentRelease += lo.cashCollections[0].reCurrentRelease;
                currentReleaseAmount += lo.cashCollections[0].currentReleaseAmount;
                fullPaymentAmount += lo.cashCollections[0].fullPaymentAmount;
                noOfFullPayment += lo.cashCollections[0].noOfFullPayment;
                offsetPerson += collection.offsetPerson ? collection.offsetPerson : 0;
                totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
                totalMcbuReturnNo += collection.noMcbuReturn ? collection.noMcbuReturn : 0;
                totalMcbuReturnAmt += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
                totalMcbuInterest += collection.mcbuInterest ? collection.mcbuInterest : 0;
                
                // Update new column totals for filtered data
                totalCsfCollection += collection.csfCollection;
                totalCsfWithdrawal += collection.csfWithdrawal;
                totalCsfReturnAmt += collection.csfReturnAmt;
                totalAdmissionFee += collection.admissionCollection;
                totalLrf += collection.lrfCollection;
                totalCbhb += collection.cbhbCollection;
                totalOtherIncome += collection.otherIncome;
            }
        }

        // Process transfers (both daily and weekly)
        if (collection.transactionType) {
            let transfer = 0;
            let totalTransferMcbu = 0;
            let totalTransferTargetCollection = 0;
            let totalTransferActualCollection = 0;

            // Process daily transfers
            if (lo.transferDailyGiverDetails && lo.transferDailyGiverDetails.length > 0) {
                collectionDailyReceived.push(...lo.transferDailyGiverDetails);
                transfer = transfer - lo.transferDailyGiverDetails.length;

                lo.transferDailyGiverDetails.forEach(giver => {
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

                    collection.totalLoanRelease = collection.totalLoanRelease ? collection.totalLoanRelease : 0;
                    collection.totalLoanRelease -= giver.amountRelease ? giver.amountRelease : 0;
                    collection.totalLoanBalance = collection.totalLoanBalance ? collection.totalLoanBalance : 0;
                    collection.totalLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;

                    totalsLoanRelease -= giver.amountRelease ? giver.amountRelease : 0;
                    totalsLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;
                });
            }

            if (lo.transferDailyReceivedDetails && lo.transferDailyReceivedDetails.length > 0) {
                collectionDailyTransferred.push(...lo.transferDailyReceivedDetails);
                transfer = transfer + lo.transferDailyReceivedDetails.length;

                lo.transferDailyReceivedDetails.forEach(rcv => {
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

                            collection.totalLoanRelease = collection.totalLoanRelease ? collection.totalLoanRelease : 0;
                            collection.totalLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
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
                                collection.totalLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                                collection.totalLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;

                                totalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                                totalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                            }

                            targetLoanCollection -= rcv.targetCollection;
                        }
                    }
                });
            }

            // Process weekly transfers
            if (lo.transferWeeklyGiverDetails && lo.transferWeeklyGiverDetails.length > 0) {
                collectionWeeklyReceived.push(...lo.transferWeeklyGiverDetails);
                transfer = transfer - lo.transferWeeklyGiverDetails.length;

                lo.transferWeeklyGiverDetails.forEach(giver => {
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

                    collection.totalLoanRelease = collection.totalLoanRelease ? collection.totalLoanRelease : 0;
                    collection.totalLoanRelease -= giver.amountRelease ? giver.amountRelease : 0;
                    collection.totalLoanBalance = collection.totalLoanBalance ? collection.totalLoanBalance : 0;
                    collection.totalLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;

                    totalsLoanRelease -= giver.amountRelease ? giver.amountRelease : 0;
                    totalsLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;
                });
            }

            if (lo.transferWeeklyReceivedDetails && lo.transferWeeklyReceivedDetails.length > 0) {
                collectionWeeklyTransferred.push(...lo.transferWeeklyReceivedDetails);
                transfer = transfer + lo.transferWeeklyReceivedDetails.length;

                lo.transferWeeklyReceivedDetails.forEach(rcv => {
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

                            collection.totalLoanRelease = collection.totalLoanRelease ? collection.totalLoanRelease : 0;
                            collection.totalLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
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
                                collection.totalLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                                collection.totalLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;

                                totalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                                totalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                            }

                            targetLoanCollection -= rcv.targetCollection;
                        }
                    }
                });
            }

            // Update collection with transfer adjustments
            if (lo.transferDailyReceivedDetails?.length > 0 || lo.transferDailyGiverDetails?.length > 0 || 
                lo.transferWeeklyReceivedDetails?.length > 0 || lo.transferWeeklyGiverDetails?.length > 0) {
                collection.mcbuStr = formatPricePhp(collection.mcbu);
                collection.totalReleasesStr = formatPricePhp(collection.totalLoanRelease);
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

        // Calculate total net collection
        const totalNetCollection = (
            safeNumber(collection.total) + 
            safeNumber(collection.mcbuCol) + 
            safeNumber(collection.csfCollection) + 
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

    // Sort by order (LO number)
    collectionData.sort((a, b) => a.order - b.order);
    
    // Recalculate totals after sorting
    noOfClients = 0;
    noOfBorrowers = 0;
    collectionData.forEach(c => {
        totalMcbu += c.mcbu ? c.mcbu : 0;
        noOfClients += c.activeClients !== '-' ? c.activeClients : 0;
        noOfBorrowers += c.activeBorrowers !== '-' ? c.activeBorrowers : 0;
        totalCsf += c.csf || 0;
        totalNetCollections += c.totalNetCollection;
    });

    // Create transfer summaries
    const transferGvr = transferDetailsTotal(collectionDailyTransferred, collectionWeeklyTransferred, 'Transfer GVR');
    const transferRcv = transferDetailsTotal(collectionDailyReceived, collectionWeeklyReceived, 'Transfer RCV');
    
    if (collectionDailyTransferred.length > 0 || collectionWeeklyTransferred.length > 0) {
        collectionData.push(transferGvr);
    }
    if (collectionDailyReceived.length > 0 || collectionWeeklyReceived.length > 0) {
        collectionData.push(transferRcv);
    }

    // Add daily and weekly totals
    collectionData.push(getDailyTotals(collectionData));
    collectionData.push(getWeeklyTotals(collectionData));

    // Create grand totals
    const loTotals = {
        name: 'GRAND TOTALS',
        transfer: totalTransfer,
        transferStr: totalTransfer,
        noOfNewCurrentRelease: noOfNewCurrentRelease,
        noCurrentRelease: noOfNewCurrentRelease + noOfReCurrentRelease,
        noCurrentReleaseStr: noOfNewCurrentRelease + ' / ' + noOfReCurrentRelease,
        currentReleaseAmount: currentReleaseAmount,
        currentReleaseAmountStr: formatPricePhp(currentReleaseAmount),
        activeClients: noOfClients >= 0 ? noOfClients : 0,
        activeBorrowers: noOfBorrowers >= 0 ? noOfBorrowers : 0,
        pendingClients: noOfPendings,
        totalLoanRelease: totalsLoanRelease,
        totalReleasesStr: formatPricePhp(totalsLoanRelease),
        totalLoanBalance: totalsLoanBalance,
        totalLoanBalanceStr: formatPricePhp(totalsLoanBalance),
        targetLoanCollection: targetLoanCollection,
        loanTargetStr: formatPricePhp(targetLoanCollection),
        excess: excess,
        excessStr: formatPricePhp(excess),
        totalLoanCollection: totalLoanCollection,
        totalStr: formatPricePhp(totalLoanCollection),
        mispayment: mispayment,
        mispaymentStr: mispayment + ' / ' + noOfClients,
        fullPaymentAmount: fullPaymentAmount,
        fullPaymentAmountStr: formatPricePhp(fullPaymentAmount),
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
        mcbuInterest: totalMcbuInterest,
        mcbuInterestStr: formatPricePhp(totalMcbuInterest),
        // New columns totals
        csf: totalCsf,
        csfStr: formatPricePhp(totalCsf),
        csfCollection: totalCsfCollection,
        csfCollectionStr: formatPricePhp(totalCsfCollection),
        csfWithdrawal: totalCsfWithdrawal,
        csfWithdrawalStr: formatPricePhp(totalCsfWithdrawal),
        csfReturnAmt: totalCsfReturnAmt,
        csfReturnAmtStr: formatPricePhp(totalCsfReturnAmt),
        admissionCollection: totalAdmissionFee,
        admissionCollectionStr: formatPricePhp(totalAdmissionFee),
        lrfCollection: totalLrf,
        lrfCollectionStr: formatPricePhp(totalLrf),
        cbhbCollection: totalCbhb,
        cbhbCollectionStr: formatPricePhp(totalCbhb),
        otherIncome: totalOtherIncome,
        otherIncomeStr: formatPricePhp(totalOtherIncome),
        totalNetCollection: totalNetCollections,
        totalNetCollectionStr: formatPricePhp(totalNetCollections),
        totalData: true
    };

    collectionData.push(loTotals);

    // Create LOS summary
    const dailyLos = { ...createLos(loTotals, date, selectedBranch, false), losType: "daily" };
    
    // Add LOS to the response
    collectionData.push(dailyLos);

    return collectionData;
}

const transferDetailsTotal = (detailsDaily, detailsWeekly, type) => {
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

    const processTransfers = (transfers) => {
        transfers.forEach(transfer => {
            totalTransfer++;
            totalMcbu += transfer.mcbu;
            totalLoanRelease += transfer.amountRelease;
            totalLoanBalance += transfer.loanBalance;
            totalCurrentReleaseAmount += transfer.currentReleaseAmount;

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
            }
        });
    };

    processTransfers(detailsDaily);
    processTransfers(detailsWeekly);

    return {
        name: type.toUpperCase(),
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
        totalLoanBalance: 0,
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
        totalData: true,
        status: '-'
    }
}

const getDailyTotals = (collectionData) => {
    const totals = calculateTotalsByType(collectionData.filter(u => u.transactionType === 'daily'));
    return { ...totals, name: 'Daily Totals' };
}

const getWeeklyTotals = (collectionData) => {
    const totals = calculateTotalsByType(collectionData.filter(u => u.transactionType === 'weekly'));
    return { ...totals, name: 'Weekly Totals' };
}

const calculateTotalsByType = (filteredData) => {
    let noOfClients = 0;
    let noOfBorrowers = 0;
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
    let offsetPerson = 0;
    let totalMcbu = 0;
    let totalMcbuCol = 0;
    let totalMcbuWithdrawal = 0;
    let totalMcbuReturnNo = 0;
    let totalMcbuReturnAmt = 0;
    let totalMcbuInterest = 0;
    let totalTransfer = 0;
    let totalCsf = 0;
    let totalCsfCollection = 0;
    let totalCsfWithdrawal = 0;
    let totalCsfReturnAmt = 0;
    let totalAdmissionFee = 0;
    let totalLrf = 0;
    let totalCbhb = 0;
    let totalOtherIncome = 0;
    let totalNetCollections = 0;

    filteredData.forEach(collection => {
        let transfer = collection.transfer;
        if (typeof collection.transfer === 'string' && collection.transfer !== '-') {
            transfer = collection.transfer.replace('(', '').replace(')', '');
            transfer = -Math.abs(transfer);
        }

        noOfClients += (collection.activeClients && collection.activeClients !== '-') ? collection.activeClients : 0;
        noOfBorrowers += (collection.activeBorrowers && collection.activeBorrowers !== '-') ? collection.activeBorrowers : 0;
        totalsLoanRelease += collection.totalLoanRelease ? collection.totalLoanRelease : 0;
        totalsLoanBalance += collection.totalLoanBalance ? collection.totalLoanBalance : 0;
        noOfNewCurrentRelease += collection.newReleasePerson ? collection.newReleasePerson : 0;
        noOfReCurrentRelease += collection.reReleasePerson ? collection.reReleasePerson : 0;
        currentReleaseAmount += collection.currentReleaseAmount ? collection.currentReleaseAmount : 0;
        targetLoanCollection += collection.loanTarget ? collection.loanTarget : 0;
        excess += collection.excess ? collection.excess : 0;
        totalLoanCollection += collection.total ? collection.total : 0;
        noOfFullPayment += (collection.noOfFullPayment && collection.noOfFullPayment !== '-') ? collection.noOfFullPayment : 0;
        fullPaymentAmount += collection.fullPaymentAmount ? collection.fullPaymentAmount : 0;
        mispayment += (collection.mispayment && collection.mispayment !== '-') ? collection.mispayment : 0;
        totalPastDue += collection.pastDue ? collection.pastDue : 0;
        totalNoPastDue += (collection.noPastDue && collection.noPastDue !== '-') ? collection.noPastDue : 0;
        offsetPerson += collection.offsetPerson ? collection.offsetPerson : 0;
        totalMcbu += collection.mcbu ? collection.mcbu : 0;
        totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
        totalMcbuWithdrawal += collection.mcbuWithdrawal ? collection.mcbuWithdrawal : 0;
        totalMcbuReturnNo += collection.mcbuReturnNo ? collection.mcbuReturnNo : 0;
        totalMcbuReturnAmt += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
        totalMcbuInterest += collection.mcbuInterest ? collection.mcbuInterest : 0;
        totalTransfer += transfer;
        
        // New columns
        totalCsf += collection.csf ? collection.csf : 0;
        totalCsfCollection += collection.csfCollection ? collection.csfCollection : 0;
        totalCsfWithdrawal += collection.csfWithdrawal ? collection.csfWithdrawal : 0;
        totalCsfReturnAmt += collection.csfReturnAmt ? collection.csfReturnAmt : 0;
        totalAdmissionFee += collection.admissionCollection ? collection.admissionCollection : 0;
        totalLrf += collection.lrfCollection ? collection.lrfCollection : 0;
        totalCbhb += collection.cbhbCollection ? collection.cbhbCollection : 0;
        totalOtherIncome += collection.otherIncome ? collection.otherIncome : 0;
        totalNetCollections += collection.totalNetCollection ? collection.totalNetCollection : 0;
    });

    return {
        transfer: totalTransfer,
        noOfNewCurrentRelease: noOfNewCurrentRelease,
        noCurrentRelease: noOfNewCurrentRelease + noOfReCurrentRelease,
        noCurrentReleaseStr: noOfNewCurrentRelease + ' / ' + noOfReCurrentRelease,
        currentReleaseAmount: currentReleaseAmount,
        currentReleaseAmountStr: formatPricePhp(currentReleaseAmount),
        activeClients: noOfClients,
        activeBorrowers: noOfBorrowers,
        totalLoanRelease: totalsLoanRelease,
        totalReleasesStr: formatPricePhp(totalsLoanRelease),
        totalLoanBalance: totalsLoanBalance,
        totalLoanBalanceStr: formatPricePhp(totalsLoanBalance),
        targetLoanCollection: targetLoanCollection,
        loanTargetStr: formatPricePhp(targetLoanCollection),
        excess: excess,
        excessStr: formatPricePhp(excess),
        totalLoanCollection: totalLoanCollection,
        totalStr: formatPricePhp(totalLoanCollection),
        mispayment: mispayment,
        mispaymentStr: mispayment + ' / ' + noOfClients,
        fullPaymentAmount: fullPaymentAmount,
        fullPaymentAmountStr: formatPricePhp(fullPaymentAmount),
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
        mcbuInterest: totalMcbuInterest,
        mcbuInterestStr: formatPricePhp(totalMcbuInterest),
        // New columns
        csf: totalCsf,
        csfStr: formatPricePhp(totalCsf),
        csfCollection: totalCsfCollection,
        csfCollectionStr: formatPricePhp(totalCsfCollection),
        csfWithdrawal: totalCsfWithdrawal,
        csfWithdrawalStr: formatPricePhp(totalCsfWithdrawal),
        csfReturnAmt: totalCsfReturnAmt,
        csfReturnAmtStr: formatPricePhp(totalCsfReturnAmt),
        admissionCollection: totalAdmissionFee,
        admissionCollectionStr: formatPricePhp(totalAdmissionFee),
        lrfCollection: totalLrf,
        lrfCollectionStr: formatPricePhp(totalLrf),
        cbhbCollection: totalCbhb,
        cbhbCollectionStr: formatPricePhp(totalCbhb),
        otherIncome: totalOtherIncome,
        otherIncomeStr: formatPricePhp(totalOtherIncome),
        totalNetCollection: totalNetCollections,
        totalNetCollectionStr: formatPricePhp(totalNetCollections),
        totalData: true
    };
}

const createLos = (totals, dateFilter, selectedBranch, yearEnd) => {
    let grandTotal;

    if (yearEnd) {
        grandTotal = {
            day: 'Year End',
            transfer: 0,
            newMember: 0,
            offsetPerson: 0,
            mcbuTarget: totals.mcbuTarget,
            mcbuActual: totals.mcbuCol,
            mcbuWithdrawal: totals.mcbuWithdrawal,
            mcbuInterest: totals.mcbuInterest,
            noMcbuReturn: totals.noMcbuReturn,
            mcbuReturnAmt: totals.mcbuReturnAmt,
            activeClients: totals.activeClients,
            loanReleasePerson: 0,
            loanReleaseAmount: 0,
            activeLoanReleasePerson: totals.activeBorrowers,
            activeLoanReleaseAmount: totals.totalLoanRelease,
            collectionAdvancePayment: totals.totalLoanRelease - totals.totalLoanBalance,
            collectionActual: totals.totalLoanRelease - totals.totalLoanBalance,
            pastDuePerson: 0,
            pastDueAmount: 0,
            fullPaymentPerson: 0,
            fullPaymentAmount: 0,
            activeBorrowers: totals.activeBorrowers,
            loanBalance: totals.totalLoanBalance
        };
    } else {
        let selectedDate = moment().format('YYYY-MM-DD');
        if (dateFilter) {
            selectedDate = dateFilter;
        }

        grandTotal = {
            day: selectedDate,
            transfer: totals.transfer,
            newMember: totals.noOfNewCurrentRelease,
            mcbuTarget: totals.mcbuTarget,
            mcbuActual: totals.mcbuCol,
            mcbuWithdrawal: totals.mcbuWithdrawal,
            mcbuInterest: totals.mcbuInterest,
            noMcbuReturn: totals.noMcbuReturn,
            mcbuReturnAmt: totals.mcbuReturnAmt,
            offsetPerson: totals.offsetPerson,
            activeClients: totals.activeClients,
            loanReleasePerson: totals.noCurrentRelease,
            loanReleaseAmount: totals.currentReleaseAmount,
            activeLoanReleasePerson: totals.activeBorrowers,
            activeLoanReleaseAmount: totals.totalLoanRelease,
            collectionTarget: totals.targetLoanCollection,
            collectionAdvancePayment: totals.excess,
            collectionActual: totals.collection,
            pastDuePerson: totals.noPastDue,
            pastDueAmount: totals.pastDue,
            fullPaymentPerson: totals.noOfFullPayment,
            fullPaymentAmount: totals.fullPaymentAmount,
            activeBorrowers: totals.activeBorrowers,
            loanBalance: totals.totalLoanBalance
        };
    }

    let month = yearEnd ? 12 : moment().month() + 1;
    let year = yearEnd ? moment().year() - 1 : moment().year();
    if (dateFilter) {
        month = moment(dateFilter).month() + 1;
        year = moment(dateFilter).year();
    }

    return {
        branchId: selectedBranch,
        month: month,
        year: year,
        data: grandTotal
    }
}