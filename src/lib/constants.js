export const getApiBaseUrl = () => process.env.NEXT_PUBLIC_API_URL;
export const getHasuraBaseUrl = () => process.env.HASURA_URL;
export const getLocalhost = () => process.env.NEXT_PUBLIC_LOCAL_HOST;

    //(localStorage.getItem('api_version') ? localStorage.getItem('api_version') + '/' : '');

export const LOR_DAILY_REMARKS = [
    { label: 'Remarks', value: ''},
    { label: 'Double Payment', value: 'double payment'},
    { label: 'Advance Payment', value: 'advance payment'},
    { label: 'Reloaner', value: 'reloaner-cont'},
    // { label: 'Reloaner RF/MCBU', value: 'reloaner-wd'},
    { label: 'For Close/Offset', value: 'offset-good'},
    // { label: 'For Close/Offset - Delinquent Client', value: 'offset-delinquent'},
    { label: 'For Close/Offset - Unclaimed Amount', value: 'offset-unclaimed'},
    { label: 'For Close/Offset - Matured PD Client', value: 'offset-matured-pd'},
    { label: 'Past Due', value: 'past due'},
    { label: 'Past Due Collection', value: 'past due collection'},
    { label: 'Matured Past Due', value: 'matured-past due'},
    { label: 'Matured Past Due Collection', value: 'matured_past_due_collection'},
    { label: 'Delinquent', value: 'delinquent'},
    { label: 'Delinquent Client for Loan Collection', value: 'delinquent-offset'},
    { label: 'Delinquent Client for MCBU', value: 'delinquent-mcbu'},
    { label: 'Good Excused due to Advance Payment', value: 'excused advance payment'},
    { label: 'Excused Due to Calamity', value: 'excused-calamity'},
    { label: 'Excused - Hospitalization', value: 'excused-hospital'},
    { label: 'Excused - Death of Clients/Family Member', value: 'excused-death'},
    { label: 'Overstated Collection', value: 'collection-overstated'},
    { label: 'Understated Collection', value: 'collection-understated'}
];

export const LOR_WEEKLY_REMARKS = [
    { label: 'Remarks', value: ''},
    { label: 'Double Payment', value: 'double payment'},
    { label: 'Advance Payment', value: 'advance payment'},
    { label: 'Reloaner', value: 'reloaner'},
    { label: 'For Close/Offset', value: 'offset-good'},
    // { label: 'For Close/Offset - Delinquent Client', value: 'offset-delinquent'},
    { label: 'For Close/Offset - Unclaimed Amount', value: 'offset-unclaimed'},
    { label: 'For Close/Offset - Matured PD Client', value: 'offset-matured-pd'},
    { label: 'Past Due', value: 'past due'},
    { label: 'Past Due Collection', value: 'past due collection'},
    { label: 'Matured Past Due', value: 'matured-past due'},
    { label: 'Matured Past Due Collection', value: 'matured_past_due_collection'},
    { label: 'Delinquent', value: 'delinquent'},
    { label: 'Delinquent Client for Loan Collection', value: 'delinquent-offset'},
    { label: 'Delinquent Client for MCBU', value: 'delinquent-mcbu'},
    { label: 'Good Excused due to Advance Payment', value: 'excused advance payment'},
    { label: 'Excused Due to Calamity', value: 'excused-calamity'},
    { label: 'Excused - Hospitalization', value: 'excused-hospital'},
    { label: 'Excused - Death of Clients/Family Member', value: 'excused-death'},
    { label: 'Overstated Collection', value: 'collection-overstated'},
    { label: 'Understated Collection', value: 'collection-understated'}
];

export const LOR_ONLY_DAILY_RELOAN_OFFSET_REMARKS = [
    { label: 'Remarks', value: ''},
    { label: 'Reloaner Cont/MCBU', value: 'reloaner-cont'},
    { label: 'Reloaner WD/MCBU', value: 'reloaner-wd'},
    { label: 'For Close/Offset - Good Client', value: 'offset-good'},
    { label: 'For Close/Offset - Delinquent Client', value: 'offset-delinquent'},
    { label: 'For Close/Offset - Unclaimed Amount', value: 'offset-unclaimed'}
];

