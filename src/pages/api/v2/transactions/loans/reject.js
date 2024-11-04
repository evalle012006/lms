import { apiHandler } from "@/services/api-handler";
import logger from "@/logger";
import {
  createGraphType,
  deleteQl,
  insertQl,
  updateQl,
} from "@/lib/graph/graph.util";
import {
  CASH_COLLECTIONS_FIELDS, CLIENT_FIELDS,
  GROUP_FIELDS,
  LOAN_FIELDS,
} from "@/lib/graph.fields";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
  filterGraphFields,
  findCashCollections,
  findClients,
  findGroups,
  findLoans,
} from "@/lib/graph.functions";

const groupType = createGraphType("groups", GROUP_FIELDS);
const loanType = createGraphType("loans", LOAN_FIELDS);
const clientType = createGraphType("clients", LOAN_FIELDS);
const cashCollectionType = createGraphType("cashCollections", CASH_COLLECTIONS_FIELDS);
const graph = new GraphProvider();

export default apiHandler({
    post: updateLoan
});

async function updateLoan(req, res) {

  const mutationList = [];
  const addToMutationList = addToList => mutationList.push(addToList(`bulk_update_${mutationList.length}`));

    let response;

    let loan = req.body;
    const loanId = loan._id;
    const currentDate = loan.currentDate;

    delete loan._id;
    delete loan.loanOfficer;
    delete loan.groupCashCollections;
    delete loan.loanReleaseStr;
    delete loan.allowApproved;
    delete loan.currentDate;
    delete loan.groupStatus;
    delete loan.selected;

    let groupData = await findGroups({ _id: { _eq: loan.groupId }});
    if (groupData.length > 0) {
        groupData = groupData[0];
        if (loan.status === 'active') {
            await updateClient(loan.clientId, addToMutationList);
            if (loan.coMaker) {
                if (typeof loan.coMaker === 'string') {
                    loan.coMakerId = loan.coMaker;
                    const coMakerResp = await getCoMakerInfo(loan.coMaker, loan.groupId);
                    if (coMakerResp.success) {
                        loan.coMaker = coMakerResp.client;
                    }
                } else if (typeof loan.coMaker === 'number') {
                    const coMakerResp = await getCoMakerInfo(loan.coMaker, loan.groupId);
                    if (coMakerResp.success) {
                        loan.coMakerId = coMakerResp.client;
                    }
                }
            }
        }  else if (loan.status === 'reject') {
            logger.debug({page: `Rejecting Loan: ${loanId}`, data: loan});
            // if reloan cashCollections:
            // status to completed
            // currentReleaseAmount to 0
            // in loans, change back the previous loan to completed status and the current one change the loanCycle to 0
            // client status to pending
            if (loan.loanCycle > 1) {
                let prevLoan = await findLoans({ 
                  clientId: { _eq: loan.clientId }, 
                  loanCycle: { _eq: loan.loanCycle - 1 },
                  groupId: { _eq: loan.groupId }
                });
                logger.debug({page: `Rejecting Loan: ${loanId}`, message: 'Previous Loan', data: prevLoan});
                if (prevLoan && prevLoan?.length > 0) {
                    prevLoan = prevLoan[0];
                    let cashCollection = await findCashCollections({
                      clientId: { _eq: loan.clientId },
                      dateAdded: { _eq: currentDate },
                      groupId: { _eq: loan.groupId },
                    });
                    logger.debug({page: `Rejecting Loan: ${loan._id}`, message: 'Cash Collection Data', data: cashCollection});
                    if (cashCollection.length > 0) {
                        cashCollection = cashCollection[0];
                        cashCollection.status = cashCollection.loanBalance <= 0 ? 'completed' : 'active';
                        cashCollection.currentReleaseAmount = 0;
                        cashCollection.loanId = prevLoan._id + "";
                        cashCollection.advance = false;
                        const ccId = cashCollection._id;
                        delete cashCollection._id;
                        delete cashCollection.prevLoanId;
                        addToMutationList(alias => updateQl(cashCollectionType(alias), {
                          where: { _id: { _eq: ccId } },
                          set: filterGraphFields(CASH_COLLECTIONS_FIELDS, {
                            ...cashCollection,
                            prevLoanId: null,
                          })
                        }));
                        // await db.collection('cashCollections').updateOne({ _id: ccId }, { $unset: { prevLoanId: 1 }, $set: { ...cashCollection } });
                    }

                    const prevLoanId = prevLoan._id;
                    delete prevLoan._id;
                    if (prevLoan.loanBalance <= 0 && prevLoan.fullPaymentDate) {
                        prevLoan.status = 'completed';
                        prevLoan.mcbu = loan.mcbu ? loan.mcbu : 0;
                        prevLoan.mcbuCollection = loan.mcbu ? loan.mcbu : 0;
                        prevLoan.advance = false;
                        prevLoan.advanceDate = null;
                    } else {
                        prevLoan.status = 'active';
                    }

                    delete prevLoan.advance;
                    delete prevLoan.advanceDate;
                    
                    addToMutationList(alias => updateQl(loanType(alias), {
                      where: { _id: { _eq: prevLoanId } },
                      set: filterGraphFields(LOAN_FIELDS, {
                        ...prevLoan,
                        advance: false,
                        advanceDate: null, 
                      })
                    }));
                    // await db.collection('loans').updateOne({ _id: prevLoanId }, {$unset: {advance: 1, advanceDate: 1}, $set: { ...prevLoan }});
                }
            } else {
                logger.debug({page: `Rejecting Loan: ${loanId}`, message: 'Deleting cashCollection data.'});
                addToMutationList(alias => deleteQl(cashCollectionType(alias), { loanId: { _eq: loanId } }));
            }

            loan.loanCycle = 0;

            if (!groupData.availableSlots.includes(loan.slotNo)) {
                groupData.availableSlots.push(loan.slotNo);
                groupData.availableSlots.sort((a, b) => { return a - b; });
                groupData.noOfClients = groupData.noOfClients - 1;
                groupData.status = groupData.status === 'full' ? 'available' : groupData.status;
                await updateGroup(groupData, addToMutationList);
            }
        }

        if (loan.status === 'active' || loan.status === 'reject') {
            logger.debug({page: `Loan: ${loanId}`, message: 'Updating loan data.', status: loan.status});
            addToMutationList(alias => updateQl(loanType(alias), {
              where: { _id: { _eq: loanId } },
              set: filterGraphFields(LOAN_FIELDS, { ...loan })
            }));

            loan._id = loanId;
            if (loan.status === 'active') {
                await saveCashCollection(loan, groupData, currentDate, addToMutationList);
            }
        }

        await graph.mutation(
          ... mutationList
        );

        response = { success: true };   
    } else {
        response = { error: true, message: 'Group data not found.' };
    }

    res.send(response);
}

