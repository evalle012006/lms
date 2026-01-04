/**
 * saveV2.js - Enhanced Cash Collection Save API
 * 
 * This is a wrapper around the original save logic that adds:
 * 1. Date validation (prevents midnight crossover issues)
 * 2. Retry mechanism (handles intermittent failures)
 * 3. Better error logging
 * 4. Notifications for offset transactions
 * 
 * The core save logic remains unchanged from the original save.js
 */

import { CASH_COLLECTIONS_FIELDS, CLIENT_FIELDS, DENOMINATION_FIELDS, GROUP_FIELDS, LOAN_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID, safeNumber } from '@/lib/utils';
import logger from '@/logger';
import { apiHandler } from '@/services/api-handler';
import { savePendingLoans } from './update-pending-loans';
import { findGroups, findUserById, findBranches } from '@/lib/graph.functions';
import { notifyLoanOffset } from '@/lib/notification-service';
import moment from 'moment-timezone';
import { getSystemDate } from '@/lib/date-utils';

// ============================================
// CONFIGURATION
// ============================================
const TIMEZONE = 'Asia/Manila';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ============================================
// GRAPH SETUP (same as original)
// ============================================
const graph = new GraphProvider();
const COLLECTION_TYPE = createGraphType('cashCollections', '_id');
const LOAN_TYPE = createGraphType('loans', `${LOAN_FIELDS}`);
const CLIENT_TYPE = createGraphType('client', `${CLIENT_FIELDS}`);
const GROUP_TYPE = createGraphType('groups', `${GROUP_FIELDS}`);
const DENOMINATION_TYPE = createGraphType('denomination', `${DENOMINATION_FIELDS}`);

