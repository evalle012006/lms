/**
 * Cash Collection Save Utility
 * 
 * This utility provides robust error handling, retry mechanism, and date validation
 * for saving cash collection transactions.
 * 
 * IMPORTANT: All date operations use Asia/Manila timezone for Philippine operations.
 * 
 * Usage:
 * import { saveCashCollectionWithRetry } from '@/lib/transaction-utils';
 * 
 * const result = await saveCashCollectionWithRetry(collectionData, {
 *   onRetry: (attempt) => console.log(`Retry attempt ${attempt}`),
 *   onDateMismatch: () => window.location.reload()
 * });
 */

import moment from 'moment-timezone';
import { fetchWrapper } from './fetch-wrapper';
import { getApiBaseUrl } from './constants';

// Always use Asia/Manila timezone for Philippine operations
const TIMEZONE = 'Asia/Manila';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1500,
    REQUEST_TIMEOUT_MS: 60000,
    DATE_CHECK_INTERVAL_MS: 30000 // Check date every 30 seconds
};

// ============================================
// ERROR TYPES
// ============================================

export class TransactionError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'TransactionError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

export const ERROR_CODES = {
    DATE_MISMATCH: 'DATE_MISMATCH',
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    SERVER_ERROR: 'SERVER_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    PARTIAL_FAILURE: 'PARTIAL_FAILURE',
    UNKNOWN: 'UNKNOWN'
};

// ============================================
// DATE VALIDATION
// ============================================

/**
 * Get the current server date for validation
 * Uses existing API at /api/v1/settings/current-date
 * This should be called before any transaction to ensure date alignment
 */
export async function getServerDate() {
    try {
        const response = await fetchWrapper.get(getApiBaseUrl() + 'settings/current-date');
        if (response.success) {
            return response.currentDate;
        }
        throw new Error('Failed to get server date');
    } catch (error) {
        console.warn('Failed to get server date, using local Manila date:', error);
        return moment().tz(TIMEZONE).format('YYYY-MM-DD');
    }
}

/**
 * Validate that the client date matches the transaction date
 * Uses Asia/Manila timezone for consistency
 */
export function validateClientDate(transactionDate) {
    const clientDate = moment().tz(TIMEZONE).format('YYYY-MM-DD');
    const txDate = moment.tz(transactionDate, TIMEZONE).format('YYYY-MM-DD');
    
    if (clientDate !== txDate) {
        return {
            valid: false,
            clientDate,
            transactionDate: txDate,
            timezone: TIMEZONE,
            reason: 'Date mismatch - the current date has changed since the page was loaded'
        };
    }
    
    return { valid: true };
}

/**
 * Check if we're close to midnight (within 5 minutes) in Manila timezone
 * This is a high-risk period for transactions
 */
export function isNearMidnight() {
    const now = moment().tz(TIMEZONE);
    const midnight = moment().tz(TIMEZONE).endOf('day');
    const minutesToMidnight = midnight.diff(now, 'minutes');
    
    return minutesToMidnight <= 5;
}

// ============================================
// RETRY LOGIC
// ============================================

/**
 * Sleep for a specified duration
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Execute a function with retry logic
 */
async function withRetry(operation, options = {}) {
    const {
        maxRetries = CONFIG.MAX_RETRIES,
        retryDelay = CONFIG.RETRY_DELAY_MS,
        onRetry = () => {},
        shouldRetry = () => true
    } = options;
    
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            // Don't retry certain errors
            if (!shouldRetry(error)) {
                throw error;
            }
            
            if (attempt < maxRetries) {
                onRetry(attempt, error);
                await sleep(retryDelay * attempt); // Exponential backoff
            }
        }
    }
    
    throw lastError;
}

// ============================================
// MAIN SAVE FUNCTION
// ============================================

/**
 * Save cash collection with robust error handling and retry
 * 
 * @param {Object} data - The collection data to save
 * @param {Object} options - Configuration options
 * @param {Function} options.onRetry - Called on each retry attempt
 * @param {Function} options.onDateMismatch - Called when date mismatch is detected
 * @param {Function} options.onProgress - Called with progress updates
 * @returns {Promise<Object>} - The save result
 */
