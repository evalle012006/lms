import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

/**
 * Fetch MCBU withdrawal retain config from transactionSettings.
 * Returns { minDailyMcbuWithdrawal, minWeeklyMcbuWithdrawal,
 *           minDailyMcbuWithdrawalGL, minWeeklyMcbuWithdrawalGL }
 */
export async function getMcbuWithdrawRetainConfig() {
    const fields = 'minDailyMcbuWithdrawal minWeeklyMcbuWithdrawal minDailyMcbuWithdrawalGL minWeeklyMcbuWithdrawalGL';
    const result = await graph.query(
        queryQl(createGraphType('transactionSettings', fields)('txnSettings'), { limit: 1 })
    );
    const s = result?.data?.txnSettings?.[0] || {};
    return {
        minDailyMcbuWithdrawal:   parseFloat(s.minDailyMcbuWithdrawal)   || 0,
        minWeeklyMcbuWithdrawal:  parseFloat(s.minWeeklyMcbuWithdrawal)  || 0,
        minDailyMcbuWithdrawalGL:  parseFloat(s.minDailyMcbuWithdrawalGL)  || 0,
        minWeeklyMcbuWithdrawalGL: parseFloat(s.minWeeklyMcbuWithdrawalGL) || 0,
    };
}

/**
 * Validate MCBU retain rule.
 * Returns { valid: true } or { valid: false, message, maxAllowed }
 */
export function validateMcbuRetain(mcbuAmount, currentMcbu, isGroupLeader, occurence, config) {
    if (mcbuAmount <= 0) return { valid: true }; // zero-amount handled elsewhere

    const minRetain = isGroupLeader
        ? (occurence === 'weekly' ? config.minWeeklyMcbuWithdrawalGL : config.minDailyMcbuWithdrawalGL)
        : (occurence === 'weekly' ? config.minWeeklyMcbuWithdrawal   : config.minDailyMcbuWithdrawal);

    // 0 = unlimited, skip check
    if (minRetain === 0) return { valid: true };

    const maxAllowed = Math.max(0, currentMcbu - minRetain);
    if (mcbuAmount > maxAllowed) {
        const who = isGroupLeader ? 'Group leaders' : 'Clients';
        return {
            valid: false,
            maxAllowed,
            message: `${who} must retain at least ₱${minRetain.toLocaleString()} MCBU balance. Maximum withdrawal allowed: ₱${maxAllowed.toLocaleString()}`
        };
    }
    return { valid: true };
}