export default apiHandler({
    post: saveWithProtection
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Validate that transaction date matches server date (Manila timezone)
 */
function validateDate(requestDate) {
    const serverDate = moment(getSystemDate()).tz(TIMEZONE).format('YYYY-MM-DD');
    const clientDate = moment(requestDate).format('YYYY-MM-DD');
    
    if (serverDate !== clientDate) {
        return {
            valid: false,
            serverDate,
            clientDate,
            message: `Date mismatch: Client sent ${clientDate} but server date is ${serverDate}`
        };
    }
    return { valid: true };
}

// ============================================
// MAIN HANDLER WITH PROTECTION
// ============================================

async function saveWithProtection(req, res) {
    const user_id = req?.auth?.sub;
    const transactionId = generateUUID();
    let response = {};
    let statusCode = 200;

    try {
        const data = req.body;
        const currentDate = data.currentDate;

        // Log start
        logger.debug({
            user_id,
            transactionId,
            page: 'Cash Collection SaveV2',
            message: 'Starting save',
            groupId: JSON.parse(data.collection || '[]')[0]?.groupId
        });

        // Step 1: Validate date
        const dateCheck = validateDate(currentDate);
        if (!dateCheck.valid) {
            logger.error({
                user_id,
                transactionId,
                page: 'Cash Collection SaveV2',
                message: 'Date validation failed',
                ...dateCheck
            });

            return res.status(400).json({
                success: false,
                error: true,
                errorCode: 'DATE_MISMATCH',
                message: 'Transaction date mismatch. The date may have changed. Please refresh the page and try again.',
                transactionId,
                details: dateCheck
            });
        }

        // Step 2: Execute save with retry
        let lastError = null;
        let attempt = 0;
        let offsetCollections = []; // Track offsets for notifications

        while (attempt < MAX_RETRIES) {
            attempt++;
            try {
                logger.debug({
                    user_id,
                    transactionId,
                    page: 'Cash Collection SaveV2',
                    message: `Save attempt ${attempt}/${MAX_RETRIES}`
                });

                // Call the actual save logic - returns offsetCollections
                offsetCollections = await executeSave(req, user_id, transactionId);

                // Success!
                logger.info({
                    user_id,
                    transactionId,
                    page: 'Cash Collection SaveV2',
                    message: 'Save completed successfully',
                    attempts: attempt,
                    offsetCount: offsetCollections.length
                });

                break; // Exit retry loop on success

            } catch (error) {
                lastError = error;
                logger.warn({
                    user_id,
                    transactionId,
                    page: 'Cash Collection SaveV2',
                    message: `Save attempt ${attempt} failed`,
                    error: error.message
                });

                if (attempt < MAX_RETRIES) {
                    await sleep(RETRY_DELAY_MS * attempt);
                }
            }
        }

        // If all retries failed, throw the last error
        if (lastError && attempt >= MAX_RETRIES) {
            throw lastError;
        }

        // Create notifications for offset transactions (after successful save)
        // Note: notifyLoanOffset already checks if notifications are enabled internally
        if (offsetCollections.length > 0) {
            for (const offset of offsetCollections) {
                try {
                    const user = await findUserById(user_id);
                    const branches = await findBranches({ _id: { _eq: offset.branchId } });
                    const branch = branches?.[0];

                    if (branch) {
                        await notifyLoanOffset({
                            clientName: offset.fullName,
                            clientId: offset.clientId,
                            loanId: offset.loanId,
                            previousBalance: offset.previousBalance,
                            groupId: offset.groupId,
                            branchId: offset.branchId,
                            areaId: branch.areaId,
                            regionId: branch.regionId,
                            divisionId: branch.divisionId,
                            loId: offset.loId,
                            createdBy: user?._id || user_id,
                            createdByName: user ? `${user.firstName} ${user.lastName}` : 'System'
                        });
                    }
                } catch (notifError) {
                    // Don't fail the transaction if notification fails
                    logger.error({
                        user_id,
                        transactionId,
                        page: 'Cash Collection SaveV2',
                        message: 'Failed to create offset notification',
                        error: notifError.message,
                        clientId: offset.clientId
                    });
                }
            }
            
            logger.debug({
                user_id,
                transactionId,
                page: 'Cash Collection SaveV2',
                message: `Processed ${offsetCollections.length} offset notifications`
            });
        }

        return res.status(200).json({
            success: true,
            transactionId,
            attempts: attempt
        });

    } catch (error) {
        logger.error({
            user_id,
            transactionId,
            page: 'Cash Collection SaveV2',
            message: 'Save failed after all retries',
            error: error.message,
            stack: error.stack
        });

        statusCode = 500;
        response = {
            success: false,
            error: true,
            errorCode: 'SAVE_FAILED',
            message: 'Failed to save transaction. Please try again.',
            transactionId,
            debugError: error.message,
            debugStack: error.stack?.split('\n').slice(0, 5)
        };

        return res.status(statusCode).json(response);
    }
}

// ============================================
// ORIGINAL SAVE LOGIC (unchanged from save.js)
// Returns: Array of offset collections for notification
// ============================================

async function executeSave(req, user_id, transactionId) {
    let data = req.body;
    const currentDate = data.currentDate;
    const currentTime = data.currentTime;
    data.collection = JSON.parse(data.collection);
    const overallTotalNetCollection = data.overallTotalNetCollection || 0;

    const mutationQl = [];
    const offsetCollections = []; // Track offsets for notifications

    if (data.collection.length > 0) {
        let existCC = [];
        let newCC = [];
        
        logger.debug({user_id, transactionId, page: `Saving Cash Collection - Group ID: ${data.collection[0]?.groupId}`});
        
        const promiseData = data.collection.map(async cc => {
            if (cc.status !== "totals") {

                const collection = JSON.parse(JSON.stringify(cc));
                delete collection.reverted;

                // get loan snapshot 
                let [loan] = await graph.query(queryQl(LOAN_TYPE('loans'), { where: { _id: { _eq: collection.loanId } } })).then(res => res.data.loans);
                
                if (!loan) {
                    logger.warn({user_id, transactionId, page: 'Cash Collection SaveV2', message: 'Loan not found', loanId: collection.loanId});
                    return; // Skip this collection if loan not found
                }

                const loan_history = {
                    loan_id: loan._id,
                    client_id: loan.clientId,
                    user_id: user_id,
                    data: loan
                };

                mutationQl.push(
                    insertQl(createGraphType('loans_history', `_id`)('loans_history_' + (mutationQl.length + 1)), {
                        objects: [loan_history]
                    })
                );

                if (collection.loanBalance <= 0 && !collection.fullPaymentDate) {
                    collection.fullPaymentDate = collection.fullPaymentDate ? collection.fullPaymentDate : currentDate;
                }

                if (collection.status === 'completed' && (collection?.remarks?.value?.startsWith('offset') || collection.mcbuReturnAmt > 0)) {
                    collection.status = "closed";
                    // Track offset for notification
                    if (collection?.remarks?.value?.startsWith('offset')) {
                        offsetCollections.push({
                            clientId: collection.clientId,
                            loanId: collection.loanId,
                            groupId: collection.groupId,
                            branchId: collection.branchId,
                            loId: collection.loId,
                            fullName: loan?.fullName || collection.fullName,
                            previousBalance: collection.prevData?.loanBalance || loan?.loanBalance || 0
                        });
                    }
                }

                let activeLoan = collection?.activeLoan;
                if (collection.status != 'pending' && collection.activeLoan == 0) {
                    activeLoan = collection?.prevData?.activeLoan ? collection.prevData?.activeLoan : 0;
                }

                logger.debug({user_id, transactionId, page: `Saving Cash Collection - Group ID: ${data.collection[0]?.groupId}`, currentDate: currentDate, clientId: collection.clientId});
                
                if (collection.hasOwnProperty('_id') && collection._id != collection?.loanId) {
                    collection.modifiedDateTime = new Date();
                    const existCollection = {...assignNullValues(collection)};
                    delete existCollection.mcbuHistory;

                    await fixCashCollectionReference(existCollection);
                    existCC.push(existCollection);
                } else {
                    collection.insertedDateTime = new Date();
                    const newCollection = {...assignNullValues(collection)};
                    delete newCollection.mcbuHistory;

                    await fixCashCollectionReference(collection);
                    newCC.push(collection);
                }
                
                if (collection.status !== "tomorrow" && collection.status !== "pending" && !collection.draft) {
                    await updateLoan(user_id, mutationQl, collection, currentDate);
                    await updateClient(user_id, mutationQl, collection);
                }

                if (collection.status == 'tomorrow' && collection.mcbuWithdrawal > 0 && !collection.hasMcbuWithdrawal) {
                    await updateLoanMcbuWithdrawal(user_id, mutationQl, collection);
                }
            }
        });

        await Promise.all(promiseData);

        if (newCC.length > 0) {
            await saveCollection(mutationQl, newCC, currentDate);
        }

        if (existCC.length > 0) {
            await updateCollection(mutationQl, existCC);
        }

        if (overallTotalNetCollection > 0) {
            await updateDenomination(mutationQl, data.collection[0]?.groupId, currentDate, overallTotalNetCollection);
        }

        // save all changes in one request
        if (mutationQl.length > 0) {
            const result = await graph.mutation(...mutationQl);
            
            // Check for GraphQL errors
            if (result.errors && result.errors.length > 0) {
                const errorMsg = result.errors.map(e => e.message).join(', ');
                throw new Error(`GraphQL mutation failed: ${errorMsg}`);
            }
        }

        const reverted = data.collection.filter(c => c.fromReverted && !c.advance);
        if (reverted.length == 0) {
            const pendingLoans = data.collection.filter(c => (c.status === 'pending' || c.status === 'closed') && c.advance == true);
            if (pendingLoans.length > 0) {
                await savePendingLoans(user_id, pendingLoans);
            }
        }
    }

    // Return offset collections for notification processing
    return offsetCollections;
}

// ============================================
// HELPER FUNCTIONS (same as original save.js)
// ============================================

async function fixCashCollectionReference(cashCollection) {
    if(!cashCollection.groupId) {
        throw { message: 'No group id for cashCollection loanId = ' + cashCollection.loanId };
    }

    const [group] = await findGroups({ _id: { _eq: cashCollection.groupId }});

    if(!group) {
        throw { message: 'No group found = ' + cashCollection.loanId };
    }

    if(group.loanOfficerId) {
        cashCollection.loId = group.loanOfficerId;
    }
    return cashCollection;
}

function cleanUpCollection(c) {
    const fields = CASH_COLLECTIONS_FIELDS.split('\n').map(f => f.trim()).filter(f => !!f);
    const allow_fields = Object.keys(c).filter(c => fields.includes(c));
    
    const cc = allow_fields.reduce((g, f) => ({
        ... g,
        [f]: c[f],
    }), {});

    return ({
        ... cc,
        loanTerms: `${c.loanTerms}`,
        coMaker: c.coMaker === '-' ? null : +c.coMaker,
        noOfPayments: c.noOfPayments === '-' ? 0 : +c.noOfPayments,
    });
}

const assignNullValues = (obj, origin) => {
    let cc = { ...obj };

    if (origin == 'client') {
        cc.delinquent = cc.delinquent ? cc.delinquent : false;
        cc.duplicate = cc.duplicate ? cc.duplicate : false;
        return cc;
    }

    cc.reverted = cc.reverted ? cc.reverted : false;
    cc.revertedTransfer = cc.revertedTransfer ? cc.revertedTransfer : false;
    cc.ldfApproved = cc.ldfApproved ? cc.ldfApproved : false;
    cc.maturedPD = cc.maturedPD ? cc.maturedPD : false;
    cc.transfer = cc.transfer ? cc.transfer : false;
    cc.transferred = cc.transferred ? cc.transferred : false;
    cc.advance = cc.advance ? cc.advance : false;
    cc.transferredReleased = cc.transferredReleased ? cc.transferredReleased : false;
    cc.advanceTransaction = cc.advanceTransaction ? cc.advanceTransaction : false;

    return cc;
};

async function saveCollection(mutationQL, collections, currentDate) {
    const objects = collections.map(c => ({
        ... cleanUpCollection(c),
        _id: generateUUID(),
        dateAdded: currentDate,
    }));

    mutationQL.push(
        insertQl(COLLECTION_TYPE('collections_' + (mutationQL.length + 1)),{
            objects: objects
        })
    );
}

async function updateCollection(mutationQL, collections) {
    collections.map(c => {
        const collectionId = c._id;
        delete c._id;
        if (c?.origin === 'pre-save') {
            delete c.origin;
        }

        mutationQL.push(
            updateQl(COLLECTION_TYPE('collections_' + (mutationQL.length + 1)), {
                set: {
                    ... cleanUpCollection(c),
                    origin: null,
                    reverted: null,
                },
                where: { _id: { _eq: collectionId } }
            })
        );
    });
}

async function updateLoan(user_id, mutationQL, collection, currentDate) {
    let loan = await graph.query(queryQl(LOAN_TYPE('loans'), { where: { _id: { _eq: collection.loanId } } })).then(res => res.data.loans);
    logger.debug({user_id, page: `Saving Cash Collection - Updating Loan: ${collection.loanId}`});
    
    if (loan.length > 0) {
        loan = loan[0];
        delete loan.groupStatus;
        loan.loanBalance = collection.loanBalance;
        loan.modifiedDateTime = new Date();

        if (collection?.revertedDate) {
            loan.revertedDateTime = collection.revertedDate;
        }

        if (collection.remarks && collection.remarks.value === 'matured-past due') {
            loan.activeLoan = 0;
            loan.maturedPD = true;
            loan.maturedPDDate = currentDate;
        }
        
        loan.amountRelease = collection.amountRelease;
        loan.noOfPayments = collection.noOfPayments !== '-' ? collection.noOfPayments : 0;
        loan.status = collection.status;
        loan.pastDue = collection.pastDue;
        loan.advanceDays = collection?.advanceDays ? collection.advanceDays : 0;

        loan.mcbuTarget = collection.mcbuTarget;
        loan.mcbu = collection.mcbu < 0 ? 0 : collection.mcbu;
        if (!loan.mcbuCollection || loan.mcbuCollection < 0) {
            loan.mcbuCollection = 0;
        }
        loan.mcbuCollection = loan.mcbuCollection ? loan.mcbuCollection + parseFloat(collection.mcbuCol) : parseFloat(collection.mcbuCol);

        if (!collection?.hasMcbuWithdrawal) {
            if (loan.occurence == 'daily' && collection.remarks) {
                if (collection.remarks.value == 'reloaner-wd') {
                    loan.mcbuWithdrawal = collection.mcbuWithdrawal;
                } else if (collection.remarks.value == 'reloaner-cont') {
                    loan.mcbuWithdrawal = 0;
                }
            } else {
                loan.mcbuWithdrawal = loan.mcbuWithdrawal ? loan.mcbuWithdrawal + parseFloat(collection.mcbuWithdrawal) : collection.mcbuWithdrawal ? parseFloat(collection.mcbuWithdrawal) : 0;
            }

            if (collection.mcbuWithdrawalFlag) {
                loan.mcbuWithdrawal = collection.mcbuWithdrawal;
            }
        }

        loan.csf = safeNumber(collection.csf);
        loan.csfCollection = safeNumber(loan.csfCollection) + safeNumber(collection.csfCollection);
        loan.csfWithdrawal = safeNumber(loan.csfWithdrawal) + safeNumber(collection.csfWithdrawal);
        loan.csfReturnAmt = safeNumber(loan.csfReturnAmt) + safeNumber(collection.csfReturnAmt);
        loan.csfIn = safeNumber(loan.csfIn) + safeNumber(collection.csfIn);

        if (collection.hasOwnProperty('mcbuInterest')) {
            loan.mcbuInterest = loan.mcbuInterest ? loan.mcbuInterest + collection.mcbuInterest : collection.mcbuInterest !== '-' ? collection.mcbuInterest : 0;
        }
        
        if (collection.remarks && collection.remarks.value === "past due") {
            loan.noPastDue = loan.noPastDue ? loan.noPastDue + 1 : 1;
        } else {
            loan.noPastDue = loan.noPastDue ? loan.noPastDue : 0;
        }

        if (collection.mcbuInterest > 0) {
            loan.mcbuInterest = collection.mcbuInterest;
        }

        if (collection.mcbuReturnAmt > 0) {
            loan.mcbuReturnAmt = collection.mcbuReturnAmt;
        } else {
            loan.mcbuReturnAmt = 0;
        }

        delete loan.groupCashCollections;
        delete loan.loanOfficer;
        delete loan.loanReleaseStr;
        delete loan.reverted;
        
        if (collection.mispayment) {
            loan.mispayment = loan.mispayment + 1;
        }

        if (collection.hasOwnProperty('maturedPastDue')) {
            loan.maturedPastDue = collection.maturedPastDue;
            loan.mispayment = 0;
        }

        loan.history = collection.history;

        if (collection.loanBalance <= 0 || collection?.remarks?.value == 'offset-matured-pd') {
            loan.status = collection.status;
            if (collection.status === 'tomorrow') {
                loan.status = 'active';
            }
            
            loan.activeLoan = 0;
            if (!loan.fullPaymentDate) {    
                loan.fullPaymentDate = collection.fullPaymentDate;
            }
            
            loan.amountRelease = 0;
            if (collection?.remarks?.value !== 'offset-matured-pd') {
                loan.noPastDue = 0;
                loan.pastDue = 0;
            }

            if (collection.status == 'closed') {
                loan.loanCycle = 0;
                loan.remarks = collection.closeRemarks;
                loan.status = 'closed';
                loan.closedDate = currentDate;
                loan.dateModified = currentDate;
            }
        }

        loan.lastUpdated = currentDate;
        logger.debug({user_id, page: `Saving Cash Collection - Updating Loan`, data: loan});
        const loanId = loan._id;
        delete loan._id;

        mutationQL.push(
            updateQl(LOAN_TYPE('loans_' + (mutationQL.length + 1)), {
                set: {
                    ... assignNullValues(loan)
                },
                where: {
                    _id: { _eq: loanId }
                }
            })
        );

        return { success: true };
    }
}

async function updateLoanMcbuWithdrawal(user_id, mutationQL, collection) {
    let loan = await graph.query(queryQl(LOAN_TYPE('loans'), { where: { _id: { _eq: collection.loanId } } })).then(res => res.data.loans);
    logger.debug({user_id, page: `Saving Cash Collection - Updating Loan Due to Withdrawal: ${collection.loanId}`});
    
    if (loan.length > 0) {
        loan = loan[0];
        delete loan.groupStatus;
        delete loan.groupCashCollections;
        delete loan.loanOfficer;
        delete loan.loanReleaseStr;
        delete loan.reverted;
        
        loan.mcbu = collection.mcbu;
        loan.mcbuWithdrawal = collection.mcbuWithdrawal;

        logger.debug({user_id, page: `Saving Cash Collection - Updating Loan Due to Withdrawal`, data: loan});
        const loanId = loan._id;
        delete loan._id;

        mutationQL.push(
            updateQl(LOAN_TYPE('loans_' + (mutationQL.length + 1)), {
                set: {
                    ... assignNullValues(loan)
                },
                where: {
                    _id: { _eq: loanId }
                }
            })
        );

        return { success: true };
    }
}

async function updateClient(user_id, mutationQl, loan) {
    let client = await graph.query(queryQl(CLIENT_TYPE('client'), { where: { _id: { _eq: loan.clientId } } })).then(res => res.data.client);
    
    if (client.length > 0) {
        client = client[0];
        client.status = loan.clientStatus;

        if (client.status === 'offset') {
            client.oldLoId = client.loId;
            client.oldGroupId = client.groupId;
            client.groupId = null;
            client.loId = null;
        }

        if ((loan.remarks && loan.remarks.value?.startsWith('delinquent') && loan.delinquent)) {
            client.delinquent = true;
        }

        mutationQl.push(
            updateQl(CLIENT_TYPE('clients_' + (mutationQl.length + 1)), {
                set: {
                    ... assignNullValues(client, 'client')
                },
                where: {
                    _id: { _eq: loan.clientId }
                }
            })
        );
        
        if (loan.remarks && loan.remarks.value?.startsWith('offset')) {
            await updateGroup(user_id, mutationQl, loan);
        }
    }
}

async function updateGroup(user_id, mutationQl, loan) {
    let group = await graph.query(
        queryQl(GROUP_TYPE('groups'), {where: { _id: { _eq: loan.groupId } }})
    ).then(res => res.data.groups);

    if (group.length > 0) {
        group = group[0];

        if (group.status === 'full') {
            group.status = 'available';
        }

        const slotNo = parseInt(loan.slotNo);
        if (!group.availableSlots) {
            group.availableSlots = [];
        }
        
        if (!group.availableSlots.includes(slotNo)) {
            group.availableSlots.push(slotNo);
            group.availableSlots.sort((a, b) => a - b);
            group.noOfClients = group.noOfClients - 1;
        } else {
            const index = group.availableSlots.indexOf(slotNo);
            if (index > -1) {
                group.availableSlots.splice(index, 1);
                group.availableSlots.sort((a, b) => a - b);
                group.noOfClients = group.noOfClients + 1;
            }
        }

        delete group._id;

        mutationQl.push(
            updateQl(GROUP_TYPE('groups_' + (mutationQl.length + 1)), {
                set: {
                    ... group
                },
                where: {
                    _id: { _eq: loan.groupId }
                }
            })
        );
    }
}

async function updateDenomination(mutationQl, groupId, currentDate, overallTotalNetCollection) {
    let denomination = await graph.query(
        queryQl(DENOMINATION_TYPE('denomination'), {where: { group_id: { _eq: groupId }, date_added: { _eq: currentDate } }})
    ).then(res => res.data.denomination);

    if (denomination && denomination.length > 0) {
        denomination = denomination[0];
        const history = denomination.history ? [...denomination.history] : [];
        
        if (history.length > 0) {
            let needsUpdate = false;
            const latestHistory = history[history.length - 1];
            const denominationId = denomination._id;
            delete denomination._id;
            
            if (latestHistory.total_net_collection !== overallTotalNetCollection && overallTotalNetCollection > 0) {
                denomination.bcc_vs_remittances = overallTotalNetCollection;
                denomination.synced = false;
                needsUpdate = true;
            } else {
                denomination.bcc_vs_remittances = overallTotalNetCollection;
                denomination.synced = true;
                needsUpdate = true;
            }

            if (needsUpdate) {
                mutationQl.push(
                    updateQl(DENOMINATION_TYPE('denomination_' + (mutationQl.length + 1)), {
                        set: {
                            ... denomination
                        },
                        where: {
                            _id: { _eq: denominationId }
                        }
                    })
                );
            }
        }
    }
}