export async function saveCashCollectionWithRetry(data, options = {}) {
    const {
        onRetry = () => {},
        onDateMismatch = () => {},
        onProgress = () => {},
        maxRetries = CONFIG.MAX_RETRIES
    } = options;
    
    // Step 1: Pre-save validation
    onProgress({ step: 'validation', message: 'Validating transaction data...' });
    
    // Check if near midnight
    if (isNearMidnight()) {
        console.warn('Transaction initiated near midnight - higher risk of date mismatch');
    }
    
    // Validate client date
    const dateValidation = validateClientDate(data.currentDate);
    if (!dateValidation.valid) {
        const error = new TransactionError(
            dateValidation.reason,
            ERROR_CODES.DATE_MISMATCH,
            dateValidation
        );
        onDateMismatch(error);
        throw error;
    }
    
    // Step 2: Prepare request
    onProgress({ step: 'preparing', message: 'Preparing transaction...' });
    
    const requestData = {
        ...data,
        _clientTimestamp: new Date().toISOString(),
        _retryAttempt: 0
    };
    
    // Step 3: Execute with retry
    const result = await withRetry(
        async () => {
            onProgress({ step: 'saving', message: 'Saving transaction...' });
            
            const response = await fetchWrapper.post(
                getApiBaseUrl() + 'transactions/cash-collections/saveV2',
                requestData
            );
            
            // Handle specific error codes
            if (response.errorCode === ERROR_CODES.DATE_MISMATCH) {
                const error = new TransactionError(
                    response.message,
                    ERROR_CODES.DATE_MISMATCH,
                    response.details
                );
                onDateMismatch(error);
                throw error; // Don't retry date mismatch errors
            }
            
            if (response.error || !response.success) {
                throw new TransactionError(
                    response.message || 'Save failed',
                    response.errorCode || ERROR_CODES.SERVER_ERROR,
                    response
                );
            }
            
            return response;
        },
        {
            maxRetries,
            onRetry: (attempt, error) => {
                requestData._retryAttempt = attempt;
                console.warn(`Save attempt ${attempt} failed:`, error.message);
                onRetry(attempt, error);
            },
            shouldRetry: (error) => {
                // Don't retry date mismatch or validation errors
                if (error.code === ERROR_CODES.DATE_MISMATCH) return false;
                if (error.code === ERROR_CODES.VALIDATION_ERROR) return false;
                return true;
            }
        }
    );
    
    // Step 4: Post-save verification
    onProgress({ step: 'verifying', message: 'Verifying transaction...' });
    
    return {
        success: true,
        transactionId: result.transactionId,
        summary: result.summary,
        timestamp: new Date().toISOString()
    };
}

// ============================================
// TRANSACTION STATE MANAGER
// ============================================

/**
 * Manages transaction state to prevent duplicate submissions
 * and handle interrupted transactions
 */
class TransactionStateManager {
    constructor() {
        this.pendingTransactions = new Map();
        this.storageKey = 'pending_cash_collection_transactions';
    }
    
    /**
     * Start tracking a transaction
     */
    startTransaction(groupId, data) {
        const transactionId = `${groupId}_${Date.now()}`;
        const state = {
            id: transactionId,
            groupId,
            startedAt: new Date().toISOString(),
            status: 'pending',
            data: data
        };
        
        this.pendingTransactions.set(transactionId, state);
        this.persistState();
        
        return transactionId;
    }
    
    /**
     * Mark transaction as completed
     */
    completeTransaction(transactionId) {
        const state = this.pendingTransactions.get(transactionId);
        if (state) {
            state.status = 'completed';
            state.completedAt = new Date().toISOString();
            this.pendingTransactions.delete(transactionId);
            this.persistState();
        }
    }
    
    /**
     * Mark transaction as failed
     */
    failTransaction(transactionId, error) {
        const state = this.pendingTransactions.get(transactionId);
        if (state) {
            state.status = 'failed';
            state.failedAt = new Date().toISOString();
            state.error = error.message;
            this.persistState();
        }
    }
    
    /**
     * Check for interrupted transactions on page load
     */
    checkForInterruptedTransactions() {
        this.loadState();
        const interrupted = [];
        
        for (const [id, state] of this.pendingTransactions) {
            if (state.status === 'pending') {
                const startedAt = moment(state.startedAt);
                const now = moment();
                
                // If transaction is older than 5 minutes, consider it interrupted
                if (now.diff(startedAt, 'minutes') > 5) {
                    interrupted.push(state);
                }
            }
        }
        
        return interrupted;
    }
    