export const LOR_ONLY_WEEKLY_RELOAN_OFFSET_REMARKS = [
    { label: 'Remarks', value: ''},
    { label: 'Reloaner', value: 'reloaner'},
    { label: 'For Close/Offset - Good Client', value: 'offset-good'},
    { label: 'For Close/Offset - Delinquent Client', value: 'offset-delinquent'},
    { label: 'For Close/Offset - Unclaimed Amount', value: 'offset-unclaimed'},
    { label: 'For Close/Offset - Matured PD Client', value: 'offset-matured-pd'}
];

export const LOR_ONLY_OFFSET_REMARKS = [
    { label: 'Remarks', value: ''},
    { label: 'For Close/Offset - Good Client', value: 'offset-good'},
    { label: 'For Close/Offset - Delinquent Client', value: 'offset-delinquent'},
    { label: 'For Close/Offset - Unclaimed Amount', value: 'offset-unclaimed'},
    { label: 'For Close/Offset - Matured PD Client', value: 'offset-matured-pd'}
];

export const LOR_MISPAY_REMARKS = [
    { label: 'Past Due', value: 'past due'},
    // { label: 'Matured Past Due', value: 'matured-past due'},
    { label: 'Delinquent', value: 'delinquent'},
    { label: 'Delinquent Client for MCBU', value: 'delinquent-mcbu'},
    { label: 'Excused Due to Calamity', value: 'excused-calamity'},
    { label: 'Excused - Hospitalization', value: 'excused-hospital'},
    { label: 'Excused - Death of Clients/Family Member', value: 'excused-death'}
];

export const LOR_NO_CSF_IN_REMARKS = [
    'past due',
    'delinquent-mcbu',
    'delinquent',
    'delinquent-offset',
    'excused-calamity',
    'excused-hospital',
    'excused-death',
    'excused advance payment',
    'offset-good',
    'offset-delinquent',
    'offset-unclaimed',
    'offset-matured-pd'
]

export const WEEKLY_GROUPS = [
    "APPLE", "BANANA", "CHERRY", "MANGO", "PINEAPPLE", "WATERMELON", "GRAPES", "KIWI", "PEAR", "PEACH", "STRAWBERRY", "BLUEBERRY", "RASPBERRY", "LEMON", "LIME"
];

export const WEEKLY_GROUPS_ACCELERATED = [
    "TOYOTA", "HONDA", "MAZDA", "NISSAN", "SUBARU", "SUZUKI", "ISUZU", "FORD",
    "CHEVROLET", "HYUNDAI", "KIA", "MITSUBISHI", "VOLVO", "PEUGEOT", "RENAULT",
    "BMW", "AUDI", "MERCEDES", "LEXUS", "INFINITI",
    "ACURA", "PORSCHE", "JAGUAR", "LANDROVER", "VOLKSWAGEN"
];

export const LO_1_DAILY_GROUPS = [
    "BLUE", "BROWN", "GRAY", "GREEN", "ORANGE", "PINK", "RED", "PURPLE", "YELLOW", "CREAM", "MAGENTA", "MOCHA"
]

export const LO_2_DAILY_GROUPS = [
    "MERCURY", "VENUS", "EARTH", "MARS", "JUPITER", "SATURN", "URANUS", "NEPTUNE", "PLUTO", "CERES", "ORCUS", "HAUMEA"
];

export const LO_3_DAILY_GROUPS = [
    "DAISY", "ROSE", "IRIS", "ORCHIDS", "TULIPS", "PANSY", "LILY", "ANEMONE", "BLUEBELL", "POPPY", "MIMOSA", "CARNATION"
];

export const LO_4_DAILY_GROUPS = [
    'ZEUS', 'POSEIDON', 'HERA', 'DEMETER', 'ATHENA', 'APOLLO', 'ARTEMIS', 'HESTIA', 'DIONYSUS', 'HEPHAESTUS', 'APHRODITE', 'HERCULES'
];

export const LO_5_DAILY_GROUPS = [
    'BORON', 'CARBON', 'NITROGEN', 'OXYGEN', 'NEON', 'SODIUM', 'SILICON', 'SULFUR', 'ARGON', 'IRON', 'ZINC', 'SILVER'
];

