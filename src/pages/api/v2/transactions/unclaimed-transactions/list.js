import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { CASH_COLLECTIONS_FIELDS, BRANCH_FIELDS, UNCLAIMED_AMOUNT_TRANSACTIONS_FIELDS } from '@/lib/graph.fields';
import { findUserById } from '@/lib/graph.functions';
import { getSystemDate } from '@/lib/date-utils';
import { calculateOffsetAmounts } from "@/lib/unclaimed-calculations";
import logger from '@/logger';
import moment from 'moment';

const graph = new GraphProvider();

const UNCLAIMED_TRANSACTION_TYPE = createGraphType(
    'unclaimed_amount_transactions',
    UNCLAIMED_AMOUNT_TRANSACTIONS_FIELDS
)('unclaimedTransactions');

const CASH_COLLECTION_WITH_BRANCH = createGraphType('cashCollections',`${CASH_COLLECTIONS_FIELDS} branch {${BRANCH_FIELDS}}`)('cashCollections');
const CLIENT_TYPE = createGraphType('client',`_id firstName lastName fullName`)('client');
const GROUP_TYPE = createGraphType('groups',`_id name`)('groups');
const BRANCH_TYPE = createGraphType('branches',`_id name`)('branches');
const LOAN_TYPE = createGraphType('loans',`_id slotNo`)('loans');

export default apiHandler({
    get: listUnclaimedTransactions
});

const toNumber = (value) => {const amount = Number(value ?? 0); return Number.isFinite(amount) ? amount : 0;};
const roundMoney = (value) => Math.round(toNumber(value) * 100) / 100;
const uniqueIds = (values) => [...new Set(values.filter(Boolean))];

async function fetchRows(type, alias, args = {}) {
    const result = await graph.query(
        queryQl(type, args)
    );

    if (result?.errors?.length) {
        throw new Error(
            result.errors[0]?.message ||
            'GraphQL query failed'
        );
    }

    return result?.data?.[alias] || [];
}

async function fetchByIds(type, alias, ids) {
    const validIds = uniqueIds(ids);

    if (!validIds.length) {
        return [];
    }

    return fetchRows(type, alias, {
        where: {
            _id: {
                _in: validIds
            }
        }
    });
}

function buildRoleScope(currentUser, manual = false) {
    const role = currentUser.role || {};
    const roleRep = Number(role.rep);
    const shortCode = String(role.shortCode || '')
        .toLowerCase();

    const fields = manual
        ? {
            branch: 'branch_id',
            division: 'division_id',
            region: 'region_id',
            area: 'area_id',
            lo: 'lo_id'
        }
        : {
            branch: 'branchId',
            division: 'divisionId',
            region: 'regionId',
            area: 'areaId',
            lo: 'loId'
        };

    const deny = {
        _id: {
            _in: []
        }
    };

    if (shortCode === 'deputy_director') {
        if (!currentUser.divisionId) return deny;

        return manual
            ? {
                [fields.division]: {
                    _eq: currentUser.divisionId
                }
            }
            : {
                branch: {
                    divisionId: {
                        _eq: currentUser.divisionId
                    }
                }
            };
    }

    if (shortCode === 'regional_manager') {
        if (!currentUser.regionId) return deny;

        return manual
            ? {
                [fields.region]: {
                    _eq: currentUser.regionId
                }
            }
            : {
                branch: {
                    regionId: {
                        _eq: currentUser.regionId
                    }
                }
            };
    }

    if (
        shortCode === 'area_admin' ||
        shortCode === 'area_manager'
    ) {
        if (!currentUser.areaId) return deny;

        return manual
            ? {
                [fields.area]: {
                    _eq: currentUser.areaId
                }
            }
            : {
                branch: {
                    areaId: {
                        _eq: currentUser.areaId
                    }
                }
            };
    }

    if (roleRep === 3) {
        if (!currentUser.designatedBranchId) {
            return deny;
        }

        return {
            [fields.branch]: {
                _eq: currentUser.designatedBranchId
            }
        };
    }

    if (roleRep === 4) {
        if (!currentUser._id) return deny;

        return {
            [fields.lo]: {
                _eq: currentUser._id
            }
        };
    }

    if (roleRep === 1) {
        return {};
    }

    return deny;
}

function buildRequestFilters(filters, manual = false) {
    const where = {};

    if (filters.branchId) {
        where[manual ? 'branch_id' : 'branchId'] = {
            _eq: filters.branchId
        };
    }

    if (filters.loId) {
        where[manual ? 'lo_id' : 'loId'] = {
            _eq: filters.loId
        };
    }

    if (filters.groupId) {
        where[manual ? 'group_id' : 'groupId'] = {
            _eq: filters.groupId
        };
    }

    return where;
}

