//src/pages/api/v2/dcs/beginning-balance.js
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'apollo-boost';

const graph = new GraphProvider();

const USER_TYPE = createGraphType(
    'users',
    `
        _id
        areaId
        designatedBranchId
        role
    `
)('users');

const BRANCH_TYPE = createGraphType(
    'branches',
    `
        _id
        areaId
    `
)('branches');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidDate = (value) => {
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00Z`);

    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const getSingleValue = (value) => (typeof value === 'string' ? value.trim() : '');

// Retrieve the effective beginning balance using a single
// Hasura Native Query.
//
// PostgreSQL handles the daily cash movements and
// carry-forward calculations.
const calculateEffectiveBeginningBalance = async (branchId, selectedDate) => {
    const response = await graph.apollo.query({
        query: gql`
            query GetDcsEffectiveBeginningBalance($branchId: String!, $selectedDate: date!) {
                get_dcs_effective_beginning_balance(args: { branch_id: $branchId, selected_date: $selectedDate }) {
                    beginning_balance
                    source
                    has_override
                    carried_from
                }

                dcs_beginning_balances(
                    where: { branch_id: { _eq: $branchId }, balance_date: { _eq: $selectedDate } }
                    limit: 1
                ) {
                    id
                    branch_id
                    balance_date
                    beginning_balance
                    updated_by
                    updated_at
                }
            }
        `,
        variables: {
            branchId,
            selectedDate,
        },
        fetchPolicy: 'network-only',
    });

    if (response.errors?.length) {
        console.error('Effective Beginning Balance GraphQL errors:', response.errors);

        throw new Error('Failed to retrieve the effective Beginning Balance.');
    }

    const result = response.data?.get_dcs_effective_beginning_balance?.[0];

    if (!result) {
        throw new Error('No effective Beginning Balance was returned.');
    }

    const source = result.source;

    if (!['historical', 'manual', 'carried_forward'].includes(source)) {
        throw new Error('Invalid Beginning Balance source.');
    }

    const beginningBalance =
        result.beginning_balance === null || result.beginning_balance === undefined
            ? null
            : Number(result.beginning_balance);

    if (beginningBalance !== null && !Number.isFinite(beginningBalance)) {
        throw new Error('Invalid effective Beginning Balance.');
    }

    if (source !== 'historical' && beginningBalance === null) {
        throw new Error('Missing effective Beginning Balance.');
    }

    const record = source === 'manual' ? response.data?.dcs_beginning_balances?.[0] || null : null;

    return {
        source,
        hasOverride: Boolean(result.has_override),
        beginningBalance,
        record,
        ...(source === 'carried_forward' ? { carriedFrom: result.carried_from } : {}),
    };
};

const getCurrentUser = async (req) => {
    const userId = req.auth?.sub;

    if (!userId) {
        return null;
    }

    const response = await graph.query(
        queryQl(USER_TYPE, {
            where: {
                _id: { _eq: userId },
            },
            limit: 1,
        })
    );

    return response.data?.users?.[0] || null;
};

const checkBranchAccess = async (user, branchId, requireEdit = false) => {
    if (!user || !branchId) {
        return false;
    }

    const roleRep = Number(user.role?.rep);

    const isAdmin = roleRep === 1;

    const isAreaManager =
        roleRep === 2 &&
        String(user.role?.shortCode || '')
            .trim()
            .toLowerCase() === 'area_admin';

    const isBranchManager = roleRep === 3;
    const isLoanOfficer = roleRep === 4;

    if (isAdmin) {
        return true;
    }

    if (requireEdit && !isBranchManager) {
        return false;
    }

    if (isBranchManager || isLoanOfficer) {
        return Boolean(user.designatedBranchId) && String(user.designatedBranchId) === String(branchId);
    }

    if (isAreaManager) {
        if (!user.areaId) {
            return false;
        }

        const response = await graph.query(
            queryQl(BRANCH_TYPE, {
                where: {
                    _id: { _eq: branchId },
                },
                limit: 1,
            })
        );

        const branch = response.data?.branches?.[0];

        return Boolean(branch) && String(branch.areaId) === String(user.areaId);
    }

    return false;
};

export default apiHandler({
    get: getBeginningBalance,
    post: saveBeginningBalance,
});

async function getBeginningBalance(req, res) {
    try {
        const branchId = getSingleValue(req.query.branch_id);
        const selectedDate = getSingleValue(req.query.selected_date);

        if (!branchId || !isValidDate(selectedDate)) {
            return res.status(400).json({
                success: false,
                message: 'Valid branch and date are required.',
            });
        }

        const currentUser = await getCurrentUser(req);

        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.',
            });
        }

        const allowed = await checkBranchAccess(currentUser, branchId);

        if (!allowed) {
            return res.status(403).json({
                success: false,
                message: 'You cannot view this branch balance.',
            });
        }

        const result = await calculateEffectiveBeginningBalance(branchId, selectedDate);

        return res.status(200).json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('Get DCS Beginning Balance error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve beginning balance.',
        });
    }
}

async function saveBeginningBalance(req, res) {
    try {
        const branchId = getSingleValue(req.body?.branch_id);
        const selectedDate = getSingleValue(req.body?.selected_date);
        const rawBalance = req.body?.beginning_balance;

        if (!branchId || !isValidDate(selectedDate)) {
            return res.status(400).json({
                success: false,
                message: 'Valid branch and date are required.',
            });
        }

        if (rawBalance === null || rawBalance === undefined || rawBalance === '' || typeof rawBalance === 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'Beginning Balance is required.',
            });
        }

        const balanceString = String(rawBalance).trim();

        if (!/^\d+(\.\d{1,2})?$/.test(balanceString)) {
            return res.status(400).json({
                success: false,
                message: 'Beginning Balance must have at most two decimal places.',
            });
        }

        const beginningBalance = Number(balanceString);

        if (!Number.isFinite(beginningBalance) || beginningBalance < 0 || beginningBalance > 99999999999999.99) {
            return res.status(400).json({
                success: false,
                message: 'Enter a valid non-negative Beginning Balance.',
            });
        }

        const currentUser = await getCurrentUser(req);

        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.',
            });
        }

        const allowed = await checkBranchAccess(currentUser, branchId, true);

        if (!allowed) {
            return res.status(403).json({
                success: false,
                message: 'You cannot edit this branch balance.',
            });
        }

        const response = await graph.apollo.mutate({
            mutation: gql`
                mutation SaveDcsBeginningBalance(
                    $branchId: String!
                    $selectedDate: date!
                    $beginningBalance: numeric!
                    $updatedBy: String!
                ) {
                    insert_dcs_beginning_balances_one(
                        object: {
                            branch_id: $branchId
                            balance_date: $selectedDate
                            beginning_balance: $beginningBalance
                            updated_by: $updatedBy
                        }
                        on_conflict: {
                            constraint: dcs_beginning_balances_branch_date_unique
                            update_columns: [beginning_balance, updated_by]
                        }
                    ) {
                        id
                        branch_id
                        balance_date
                        beginning_balance
                        updated_by
                        updated_at
                    }
                }
            `,
            variables: {
                branchId,
                selectedDate,
                beginningBalance,
                updatedBy: String(currentUser._id),
            },
        });

        if (response.errors?.length) {
            console.error('Beginning Balance GraphQL mutation errors:', response.errors);

            return res.status(500).json({
                success: false,
                message: 'Failed to save beginning balance.',
            });
        }

        const record = response.data?.insert_dcs_beginning_balances_one;

        if (!record) {
            return res.status(500).json({
                success: false,
                message: 'Beginning Balance was not saved.',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Beginning Balance saved successfully.',
            beginningBalance: Number(record.beginning_balance),
            record,
        });
    } catch (error) {
        console.error('Save DCS Beginning Balance error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to save beginning balance.',
        });
    }
}
