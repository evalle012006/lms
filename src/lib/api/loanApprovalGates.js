// src/lib/api/loanApprovalGates.js
// Server-side approval gates for the v2 Loan Application page, for branch
// managers (own branch) and supervisors (admin / deputy_director /
// regional_manager / area_admin — every branch in their scope).
//
// The classic page computed these in the browser from two fields that the
// Postgres function get_loan_data_for_pending_loans_page puts on every row
// (`groupStatus`, `pendings`), then enforced them in the UI only. This module
// calls THE SAME function (same arguments loans/list.js passes for a branch
// manager) and applies THE SAME rules, so semantics cannot drift from the
// classic page — but now the server computes them, from the authenticated
// user's own branch, instead of trusting whatever the browser sends.
//
// Rules copied from the classic page (rep = 3 / branch manager):
//   groupStatus[0].groupStatusArr has 'pending'  -> allowApproved
//   else loanCycle == 1                          -> allowApproved (new members always)
//   else                                         -> transactionClosed (reloan, group closed)
//   NEXT_PUBLIC_STAGING set                      -> allowApproved forced true
//   no groupStatusArr, pendings[0].status active -> hasActiveLoan, not allowed
//   no groupStatusArr, pendings[0].status completed -> hasTdaLoan, not allowed
//   otherwise                                    -> allowApproved
//
// Blockers copied from the classic page's validate(), plus one the classic page
// never had: a loan whose release date has already passed cannot be approved
// (LDF approve or final approval) — see OVERDUE_RELEASE below.

import { gql } from 'apollo-boost';
import momentTz from 'moment-timezone';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { findBranches, findUserById, loadSettingsSystemDate } from '@/lib/graph.functions';
import { resolveLoanBranchScope } from '@/lib/api/resolveLoanBranchScope';
import { approvalMode } from '@/lib/loan-application-v2-gate';

const graph = new GraphProvider();
const TZ = 'Asia/Manila';

const ROWS_QUERY = gql`
    query get_data($args: get_loan_data_for_pending_loans_page_arguments!) {
        loans: get_loan_data_for_pending_loans_page (args: $args) {
            _id, data
        }
    }
`;

const FOUND_TYPE = createGraphType('loans', '_id branchId');

// The SQL function runs once per branch (that is how the branch manager page
// calls it). Bound the fan-out so one request cannot trigger hundreds of runs.
const MAX_BRANCHES_PER_REQUEST = 30;
const BRANCH_CONCURRENCY = 5;

const hasId = (v) => typeof v === 'string' && v.trim().length > 0;

async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const idx = next++;
            out[idx] = await fn(items[idx]);
        }
    });
    await Promise.all(workers);
    return out;
}

export async function getManilaToday() {
    return momentTz(await loadSettingsSystemDate()).tz(TZ).format('YYYY-MM-DD');
}

/**
 * Who is calling and which branches they may approve in. Never read from the
 * request:
 *   branch manager -> their designated branch
 *   supervisor     -> resolveLoanBranchScope (null = every branch, [] = none,
 *                     so a supervisor with no area/region/division gets nothing)
 */
async function resolveApprover(user) {
    const mode = approvalMode(user);
    if (!mode) return { error: 'You do not have permission to approve loans.' };

    if (mode === 'branch_manager') {
        if (!hasId(user.designatedBranchId)) return { error: 'No branch is assigned to your account.' };
        return { user, mode, scope: { branchIds: [user.designatedBranchId] } };
    }

    const scope = await resolveLoanBranchScope(user);
    if (scope.branchIds && scope.branchIds.length === 0) {
        return { error: 'No branches are assigned to your account.' };
    }
    return { user, mode, scope: { branchIds: scope.branchIds } };
}

export async function requireApprover(req) {
    const user = await findUserById(req.auth.sub);
    if (!user) return { error: 'User not found.' };
    return resolveApprover(user);
}

/**
 * READ-ONLY access to a loan's approval details (the details modal): approvers
 * as above, plus loan officers for their OWN pending loans in their own branch.
 * `loId` is set for loan officers and must be applied to every lookup.
 * Never use this for anything that writes.
 */
export async function requireDetailsAccess(req) {
    const user = await findUserById(req.auth.sub);
    if (!user) return { error: 'User not found.' };

    if (approvalMode(user)) return resolveApprover(user);

    if (user.role?.rep === 4) {
        if (!hasId(user.designatedBranchId)) return { error: 'No branch is assigned to your account.' };
        return { user, mode: 'loan_officer', scope: { branchIds: [user.designatedBranchId] }, loId: user._id };
    }
    return { error: 'You do not have permission to view this.' };
}