function formatOffsetTransaction(cc, transaction = null) {
    const { mcbu, csf, totalReturn, paymentCollection: loanBalance, unclaimedAmount, } = calculateOffsetAmounts(cc);

    return {
        _id: cc._id,

        sourceType: 'offset',

        cashCollectionId: cc._id,
        transactionId: transaction?._id || null,

        dateOfOffset: cc.dateAdded,
        entryDate: cc.dateAdded,

        branchName: cc.branch?.name || '-',
        groupName: cc.groupName || '-',
        slotNo: cc.slotNo ?? '-',
        clientName: cc.fullName || '-',

        amountRelease: toNumber(cc.amountRelease),
        loanBalance,

        mcbu,
        csf,
        unclaimedAmount,

        status: transaction?.status || 'unclaimed',

        dateClaimed: transaction?.date_added || null,
        documentUrl: transaction?.document_url || null,

        clientId: cc.clientId,
        groupId: cc.groupId,
        branchId: cc.branchId,

        areaId:
            cc.areaId ||
            cc.branch?.areaId ||
            null,

        regionId:
            cc.regionId ||
            cc.branch?.regionId ||
            null,

        divisionId:
            cc.divisionId ||
            cc.branch?.divisionId ||
            null,

        loanId: cc.loanId,
        loId: cc.loId,

        remarks: cc.remarks || null
    };
}

async function getManualTransactions(
    currentUser,
    filters,
    status,
    currentSystemDate
) {
    const where = {
        source_type: {
            _eq: 'manual'
        },

        status: {
            _eq: status
        },

        _and: [
            buildRoleScope(currentUser, true),
            buildRequestFilters(filters, true)
        ]
    };

    if (status === 'claimed' && filters.date) {
        const nextDate = moment(
            filters.date,
            'YYYY-MM-DD'
        )
            .add(1, 'day')
            .format('YYYY-MM-DD');

        where.date_added = {
            _gte: `${filters.date} 00:00:00`,
            _lt: `${nextDate} 00:00:00`
        };
    }

    if (status === 'unclaimed') {
        where.entry_date = filters.date
            ? {
                _eq: filters.date
            }
            : {
                _lte: currentSystemDate
            };
    }

    const transactions = await fetchRows(
        UNCLAIMED_TRANSACTION_TYPE,
        'unclaimedTransactions',
        {
            where,
            order_by: [
                { entry_date: 'desc' },
                { inserted_date: 'desc' }
            ]
        }
    );

    if (!transactions.length) {
        return [];
    }

    const [
        clients,
        groups,
        branches,
        loans
    ] = await Promise.all([
        fetchByIds(
            CLIENT_TYPE,
            'client',
            transactions.map(tx => tx.client_id)
        ),

        fetchByIds(
            GROUP_TYPE,
            'groups',
            transactions.map(tx => tx.group_id)
        ),

        fetchByIds(
            BRANCH_TYPE,
            'branches',
            transactions.map(tx => tx.branch_id)
        ),

        fetchByIds(
            LOAN_TYPE,
            'loans',
            transactions.map(tx => tx.loan_id)
        )
    ]);

    const clientMap = new Map(
        clients.map(item => [item._id, item])
    );

    const groupMap = new Map(
        groups.map(item => [item._id, item])
    );

    const branchMap = new Map(
        branches.map(item => [item._id, item])
    );

    const loanMap = new Map(
        loans.map(item => [item._id, item])
    );

    return transactions.map(tx => {
        const client = clientMap.get(tx.client_id);
        const group = groupMap.get(tx.group_id);
        const branch = branchMap.get(tx.branch_id);
        const loan = loanMap.get(tx.loan_id);

        const mcbu = toNumber(tx.mcbu_amount);
        const csf = toNumber(tx.csf_amount);

        const clientName =
            client?.fullName ||
            [
                client?.firstName,
                client?.lastName
            ]
                .filter(Boolean)
                .join(' ') ||
            '-';

        return {
            _id: tx._id,

            sourceType: 'manual',

            cashCollectionId: null,
            transactionId: tx._id,

            dateOfOffset: tx.entry_date,
            entryDate: tx.entry_date,

            branchName: branch?.name || '-',
            groupName: group?.name || '-',
            slotNo: loan?.slotNo ?? '-',
            clientName,

            amountRelease: 0,
            loanBalance: 0,

            mcbu,
            csf,

            unclaimedAmount: roundMoney(mcbu + csf),

            status: tx.status,

            dateClaimed: tx.date_added || null,
            documentUrl: tx.document_url || null,

            clientId: tx.client_id,
            groupId: tx.group_id,
            branchId: tx.branch_id,

            areaId: tx.area_id,
            regionId: tx.region_id,
            divisionId: tx.division_id,

            loanId: tx.loan_id,
            loId: tx.lo_id,

            remarks: tx.remarks || null
        };
    });
}