export const LO_6_DAILY_GROUPS = [
    'AUSTRIA', 'BAHRAIN', 'BRAZIL', 'CANADA', 'CROATIA', 'DENMARK', 'FRANCE', 'GREECE', 'HAITI', 'ITALY', 'LAOS', 'MALAYSIA'
];

export const LO_7_DAILY_GROUPS = [
    'EMERALD', 'AGATE', 'TOPAZ', 'BERYL', 'RUBY', 'PERIDOT', 'GOLD', 'ZIRCON', 'OPAL', 'ONYX', 'JADE', 'GARNET'
];

export const LO_8_DAILY_GROUPS = [
    'ARIES', 'TAURUS', 'GEMINI', 'PISCES', 'SCORPIO', 'LEO', 'CANCER', 'VIRGO', 'LIBRA', 'SAGUITARIUS', 'CAPRICORN', 'AQUARIUS'
];

export const LO_9_DAILY_GROUPS = [
    'NARRA', 'IPIL', 'KAMAGONG', 'MOLAVE', 'ACACIA', 'MAHOGANY', 'YAKAL', 'BAMBOO', 'TANGUILI', 'NATO', 'GEMELINA', 'ALMACIGA'
];

export const LO_10_DAILY_GROUPS = [
    'MERCY', 'PATIENCE', 'PEACE', 'CARE', 'HONEST', 'GENEROUS', 'FIDELITY', 'PRUDENCE', 'HONOR', 'LOVE', 'TRUST', 'HOPE'
];

export const LO_11_DAILY_GROUPS = [
    'AMBER', 'BEIGE', 'BLACK', 'CYAN', 'INDIGO', 'MAROON', 'RUST', 'TEAL', 'WHITE', 'AQUA', 'BLOND', 'BURGUNDY'
];

export const LO_12_DAILY_GROUPS = [
    'KROTOA', 'MAGOR', 'ARBER', 'BURU', 'CHURA', 'HAIRU', 'NARON', 'SAFFAR', 'ARBER', 'AMATERU', 'BRAN', 'GUARANI'
];

export const LO_13_DAILY_GROUPS = [
    'DAFFODIL', 'DAHLIA', 'LAVENDER', 'MARIGOLD', 'PEONY', 'ASTER', 'JASMINE', 'SUNFLOWER', 'PETUNIA', 'AZALEA', 'AMARYLLIS', 'HYDRANGEA'
];

export const LO_14_DAILY_GROUPS = [
    'HERMES', 'ARES', 'HADES', 'CRONUS', 'EROS', 'PERSOPHONIE', 'HELIOS', 'GAIA', 'PAN', 'RHEA', 'ATLAS', 'HERACLES'
];

export const LO_15_DAILY_GROUPS = [
    'HYDROGEN', 'HELIUM', 'FLOURINE', 'BERYLLIUM', 'LITHIUM', 'MAGNESIUM', 'POTASSIUM', 'BARIUM', 'CALCIUM', 'NEON', 'COPPER', 'NICKEL'
];

export const LO_16_DAILY_GROUPS = [
    'PERSIA', 'CAMBODIA', 'HUNGARY', 'ALBANIA', 'INDONESIA', 'JAPAN', 'INDIA', 'CUBA', 'BULGARIA', 'PHILIPPINES', 'COLOMBIA', 'GHANA'
];

export const LO_17_DAILY_GROUPS = [
    'AMETHYST', 'DIAMOND', 'PEARL', 'TOPAZ', 'SAPPHIRE', 'AQUAMARINE', 'CITRINE', 'CORUNDUM', 'QUARTZ', 'TOURMALINE', 'JASPER', 'CARNELIAN'
];

export const LO_18_DAILY_GROUPS = [
    'RAT', 'OX', 'TIGER', 'RABBIT', 'DRAGON', 'SNAKE', 'HORSE', 'SHEEP', 'MONKEY', 'ROOSTER', 'DOG', 'PIG'
];

export const LO_19_DAILY_GROUPS = [
    'OAK', 'MAPLE', 'BIRCH', 'CEDAR', 'PICEA', 'POPLAR', 'WALNUT', 'ABIES', 'SAPELE', 'ALDER', 'PINE', 'BEECH'
];

