/**
 * Branch dump configuration for the LMS database.
 *
 * Most LMS tables are linked to a branch by COLUMN NAME ("branchId" / branch_id),
 * not by real foreign keys, so the relationships are declared here.
 * Run with --dry-run first: the coverage report at the end lists every table the
 * dump did NOT reach, so you can add a rule below for anything that matters.
 */
module.exports = {
  schema: 'public',

  // Any table with a column matching this is dumped WHERE column = <branch id>.
  // Catches "branchId", "branch_id", "branchid" automatically, including tables
  // that exist in production but not in the repo (mcbu_withdrawal, branchApprovals...).
  branchColumnPattern: /^branch_?id$/i,

  // The branch row itself.
  branchTable: { name: 'branches', pk: '_id' },

  // Only keep recent rows of big transactional tables. months counts back from today
  // (override with --months or --since on the command line).
  windows: {
    cashCollections: { column: 'dateAdded', months: 2 },
  },

  // General rule: skip rows that have not been added or modified in the last N months.
  // A row counts as recent if ANY of these date/timestamp columns (those that exist on the table)
  // is newer than the cutoff; rows with no date info at all are kept. Explicit `windows` above win.
  // Older records that recent rows still point at (clients, loans, groups, users...) are pulled in
  // anyway through the `parents` links below, so nothing recent is left dangling.
  recency: {
    months: 6,
    columns: ['dateModified', 'modifiedDateTime', 'modified_at', 'updated_at', 'updatedAt', 'lastUpdated',
              'dateAdded', 'insertedDateTime', 'created_at', 'createdAt',
              // snake_case / other tables seen in production
              'date_added', 'inserted_date', 'modified_date', 'approval_date', 'rejection_date',
              'approved_date', 'rejected_date', 'insertedDate', 'modifiedDate', 'approvedRejectedDate'],
    // small structural tables that are always copied whole
    skip: ['branches', 'users', 'groups', 'settings'],
    // always keep rows matching a condition even if old (c = the table row), e.g. still-open loans:
    keep: {
      // loans: `c."status" = 'active'`,
    },
  },

  // Tables linked to a branch by a differently-named column. {{branch}} is replaced by
  // the quoted branch id, and the table is aliased as c.
  extraSeeds: {
    users: `c."designatedBranchId"::text = {{branch}}`,
    fund_transfer: `c."giverBranchId"::text = {{branch}} OR c."receiverBranchId"::text = {{branch}}`,
    settings: `c."branchCode" IN (SELECT b."code" FROM "branches" b WHERE b."_id"::text = {{branch}})`,
  },

  // DOWN links: tables with NO branch column, owned by a parent row we already selected.
  children: [
    { child: 'dcs_transaction_items',        childCols: ['transaction_id'], parent: 'dcs_transactions',        parentCols: ['id'] },
    { child: 'branch_payroll_employees',     childCols: ['payroll_id'],     parent: 'branch_payroll',          parentCols: ['id'] },
    { child: 'cash_collection_upload_rows',  childCols: ['upload_id'],      parent: 'cash_collection_uploads', parentCols: ['_id'] },
    { child: 'client_accounts',              childCols: ['client_id'],      parent: 'client',                  parentCols: ['_id'] },
    { child: 'client_enrollment_requests',   childCols: ['client_id'],      parent: 'client',                  parentCols: ['_id'] },
    { child: 'client_enrollment_attempts',   childCols: ['client_id'],      parent: 'client',                  parentCols: ['_id'] },
    { child: 'client_programs',              childCols: ['client_id'],      parent: 'client',                  parentCols: ['_id'] },
    { child: 'client_program_attachments',   childCols: ['program_id'],     parent: 'client_programs',         parentCols: ['_id'] },
    { child: 'ciInvestigations',             childCols: ['tempApplicationId'], parent: 'temporaryLoanApplications', parentCols: ['_id'] },
  ],

  // UP links: rows that selected rows point to, pulled in so nothing dangles
  // (e.g. a loan officer from another branch). Real foreign keys are added automatically.
  // Parents are NOT expanded back down, so other branches' data does not leak in.
  parents: [
    // keep recent records connected to the (possibly older) rows they reference
    { child: 'cashCollections', childCols: ['loanId'],   parent: 'loans',  parentCols: ['_id'] },
    { child: 'cashCollections', childCols: ['clientId'], parent: 'client', parentCols: ['_id'] },
    { child: 'cashCollections', childCols: ['groupId'],  parent: 'groups', parentCols: ['_id'] },
    { child: 'loans',    childCols: ['clientId'],   parent: 'client', parentCols: ['_id'] },
    { child: 'loans',    childCols: ['groupId'],    parent: 'groups', parentCols: ['_id'] },
    // reloan chain: ONE level only (the previous loan of each copied loan), not the whole history
    { child: 'loans',    childCols: ['prevLoanId'], parent: 'loans',  parentCols: ['_id'], fromBaseOnly: true },
    { child: 'client',   childCols: ['groupId'],    parent: 'groups', parentCols: ['_id'] },
    { child: 'mcbu_withdrawals',  childCols: ['client_id'], parent: 'client', parentCols: ['_id'] },
    { child: 'mcbu_withdrawals',  childCols: ['loan_id'],   parent: 'loans',  parentCols: ['_id'] },
    { child: 'loans',    childCols: ['loId'],          parent: 'users', parentCols: ['_id'] },
    { child: 'loans',    childCols: ['insertedBy'],    parent: 'users', parentCols: ['_id'] },
    { child: 'client',   childCols: ['loId'],          parent: 'users', parentCols: ['_id'] },
    { child: 'client',   childCols: ['insertedBy'],    parent: 'users', parentCols: ['_id'] },
    { child: 'groups',   childCols: ['loanOfficerId'], parent: 'users', parentCols: ['_id'] },
    { child: 'cashCollections', childCols: ['loId'],       parent: 'users', parentCols: ['_id'] },
    { child: 'cashCollections', childCols: ['insertedBy'], parent: 'users', parentCols: ['_id'] },
    { child: 'fund_transfer', childCols: ['insertedById'],        parent: 'users',           parentCols: ['_id'] },
    { child: 'fund_transfer', childCols: ['modifiedById'],        parent: 'users',           parentCols: ['_id'] },
    { child: 'fund_transfer', childCols: ['giverApprovalId'],     parent: 'branchApprovals', parentCols: ['_id'] },
    { child: 'fund_transfer', childCols: ['receiverApprovalId'],  parent: 'branchApprovals', parentCols: ['_id'] },
    { child: 'branches', childCols: ['areaId'],     parent: 'areas',     parentCols: ['_id'] },
    { child: 'branches', childCols: ['regionId'],   parent: 'regions',   parentCols: ['_id'] },
    { child: 'branches', childCols: ['divisionId'], parent: 'divisions', parentCols: ['_id'] },
    { child: 'users',    childCols: ['areaId'],     parent: 'areas',     parentCols: ['_id'] },
    { child: 'users',    childCols: ['regionId'],   parent: 'regions',   parentCols: ['_id'] },
    { child: 'users',    childCols: ['divisionId'], parent: 'divisions', parentCols: ['_id'] },
  ],

  // Tables copied in full (small global reference data), if staging lacks them.
  fullTables: [], // e.g. ['roles', 'rolesPermissions', 'holidays', 'transactionSettings']

  // --replace never deletes these from the target (the branch row is always kept).
  // 'users' is kept so dev/staging logins survive; remove it to make users mirror production.
  keepOnWipe: ['users'],

  // Per-table behaviour when a row already exists in the target ('nothing' = keep the
  // target's row, 'update' = production wins). Matches the earlier prod->dev sync rule:
  // branches and users are insert-if-missing only and never overwrite the target.
  // Everything else follows --on-conflict (update with --replace).
  conflict: { branches: 'nothing', users: 'nothing' },

  // Tables that are NOT copied but whose rows must be cleared on the target before their parent
  // rows can be deleted (the target has a foreign key into them). --replace deletes the matching rows.
  wipeOnly: [
    { child: 'loans_history', childCols: ['loan_id'], parent: 'loans', parentCols: ['_id'] },
  ],

  // Never dumped: authentication secrets. Prod tokens/OTPs must not land in staging.
  exclude: [
    // authentication secrets / tokens: never copy prod credentials into dev
    'client_refresh_tokens', 'client_otp_codes', 'biometricRegistrationTokens',
    // leftover temp/backup tables and system logs: not branch data, dev may not have them
    'cashCollections_dups_loanId_dateAdded', 'losTotals_temp', 'loans_fpd_backup_5ids', 'temp_loan_group',
    'audit_row_changes', 'lms_logs', 'user_activity_logs',
    // not needed in dev
    'face_verify_attempts', 'transferClients',
    'loans_history', 'notifications', 'audit_logs',
    'closing_documents', 'closing_document_reviews', 'loan_closing_reviews',
  ],

  // The dump FAILS LOUDLY if any of these are missing or empty, so nothing is silently skipped.
  require: ['users', 'client', 'loans', 'cashCollections', 'mcbu_withdrawals', 'branchApprovals', 'branch_payroll', 'fund_transfer'],
  requirePrefix: ['dcs_'],

  // Replace sensitive columns with SQL expressions (t = the source row). Strongly
  // recommended for production -> staging copies of client personal data. Examples:
  mask: {
    // users:  { password: `'<bcrypt hash of a known staging password>'` },
    // client: { contactNumber: `'09' || lpad((abs(hashtext(t."_id")) % 1000000000)::text, 9, '0')` },
  },
};