async function getClaimedOffsetTransactions(
    currentUser,
    filters
) {
    const where = {
        source_type: {
            _eq: 'offset'
        },

        status: {
            _eq: 'claimed'
        },

        cash_collection_id: {
            _is_null: false
        }
    };

    if (filters.date) {
        const nextDate = moment(
            filters.date,
            'YYYY-MM-DD'
        )
            .add(1, 'day')
            .format('YYYY-MM-DD');

        where.date_added = {
            _gte: `${filters.date} 00:00:00`,
            _lt: `${nextDate} 00:00:00`
        };
    }

    const transactions = await fetchRows(
        UNCLAIMED_TRANSACTION_TYPE,
        'unclaimedTransactions',
        { where }
    );

    const cashCollectionIds = uniqueIds(
        transactions.map(tx => tx.cash_collection_id)
    );

    if (!cashCollectionIds.length) {
        return [];
    }

    const cashCollections = await fetchRows(
        CASH_COLLECTION_WITH_BRANCH,
        'cashCollections',
        {
            where: {
                _id: {
                    _in: cashCollectionIds
                },

                _and: [
                    buildRoleScope(currentUser),
                    buildRequestFilters(filters)
                ]
            }
        }
    );

    const cashCollectionMap = new Map(
        cashCollections.map(cc => [cc._id, cc])
    );

    return transactions
        .map(tx => {
            const cc = cashCollectionMap.get(
                tx.cash_collection_id
            );

            if (!cc) {
                return null;
            }

            return formatOffsetTransaction(cc, tx);
        })
        .filter(Boolean);
}

async function getUnclaimedOffsetTransactions(
    currentUser,
    filters,
    currentSystemDate
) {
    const where = {
        remarks: {
            _contains: {
                value: 'offset-unclaimed'
            }
        },

        dateAdded: filters.date
            ? {
                _eq: filters.date
            }
            : {
                _lt: currentSystemDate
            },

        _and: [
            buildRoleScope(currentUser),
            buildRequestFilters(filters)
        ]
    };

    const cashCollections = await fetchRows(
        CASH_COLLECTION_WITH_BRANCH,
        'cashCollections',
        {
            where,
            order_by: [
                { dateAdded: 'desc' }
            ]
        }
    );

    const cashCollectionIds = uniqueIds(
        cashCollections.map(cc => cc._id)
    );

    if (!cashCollectionIds.length) {
        return [];
    }

    const existingTransactions = await fetchRows(
        UNCLAIMED_TRANSACTION_TYPE,
        'unclaimedTransactions',
        {
            where: {
                source_type: {
                    _eq: 'offset'
                },

                cash_collection_id: {
                    _in: cashCollectionIds
                }
            }
        }
    );

    const existingTxMap = new Map(
        existingTransactions.map(tx => [
            tx.cash_collection_id,
            tx
        ])
    );

    return cashCollections
        .map(cc => {
            const transaction = existingTxMap.get(cc._id);

            if (transaction?.status === 'claimed') {
                return null;
            }

            return formatOffsetTransaction(
                cc,
                transaction
            );
        })
        .filter(Boolean);
}

async function listUnclaimedTransactions(req, res) {
    try {
        const userId = req?.auth?.sub;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const currentUser = await findUserById(userId);

        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const {
            status = 'unclaimed',
            branchId,
            loId,
            groupId,
            date
        } = req.query;

        if (!['unclaimed', 'claimed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid transaction status.'
            });
        }

        if (
            date &&
            !moment(date, 'YYYY-MM-DD', true).isValid()
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date.'
            });
        }

        const filters = {
            branchId,
            loId,
            groupId,
            date
        };

        const currentSystemDate = moment(
            getSystemDate()
        ).format('YYYY-MM-DD');

        const [
            offsetTransactions,
            manualTransactions
        ] = await Promise.all([
            status === 'claimed'
                ? getClaimedOffsetTransactions(
                    currentUser,
                    filters
                )
                : getUnclaimedOffsetTransactions(
                    currentUser,
                    filters,
                    currentSystemDate
                ),

            getManualTransactions(
                currentUser,
                filters,
                status,
                currentSystemDate
            )
        ]);

        const result = [
            ...offsetTransactions,
            ...manualTransactions
        ];

        result.sort((a, b) => {
            const dateA = status === 'claimed'
                ? a.dateClaimed
                : a.dateOfOffset;

            const dateB = status === 'claimed'
                ? b.dateClaimed
                : b.dateOfOffset;

            return String(dateB || '')
                .localeCompare(String(dateA || ''));
        });

        return res.status(200).json({
            success: true,
            data: result,
            total: result.length
        });

    } catch (error) {
        logger.error({
            page: 'List Unclaimed Transactions',
            message: 'Error fetching unclaimed transactions',
            error: error?.message || error,
            stack: error?.stack
        });

        return res.status(500).json({
            success: false,
            message: 'Error fetching unclaimed transactions'
        });
    }
}