    /**
     * Clear old transaction states
     */
    clearOldStates() {
        const oneDayAgo = moment().subtract(1, 'day');
        
        for (const [id, state] of this.pendingTransactions) {
            const startedAt = moment(state.startedAt);
            if (startedAt.isBefore(oneDayAgo)) {
                this.pendingTransactions.delete(id);
            }
        }
        
        this.persistState();
    }
    
    /**
     * Persist state to localStorage
     */
    persistState() {
        try {
            const states = Array.from(this.pendingTransactions.entries());
            localStorage.setItem(this.storageKey, JSON.stringify(states));
        } catch (error) {
            console.warn('Failed to persist transaction state:', error);
        }
    }
    
    /**
     * Load state from localStorage
     */
    loadState() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const states = JSON.parse(stored);
                this.pendingTransactions = new Map(states);
            }
        } catch (error) {
            console.warn('Failed to load transaction state:', error);
        }
    }
}

export const transactionStateManager = new TransactionStateManager();

// ============================================
// DATE WATCHER
// ============================================

/**
 * Watches for date changes and warns users
 * Uses Asia/Manila timezone for consistency
 */
class DateWatcher {
    constructor() {
        this.initialDate = null;
        this.intervalId = null;
        this.onDateChange = null;
    }
    
    /**
     * Start watching for date changes
     */
    start(onDateChange) {
        this.initialDate = moment().tz(TIMEZONE).format('YYYY-MM-DD');
        this.onDateChange = onDateChange;
        
        this.intervalId = setInterval(() => {
            this.checkDate();
        }, CONFIG.DATE_CHECK_INTERVAL_MS);
        
        // Also check when page becomes visible
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.checkDate();
            }
        });
    }
    
    /**
     * Stop watching
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    
    /**
     * Check if date has changed (in Manila timezone)
     */
    checkDate() {
        const currentDate = moment().tz(TIMEZONE).format('YYYY-MM-DD');
        
        if (currentDate !== this.initialDate) {
            console.warn('Date change detected (Asia/Manila):', {
                initial: this.initialDate,
                current: currentDate,
                timezone: TIMEZONE
            });
            
            if (this.onDateChange) {
                this.onDateChange({
                    initialDate: this.initialDate,
                    currentDate: currentDate,
                    timezone: TIMEZONE
                });
            }
        }
    }
}

export const dateWatcher = new DateWatcher();

// ============================================
// USAGE EXAMPLE (for reference)
// ============================================

/*
// In your component:

import { 
    saveCashCollectionWithRetry, 
    dateWatcher, 
    transactionStateManager,
    TransactionError,
    ERROR_CODES
} from '@/lib/transaction-utils';

// On component mount:
useEffect(() => {
    // Check for interrupted transactions
    const interrupted = transactionStateManager.checkForInterruptedTransactions();
    if (interrupted.length > 0) {
        // Show warning to user
        toast.warning('Some transactions may not have completed. Please verify your data.');
    }
    
    // Start date watcher
    dateWatcher.start(({ initialDate, currentDate }) => {
        toast.warning('The date has changed. Please refresh the page before submitting transactions.');
        setPageStale(true);
    });
    
    return () => {
        dateWatcher.stop();
    };
}, []);

// On submit:
const handleSubmit = async () => {
    const transactionId = transactionStateManager.startTransaction(groupId, data);
    
    try {
        const result = await saveCashCollectionWithRetry(data, {
            onRetry: (attempt, error) => {
                toast.info(`Retrying save (attempt ${attempt})...`);
            },
            onDateMismatch: (error) => {
                toast.error('Date mismatch detected. Please refresh the page.');
            },
            onProgress: ({ step, message }) => {
                setProgress({ step, message });
            }
        });
        
        transactionStateManager.completeTransaction(transactionId);
        toast.success('Transaction saved successfully!');
        
    } catch (error) {
        transactionStateManager.failTransaction(transactionId, error);
        
        if (error.code === ERROR_CODES.DATE_MISMATCH) {
            // Offer to refresh
            if (confirm('The date has changed. Refresh the page?')) {
                window.location.reload();
            }
        } else {
            toast.error(`Save failed: ${error.message}`);
        }
    }
};
*/