import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';

/**
 * MCBU Interest Service
 * 
 * Provides functions to calculate MCBU interest for clients
 */
export const mcbuInterestService = {
    calculateInterest,
    calculateInterestForYear
};

/**
 * Calculate MCBU Interest for a client for the current year
 * 
 * @param {string} clientId - The client ID to calculate interest for
 * @returns {Promise<Object>} - Response containing mcbuInterest and breakdown
 * 
 * @example
 * const result = await mcbuInterestService.calculateInterest('client-123');
 * console.log(result.mcbuInterest); // Total interest amount
 * console.log(result.monthlyBreakdown); // Array of monthly calculations
 */
async function calculateInterest(clientId) {
    if (!clientId) {
        throw new Error('clientId is required');
    }

    const url = `${getApiBaseUrl()}/transactions/cash-collections/calculate-mcbu-interest`;
    const params = new URLSearchParams({ clientId });
    
    try {
        const response = await fetchWrapper.get(`${url}?${params}`);
        return response;
    } catch (error) {
        console.error('Error calculating MCBU Interest:', error);
        throw error;
    }
}

/**
 * Calculate MCBU Interest for a client for a specific year
 * 
 * @param {string} clientId - The client ID to calculate interest for
 * @param {number} year - The year to calculate interest for
 * @returns {Promise<Object>} - Response containing mcbuInterest and breakdown
 * 
 * @example
 * const result = await mcbuInterestService.calculateInterestForYear('client-123', 2024);
 * console.log(result.mcbuInterest); // Total interest amount for 2024
 */
async function calculateInterestForYear(clientId, year) {
    if (!clientId) {
        throw new Error('clientId is required');
    }

    if (!year) {
        throw new Error('year is required');
    }

    const url = `${getApiBaseUrl()}/transactions/cash-collections/calculate-mcbu-interest`;
    const params = new URLSearchParams({ clientId, year: year.toString() });
    
    try {
        const response = await fetchWrapper.get(`${url}?${params}`);
        return response;
    } catch (error) {
        console.error('Error calculating MCBU Interest for year:', error);
        throw error;
    }
}

export default mcbuInterestService;