// Short-lived per-process cache so paging through the list does not re-run the
// SQL function for every page. Used for DISPLAY only; anything that writes
// reads fresh (fresh: true).
const CACHE_TTL_MS = 5000;
const cache = new Map();

export async function loadBranchPendingRows(branchId, currentDate, { fresh = false } = {}) {
    const key = `${branchId}|${currentDate}`;
    if (!fresh) {
        const hit = cache.get(key);
        if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.rows;
    }

    // Same arguments loans/list.js builds for the `branchId` + status=pending path.
    const args = {
        branchId,
        status: 'pending',
        currentDate,
        pendingLoanStatus1: 'active',
        pendingLoanStatus2: 'completed',
    };

    const rows = await graph.apollo
        .query({ query: ROWS_QUERY, variables: { args }, fetchPolicy: 'no-cache' })
        .then((res) => {
            if (res.errors) throw res.errors[0];
            return res.data?.loans ?? [];
        })
        .then((list) => list.map(({ data }) => {
            const loan = { ...data };
            loan.branch = [loan.branch]; // loans/list.js rowMapper for the branchId path
            return loan;
        }));

    if (!fresh) cache.set(key, { at: Date.now(), rows });
    return rows;
}

export function computeGates(row) {
    let allowApproved = false;
    let hasActiveLoan = false;
    let hasTdaLoan = false;
    let transactionClosed = false;

    const groupStatus = row.groupStatus ?? [];
    const pendings = row.pendings ?? [];

    if (groupStatus.length > 0 && Object.prototype.hasOwnProperty.call(groupStatus[0], 'groupStatusArr')) {
        const open = (groupStatus[0].groupStatusArr ?? []).some((s) => s === 'pending');
        if (open) allowApproved = true;
        else if (row.loanCycle == 1) allowApproved = true; // eslint-disable-line eqeqeq
        else transactionClosed = true;

        if (process.env.NEXT_PUBLIC_STAGING) allowApproved = true;
    } else if (pendings.length > 0) {
        allowApproved = false;
        const st = pendings[0].status;
        if (st === 'active') hasActiveLoan = true;
        else if (st === 'completed') hasTdaLoan = true;
    } else {
        allowApproved = true;
    }

    return { allowApproved, hasActiveLoan, hasTdaLoan, transactionClosed };
}

// Calendar day (YYYY-MM-DD) of a release date. Date-only strings are used as-is,
// so the server's own time zone can never shift them by a day. Anything with a
// time part is converted to the Manila day it falls on (a Manila midnight stored
// as a UTC timestamp would otherwise read as the previous day).
function releaseDay(value) {
    if (!value) return null;
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const parsed = momentTz.tz(str, TZ);
    return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null;
}

// `label` is the short pill text; `message` is the full sentence used in the
// blockers dialog (wording copied from the classic validate()).
// `today` is the Manila system date (YYYY-MM-DD); without it the overdue check
// is skipped rather than guessed.
export function collectBlockers(row, gates, { today } = {}) {
    const c = row.client ?? {};
    const who = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
    const group = row.group?.name ?? '';
    const at = `${who} in group ${group}`;
    const out = [];
    const add = (code, label, message) => out.push({ code, label, message });

    if (c.firstName == null || c.lastName == null) {
        add('INVALID_NAME', 'Name missing', `Invalid name: ${who} in group ${group}, please update it in Client page.`);
    }
    if (!gates.allowApproved) {
        add('GROUP_CLOSED', 'Group closed', `${at} please re-open the LO transaction.`);
    }
    if (gates.hasActiveLoan) {
        add('ACTIVE_LOAN', 'Active loan', `${at} still has active loan. Please transact it first`);
    }
    if (gates.hasTdaLoan) {
        add('TDA_LOAN', 'Completed loan', `${at} still has completed loan. Please transact it first`);
    }
    if (row.pnNumber == null || !row.pnNumber) {
        add('NO_PN', 'No PN', `${at} don't have PN Number.`);
    }
    if (c.duplicate) {
        add('DUPLICATE_CLIENT', 'Duplicate client', `${at} has been marked as duplicate client. Please contact your RM for approval of this client loan.`);
    }
    if (row.guarantorDuplicate) {
        add('GUARANTOR_FLAG', 'Guarantor flag', `${at} has a flagged guarantor duplicate. Admin review required before LDF approval.`);
    }
    if (row.coMakerPending) {
        add('NO_COMAKER', 'No co-maker', `${at} has no co-maker assigned yet. Edit the loan to assign a co-maker before approving.`);
    }
    const day = today ? releaseDay(row.dateOfRelease) : null;
    if (day && day < today) {
        add(
            'OVERDUE_RELEASE',
            'Release overdue',
            `${at} has a release date of ${momentTz(day, 'YYYY-MM-DD').format('MMM D, YYYY')}, which has already passed. ` +
            `Update the release date (edit the loan) or reject it; overdue loans cannot be approved.`
        );
    }
    const ciName = row.ciName ? row.ciName : c.ciName;
    if (!ciName || !String(ciName).trim()) {
        add('NO_CI_NAME', 'No CI name', `${at} has no CI name recorded. Please complete CI investigation before LDF approval.`);
    }
    return out;
}


