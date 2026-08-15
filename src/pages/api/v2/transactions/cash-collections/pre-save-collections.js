import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'node_modules/apollo-boost/lib/index';

const graph = new GraphProvider();

export default apiHandler({
    post: save
});

async function save(req, res) {
    let response = {};
    let statusCode = 200;
    const { loId, loanOfficers, currentDate, mode = 'single' } = req.body;

    try {
        // Batch mode - process multiple loan officers
        if (mode === 'batch' && loanOfficers && Array.isArray(loanOfficers)) {
            console.log(`Starting batch pre-save for ${loanOfficers.length} loan officers on date: ${currentDate}`);
            
            let successCount = 0;
            let skippedCount = 0;
            let errorCount = 0;
            const results = [];

            for (const lo of loanOfficers) {
                try {
                    const result = await preSaveForLoanOfficer(lo.loId, currentDate);
                    
                    if (result.skipped) {
                        skippedCount++;
                    } else if (result.success) {
                        successCount++;
                    }
                    
                    results.push({
                        loId: lo.loId,
                        loName: lo.loName,
                        ...result
                    });
                } catch (error) {
                    errorCount++;
                    console.error(`Error pre-saving for LO ${lo.loName} (${lo.loId}):`, error.message);
                    results.push({
                        loId: lo.loId,
                        loName: lo.loName,
                        success: false,
                        error: true,
                        message: error.message
                    });
                }
            }

            console.log(`Batch pre-save completed. Success: ${successCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);

            response = {
                success: true,
                mode: 'batch',
                total: loanOfficers.length,
                successCount,
                skippedCount,
                errorCount,
                results
            };

            res.status(statusCode)
                .setHeader('Content-Type', 'application/json')
                .end(JSON.stringify(response));
            return;
        }

        // Single mode - process one loan officer (existing implementation)
        if (mode === 'single' && loId) {
            const result = await preSaveForLoanOfficer(loId, currentDate);
            
            response = result;
            res.status(statusCode)
                .setHeader('Content-Type', 'application/json')
                .end(JSON.stringify(response));
            return;
        }

        // Invalid request
        statusCode = 400;
        response = {
            success: false,
            error: true,
            message: 'Invalid request. Either provide loId with mode=single or loanOfficers array with mode=batch'
        };

        res.status(statusCode)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify(response));

    } catch (error) {
        console.error('Error in pre-save collections:', error);
        statusCode = 500;
        response = { 
            success: false, 
            error: true,
            message: error.message || 'Error saving collections'
        };
        
        res.status(statusCode)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify(response));
    }
}

// Helper function to pre-save collections for a single loan officer
async function preSaveForLoanOfficer(loId, currentDate) {
    // Fetch loans that need pre-save collections
    const loans = await graph.apollo.query({
        query: gql`
            query groups ($where:pre_save_collection_model_bool_exp_bool_exp,  $args: get_pre_save_collection_data_arguments!) {
                collections: get_pre_save_collection_data(args: $args, where: $where) {
                    _id,
                    loan
                    group
                }
            }
        `,
        variables: {
            args: {
                loId,
                curr_date: currentDate
            }
        }
    }).then(res => res.data.collections.map(c => ({
        ... c.loan,
        groupIdObj: null,
        group: c.group,
    })));

    // If no loans found, return early
    if (!loans || loans.length === 0) {
        console.log(`No loans found for pre-save for loId: ${loId} on date: ${currentDate}`);
        return { 
            success: true, 
            message: 'No loans found for pre-save',
            count: 0
        };
    }

    // Check which clients already have collections for this date
    const clientIds = loans.map(loan => loan.clientId);
    
    const existingCollections = await graph.apollo.query({
        query: gql`
            query checkExisting($clientIds: [String!]!, $currentDate: date!) {
                cashCollections(
                    where: {
                        clientId: { _in: $clientIds }
                        dateAdded: { _eq: $currentDate }
                        origin: { _eq: "pre-save" }
                    }
                ) {
                    clientId
                }
            }
        `,
        variables: {
            clientIds,
            currentDate
        }
    });

    // Create a Set of existing clientIds for fast lookup
    const existingClientIds = new Set(
        existingCollections.data.cashCollections.map(c => c.clientId)
    );

    // Filter out loans that already have collections
    const loansToPreSave = loans.filter(loan => !existingClientIds.has(loan.clientId));

    if (loansToPreSave.length === 0) {
        console.log(`All collections already pre-saved for loId: ${loId} on date: ${currentDate}`);
        return { 
            success: true, 
            message: 'All collections already pre-saved for this date',
            skipped: true,
            existingCount: existingClientIds.size
        };
    }

    console.log(`Pre-saving ${loansToPreSave.length} collections for loId: ${loId} on date: ${currentDate} (${existingClientIds.size} already exist)`);

    // Create cash collections from loans (only for new clients)
    const cashCollections = loansToPreSave.map(loan => ({
        _id: generateUUID(),
        loanId: loan._id + '',
        branchId: loan.branchId,
        groupId: loan.groupId,
        groupName: loan.groupName,
        loId: loan.loId,
        clientId: loan.clientId,
        slotNo: loan.slotNo,
        loanCycle: loan.loanCycle,
        mispayment: false,
        excess: 0,
        total: 0,
        noOfPayments: 0,
        activeLoan: loan.activeLoan,
        targetCollection: loan.activeLoan, 
        amountRelease: loan.amountRelease,
        loanBalance: loan.loanBalance,
        paymentCollection: 0,
        occurence: loan.group.occurence,
        currentReleaseAmount: 0,
        mcbuTarget: 50,
        groupDay: loan.group.day,
        fullPayment: 0,
        mcbu: loan.mcbu,
        mcbuCol: 0,
        mcbuWithdrawal: 0,
        mcbuReturnAmt: 0,
        admissionCollection: 0,
        lrfCollection: 0,
        cbhbCollection: 0,
        addHospitalization: 0,
        otherPassbookCollection: 0,
        otherPictureCollection: 0,
        csf: loan.csf || 0,
        csfCollection: 0,
        csfWithdrawal: 0,
        csfReturnAmt: 0,
        remarks: '',
        status: loan.status,
        dateAdded: currentDate,
        groupStatus: "pending",
        insertedDateTime: new Date(),
        pastDue: loan.pastDue ? loan.pastDue : 0,
        coMakerId: loan.coMakerId,
        coMaker: loan.coMaker,
        origin: 'pre-save'
    }));

    // Insert the collections
    await graph.mutation(
        insertQl(createGraphType('cashCollections', '_id')('collections'), {
            objects: cashCollections
        })
    );

    console.log(`Successfully pre-saved ${cashCollections.length} collections for loId: ${loId}`);

    return { 
        success: true, 
        message: 'Collections pre-saved successfully',
        count: cashCollections.length,
        skippedCount: existingClientIds.size
    };
}