async function updateGroup(group, addToMutationList) {
    const groupId = group._id;
    delete group._id;

    addToMutationList(alias => updateQl(groupType(alias), {
      where: { _id: { _eq: groupId } },
      set: { ...group }
    }));

    return {success: true}
}

async function updateClient(clientId, addToMutationList) {
    let client = await findClients({ _id: { _eq: clientId }});

    if (client.length > 0) {
        client = client[0];

        client.status = 'active';
        delete client._id;

        addToMutationList(alias => updateQl(clientType(alias), {
          where: { _id: { _eq: clientId } },
          set: filterGraphFields(CLIENT_FIELDS, { ...client })
        }));
    }
    
    return {success: true, client}
}

async function getCoMakerInfo(coMaker, groupId) {
    let client;
    if (typeof coMaker === 'number' || !isNaN(coMaker)) {
        const loan = await findLoans({
          groupId: { _eq: groupId },
          status: { _in: ['active', 'pending'] },
          slotNo: { _eq: +coMaker },
        });
          
        if (loan && loan.length > 0) {
            client = loan[0].clientId;
        }
    } else if (typeof coMaker === 'string') {
        const loan = await findLoans({
          clientId: { _eq: coMaker },
          status: { _in: ['active', 'pending'] }
        });
        
        if (loan && loan.length > 0) {
            client = loan[0].slotNo;
        }
    }
    
    return {success: true, client}
}

async function saveCashCollection(loan, group, currentDate, addToMutationList) {
    const status = loan.status === "active" ? "tomorrow" : loan.status;

    let cashCollection = await findCashCollections({
      clientId: { _eq: loan.clientId },
      dateAdded: { _eq: currentDate },
    })

    if (cashCollection.length > 0) {
        cashCollection = cashCollection[0];
        const ccId = cashCollection._id;
        delete cashCollection._id;

        addToMutationList(alias =>updateQl(cashCollectionType(alias), {
          where: { _id: { _eq: ccId } },
          set: filterGraphFields(CASH_COLLECTIONS_FIELDS, { ...cashCollection, status: status, loanCycle: loan.loanCycle, modifiedDate: currentDate })
        }));

    } else {
        // this entry is only when the approve or reject is not the same day when it applies
        let data = {
            loanId: loan._id + '',
            branchId: loan.branchId,
            groupId: loan.groupId,
            groupName: loan.groupName,
            loId: loan.loId,
            clientId: loan.clientId,
            slotNo: loan.slotNo,
            loanCycle: loan.loanCycle,
            mispayment: false,
            mispaymentStr: 'No',
            collection: 0,
            excess: 0,
            total: 0,
            noOfPayments: 0,
            activeLoan: loan.activeLoan,
            targetCollection: loan.activeLoan,
            amountRelease: loan.amountRelease,
            loanBalance: loan.loanBalance,
            paymentCollection: 0,
            occurence: group.occurence,
            currentReleaseAmount: loan.amountRelease,
            fullPayment: 0,
            remarks: '',
            mcbu: loan.mcbu ? loan.mcbu : 0,
            mcbuCol: 0,
            mcbuWithdrawal: 0,
            mcbuReturnAmt: 0,
            status: status,
            dateAdded: currentDate,
            groupStatus: 'pending',
            origin: 'automation-ar-loan'
        };

        if (data.loanCycle === 1 && data.occurence === 'weekly') {
            data.mcbuCol = loan.mcbu;
        }

        if (data.occurence === 'weekly') {
            data.mcbuTarget = 50;
            data.groupDay = group.day;
        }

        addToMutationList(alias => insertQl(cashCollectionType(alias), {
          objects: [filterGraphFields(CASH_COLLECTIONS_FIELDS, {...data})]
        }));
    }
}