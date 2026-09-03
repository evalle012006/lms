import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
    Receipt,
    Plus,
    X,
    Eye,
    Printer,
    Trash2,
    Pencil,
} from 'lucide-react';

const EMPTY_ITEM = {
    transactionType: '',
    code: '',
    accountTitle: '',
    description: '',
    amount: '',
};

const EMPTY_FORM = {
    paidTo: '',
    address: '',
    date: '',
    voucherNo: '',
    totalAmountWords: '',
    cashierInCharge: '',
    supervisor: '',
    receivedBy: '',
    items: [{ ...EMPTY_ITEM }],
};

const INITIAL_TRANSACTION_TYPES = [
    { id: 1, code: '062', accountTitle: 'Lights & Water' },
    { id: 2, code: '065', accountTitle: 'Repairing & Maintenance' },
    { id: 3, code: '066', accountTitle: 'Communication & Postage' },
    { id: 4, code: '067', accountTitle: 'Office Supply & Xerox' },
    { id: 5, code: '071', accountTitle: 'Representation' },
    { id: 6, code: '072', accountTitle: 'Bank Charges' },
    { id: 7, code: '078', accountTitle: 'Miscellaneous Expenses' },
    { id: 8, code: '060', accountTitle: 'Office Rental Base' },
    { id: 9, code: '054', accountTitle: 'Basic Salaries' },
    { id: 10, code: '055', accountTitle: 'Employers Contribution' },
    {
        id: 11,
        code: '056',
        accountTitle: 'Bonuses (13th Month & Other Staff Benefits)',
    },
    {
        id: 12,
        code: '064',
        accountTitle: 'SSS, HDMF, PH Payment (BM Personnel)',
    },
    {
        id: 13,
        code: '069',
        accountTitle: 'Staff Development & Conference',
    },
    {
        id: 14,
        code: '075',
        accountTitle: 'Consultancy & Professional Fees',
    },
    {
        id: 15,
        code: '077',
        accountTitle: 'Association Dues & Membership Fees',
    },
    {
        id: 16,
        code: '073',
        accountTitle: 'Municipality / City Taxes & Licenses',
    },
    {
        id: 17,
        code: '050',
        accountTitle: 'Staff CBU/Cashbond & Client MCBU Interest',
    },
    {
        id: 18,
        code: '076',
        accountTitle: 'Clients Development & Training',
    },
];

