import { apiHandler } from "@/services/api-handler";
import moment from "moment";
import { findCashCollections, findLoans } from "@/lib/graph.functions";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, insertQl, updateQl } from "@/lib/graph/graph.util";
import {
  CASH_COLLECTIONS_FIELDS,
  CLIENT_FIELDS,
  GROUP_FIELDS,
  LOAN_FIELDS,
  TRANSFER_CLIENT_FIELDS,
} from "@/lib/graph.fields";
import logger from "@/logger";
import { generateUUID } from "@/lib/utils";
import { logGraphQLError } from "@/lib/graphql-utils";

const groupsType = createGraphType("groups", GROUP_FIELDS);
const loansType = createGraphType("loans", LOAN_FIELDS);
const clientType = createGraphType("client", CLIENT_FIELDS);
const transferClientsType = createGraphType("transferClients", TRANSFER_CLIENT_FIELDS);
const cashCollectionsType = createGraphType("cashCollections", CASH_COLLECTIONS_FIELDS);

const graph = new GraphProvider();

export default apiHandler({
  post: approveReject,
});

async function approveReject(req, res) {
    const user_id = req.auth?.sub;
    const transfers = req.body;
    const mutationList = [];
    const addToMutationList = addToList => mutationList.push(addToList(`bulk_update_${mutationList.length}`));

    const errorMsg = new Set();
    try {
        await Promise.all(transfers.map(async (transfer) => {
            if (transfer.status === "approved") {
                logger.debug({user_id, page: `Processing Transfer: ${transfer.selectedClientId}`, data: transfer});
                const currentDate = transfer.currentDate;
                delete transfer.currentDate;

                let sourceGroup = transfer.sourceGroup;
                let targetGroup = transfer.targetGroup;
    
                const sourceGroupId = sourceGroup._id;
                const targetGroupId = targetGroup._id;
                delete sourceGroup._id;
                delete targetGroup._id;
    
                const existingCashCollection = await findCashCollections({
                    clientId: { _eq: transfer.selectedClientId },
                    groupId: { _eq: transfer.sourceGroupId },
                    dateAdded: { _eq: currentDate },
                });
                
                logger.debug({user_id, page: `Existing CashCollection: ${existingCashCollection.length}`});
                targetGroup.noOfClients = targetGroup.noOfClients ? targetGroup.noOfClients : 0;
                
                if (targetGroup.status === 'full') {
                    errorMsg.add("Some client were not successfully transferred due to selected group is full.");
                } else {
                    let selectedSlotNo = transfer.selectedSlotNo;
                    const clientLoans = await findLoans({
                        clientId: { _eq: transfer.selectedClientId },
                        status: { _in: ['active', 'completed', 'pending'] } 
                    });
                    
                    logger.debug({user_id, page: `Client Loans: ${clientLoans.length}`, data: clientLoans});
                    const validateLoan = getAndValidateLoan(clientLoans);
                    logger.debug({user_id, page: `Validate Loan: ${clientLoans.length}`, data: validateLoan});
                    const loan = validateLoan.loan;

                    if (validateLoan.error) {
                        errorMsg.add(validateLoan.errorMsg);
                    } else {
                        if (selectedSlotNo !== '-') {
                            if (!targetGroup.availableSlots.includes(selectedSlotNo)) {
                                selectedSlotNo = targetGroup.availableSlots[0];
                            }

                            targetGroup.availableSlots = targetGroup.availableSlots.filter(s => s !== selectedSlotNo);
                            targetGroup.noOfClients = targetGroup.noOfClients + 1;

                            if (targetGroup.noOfClients === targetGroup.capacity) {
                                targetGroup.status = 'full';
                            }

                            if (!sourceGroup.availableSlots.includes(transfer.currentSlotNo)) {
                                sourceGroup.availableSlots.push(transfer.currentSlotNo);
                                sourceGroup.availableSlots.sort((a, b) => { return a - b; });
                            }
                            sourceGroup.noOfClients = sourceGroup.noOfClients - 1;

                            addToMutationList(alias => updateQl(groupsType(alias), {
                                where: { _id: { _eq: sourceGroupId } },
                                set: { ...sourceGroup }
                            }));

                            addToMutationList(alias => updateQl(groupsType(alias), {
                                where: { _id: { _eq: targetGroupId } },
                                set: { ...targetGroup }
                            }));

                            if (loan) {
                                const loanId = loan._id;
                                delete loan._id;
                                delete loan.transferId;
                                delete loan.transferDate;
                                delete loan.transfer;
                                delete loan.transferredDate;
                                delete loan.transferred;

                                let updatedLoan = {...loan};
                                updatedLoan.branchId = transfer.targetBranchId;
                                updatedLoan.loId = transfer.targetUserId;
                                updatedLoan.groupId = transfer.targetGroupId;
                                updatedLoan.groupName = targetGroup.name;
                                updatedLoan.slotNo = selectedSlotNo;
                                updatedLoan.mcbuCollection = loan.mcbu;
                                updatedLoan.transferId = transfer._id;
                                updatedLoan.transfer = true;
                                if (updatedLoan.status == 'active') {
                                    updatedLoan.startDate = moment(currentDate).add(1, 'days').format("YYYY-MM-DD");
                                }
                                updatedLoan.transferDate = currentDate;
                                updatedLoan.insertedDateTime = new Date();

                                if (updatedLoan.status == 'completed' && updatedLoan.fullPaymentDate == currentDate) {
                                    updatedLoan.fullPaymentDate = null;
                                }

                                if (existingCashCollection.length > 0) {
                                    const prevLoanId = existingCashCollection[0].loanId;
                                    let prevLoan = await findLoans({ _id: { _eq: prevLoanId } });
                                    if (prevLoan.length > 0) {
                                        prevLoan = prevLoan[0];

                                        if (existingCashCollection[0].status == 'tomorrow' || existingCashCollection[0].status == 'pending') {
                                            prevLoan.transferredReleased = true;
                                        }

                                        if (existingCashCollection[0].status == 'completed') {
                                            updatedLoan.status = 'completed';
                                        }
                                    }
                                    delete prevLoan._id;
                                    logger.debug({user_id, page: `Previous Loan: ${prevLoanId}`, data: prevLoan});
                                    addToMutationList(alias => updateQl(loansType(alias), {
                                        where: { _id: { _eq: prevLoanId } },
                                        set: { ...prevLoan },
                                    }));
                                }

                                const newLoanId = generateUUID();
                                // Remove the .then() chain and just add to mutation list
                                addToMutationList(alias => insertQl(loansType(alias), { 
                                    objects: [{ ...updatedLoan, _id: newLoanId }]
                                }));

                                loan.status = "closed";
                                loan.transferred = true;
                                loan.transferId = transfer._id;
                                loan.transferredDate = currentDate;
                                loan.modifiedDateTime = new Date();

                                addToMutationList(alias => updateQl(loansType(alias), {
                                    where: { _id: { _eq: loanId } },
                                    set: { ...loan }
                                }));

                                loan._id = newLoanId;
                                loan.oldId = loanId + "";
                            }
                        }

                        await saveCashCollection(transfer, loan, sourceGroup, targetGroup, selectedSlotNo, existingCashCollection, currentDate, addToMutationList);

                        logger.debug({user_id, page: `Updating Client: ${transfer.selectedClientId}`});

                        addToMutationList(alias => updateQl(clientType(alias), {
                            where: { _id: { _eq: transfer.selectedClientId } },
                            set: { branchId: transfer.targetBranchId, loId: transfer.targetUserId, groupId: transfer.targetGroupId, groupName: targetGroup.name }
                        }));
                        
                        addToMutationList(alias => updateQl(transferClientsType(alias), {
                            where: { _id: { _eq: transfer._id } },
                            set: {
                                oldLoanId: loan?.oldId,
                                newLoanId: loan?._id,
                                status: "approved",
                                occurence: sourceGroup.occurence,
                                approveRejectDate: currentDate,
                                modifiedDateTime: new Date()
                            }
                        }));
                    }
                }
            } else {
                addToMutationList(alias => updateQl(transferClientsType(alias), {
                    where: { _id: { _eq: transfer._id } },
                    set: {status: "reject", modifiedDateTime: new Date()}
                }));
            }
        }));

        try {
            const result = await graph.mutation(...mutationList);
            
            const errors = Array.from(errorMsg);
            const response = errors.length > 0 
                ? { success: true, message: errors.join('<br/>')}
                : { success: true };

            res.status(200)
                .setHeader('Content-Type', 'application/json')
                .end(JSON.stringify(response));

        } catch (graphqlError) {
            // Format and log the error
            const formattedErrors = logGraphQLError(graphqlError, {
                user_id,
                page: 'Transfer Client Approve/Reject',
                operation: 'mutation'
            });

            // Create a user-friendly error message
            const errorMessages = formattedErrors.map(err => {
                if (err.details?.type === 'TypeMismatch') {
                    return `Field "${err.details.field}" expected ${err.details.expected} but received ${err.details.received}`;
                }
                return err.message;
            });

            logger.error({
                user_id,
                page: 'Transfer Client Approve/Reject',
                error: formattedErrors
            });

            res.status(400)
                .setHeader('Content-Type', 'application/json')
                .end(JSON.stringify({
                    success: false,
                    message: errorMessages.join('\n'),
                    details: formattedErrors
                }));
        }

    } catch (error) {
        logger.error({
            user_id,
            page: 'Transfer Client Approve/Reject',
            error: error
        });

        res.status(500)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify({
                success: false,
                message: 'An internal server error occurred',
                details: error.message
            }));
    }
}

