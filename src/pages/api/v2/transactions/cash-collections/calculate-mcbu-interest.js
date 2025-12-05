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
 * 1. For each month, query ONLY the first transaction where mcbu >= 500 (limit: 1)
 * 2. Execute all 12 queries in parallel using Promise.all
 * 3. Calculate monthly interest for each first instance
 * 4. Sum all monthly interests and return as mcbuInterest
 */
async function calculateMcbuInterest(req, res) {
    let statusCode = 200;
    let response = {};

    try {
        const { clientId, year } = req.method === 'GET' ? req.query : req.body;

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

        // Query all 12 months in parallel
        const monthlyFirstInstances = await getFirstInstancePerMonth(clientId, targetYear);

        logger.debug({
            page: 'Calculate MCBU Interest',
            message: `Found ${monthlyFirstInstances.length} months with eligible records`
        });

        if (monthlyFirstInstances.length === 0) {
            return res.status(200).json({
                success: true,
                mcbuInterest: 0,
                monthlyBreakdown: [],
                message: 'No cash collection records found with MCBU >= 500 for this client in the specified year'
            });
        }

        // Calculate monthly interest for each first instance
        const INTEREST_RATE = 0.0083;
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

        // Round to 2 decimal places
        totalMcbuInterest = parseFloat(totalMcbuInterest.toFixed(2));

        logger.debug({
            page: 'Calculate MCBU Interest',
            message: `Total MCBU Interest calculated: ${totalMcbuInterest}`
        });

        response = {
            success: true,
            clientId: clientId,
            year: targetYear,
            mcbuInterest: totalMcbuInterest,
            monthlyBreakdown: monthlyBreakdown,
            totalMonths: monthlyBreakdown.length
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
 * Get the first instance of cash collection per month
 * Uses Promise.all to execute 12 queries in parallel (one per month with limit: 1)
 * 
 * @param {string} clientId - Client ID
 * @param {number} year - Year to query
 * @returns {Promise<Array>} Array of first instances per month
 */
async function getFirstInstancePerMonth(clientId, year) {
    // Build all 12 month queries and execute in parallel
    const monthPromises = [];

    for (let month = 1; month <= 12; month++) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = getLastDayOfMonth(year, month);

        const promise = graph.query(
            queryQl(CASH_COLLECTION_TYPE(`month_${month}`), {
                where: {
                    clientId: { _eq: clientId },
                    mcbu: { _gte: 500 },
                    dateAdded: {
                        _gte: startDate,
                        _lte: endDate
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

    // Execute all 12 queries in parallel
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