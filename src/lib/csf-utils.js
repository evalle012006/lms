import { safeNumber } from '@/lib/utils';

// Start false (log-only) on staging; flip to true once no false positives are seen.
export const ENFORCE_CSF_CONFIG = false;

// 'per_installment': add-on scales with installments paid (matches MCBU's proportional minimum)
// 'per_transaction': flat add-on once per row (matches how CSF In behaved)
export const CSF_ADDON_MODE = 'per_installment';

// Effective only when BOTH branch and group are enabled.
// null/undefined count as enabled, matching the DB default.
export const isCsfEnabled = (branch, group) =>
    branch?.csfEnabled !== false && group?.csfEnabled !== false;

// Amount added to the MCBU minimum when CSF is off. 0 when CSF is on or the remark is exempt.
export const resolveCsfMcbuAddOn = ({ csfEnabled, settings, noPayments = 1, exempt = false }) => {
    if (csfEnabled || exempt) return 0;
    const add = parseFloat(settings?.minCsfCollection);
    if (!Number.isFinite(add) || add <= 0) return 0;
    return CSF_ADDON_MODE === 'per_installment' ? add * noPayments : add;
};

// Rows a CSF-disabled group is not allowed to send.
export const findCsfViolations = (collections, csfEnabled) => {
    if (csfEnabled) return [];
    return collections.filter(cc =>
        cc.status !== 'totals' &&
        (safeNumber(cc.csfCollection) > 0 || safeNumber(cc.csfIn) > 0)
    );
};