export const LO_20_DAILY_GROUPS = [
    'BEAUTY', 'COURAGE', 'CONFIDENCE', 'FAITH', 'DIGNITY', 'JUSTICE', 'LOYALTY', 'ETHICAL', 'SINCERITY', 'UNITY', 'WISDOM', 'GRATITUDE'
];

export const SUMMARY_RECEIPTS = [
    { no: '1a', key: 'rcptMcbu',                   label: 'MCBU Collection',                          source: 'collection' },
    { no: '1b', key: 'rcptCsf',                    label: 'CSF Collection',                           source: 'collection' },
    { no: 2,    key: 'rcptRegularLoan',             label: 'Regular Loan Collection (Daily / 60 Days)',source: 'collection' },
    { no: 3,    key: 'rcptOtherLoan',               label: 'Other Loan Collection (Weekly)',           source: 'collection' },
    { no: 4,    key: 'rcptStaffCbu',                label: 'Staff Collection CBU / CashBond',          source: 'gl' },
    { no: 5,    key: 'rcptStaffPrincipal',          label: 'Staff Principal Loan collection',          source: 'gl' },
    { no: 6,    key: 'rcptAdminFees',               label: 'Admin Fees #',                             source: 'collection' },
    { no: 7,    key: 'rcptLrf',                     label: 'LRF Collection',                           source: 'collection' },
    { no: 8,    key: 'rcptCbhb',                    label: 'C B H B Collection',                       source: 'collection' },
    { no: 9,    key: 'rcptAddHospi',                label: 'ADD-Hospi #',                              source: 'collection' },
    { no: 10,   key: 'rcptWtax',                    label: 'W/Tax, EE&ER',                             source: 'gl' },
    { no: 11,   key: 'rcptMcbuUnclaimedIn',         label: 'MCBU Unclaimed (In)',                      source: 'special' },
    { no: '12a',key: 'rcptOtherIncomePassbook',     label: 'Other Income (Passbook)',                  source: 'collection' },
    { no: '12b',key: 'rcptOtherIncome',             label: 'Other Income',                             source: 'collection' },
    { no: '12c',key: 'rcptOtherIncomeCsf',          label: 'Other Income CSF W/o Agent',               source: 'collection' },
    { no: 13,   key: 'rcptOtherReceiptsPicture',    label: 'Other Receipts (Picture)',                 source: 'collection' },
    { no: 14,   key: 'rcptOtherReceiptsGl',         label: 'Other Receipts',                           source: 'gl' },
    { no: 15,   key: 'rcptFundTransferIn',          label: 'Fund Transfer',                            source: 'special' },
    { no: 16,   key: 'rcptBankWithdrawal',          label: 'Bank Withdrawal',                          source: 'special' },
];

export const SUMMARY_PAYMENTS = [
    { no: 1,    key: 'payLoanRelease',              label: 'Client Loan Release # of Prs.',            source: 'collection' },
    { no: '2a', key: 'payMcbuWithdrawal',           label: 'Client MCBU withd.',                       source: 'collection' },
    { no: '2b', key: 'payCsfWithdrawal',            label: 'CSF Withd.',                               source: 'collection' },
    { no: '3a', key: 'payMcbuReturn',               label: 'MCBU Return',                              source: 'collection' },
    { no: '3b', key: 'payCsfReturn',                label: 'CSF Return',                               source: 'collection' },
    { no: 4,    key: 'payStaffLoanRelease',         label: 'Staff Loan Release / Staff CBU withd.',    source: 'gl' },
    { no: 5,    key: 'payMngtExpenses',             label: 'Mngt. Expenses',                           source: 'gl' },
    { no: 6,    key: 'payCbhbDisbursed',            label: 'CBHB Disbursed',                           source: 'gl' },
    { no: 7,    key: 'payMcbuUnclaimedOut',         label: 'MCBU Unclaimed (Out)',                     source: 'special' },
    { no: 8,    key: 'payRebates',                  label: 'Rebates',                                  source: 'gl' },
    { no: 9,    key: 'payOtherPayments',            label: 'Other payments',                           source: 'gl' },
    { no: 10,   key: 'payFundTransferOut',          label: 'Fund Transfer',                            source: 'special' },
    { no: 11,   key: 'payBankDeposits',             label: 'Bank Deposits',                            source: 'special' },
];

