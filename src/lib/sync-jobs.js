import { getApiBaseUrl } from "./constants";
import { fetchWrapper } from "./fetch-wrapper";

export const autoSyncLoans = async (loId) => {
    const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/cash-collections/sync-loans', {loId: loId});

    if (response.success) {
        setTimeout(() => {
            return true;
        }, 2000);
    }
}

export const autoHealCashCollections = async (loId, currentDate) => {
    const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/cash-collections/auto-heal-loans', {loId: loId, currentDate: currentDate});

    if (response.success) {
        setTimeout(() => {
            return true;
        }, 2000);
    }
}