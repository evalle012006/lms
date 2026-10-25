import { safeNumber } from '@/lib/utils';
import { NON_MISPAY_REMARKS } from '@/lib/constants';

export const isMispayRemark = (value = '') =>
    value.startsWith('excused-') || (value.startsWith('delinquent') && value !== 'delinquent-offset');

export function resolveMispayment(cc) {
    const remark = cc?.remarks?.value || '';
    if (NON_MISPAY_REMARKS.includes(remark)) return false;
    if (isMispayRemark(remark)) return true;
    if (safeNumber(cc?.paymentCollection) > 0) return false;
    return cc?.mispayment === true;
}