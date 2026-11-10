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

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
};

const getSingleValue = (value) =>
    typeof value === 'string' ? value.trim() : '';

const getPreviousBusinessDate = (dateString) => {
    const date = new Date(`${dateString}T00:00:00Z`);

    do {
        date.setUTCDate(date.getUTCDate() - 1);
    } while (
        date.getUTCDay() === 0 ||
        date.getUTCDay() === 6
    );

    return date.toISOString().slice(0, 10);
};

const getLatestBeginningBalanceOverride = async (
    branchId,
    selectedDate
) => {
    const response = await graph.apollo.query({
        query: gql`
            query GetLatestDcsBeginningBalanceOverride(
                $branchId: String!
                $selectedDate: date!
            ) {
                dcs_beginning_balances(
                    where: {
                        branch_id: { _eq: $branchId }
                        balance_date: { _lte: $selectedDate }
                    }
                    order_by: {
                        balance_date: desc
                    }
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
        throw new Error(
            'Failed to retrieve the latest Beginning Balance override.'
        );
    }

    return response.data?.dcs_beginning_balances?.[0] || null;
};

const roundMoney = (value) =>
    Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const getBusinessDatesBetween = (startDate, endDate) => {
    const dates = [];
    const date = new Date(`${startDate}T00:00:00Z`);

    date.setUTCDate(date.getUTCDate() + 1);

    while (date.toISOString().slice(0, 10) < endDate) {
        const day = date.getUTCDay();

        if (day !== 0 && day !== 6) {
            dates.push(date.toISOString().slice(0, 10));
        }

        date.setUTCDate(date.getUTCDate() + 1);
    }

    return dates;
};

const getBranchDcsTotals = async (branchId, selectedDate) => {
    const response = await graph.apollo.query({
        query: gql`
            query GetBranchDcsTotals(
                $args: get_daily_collection_sheet_v2_arguments!
            ) {
                results: get_daily_collection_sheet_v2(args: $args) {
                    data
                }
            }
        `,
        variables: {
            args: {
                branch_id: branchId,
                lo_id: null,
                selected_date: selectedDate,
            },
        },
        fetchPolicy: 'network-only',
    });

    if (response.errors?.length) {
        throw new Error(
            `Failed to retrieve DCS totals for ${selectedDate}.`
        );
    }

    const rows = (response.data?.results || []).map(
        (item) => item.data || item
    );

    const toNumber = (value) => {
        const number = Number(value ?? 0);
        return Number.isFinite(number) ? number : 0;
    };

    const getValue = (row, keys) => {
        const nested = row?.data || row;

        for (const key of keys) {
            const value = row?.[key] ?? nested?.[key];

            if (value !== null && value !== undefined) {
                return toNumber(value);
            }
        }

        return 0;
    };

    const sum = (...keys) =>
        rows.reduce(
            (total, row) => total + getValue(row, keys),
            0
        );

    return {
        mcbuActual: sum(
            'mcbuActual',
            'mcbu_actual'
        ),

        csfCollection: sum(
            'csf_collection',
            'csfCollection'
        ),

        regularLoanActual: sum(
            'regularLoanActual',
            'regular_loan_actual'
        ),

        otherLoanActual: sum(
            'otherLoanActual',
            'other_loan_actual'
        ),

        mcbuReturnAmount: sum(
            'mcbuReturnAmount',
            'mcbu_return_amount'
        ),

        csfReturnAmount: sum(
            'csf_return_amount',
            'csfReturnAmount'
        ),
    };
};

const getBranchMcbuIn = async (branchId, selectedDate) => {
    const TRANSACTION_TYPE = createGraphType(
        'dcs_transactions',
        `
            id
            branch_id
            transaction_date

            dcs_transaction_items {
                category
                code
                account_title
                amount
            }
        `
    )('dcs_transactions');

    const response = await graph.query(
        queryQl(TRANSACTION_TYPE, {
            where: {
                branch_id: { _eq: branchId },
                transaction_date: { _eq: selectedDate },
            },
        })
    );

    if (response.errors?.length) {
        throw new Error(
            `Failed to retrieve MCBU IN for ${selectedDate}.`
        );
    }

    const transactions = response.data?.dcs_transactions;

    if (!Array.isArray(transactions)) {
        throw new Error(
            `Invalid MCBU IN transaction data for ${selectedDate}.`
        );
    }

    let totalMcbuIn = 0;

    transactions.forEach((transaction) => {
        const items = transaction.dcs_transaction_items || [];

        items.forEach((item) => {
            const category = String(item.category || '')
                .trim()
                .toLowerCase();

            const code = String(item.code || '').trim();

            const accountTitle = String(item.account_title || '')
                .trim()
                .toLowerCase();

            const amount = Number(item.amount || 0);

            if (
                category === 'other receipts' &&
                code === '019' &&
                accountTitle === "client's mcbu (in)" &&
                Number.isFinite(amount) &&
                amount > 0
            ) {
                totalMcbuIn += amount;
            }
        });
    });

    return roundMoney(totalMcbuIn);
};

const getBranchDailyCashMovement = async (branchId, selectedDate) => {
    const [summaryResponse, dcsTotals, mcbuIn] = await Promise.all([
        graph.apollo.query({
            query: gql`
                query GetBranchDcsCashMovement(
                    $args: get_daily_collection_summary_arguments!
                ) {
                    results: get_daily_collection_summary(args: $args) {
                        data
                    }
                }
            `,
            variables: {
                args: {
                    branch_id: branchId,
                    lo_id: null,
                    selected_date: selectedDate,
                },
            },
            fetchPolicy: 'network-only',
        }),

        getBranchDcsTotals(branchId, selectedDate),
        getBranchMcbuIn(branchId, selectedDate),
    ]);

    if (summaryResponse.errors?.length) {
        throw new Error(
            `Failed to retrieve branch cash movements for ${selectedDate}.`
        );
    }

    const raw = summaryResponse.data?.results?.[0]?.data;

    if (!raw) {
        throw new Error(
            `No DCS summary was returned for ${selectedDate}.`
        );
    }

    const toNumber = (value) => {
        const number = Number(value ?? 0);

        if (!Number.isFinite(number)) {
            throw new Error(
                `Invalid cash movement amount for ${selectedDate}.`
            );
        }

        return number;
    };

    const getSummaryValue = (...keys) => {
        for (const key of keys) {
            if (raw[key] !== null && raw[key] !== undefined) {
                return toNumber(raw[key]);
            }
        }

        return 0;
    };

    // ORIGINAL SUMMARY TOTALS
    const originalReceipts = toNumber(raw.total_receipts);
    const originalPayments = toNumber(raw.total_payments);

    // ORIGINAL SUMMARY COLLECTIONS
    const originalMcbu = getSummaryValue(
        'rcpt_mcbu',
        'rcptMcbu'
    );

    const originalCsf = getSummaryValue(
        'rcpt_csf',
        'rcptCsf'
    );

    const originalRegularLoan = getSummaryValue(
        'rcpt_regular_loan',
        'rcptRegularLoan'
    );

    const originalOtherLoan = getSummaryValue(
        'rcpt_other_loan',
        'rcptOtherLoan'
    );

    // ORIGINAL SUMMARY RETURNS
    const originalMcbuReturn = getSummaryValue(
        'pay_mcbu_return',
        'payMcbuReturn'
    );

    const originalCsfReturn = getSummaryValue(
        'pay_csf_return',
        'payCsfReturn'
    );

    // DCS COLLECTION ADJUSTMENTS
    const mcbuDifference =
        dcsTotals.mcbuActual - originalMcbu;

    const csfDifference =
        dcsTotals.csfCollection - originalCsf;

    const regularLoanDifference =
        dcsTotals.regularLoanActual - originalRegularLoan;

    const otherLoanDifference =
        dcsTotals.otherLoanActual - originalOtherLoan;

    // DCS PAYMENT ADJUSTMENTS
    const mcbuReturnDifference =
        dcsTotals.mcbuReturnAmount - originalMcbuReturn;

    const csfReturnDifference =
        dcsTotals.csfReturnAmount - originalCsfReturn;

    const originalMcbuIn = getSummaryValue(
        'rcpt_mcbu_unclaimed_in'
    );

    const mcbuUnclaimedInDifference =
        mcbuIn - originalMcbuIn;

    const totalCollectionDifference =
        mcbuDifference +
        csfDifference +
        regularLoanDifference +
        otherLoanDifference +
        mcbuUnclaimedInDifference;

    const totalPaymentDifference =
        mcbuReturnDifference +
        csfReturnDifference;

    const receipts = roundMoney(
        originalReceipts + totalCollectionDifference
    );

    const payments = roundMoney(
        originalPayments + totalPaymentDifference
    );

    return {
        receipts,
        payments,
    };
};

const calculateEffectiveBeginningBalance = async (
    branchId,
    selectedDate
) => {
    const latestOverride =
        await getLatestBeginningBalanceOverride(
            branchId,
            selectedDate
        );

    if (!latestOverride) {
        return {
            source: 'historical',
            hasOverride: false,
            beginningBalance: null,
            record: null,
        };
    }

    const overrideDate = latestOverride.balance_date;

    if (overrideDate === selectedDate) {
        return {
            source: 'manual',
            hasOverride: true,
            beginningBalance: Number(
                latestOverride.beginning_balance
            ),
            record: latestOverride,
        };
    }

    const dates = getBusinessDatesBetween(
        overrideDate,
        selectedDate
    );

    const movements = await Promise.all(
        [overrideDate, ...dates].map((date) =>
            getBranchDailyCashMovement(branchId, date)
        )
    );

    const carriedBalance = movements.reduce(
        (balance, movement) =>
            roundMoney(
                balance +
                movement.receipts -
                movement.payments
            ),
        Number(latestOverride.beginning_balance)
    );

    return {
        source: 'carried_forward',
        hasOverride: false,
        beginningBalance: roundMoney(carriedBalance),
        record: null,
        carriedFrom: overrideDate,
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
        return (
            Boolean(user.designatedBranchId) &&
            String(user.designatedBranchId) === String(branchId)
        );
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

        return (
            Boolean(branch) &&
            String(branch.areaId) === String(user.areaId)
        );
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

        const allowed = await checkBranchAccess(
            currentUser,
            branchId
        );

        if (!allowed) {
            return res.status(403).json({
                success: false,
                message: 'You cannot view this branch balance.',
            });
        }

        const result = await calculateEffectiveBeginningBalance(
            branchId,
            selectedDate
        );

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

        if (
            rawBalance === null ||
            rawBalance === undefined ||
            rawBalance === '' ||
            typeof rawBalance === 'boolean'
        ) {
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

        if (
            !Number.isFinite(beginningBalance) ||
            beginningBalance < 0 ||
            beginningBalance > 99999999999999.99
        ) {
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

        const allowed = await checkBranchAccess(
            currentUser,
            branchId,
            true
        );

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
                            update_columns: [
                                beginning_balance
                                updated_by
                            ]
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
            console.error(
                'Beginning Balance GraphQL mutation errors:',
                response.errors
            );

            return res.status(500).json({
                success: false,
                message: 'Failed to save beginning balance.',
            });
        }

        const record =
            response.data?.insert_dcs_beginning_balances_one;

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