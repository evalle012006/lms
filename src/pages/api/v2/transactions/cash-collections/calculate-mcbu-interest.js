import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import logger from '@/logger';

const graph = new GraphProvider();

// Define the fields we need from cashCollections
const MCBU_INTEREST_FIELDS = `
    _id
    clientId
    dateAdded
    mcbu
    mcbuWithdrawal
    remarks
`;

const CASH_COLLECTION_TYPE = createGraphType('cashCollections', MCBU_INTEREST_FIELDS);

export default apiHandler({
    get: calculateMcbuInterest,
    post: calculateMcbuInterest
});

/**
 * Calculate MCBU Interest for a client
 * 
 * Formula: monthlyInterest = (mcbu - mcbuWithdrawal) * 0.0083
 * 
 * Logic:
 * 1. Check if client had an offset transaction during the year (remarks.value contains 'offset')
 * 2. If offset exists, only calculate from records AFTER the last offset date
 * 3. For each applicable month, query ONLY the first transaction where mcbu >= 500 (limit: 1)
 * 4. Execute all queries in parallel using Promise.all
 * 5. Calculate monthly interest for each first instance
 * 6. Round off final mcbuInterest to whole number
 * 7. Calculate lacking amount to add to mcbuCol (to round up to nearest 10)
 */
async function calculateMcbuInterest(req, res) {
    let statusCode = 200;
    let response = {};

    try {
        const { clientId, year, mcbuInterestRate } = req.method === 'GET' ? req.query : req.body;

        if (!clientId) {
            return res.status(400).json({
                success: false,
                message: 'clientId is required'
            });
        }

        // Use current year if not provided
        const targetYear = parseInt(year) || new Date().getFullYear();

        logger.debug({
            page: 'Calculate MCBU Interest',
            message: `Calculating MCBU Interest for clientId: ${clientId}, year: ${targetYear}`
        });

        // Step 1: Check for the last offset transaction in the year
        const lastOffsetDate = await getLastOffsetDate(clientId, targetYear);

        if (lastOffsetDate) {
            logger.debug({
                page: 'Calculate MCBU Interest',
                message: `Found offset transaction on ${lastOffsetDate}, will only calculate from records after this date`
            });
        }

        // Step 2: Query all applicable months in parallel (after offset if exists)
        const monthlyFirstInstances = await getFirstInstancePerMonth(clientId, targetYear, lastOffsetDate);

        logger.debug({
            page: 'Calculate MCBU Interest',
            message: `Found ${monthlyFirstInstances.length} months with eligible records`
        });

        if (monthlyFirstInstances.length === 0) {
            return res.status(200).json({
                success: true,
                mcbuInterest: 0,
                mcbuInterestLacking: 0,
                monthlyBreakdown: [],
                message: 'No cash collection records found with MCBU >= 500 for this client in the specified year'
            });
        }

        // Step 3: Calculate monthly interest for each first instance
        const INTEREST_RATE = mcbuInterestRate || 0.0083;
        let totalMcbuInterest = 0;
        const monthlyBreakdown = [];

        monthlyFirstInstances.forEach(record => {
            const mcbu = parseFloat(record.mcbu) || 0;
            const mcbuWithdrawal = parseFloat(record.mcbuWithdrawal) || 0;
            const monthlyInterest = (mcbu - mcbuWithdrawal) * INTEREST_RATE;

            // Only add positive interests
            if (monthlyInterest > 0) {
                totalMcbuInterest += monthlyInterest;
                monthlyBreakdown.push({
                    month: record.month,
                    monthName: getMonthName(record.month),
                    dateAdded: record.dateAdded,
                    mcbu: mcbu,
                    mcbuWithdrawal: mcbuWithdrawal,
                    netMcbu: mcbu - mcbuWithdrawal,
                    monthlyInterest: parseFloat(monthlyInterest.toFixed(2))
                });
            }
        });

        // Step 4: Round off to whole number
        totalMcbuInterest = Math.round(totalMcbuInterest);

        // Step 5: Calculate lacking amount to round up to nearest 10
        // e.g., 34 -> lacking = 6 (to make 40), 8 -> lacking = 2 (to make 10)
        const mcbuInterestLacking = totalMcbuInterest > 0 
            ? (10 - (totalMcbuInterest % 10)) % 10 
            : 0;

        logger.debug({
            page: 'Calculate MCBU Interest',
            message: `Total MCBU Interest: ${totalMcbuInterest}, Lacking: ${mcbuInterestLacking}`
        });

        response = {
            success: true,
            clientId: clientId,
            year: targetYear,
            mcbuInterest: totalMcbuInterest,
            mcbuInterestLacking: mcbuInterestLacking,
            monthlyBreakdown: monthlyBreakdown,
            totalMonths: monthlyBreakdown.length,
            offsetDate: lastOffsetDate || null
        };

        res.status(statusCode).json(response);

    } catch (error) {
        logger.error({
            page: 'Calculate MCBU Interest',
            message: 'Error calculating MCBU Interest',
            error: error.message,
            stack: error.stack
        });

        res.status(500).json({
            success: false,
            message: 'Error calculating MCBU Interest',
            error: error.message
        });
    }
}