async function saveCashCollection(transfer, loan, sourceGroup, targetGroup, selectedSlotNo, existingCashCollection, currentDate, addToMutationList) {
    // add new cash collection entry with updated data
    const cashCollection = await findCashCollections({
      clientId: { _eq: transfer.selectedClientId },
      groupId: { _eq: transfer.targetGroupId },
      dateAdded: { _eq: currentDate }
    });

    if (cashCollection.length === 0) {
        let data = {
            branchId: transfer.targetBranchId,
            groupId: transfer.targetGroupId,
            loId: transfer.targetUserId,
            clientId: transfer.selectedClientId,
            mispayment: false,
            // collection: 0,
            excess: 0,
            total: 0,
            activeLoan: 0,
            targetCollection: 0,
            amountRelease: 0,
            loanBalance: 0,
            paymentCollection: 0,
            occurence: targetGroup.occurence,
            currentReleaseAmount: 0,
            fullPayment: 0,
            mcbu: 0,
            mcbuCol: 0,
            mcbuWithdrawal: 0,
            mcbuReturnAmt: 0,
            remarks: null,
            dateAdded: currentDate,
            groupStatus: 'closed',
            transferId: transfer._id,
            transferDate: currentDate,
            // sameLo: transfer.sameLo, 
            transfer: true,
            // loToLo: transfer.loToLo,
            // branchToBranch: transfer.branchToBranch,
            insertedDateTime: new Date(),
            origin: 'automation-trf'
        };

        if (loan) {
            data.oldLoanId = loan.oldId;
            data.loanId = loan._id;
            data.activeLoan = loan.activeLoan;
            data.targetCollection = loan.activeLoan;
            data.amountRelease = loan.amountRelease;
            data.loanBalance = loan.loanBalance;
            data.slotNo = selectedSlotNo;
            data.loanCycle = loan.loanCycle;
            data.noOfPayments = loan.noOfPayments;
            data.mcbu = loan.mcbu;
            data.pastDue = loan.pastDue;
            data.noPastDue = loan.noPastDue;
            data.loanTerms = loan.loanTerms + "";
            data.remarks = existingCashCollection.length > 0 ? existingCashCollection[0].remarks : null;
            data.status = existingCashCollection.length > 0 ? existingCashCollection[0].status : null;

            if (data.status == 'tomorrow')  {
                data.amountRelease = 0;
                data.loanBalance = 0;
                data.targetCollection = 0;
                data.activeLoan = 0;
            }

            if (data.occurence === 'weekly') {
                // data.mcbuTarget = 50;
                data.groupDay = targetGroup.groupDay;
            }
        }

        addToMutationList(alias => insertQl(cashCollectionsType(alias), { objects: [{ ...data, _id: generateUUID() }]}));
    } else {
        addToMutationList(alias => updateQl(cashCollectionsType(alias), {
            where: { _id: { _eq: cashCollection[0]._id } },
            set: {
                transfer: true,
                // sameLo: transfer.sameLo, 
                transferId: transfer._id, 
                transferDate: currentDate,
                // loToLo: transfer.loToLo, 
                // branchToBranch: transfer.branchToBranch,
                modifiedDateTime: new Date()
            }
        }));
    }

    // add or update client data on cash collection
    if (existingCashCollection.length === 0) {
        let data = {
            branchId: transfer.oldBranchId,
            groupId: transfer.oldGroupId,
            loId: transfer.oldLoId,
            clientId: transfer.selectedClientId,
            mispayment: false,
            // collection: 0,
            excess: 0,
            total: 0,
            activeLoan: 0,
            targetCollection: 0,
            amountRelease: 0,
            loanBalance: 0,
            paymentCollection: 0,
            occurence: sourceGroup.occurence,
            currentReleaseAmount: 0,
            fullPayment: 0,
            mcbu: 0,
            mcbuCol: 0,
            mcbuWithdrawal: 0,
            mcbuReturnAmt: 0,
            remarks: null,
            dateAdded: currentDate,
            groupStatus: 'closed',
            transferId: transfer._id,
            transferredDate: currentDate,
            // sameLo: transfer.sameLo, 
            transferred: true,
            // loToLo: transfer.loToLo,
            // branchToBranch: transfer.branchToBranch,
            insertedDateTime: new Date(),
            origin: 'automation-trf'
        };

        if (loan) {
            data.loanId = loan.oldId + "";
            data.activeLoan = loan.activeLoan;
            data.targetCollection = loan.activeLoan;
            data.amountRelease = loan.amountRelease;
            data.loanBalance = loan.loanBalance;
            data.slotNo = loan.slotNo;
            data.loanCycle = loan.loanCycle;
            data.noOfPayments = loan.noOfPayments;
            data.status = loan.status;
            data.mcbu = loan.mcbu;
            data.loanTerms = loan.loanTerms + "";
            data.remarks = loan?.history?.remarks;
        }

        if (data.occurence === 'weekly') {
            data.mcbuTarget = 50;
            data.groupDay = sourceGroup.groupDay;
        }

        addToMutationList(alias => insertQl(cashCollectionsType(alias), { objects: [{ ...data, _id: generateUUID() }]}));
    } else {
        addToMutationList(alias => updateQl(cashCollectionsType(alias), {
            where: { _id: { _eq: existingCashCollection[0]._id } }, 
            set: {
                transferred: true,
                // sameLo: transfer.sameLo, 
                transferId: transfer._id, 
                transferredDate: currentDate,
                // loToLo: transfer.loToLo, 
                // branchToBranch: transfer.branchToBranch,
                modifiedDateTime: new Date()
            }
        }));
    }
}

function getAndValidateLoan(loans) {
    let withError = false;
    let errorMsg;
    let loan;

    if (loans.length > 0) {
        if (loans.length > 1) {
            withError = true;
            errorMsg = `Slot No ${loans[0].slotNo} from group ${loans[0].groupName} has multiple loans open. Please contact System support.`;
        } else {
            loan = loans[0];
        }
    } else {
        withError = true;
        errorMsg = `Client has no active loans.`;
    }

    return { loan: loan, error: withError, errorMsg: errorMsg };
}