/**
 * Pending loans among `ids` that sit inside the caller's scope, with the SQL
 * function row for each, plus each branch's lock / flow settings.
 *
 * Ids that are not pending, do not exist, or are out of scope all come back as
 * simply "missing" — the caller cannot probe for loans outside their scope.
 */
export async function loadApprovalRows(ids, { scope, currentDate, fresh = false, loId = null }) {
    const and = [{ _id: { _in: ids } }, { status: { _eq: 'pending' } }];
    if (scope.branchIds) and.push({ branchId: { _in: scope.branchIds } });
    if (loId) and.push({ loId: { _eq: loId } });

    const found = await graph
        .query(queryQl(FOUND_TYPE('found'), { where: { _and: and } }))
        .then((r) => r.data?.found ?? []);

    const branchIds = [...new Set(found.map((l) => l.branchId))];
    if (branchIds.length > MAX_BRANCHES_PER_REQUEST) {
        return {
            error: `These loans span ${branchIds.length} branches. Filter by branch, area or region so at most ` +
                `${MAX_BRANCHES_PER_REQUEST} branches are involved.`,
        };
    }

    const [rowLists, branches] = await Promise.all([
        mapLimit(branchIds, BRANCH_CONCURRENCY, (b) => loadBranchPendingRows(b, currentDate, { fresh })),
        branchIds.length ? findBranches({ _id: { _in: branchIds } }) : [],
    ]);

    const wanted = new Set(found.map((l) => l._id));
    const rowById = new Map();
    rowLists.flat().forEach((row) => { if (wanted.has(row._id)) rowById.set(row._id, row); });

    const branchOfLoan = new Map(found.map((l) => [l._id, l.branchId]));
    const branchById = new Map(branches.map((b) => [b._id, b]));

    return { rowById, branchOfLoan, branchById };
}

/**
 * Extra blockers that apply only to FINAL approval ('application').
 *
 * Branch managers: a locked branch cannot be approved into (the classic page
 * checked this against the manager's own branch record; here it is per loan, so
 * the server can enforce it too). Nothing else: if the branch record cannot be
 * read they keep the classic behaviour.
 *
 * Supervisors, additionally:
 *  - v2 branches record a disbursement photo and face verification at release,
 *    which only the branch can do, so a supervisor cannot final-approve them.
 *  - if the branch record does not say which flow it uses, fail closed.
 */
export function finalApprovalBlockers(row, branch, mode) {
    const c = row.client ?? {};
    const who = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
    const at = `${who} in group ${row.group?.name ?? ''}`;
    const out = [];

    if (mode === 'supervisor') {
        if (!branch || branch.clientFlowVersion === undefined) {
            out.push({
                code: 'UNKNOWN_BRANCH_CONFIG',
                label: 'Branch setup unknown',
                message: `${at}: this branch's approval settings could not be read, so final approval is blocked.`,
            });
        } else if (branch.clientFlowVersion === 'v2') {
            out.push({
                code: 'V2_DISBURSEMENT',
                label: 'Branch disbursement',
                message: `${at}: this branch records a disbursement photo and face verification at release. Final approval must be done from the branch manager account.`,
            });
        }
    }
    if ((mode === 'supervisor' || mode === 'branch_manager') && branch?.lockTransaction) {
        out.push({
            code: 'BRANCH_LOCKED',
            label: 'Branch locked',
            message: `${at}: transactions for this branch are locked.`,
        });
    }
    return out;
}