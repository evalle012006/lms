// src/lib/coh-permissions.js
//
// Single source of truth for "can this user save Cash on Hand for this
// branch + date?". Used by:
//   - /api/v2/branches/save-update-coh   (enforcement)
//   - /api/v2/branches (GET, opt-in)     (tells the UI whether to unlock inputs)
//
// Rules:
//   admin                                   -> any branch, any date
//   deputy_director / regional_manager /
//   area_admin                              -> own scope only, today (system date) or the previous business day
//                                              (skips weekends + holidays),
//                                              and the branch must not be 'closed'
//                                              for that date (i.e. it was reopened)
//   branch_manager                          -> own branch only (date behavior unchanged)
//   anyone else                             -> denied

import moment from 'moment';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { getCurrentDate } from '@/lib/date-utils';
import { holidayType } from '@/pages/api/v2/settings/holidays/common';

const graph = new GraphProvider();

// Same type definitions the rest of the codebase uses:
//  - approvals: createGraphType('branchApprovals', ...)('approvals') in
//    update-group-transaction-status.js / get-approval-status.js
//  - holidays:  holidayType from settings/holidays/common (key: data.holidays)
const BRANCH_SCOPE_TYPE = createGraphType('branches', `_id areaId regionId divisionId`)('branches');
const BRANCH_APPROVAL_STATUS_TYPE = createGraphType('branchApprovals', `_id status`)('approvals');

const SUPERVISOR_SHORTCODES = ['deputy_director', 'regional_manager', 'area_admin'];
const DATE_FORMAT = 'YYYY-MM-DD';

// designatedBranchId / areaId etc. can be " " (a space) instead of null for some
// users, so never rely on bare truthiness.
const hasId = (id) => typeof id === 'string' && id.trim().length > 0;

// Holidays are stored as recurring 'MM-DD' (see settings/holidays/save.js);
// older rows may hold a full 'YYYY-MM-DD'. Match either form.
async function isHoliday(dateStr) {
    const m = moment(dateStr, DATE_FORMAT, true);
    const rows = await graph.query(
        queryQl(holidayType, { where: { date: { _in: [m.format('MM-DD'), m.format(DATE_FORMAT)] } } })
    ).then(res => res.data?.holidays ?? []);
    return rows.length > 0;
}

// Returns 'open' | 'closed' | null (null = no approval record for that date).
async function getBranchApprovalStatus(branchId, dateFor) {
    const rows = await graph.query(
        queryQl(BRANCH_APPROVAL_STATUS_TYPE, {
            where: { branchId: { _eq: branchId }, dateFor: { _eq: dateFor } },
        })
    ).then(res => res.data?.approvals ?? []);
    return rows[0]?.status ?? null;
}

export async function getPreviousBusinessDay(fromDate) {
    const d = moment(fromDate, DATE_FORMAT, true).subtract(1, 'day');
    for (let i = 0; i < 31; i++) {
        const dateStr = d.format(DATE_FORMAT);
        const isWeekend = d.isoWeekday() > 5; // Sat/Sun
        if (!isWeekend && !(await isHoliday(dateStr))) return dateStr;
        d.subtract(1, 'day');
    }
    throw new Error('No business day found in the last 31 days');
}

/**
 * Authoritative check. Returns { canEdit, reason? }. Never throws for a normal
 * denial; infrastructure errors are caught, logged, and turned into a
 * fail-closed denial.
 */
export async function resolveCohEditPermission(user, branchId, dateFor) {
    const deny = (reason) => ({ canEdit: false, reason });
    const shortCode = user?.role?.shortCode;

    if (!user) return deny('Not authenticated.');
    if (!hasId(branchId) || !moment(dateFor, DATE_FORMAT, true).isValid()) {
        return deny('A valid branch and date are required.');
    }

    if (shortCode === 'admin') return { canEdit: true };

    if (shortCode === 'branch_manager') {
        return hasId(user.designatedBranchId) && user.designatedBranchId === branchId
            ? { canEdit: true }
            : deny('You can only edit Cash on Hand for your own branch.');
    }

    if (SUPERVISOR_SHORTCODES.includes(shortCode)) {
        try {
            // 1. Hierarchy scope
            const branch = await graph.query(
                queryQl(BRANCH_SCOPE_TYPE, { where: { _id: { _eq: branchId } } })
            ).then(res => res.data?.branches?.[0]);
            if (!branch) return deny('Branch not found.');

            const inScope =
                (shortCode === 'area_admin' && hasId(user.areaId) && branch.areaId === user.areaId) ||
                (shortCode === 'regional_manager' && hasId(user.regionId) && branch.regionId === user.regionId) ||
                (shortCode === 'deputy_director' && hasId(user.divisionId) && branch.divisionId === user.divisionId);
            if (!inScope) return deny('This branch is outside your area of responsibility.');

            // 2. Date window: the current system date OR the previous business
            //    day. Nothing older, and never a future date.
            const today = moment(getCurrentDate()).format(DATE_FORMAT);
            if (dateFor !== today) {
                const previousBusinessDay = await getPreviousBusinessDay(today);
                if (dateFor !== previousBusinessDay) {
                    return deny(`Cash on Hand can only be edited for today (${today}) or the previous business day (${previousBusinessDay}).`);
                }
            }

            // 3. The branch must have been reopened (not 'closed') for that date
            const status = await getBranchApprovalStatus(branchId, dateFor);
            if (status === 'closed') {
                return deny('This branch is closed for that date. Unlock it first to edit Cash on Hand.');
            }

            return { canEdit: true };
        } catch (err) {
            // Look for this line in the server console if you see
            // "Unable to verify permission right now" in the UI.
            console.error('[resolveCohEditPermission] failed:', err);
            return deny('Unable to verify permission right now. Please try again.');
        }
    }

    return deny('Your role is not allowed to edit Cash on Hand.');
}