/**
 * Get the last offset transaction date for a client in a given year
 * Offset transactions have remarks.value containing 'offset'
 * remarks is a JSONB field: { value: 'offset-something' }
 * 
 * @param {string} clientId - Client ID
 * @param {number} year - Year to check
 * @returns {Promise<string|null>} Last offset date or null if none found
 */
async function getLastOffsetDate(clientId, year) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    try {
        const result = await graph.query(
            queryQl(CASH_COLLECTION_TYPE('offsetCheck'), {
                where: {
                    clientId: { _eq: clientId },
                    dateAdded: {
                        _gte: startDate,
                        _lte: endDate
                    },
                    // JSONB path filter: remarks->>'value' like 'offset%'
                    remarks: { value: { _ilike: 'offset%' } }
                },
                order_by: [{ dateAdded: 'desc' }],
                limit: 1
            })
        );

        const record = result.data?.offsetCheck?.[0];
        return record ? record.dateAdded : null;
    } catch (error) {
        logger.error({
            page: 'Calculate MCBU Interest',
            message: 'Error checking for offset transactions',
            error: error.message
        });
        return null;
    }
}

/**
 * Get the first instance of cash collection per month
 * Uses Promise.all to execute queries in parallel (one per month with limit: 1)
 * If offsetDate is provided, only queries records AFTER that date
 * 
 * @param {string} clientId - Client ID
 * @param {number} year - Year to query
 * @param {string|null} offsetDate - Last offset date (if any)
 * @returns {Promise<Array>} Array of first instances per month
 */
async function getFirstInstancePerMonth(clientId, year, offsetDate = null) {
    const monthPromises = [];

    // Determine the start date - either after offset or beginning of year
    const afterOffsetDate = offsetDate ? new Date(offsetDate) : null;

    for (let month = 1; month <= 12; month++) {
        const monthStartDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const monthEndDate = getLastDayOfMonth(year, month);

        // Skip months that are entirely before the offset date
        if (afterOffsetDate) {
            const monthEnd = new Date(monthEndDate);
            if (monthEnd <= afterOffsetDate) {
                // This entire month is before or on the offset date, skip it
                continue;
            }
        }

        // Determine the effective start date for this month's query
        let effectiveStartDate = monthStartDate;
        if (afterOffsetDate) {
            const monthStart = new Date(monthStartDate);
            if (monthStart <= afterOffsetDate) {
                // Offset happened during this month, start from day after offset
                const dayAfterOffset = new Date(afterOffsetDate);
                dayAfterOffset.setDate(dayAfterOffset.getDate() + 1);
                effectiveStartDate = dayAfterOffset.toISOString().split('T')[0];
            }
        }

        const promise = graph.query(
            queryQl(CASH_COLLECTION_TYPE(`month_${month}`), {
                where: {
                    clientId: { _eq: clientId },
                    mcbu: { _gte: 500 },
                    dateAdded: {
                        _gte: effectiveStartDate,
                        _lte: monthEndDate
                    }
                },
                order_by: [{ dateAdded: 'asc' }],
                limit: 1
            })
        ).then(res => {
            const record = res.data?.[`month_${month}`]?.[0];
            if (record) {
                return { ...record, month };
            }
            return null;
        }).catch(err => {
            logger.error({
                page: 'Calculate MCBU Interest',
                message: `Error querying month ${month}`,
                error: err.message
            });
            return null;
        });

        monthPromises.push(promise);
    }

    // Execute all queries in parallel
    const results = await Promise.all(monthPromises);

    // Filter out null results and return valid records
    return results.filter(record => record !== null);
}

/**
 * Get the last day of a month
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @returns {string} Date string in YYYY-MM-DD format
 */
function getLastDayOfMonth(year, month) {
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Get month name from month number
 * @param {number} month - Month number (1-12)
 * @returns {string} Month name
 */
function getMonthName(month) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || '';
}