const money = (value) => {
    const amount = Number(value || 0);

    return amount.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const TransactionPanel = () => {
    const currentUser = useSelector((state) => state.user.data);
    const currentDate = useSelector((state) => state.systemSettings.currentDate);
    const isAdmin = currentUser?.role?.rep === 1;
    const isTransactionToday = (transaction) => { return transaction?.date === currentDate; };
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showTypeModal, setShowTypeModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [transactionTypes, setTransactionTypes] = useState(
        INITIAL_TRANSACTION_TYPES
    );

    const [transactions, setTransactions] = useState([]);

    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [editingTransactionId, setEditingTransactionId] = useState(null);
    const [transactionForm, setTransactionForm] = useState({
        ...EMPTY_FORM,
        items: [{ ...EMPTY_ITEM }],
    });

    const [typeForm, setTypeForm] = useState({
        code: '',
        accountTitle: '',
    });

    const totalAmount = useMemo(() => {
        return transactionForm.items.reduce(
            (sum, item) => sum + Number(item.amount || 0),
            0
        );
    }, [transactionForm.items]);

    const resetTransactionForm = () => {
        setTransactionForm({
            ...EMPTY_FORM,
            items: [{ ...EMPTY_ITEM }],
        });
    };

    const openCreateModal = () => {
        setEditingTransactionId(null);

        setTransactionForm({
            ...EMPTY_FORM,
            date: currentDate,
            items: [{ ...EMPTY_ITEM }],
        });

        setShowCreateModal(true);
    };

    const updateMainField = (field, value) => {
        setTransactionForm((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const updateItem = (index, field, value) => {
        setTransactionForm((prev) => {
            const nextItems = [...prev.items];

            nextItems[index] = {
                ...nextItems[index],
                [field]: value,
            };

            return {
                ...prev,
                items: nextItems,
            };
        });
    };

    const selectTransactionType = (index, typeId) => {
        const selected = transactionTypes.find(
            (item) => String(item.id) === String(typeId)
        );

        setTransactionForm((prev) => {
            const nextItems = [...prev.items];

            nextItems[index] = {
                ...nextItems[index],
                transactionType: typeId,
                code: selected?.code || '',
                accountTitle: selected?.accountTitle || '',
            };

            return {
                ...prev,
                items: nextItems,
            };
        });
    };

    const addTransactionItem = () => {
        setTransactionForm((prev) => ({
            ...prev,
            items: [...prev.items, { ...EMPTY_ITEM }],
        }));
    };

    const removeTransactionItem = (index) => {
        setTransactionForm((prev) => {
            if (prev.items.length === 1) {
                return prev;
            }

            return {
                ...prev,
                items: prev.items.filter((_, itemIndex) => itemIndex !== index),
            };
        });
    };

    const handleSaveTransactionType = () => {
        const code = typeForm.code.trim();
        const accountTitle = typeForm.accountTitle.trim();

        if (!code) {
            alert('Please enter the transaction code.');
            return;
        }

        if (!accountTitle) {
            alert('Please enter the account title.');
            return;
        }

        const duplicate = transactionTypes.some(
            (item) => item.code.toLowerCase() === code.toLowerCase()
        );

        if (duplicate) {
            alert('This transaction code already exists.');
            return;
        }

        const newType = {
            id: Date.now(),
            code,
            accountTitle,
        };

        setTransactionTypes((prev) => [...prev, newType]);

        setTypeForm({
            code: '',
            accountTitle: '',
        });

        setShowTypeModal(false);
    };

    const handleSaveTransaction = () => {
        if (!transactionForm.paidTo.trim()) {
            alert('Please enter Paid to.');
            return;
        }

        if (!transactionForm.date) {
            alert('Please select the date.');
            return;
        }

        if (!transactionForm.voucherNo.trim()) {
            alert('Please enter the voucher number.');
            return;
        }

        const validItems = transactionForm.items.filter(
            (item) =>
                item.transactionType &&
                item.code &&
                item.accountTitle &&
                Number(item.amount || 0) > 0
        );

        if (!validItems.length) {
            alert('Please add at least one transaction item with an amount.');
            return;
        }

        const calculatedTotal = validItems.reduce(
            (sum, item) => sum + Number(item.amount || 0),
            0
        );

        // ==========================================
        // EDIT EXISTING TRANSACTION
        // ==========================================
        if (editingTransactionId) {
            const existingTransaction = transactions.find(
                (item) => item.id === editingTransactionId
            );

            if (!existingTransaction) {
                alert('Transaction not found.');
                return;
            }

            const canEdit =
                isAdmin || isTransactionToday(existingTransaction);

            if (!canEdit) {
                alert('Past transactions can no longer be edited.');
                return;
            }

            const updatedTransaction = {
                ...existingTransaction,
                ...transactionForm,
                id: existingTransaction.id,

                // Do not allow the original transaction date
                // to be changed while editing.
                date: existingTransaction.date,

                items: validItems,
                totalAmount: calculatedTotal,
                updatedAt: new Date().toISOString(),
            };

            setTransactions((prev) =>
                prev.map((item) =>
                    item.id === editingTransactionId
                        ? updatedTransaction
                        : item
                )
            );

            setSelectedTransaction(updatedTransaction);
            setEditingTransactionId(null);
            setShowCreateModal(false);
            resetTransactionForm();

            return;
        }

        // ==========================================
        // CREATE NEW TRANSACTION
        // ==========================================
        const transaction = {
            id: Date.now(),
            ...transactionForm,
            items: validItems,
            totalAmount: calculatedTotal,
            createdAt: new Date().toISOString(),
        };

        setTransactions((prev) => [transaction, ...prev]);

        setSelectedTransaction(transaction);
        setShowCreateModal(false);
        resetTransactionForm();
    };

    const handleView = (transaction) => {
        setSelectedTransaction(transaction);
        setShowViewModal(true);
    };

    const handleEdit = (transaction) => {
        const canEdit = isAdmin || isTransactionToday(transaction);

        if (!canEdit) {
            alert('Past transactions can no longer be edited.');
            return;
        }

        setEditingTransactionId(transaction.id);

        setTransactionForm({
            paidTo: transaction.paidTo || '',
            address: transaction.address || '',
            date: transaction.date || '',
            voucherNo: transaction.voucherNo || '',
            totalAmountWords: transaction.totalAmountWords || '',
            cashierInCharge: transaction.cashierInCharge || '',
            supervisor: transaction.supervisor || '',
            receivedBy: transaction.receivedBy || '',
            items: transaction.items.map((item) => ({
                ...item,
            })),
        });

        setShowViewModal(false);
        setShowCreateModal(true);
    };

    const handleDelete = (transaction) => {
        if (!isAdmin) {
            alert('Only Admin can delete transactions.');
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to delete Voucher ${transaction.voucherNo}?`
        );

        if (!confirmed) {
            return;
        }

        setTransactions((prev) =>
            prev.filter((item) => item.id !== transaction.id)
        );

        if (selectedTransaction?.id === transaction.id) {
            setSelectedTransaction(null);
            setShowViewModal(false);
        }
    };

    const handlePrint = (transaction) => {
        if (!transaction) return;

        const rows = transaction.items
            .map(
                (item) => `
                    <tr>
                        <td>${item.code || ''}</td>
                        <td>${item.accountTitle || ''}</td>
                        <td>${item.description || ''}</td>
                        <td class="amount">₱ ${money(item.amount)}</td>
                    </tr>
                `
            )
            .join('');

        const blankRowsCount = Math.max(0, 6 - transaction.items.length);

        const blankRows = Array.from({ length: blankRowsCount })
            .map(
                () => `
                    <tr>
                        <td>&nbsp;</td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                `
            )
            .join('');

        const printWindow = window.open('', '_blank', 'width=1100,height=800');

        if (!printWindow) {
            alert('Please allow pop-ups to print the voucher.');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Petty Cash Voucher - ${
                    transaction.voucherNo || ''
                }</title>

                <style>
                    * {
                        box-sizing: border-box;
                    }

                    body {
                        margin: 0;
                        padding: 25px;
                        font-family: Arial, Helvetica, sans-serif;
                        color: #000;
                        background: #fff;
                    }

                    .voucher {
                        width: 100%;
                        max-width: 1050px;
                        margin: 0 auto;
                    }

                    .company {
                        text-align: center;
                        margin-bottom: 22px;
                    }

                    .company-name {
                        font-size: 27px;
                        font-weight: 800;
                    }

                    .voucher-title {
                        margin-top: 2px;
                        font-size: 25px;
                        font-weight: 900;
                        letter-spacing: 1px;
                    }

                    .info-grid {
                        display: grid;
                        grid-template-columns: 1fr 260px;
                        gap: 18px;
                        margin-bottom: 10px;
                    }

                    .info-row {
                        display: flex;
                        align-items: flex-end;
                        gap: 8px;
                        margin-bottom: 8px;
                        font-size: 15px;
                    }

                    .info-label {
                        font-weight: 700;
                        white-space: nowrap;
                    }

                    .info-value {
                        flex: 1;
                        min-height: 23px;
                        padding: 0 5px 3px;
                        border-bottom: 1px solid #000;
                    }

                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                    }

                    th,
                    td {
                        border: 1px solid #000;
                        padding: 9px 8px;
                        font-size: 13px;
                    }

                    th {
                        text-align: center;
                        font-size: 14px;
                    }

                    td {
                        height: 44px;
                    }

                    .code {
                        width: 10%;
                    }

                    .account {
                        width: 28%;
                    }

                    .description {
                        width: 42%;
                    }

                    .amount-column {
                        width: 20%;
                    }

                    .amount {
                        text-align: right;
                        white-space: nowrap;
                    }

                    .total-row td {
                        font-weight: 900;
                        font-size: 15px;
                    }

                    .total-label {
                        text-align: right;
                    }

                    .words-section {
                        display: grid;
                        grid-template-columns: 1fr 250px;
                        gap: 18px;
                        margin-top: 18px;
                    }

                    .words {
                        font-size: 14px;
                        line-height: 1.7;
                    }

                    .words-value {
                        display: inline-block;
                        width: calc(100% - 150px);
                        min-height: 25px;
                        border-bottom: 1px dotted #000;
                        font-weight: 700;
                    }

                    .received {
                        font-size: 14px;
                    }

                    .signature-line {
                        margin-top: 35px;
                        border-bottom: 1px solid #000;
                        min-height: 22px;
                        text-align: center;
                        font-weight: 700;
                    }

                    .signature-caption {
                        margin-top: 6px;
                        text-align: center;
                        font-size: 12px;
                    }

                    .signatures {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 70px;
                        margin-top: 30px;
                    }

                    .signature-box {
                        font-size: 14px;
                    }

                    .signature-title {
                        font-weight: 700;
                    }

                    .signature-name {
                        height: 45px;
                        display: flex;
                        align-items: flex-end;
                        justify-content: center;
                        padding-bottom: 4px;
                        border-bottom: 1px solid #000;
                        font-weight: 700;
                    }

                    .signature-role {
                        margin-top: 6px;
                        font-weight: 700;
                        font-style: italic;
                    }

                    @media print {
                        body {
                            padding: 0;
                        }

                        @page {
                            size: landscape;
                            margin: 12mm;
                        }
                    }

                    .voucher-header {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 12px;
                        margin-bottom: 18px;
                    }

                    .voucher-logo {
                        width: 52px;
                        height: 52px;
                        object-fit: contain;
                        flex-shrink: 0;
                    }

                    .voucher-heading {
                        text-align: center;
                    }

                    .company-name {
                        font-size: 18px;
                        font-weight: 800;
                        line-height: 1.2;
                    }

                    .voucher-title {
                        margin-top: 3px;
                        font-size: 17px;
                        font-weight: 900;
                        letter-spacing: 0.5px;
                    }
                </style>
            </head>

            <body>
                <div class="voucher">
                    <div class="voucher-header">
                        <img
                            src="${logoUrl}"
                            class="voucher-logo"
                            alt="AmberCash Logo"
                        />

                        <div class="voucher-heading">
                            <div class="company-name">
                                AmberCash PH Micro Lending Corp.
                            </div>

                            <div class="voucher-title">
                                PETTY CASH VOUCHER
                            </div>
                        </div>
                    </div>

                    <div class="info-grid">
                        <div>
                            <div class="info-row">
                                <span class="info-label">Paid to:</span>
                                <span class="info-value">
                                    ${transaction.paidTo || ''}
                                </span>
                            </div>

                            <div class="info-row">
                                <span class="info-label">Address:</span>
                                <span class="info-value">
                                    ${transaction.address || ''}
                                </span>
                            </div>
                        </div>

                        <div>
                            <div class="info-row">
                                <span class="info-label">Date:</span>
                                <span class="info-value">
                                    ${transaction.date || ''}
                                </span>
                            </div>

                            <div class="info-row">
                                <span class="info-label">Voucher #:</span>
                                <span class="info-value">
                                    ${transaction.voucherNo || ''}
                                </span>
                            </div>
                        </div>

                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th class="code">Code</th>
                                <th class="account">Account Title</th>
                                <th class="description">DESCRIPTION</th>
                                <th class="amount-column">AMOUNT</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${rows}
                            ${blankRows}

                            <tr class="total-row">
                                <td colspan="3" class="total-label">
                                    TOTAL
                                </td>

                                <td class="amount">
                                    ₱ ${money(transaction.totalAmount)}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="words-section">

                        <div class="words">
                            <strong>Total Peso (in word):</strong>

                            <span class="words-value">
                                ${transaction.totalAmountWords || ''}
                            </span>

                            <div class="signatures">

                                <div class="signature-box">
                                    <div class="signature-title">
                                        Prepared By:
                                    </div>

                                    <div class="signature-name">
                                        ${transaction.cashierInCharge || ''}
                                    </div>

                                    <div class="signature-role">
                                        Cashier-in-charge
                                    </div>
                                </div>

                                <div class="signature-box">
                                    <div class="signature-title">
                                        Approved By:
                                    </div>

                                    <div class="signature-name">
                                        ${transaction.supervisor || ''}
                                    </div>

                                    <div class="signature-role">
                                        Branch Manager / Present Supervisor
                                    </div>
                                </div>

                            </div>
                        </div>

                        <div class="received">
                            <strong>Received by</strong>

                            <div class="signature-line">
                                ${transaction.receivedBy || ''}
                            </div>

                            <div class="signature-caption">
                                (Signature over printed name)
                            </div>
                        </div>

                    </div>

                </div>

                <script>
                    window.onload = function () {
                        setTimeout(function () {
                            window.print();
                        }, 300);
                    };
                </script>
            </body>
            </html>
        `);

        printWindow.document.close();
    };

    const logoUrl = `${window.location.origin}/images/logo.png`;

    return (
        <>
            {/* =========================================================
                TRANSACTION PANEL
            ========================================================== */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm">

                <div className="px-5 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between gap-4 flex-wrap">

                        <div className="flex items-center space-x-2">
                            <Receipt className="w-5 h-5 text-teal-600" />

                            <div>
                                <h2 className="text-base font-bold text-gray-800">
                                    Transactions
                                </h2>

                                <p className="text-xs text-gray-500 mt-0.5">
                                    Daily transaction details
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {isAdmin && (
                                <button
                                    type="button"
                                    onClick={() => setShowTypeModal(true)}
                                    className="
                                        inline-flex items-center gap-2
                                        px-4 py-2
                                        border border-teal-600
                                        text-teal-700
                                        hover:bg-teal-50
                                        text-sm font-semibold
                                        rounded-md
                                        transition-colors
                                    "
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Transaction Type
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={openCreateModal}
                                className="
                                    inline-flex items-center gap-2
                                    px-4 py-2
                                    bg-teal-600
                                    hover:bg-teal-700
                                    text-white
                                    text-sm font-semibold
                                    rounded-md
                                    transition-colors
                                "
                            >
                                <Plus className="w-4 h-4" />
                                Create Transaction
                            </button>

                        </div>
                    </div>
                </div>

                {/* TRANSACTION LIST */}
                <div className="p-5">

                    {transactions.length === 0 ? (
                        <div
                            className="
                                border border-dashed border-gray-300
                                rounded-lg
                                py-16
                                text-center
                            "
                        >
                            <Receipt
                                className="
                                    w-10 h-10
                                    text-gray-300
                                    mx-auto mb-3
                                "
                            />

                            <p className="text-sm font-medium text-gray-600">
                                No Transactions
                            </p>

                            <p className="text-xs text-gray-400 mt-1">
                                Created transactions will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-gray-200 rounded-lg">

                            <table className="w-full min-w-[950px] text-sm">

                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">
                                            Voucher No.
                                        </th>

                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">
                                            Date
                                        </th>

                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">
                                            Paid To
                                        </th>

                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-600">
                                            Address
                                        </th>

                                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-600">
                                            Items
                                        </th>

                                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-600">
                                            Total Amount
                                        </th>

                                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-600">
                                            Action
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-200">

                                    {transactions.map((transaction) => (
                                        <tr
                                            key={transaction.id}
                                            className="hover:bg-gray-50"
                                        >
                                            <td className="px-4 py-3 font-semibold text-gray-800">
                                                {transaction.voucherNo}
                                            </td>

                                            <td className="px-4 py-3 text-gray-600">
                                                {transaction.date}
                                            </td>

                                            <td className="px-4 py-3 text-gray-700">
                                                {transaction.paidTo}
                                            </td>

                                            <td className="px-4 py-3 text-gray-600">
                                                {transaction.address || '-'}
                                            </td>

                                            <td className="px-4 py-3 text-center">
                                                {transaction.items.length}
                                            </td>

                                            <td className="px-4 py-3 text-right font-bold text-gray-800">
                                                ₱ {money(transaction.totalAmount)}
                                            </td>

                                            <td className="px-4 py-3">
                                                <div className="flex justify-center gap-2">

                                                    {/* VIEW */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleView(transaction)}
                                                        className="
                                                            inline-flex
                                                            items-center
                                                            gap-1
                                                            px-3 py-1.5
                                                            border
                                                            border-gray-300
                                                            rounded-md
                                                            text-xs
                                                            font-semibold
                                                            text-gray-700
                                                            hover:bg-gray-50
                                                        "
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                        View
                                                    </button>

                                                    {/* EDIT - TODAY ONLY, ADMIN CAN EDIT ANY DATE */}
                                                        {(isAdmin || isTransactionToday(transaction)) && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEdit(transaction)}
                                                                className="
                                                                    inline-flex
                                                                    items-center
                                                                    gap-1
                                                                    px-3 py-1.5
                                                                    bg-amber-500
                                                                    text-white
                                                                    rounded-md
                                                                    text-xs
                                                                    font-semibold
                                                                    hover:bg-amber-600
                                                                    transition-colors
                                                                "
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                                Edit
                                                            </button>
                                                        )}

                                                    {/* PRINT */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePrint(transaction)}
                                                        className="
                                                            inline-flex
                                                            items-center
                                                            gap-1
                                                            px-3 py-1.5
                                                            bg-teal-600
                                                            text-white
                                                            rounded-md
                                                            text-xs
                                                            font-semibold
                                                            hover:bg-teal-700
                                                        "
                                                    >
                                                        <Printer className="w-3.5 h-3.5" />
                                                        Print
                                                    </button>

                                                    {/* DELETE - ADMIN ONLY */}
                                                        {isAdmin && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDelete(transaction)}
                                                                className="
                                                                    inline-flex
                                                                    items-center
                                                                    gap-1
                                                                    px-3 py-1.5
                                                                    bg-red-600
                                                                    text-white
                                                                    rounded-md
                                                                    text-xs
                                                                    font-semibold
                                                                    hover:bg-red-700
                                                                    transition-colors
                                                                "
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                Delete
                                                            </button>
                                                        )}

                                                </div>

                                            </td>
                                        </tr>
                                    ))}

                                </tbody>
                            </table>

                        </div>
                    )}

                </div>
            </div>

            {/* =========================================================
                CREATE TRANSACTION MODAL
            ========================================================== */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">

                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setShowCreateModal(false)}
                    />

                    <div
                        className="
                            relative
                            bg-white
                            rounded-lg
                            shadow-xl
                            w-full
                            max-w-5xl
                            mx-4
                            max-h-[92vh]
                            flex
                            flex-col
                        "
                    >

                        {/* HEADER */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">

                            <div>
                                <h2 className="text-lg font-bold text-gray-800">
                                    {editingTransactionId
                                        ? 'Edit Transaction'
                                        : 'Create Transaction'}
                                </h2>

                                <p className="text-xs text-gray-500 mt-0.5">
                                    {editingTransactionId
                                        ? 'Fix or update Petty Cash Voucher'
                                        : 'Create Petty Cash Voucher'}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="
                                    p-2
                                    text-gray-400
                                    hover:text-gray-700
                                    hover:bg-gray-100
                                    rounded-md
                                "
                            >
                                <X className="w-5 h-5" />
                            </button>

                        </div>

                        {/* BODY */}
                        <div className="p-5 overflow-y-auto">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Paid to
                                    </label>

                                    <input
                                        type="text"
                                        value={transactionForm.paidTo}
                                        onChange={(e) =>
                                            updateMainField(
                                                'paidTo',
                                                e.target.value
                                            )
                                        }
                                        placeholder="Enter payee name"
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Address
                                    </label>

                                    <input
                                        type="text"
                                        value={transactionForm.address}
                                        onChange={(e) =>
                                            updateMainField(
                                                'address',
                                                e.target.value
                                            )
                                        }
                                        placeholder="Enter address"
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Date
                                    </label>

                                    <input
                                        type="date"
                                        value={transactionForm.date}
                                        disabled={Boolean(editingTransactionId)}
                                        onChange={(e) =>
                                            updateMainField(
                                                'date',
                                                e.target.value
                                            )
                                        }
                                        className={`
                                            w-full border border-gray-300 rounded-md
                                            px-3 py-2 text-sm
                                            focus:outline-none focus:ring-2 focus:ring-teal-500
                                            ${
                                                editingTransactionId
                                                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                                    : 'bg-white'
                                            }
                                        `}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Voucher No.
                                    </label>

                                    <input
                                        type="text"
                                        value={transactionForm.voucherNo}
                                        onChange={(e) =>
                                            updateMainField(
                                                'voucherNo',
                                                e.target.value
                                            )
                                        }
                                        placeholder="Enter voucher number"
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>

                            </div>

                            {/* ITEMS */}
                            <div className="mt-6">

                                <div className="flex items-center justify-between mb-3">

                                    <div>
                                        <h3 className="text-sm font-bold text-gray-800">
                                            Transaction Items
                                        </h3>

                                        <p className="text-xs text-gray-500">
                                            Add the account entries for this voucher.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={addTransactionItem}
                                        className="
                                            inline-flex
                                            items-center
                                            gap-1.5
                                            px-3 py-2
                                            border
                                            border-teal-600
                                            text-teal-700
                                            rounded-md
                                            text-xs
                                            font-semibold
                                            hover:bg-teal-50
                                        "
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Item
                                    </button>

                                </div>

                                <div className="space-y-3">

                                    {transactionForm.items.map((item, index) => (
                                        <div
                                            key={index}
                                            className="
                                                border
                                                border-gray-200
                                                rounded-lg
                                                p-4
                                                bg-gray-50/50
                                            "
                                        >

                                            <div className="flex items-center justify-between mb-3">

                                                <span className="text-xs font-bold text-gray-600">
                                                    Item {index + 1}
                                                </span>

                                                {transactionForm.items.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            removeTransactionItem(
                                                                index
                                                            )
                                                        }
                                                        className="
                                                            inline-flex
                                                            items-center
                                                            gap-1
                                                            text-xs
                                                            font-semibold
                                                            text-red-600
                                                            hover:text-red-700
                                                        "
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        Remove
                                                    </button>
                                                )}

                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">

                                                <div className="md:col-span-4">
                                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                                        Transaction Type
                                                    </label>

                                                    <select
                                                        value={item.transactionType}
                                                        onChange={(e) =>
                                                            selectTransactionType(
                                                                index,
                                                                e.target.value
                                                            )
                                                        }
                                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                                                    >
                                                        <option value="">
                                                            Select transaction type
                                                        </option>

                                                        {transactionTypes.map(
                                                            (type) => (
                                                                <option
                                                                    key={type.id}
                                                                    value={type.id}
                                                                >
                                                                    {type.code} -{' '}
                                                                    {type.accountTitle}
                                                                </option>
                                                            )
                                                        )}

                                                    </select>
                                                </div>

                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                                        Code
                                                    </label>

                                                    <input
                                                        type="text"
                                                        value={item.code}
                                                        readOnly
                                                        placeholder="Code"
                                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-100 text-gray-600"
                                                    />
                                                </div>

                                                <div className="md:col-span-3">
                                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                                        Account Title
                                                    </label>

                                                    <input
                                                        type="text"
                                                        value={item.accountTitle}
                                                        readOnly
                                                        placeholder="Account title"
                                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-100 text-gray-600"
                                                    />
                                                </div>

                                                <div className="md:col-span-3">
                                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                                        Amount
                                                    </label>

                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.amount}
                                                        onChange={(e) =>
                                                            updateItem(
                                                                index,
                                                                'amount',
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="0.00"
                                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                                                    />
                                                </div>

                                                <div className="md:col-span-12">
                                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                                        Description
                                                    </label>

                                                    <textarea
                                                        rows={2}
                                                        value={item.description}
                                                        onChange={(e) =>
                                                            updateItem(
                                                                index,
                                                                'description',
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="Enter description"
                                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                                                    />
                                                </div>

                                            </div>
                                        </div>
                                    ))}

                                </div>

                                <div className="flex justify-end mt-4">
                                    <div className="bg-gray-100 border border-gray-200 rounded-lg px-5 py-3">

                                        <span className="text-xs text-gray-500 font-semibold">
                                            TOTAL AMOUNT
                                        </span>

                                        <div className="text-xl font-bold text-gray-800">
                                            ₱ {money(totalAmount)}
                                        </div>

                                    </div>
                                </div>

                            </div>

                            {/* OTHER DETAILS */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Total Amount (in word)
                                    </label>

                                    <input
                                        type="text"
                                        value={transactionForm.totalAmountWords}
                                        onChange={(e) =>
                                            updateMainField(
                                                'totalAmountWords',
                                                e.target.value
                                            )
                                        }
                                        placeholder="Example: One Thousand Pesos Only"
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Cashier in Charge
                                    </label>

                                    <input
                                        type="text"
                                        value={transactionForm.cashierInCharge}
                                        onChange={(e) =>
                                            updateMainField(
                                                'cashierInCharge',
                                                e.target.value
                                            )
                                        }
                                        placeholder="Enter cashier name"
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Branch Manager / Present Supervisor
                                    </label>

                                    <input
                                        type="text"
                                        value={transactionForm.supervisor}
                                        onChange={(e) =>
                                            updateMainField(
                                                'supervisor',
                                                e.target.value
                                            )
                                        }
                                        placeholder="Enter manager / supervisor"
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Received by
                                    </label>

                                    <input
                                        type="text"
                                        value={transactionForm.receivedBy}
                                        onChange={(e) =>
                                            updateMainField(
                                                'receivedBy',
                                                e.target.value
                                            )
                                        }
                                        placeholder="Enter receiver name"
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>

                            </div>

                        </div>

                        {/* FOOTER */}
                        <div className="flex justify-between items-center gap-3 px-5 py-4 border-t border-gray-200">

                            <div className="text-sm font-bold text-gray-700">
                                Total: ₱ {money(totalAmount)}
                            </div>

                            <div className="flex gap-2">

                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="
                                        px-4 py-2
                                        border border-gray-300
                                        text-gray-700
                                        text-sm font-medium
                                        rounded-md
                                        hover:bg-gray-50
                                    "
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSaveTransaction}
                                    className="
                                        px-4 py-2
                                        bg-teal-600
                                        hover:bg-teal-700
                                        text-white
                                        text-sm font-semibold
                                        rounded-md
                                    "
                                >
                                    {editingTransactionId
                                        ? 'Update Transaction'
                                        : 'Save Transaction'}
                                </button>

                            </div>

                        </div>

                    </div>
                </div>
            )}

            {/* =========================================================
                ADD TRANSACTION TYPE
            ========================================================== */}
            {showTypeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">

                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setShowTypeModal(false)}
                    />

                    <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">

                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">

                            <div>
                                <h2 className="text-lg font-bold text-gray-800">
                                    Add Transaction Type
                                </h2>

                                <p className="text-xs text-gray-500 mt-0.5">
                                    Add Code and Account Title
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowTypeModal(false)}
                                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md"
                            >
                                <X className="w-5 h-5" />
                            </button>

                        </div>

                        <div className="p-5 space-y-4">

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Code
                                </label>

                                <input
                                    type="text"
                                    value={typeForm.code}
                                    onChange={(e) =>
                                        setTypeForm((prev) => ({
                                            ...prev,
                                            code: e.target.value,
                                        }))
                                    }
                                    placeholder="Enter code"
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Account Title
                                </label>

                                <input
                                    type="text"
                                    value={typeForm.accountTitle}
                                    onChange={(e) =>
                                        setTypeForm((prev) => ({
                                            ...prev,
                                            accountTitle: e.target.value,
                                        }))
                                    }
                                    placeholder="Enter account title"
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                            </div>

                        </div>

                        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">

                            <button
                                type="button"
                                onClick={() => setShowTypeModal(false)}
                                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={handleSaveTransactionType}
                                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-md"
                            >
                                Save Transaction Type
                            </button>

                        </div>

                    </div>
                </div>
            )}

            {/* =========================================================
                VIEW TRANSACTION
            ========================================================== */}
            {showViewModal && selectedTransaction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">

                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setShowViewModal(false)}
                    />

                    <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">

                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">

                            <div>
                                <h2 className="text-lg font-bold text-gray-800">
                                    Petty Cash Voucher
                                </h2>

                                <p className="text-xs text-gray-500">
                                    Voucher #{selectedTransaction.voucherNo}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowViewModal(false)}
                                className="p-2 text-gray-400 hover:bg-gray-100 rounded-md"
                            >
                                <X className="w-5 h-5" />
                            </button>

                        </div>

                        <div className="p-6 overflow-y-auto">

                            <div className="flex items-center justify-center gap-3 mb-6">
                                <img
                                    src="/images/logo.png"
                                    alt="AmberCash Logo"
                                    className="w-16 h-16 object-contain"
                                />

                                <div className="text-center">
                                    <div className="text-lg font-extrabold text-gray-900">
                                        AmberCash PH Micro Lending Corp.
                                    </div>

                                    <div className="text-base font-black text-gray-900 tracking-wide">
                                        PETTY CASH VOUCHER
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">

                                <div>
                                    <span className="text-xs text-gray-500">
                                        Paid to
                                    </span>

                                    <div className="font-semibold text-gray-800">
                                        {selectedTransaction.paidTo}
                                    </div>
                                </div>

                                <div>
                                    <span className="text-xs text-gray-500">
                                        Date
                                    </span>

                                    <div className="font-semibold text-gray-800">
                                        {selectedTransaction.date}
                                    </div>
                                </div>

                                <div>
                                    <span className="text-xs text-gray-500">
                                        Address
                                    </span>

                                    <div className="font-semibold text-gray-800">
                                        {selectedTransaction.address || '-'}
                                    </div>
                                </div>

                                <div>
                                    <span className="text-xs text-gray-500">
                                        Voucher #
                                    </span>

                                    <div className="font-semibold text-gray-800">
                                        {selectedTransaction.voucherNo}
                                    </div>
                                </div>

                            </div>

                            <div className="overflow-x-auto">

                                <table className="w-full border-collapse">

                                    <thead>
                                        <tr className="bg-gray-50">

                                            <th className="border border-gray-300 p-2 text-xs">
                                                Code
                                            </th>

                                            <th className="border border-gray-300 p-2 text-xs">
                                                Account Title
                                            </th>

                                            <th className="border border-gray-300 p-2 text-xs">
                                                Description
                                            </th>

                                            <th className="border border-gray-300 p-2 text-xs text-right">
                                                Amount
                                            </th>

                                        </tr>
                                    </thead>

                                    <tbody>

                                        {selectedTransaction.items.map(
                                            (item, index) => (
                                                <tr key={index}>

                                                    <td className="border border-gray-300 p-2 text-sm">
                                                        {item.code}
                                                    </td>

                                                    <td className="border border-gray-300 p-2 text-sm">
                                                        {item.accountTitle}
                                                    </td>

                                                    <td className="border border-gray-300 p-2 text-sm">
                                                        {item.description || '-'}
                                                    </td>

                                                    <td className="border border-gray-300 p-2 text-sm text-right">
                                                        ₱ {money(item.amount)}
                                                    </td>

                                                </tr>
                                            )
                                        )}

                                        <tr>
                                            <td
                                                colSpan={3}
                                                className="border border-gray-300 p-2 text-right font-bold"
                                            >
                                                TOTAL
                                            </td>

                                            <td className="border border-gray-300 p-2 text-right font-bold">
                                                ₱{' '}
                                                {money(
                                                    selectedTransaction.totalAmount
                                                )}
                                            </td>
                                        </tr>

                                    </tbody>

                                </table>

                            </div>

                            <div className="mt-5 space-y-3 text-sm">

                                <div>
                                    <span className="font-bold">
                                        Total Peso (in word):
                                    </span>{' '}

                                    {selectedTransaction.totalAmountWords || '-'}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">

                                    <div>
                                        <div className="text-xs text-gray-500">
                                            Cashier in Charge
                                        </div>

                                        <div className="font-semibold">
                                            {selectedTransaction.cashierInCharge ||
                                                '-'}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-xs text-gray-500">
                                            Branch Manager / Present Supervisor
                                        </div>

                                        <div className="font-semibold">
                                            {selectedTransaction.supervisor ||
                                                '-'}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-xs text-gray-500">
                                            Received by
                                        </div>

                                        <div className="font-semibold">
                                            {selectedTransaction.receivedBy ||
                                                '-'}
                                        </div>
                                    </div>

                                </div>

                            </div>

                        </div>

                        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">

                            <button
                                type="button"
                                onClick={() => setShowViewModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700"
                            >
                                Close
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    handlePrint(selectedTransaction)
                                }
                                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-sm font-semibold"
                            >
                                <Printer className="w-4 h-4" />
                                Print Voucher
                            </button>

                        </div>

                    </div>
                </div>
            )}
        </>
    );
};

export default TransactionPanel;