// Map fn_get_dcs_summary snake_case fields → camelCase keys
// Used by SummaryPanel to build its amount objects.
export const mapSummaryData = (d) => {
    if (!d) return null;
    // Guard: if array was accidentally passed, unwrap first element
    const raw = Array.isArray(d) ? d[0] : d;
    if (!raw) return null;
    return {
        // Balance
        beginningBalance:           parseFloat(raw.beginning_balance)            || 0,
        // Receipts
        rcptMcbu:                   parseFloat(raw.rcpt_mcbu)                    || 0,
        rcptCsf:                    parseFloat(raw.rcpt_csf)                     || 0,
        rcptRegularLoan:            parseFloat(raw.rcpt_regular_loan)            || 0,
        rcptOtherLoan:              parseFloat(raw.rcpt_other_loan)              || 0,
        rcptAdminFees:              parseFloat(raw.rcpt_admin_fees)              || 0,
        rcptLrf:                    parseFloat(raw.rcpt_lrf)                     || 0,
        rcptCbhb:                   parseFloat(raw.rcpt_cbhb)                    || 0,
        rcptAddHospi:               parseFloat(raw.rcpt_add_hospi)               || 0,
        rcptOtherIncomePassbook:    parseFloat(raw.rcpt_other_income_passbook)   || 0,
        rcptOtherIncome:            parseFloat(raw.rcpt_other_income)            || 0,
        rcptOtherIncomeCsf:         parseFloat(raw.rcpt_other_income_csf)        || 0,
        rcptOtherReceiptsPicture:   parseFloat(raw.rcpt_other_receipts_picture)  || 0,
        rcptStaffCbu:               parseFloat(raw.rcpt_staff_cbu)               || 0,
        rcptStaffPrincipal:         parseFloat(raw.rcpt_staff_principal)         || 0,
        rcptWtax:                   parseFloat(raw.rcpt_wtax)                    || 0,
        rcptOtherReceiptsGl:        parseFloat(raw.rcpt_other_receipts_gl)       || 0,
        rcptMcbuUnclaimedIn:        parseFloat(raw.rcpt_mcbu_unclaimed_in)       || 0,
        rcptFundTransferIn:         parseFloat(raw.rcpt_fund_transfer_in)        || 0,
        rcptBankWithdrawal:         parseFloat(raw.rcpt_bank_withdrawal)         || 0,
        totalReceipts:              parseFloat(raw.total_receipts)               || 0,
        // Payments
        payLoanRelease:             parseFloat(raw.pay_loan_release_amount)      || 0,
        payLoanReleaseNo:           parseInt(raw.pay_loan_release_no)            || 0,
        payMcbuWithdrawal:          parseFloat(raw.pay_mcbu_withdrawal)          || 0,
        payCsfWithdrawal:           parseFloat(raw.pay_csf_withdrawal)           || 0,
        payMcbuReturn:              parseFloat(raw.pay_mcbu_return)              || 0,
        payCsfReturn:               parseFloat(raw.pay_csf_return)               || 0,
        payStaffLoanRelease:        parseFloat(raw.pay_staff_loan_release)       || 0,
        payMngtExpenses:            parseFloat(raw.pay_mngt_expenses)            || 0,
        payCbhbDisbursed:           parseFloat(raw.pay_cbhb_disbursed)           || 0,
        payMcbuUnclaimedOut:        parseFloat(raw.pay_mcbu_unclaimed_out)       || 0,
        payRebates:                 parseFloat(raw.pay_rebates)                  || 0,
        payOtherPayments:           parseFloat(raw.pay_other_payments)           || 0,
        payFundTransferOut:         parseFloat(raw.pay_fund_transfer_out)        || 0,
        payBankDeposits:            parseFloat(raw.pay_bank_deposits)            || 0,
        totalPayments:              parseFloat(raw.total_payments)               || 0,
        // Balance
        closingBalance:             parseFloat(raw.closing_balance)              || 0,
        // JSONB arrays
        loanReleasePerLo:           raw.loan_release_per_lo   || [],
        denominationSummary:        raw.denomination_summary  || [],
    };
};