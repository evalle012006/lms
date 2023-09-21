import { fetchWrapper } from "./fetch-wrapper";

export const autoSyncLoans = async (loId) => {
    const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/sync-loans', {loId: loId});

    if (response.success) {
        setTimeout(() => {
            return true;
        }, 2000);
    }
}

export const autoHealCashCollections = async (groupId, currentDate) => {
    const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/auto-heal-loans', {groupId: groupId, currentDate: currentDate});

    if (response.success) {
        setTimeout(() => {
            return true;
        }, 2000);
    }
}