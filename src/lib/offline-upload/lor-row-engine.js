/**
 * src/lib/offline-upload/lor-row-engine.js
 *
 * Pure port of the row logic that lives inside handlePaymentCollectionChange on the two LOR pages
 * (daily-cash-collection/client/[uuid].js and weekly-cash-collection/client/[uuid].js):
 *   type 'amount'   -> applyPayment
 *   type 'mcbuCol'  -> applyMcbuCol   (+ the onBlur check from handlePaymentValidation)
 *   type 'csfCol'   -> applyCsfCol    (+ the onBlur check)
 *   type 'remarks'  -> applyRemarks
 *
 * Used ONLY by the offline upload, to compute a row exactly as if a person typed it. The live pages
 * are NOT rewired to this file yet (a mistake here would hit daily operations). Once the parity
 * fixtures pass on staging, the pages can switch to it and the duplicate disappears.
 *
 * Differences from the pages, on purpose:
 *   - no display strings (*Str): they are never stored, the page rebuilds them when the draft loads
 *   - no toasts: messages are returned as `errors` / `warnings`
 *   - no React state: UI side effects come back as `effects`
 *   - matured past due, QR-sourced and already-completed rows are out of scope (rejected upstream)
 *
 * Dependencies are injected so the file has no imports and can be unit-tested with plain node:
 *   mode                  'daily' | 'weekly'
 *   safeNumber            same function as '@/lib/utils'
 *   getMinMcbu(row, n, remarks)  daily:  (row, n, r) => getDailyMinMcbu(n, r)
 *                                weekly: (row, n, r) => getWeeklyMinMcbu(row.group?.weeklyScheduleType, n, r)
 *   minCsfCollection      transactionSettings.minCsfCollection
 *   csfEnabled, hasGroupLeader   same values the page holds in state
 *   isCsfCollectionAllowed(row)  the page's `allowCSFCollection` expression
 */

// Remarks the upload does not handle (matured past due family needs state the template cannot carry,
// reloaner-wd starts a withdrawal flow). commit.js imports this same list.
export const UPLOAD_BLOCKED_REMARKS = [
    'matured-past due',
    'matured_past_due_collection',
    'offset-matured-pd',
    'reloaner-wd',
];

const clone = (o) => JSON.parse(JSON.stringify(o));

export function createRowEngine(ctx) {
    const { mode, safeNumber, getMinMcbu, minCsfCollection, csfEnabled, hasGroupLeader } = ctx;
    const isDaily = mode === 'daily';
    const RELOANER = isDaily ? 'reloaner-cont' : 'reloaner';
    const MCBU_CHECK_REMARKS = [RELOANER, 'double payment', 'advance payment'];

    const calculateCsfIn = (n) => (csfEnabled && !hasGroupLeader ? minCsfCollection * n : 0);
    const removeCsfIn = (t) => { if (!hasGroupLeader) t.csfIn = 0; return t; };

    const snapshotPrev = (t) => ({
        amountRelease: t.amountRelease,
        paymentCollection: t.paymentCollection,
        excess: t.excess && t.excess !== '-' ? t.excess : 0,
        loanBalance: t.loanBalance,
        activeLoan: t.activeLoan,
        noOfPayments: t.noOfPayments,
        total: t.total,
        pastDue: t.pastDue,
        mcbu: t.mcbu,
        csf: t.csf,
        advanceDays: t.advanceDays,
        mcbuCol: t.mcbuCol,
        csfCollection: t.csfCollection,
    });

    const setHistory = (t, prevLoanBalance) => {
        t.history = {
            amountRelease: t.amountRelease,
            loanBalance: prevLoanBalance ? prevLoanBalance : t.loanBalance,
            activeLoan: t.activeLoan,
            excess: t.excess,
            collection: t.paymentCollection,
            loanCycle: t.loanCycle,
            remarks: t.remarks,
            advanceDays: t.advanceDays,
        };
        return t;
    };

    // ------------------------------------------------------------------------------------------
    // type 'amount'
    // ------------------------------------------------------------------------------------------
    function applyPayment(row, rawValue) {
        const errors = [];
        const t = clone(row);
        const payment = rawValue === '' || rawValue === null || rawValue === undefined ? 0 : Number(rawValue);

        if (!Number.isFinite(payment) || payment < 0) {
            t.error = true;
            return { row: t, errors: ['Invalid amount in actual collection. Please input numeric only.'], warnings: [] };
        }

        t.error = false; t.dcmc = false; t.mpdc = false;

        if (t.prevData) {
            const p = t.prevData;
            t.loanBalance = p.loanBalance;
            t.total = p.total;
            t.noOfPayments = p.noOfPayments;
            t.amountRelease = p.amountRelease;
            t.excess = p.excess;
            t.fullPayment = 0;
            t.activeLoan = p.activeLoan;
            t.targetCollection = t.activeLoan;
            t.remarks = '';
            t.pastDue = p.pastDue;
            t.status = 'active';
            t.advanceDays = p.advanceDays;
            if (isDaily) {
                t.mcbu = p.mcbu;
                t.mcbuWithdrawal = 0;
            } else if (!t.hasMcbuWithdrawal) {
                t.mcbuWithdrawal = 0;
            }
            t.mcbuReturnAmt = 0;
            delete t.excused;
            delete t.delinquent;
        } else {
            t.prevData = snapshotPrev(t);
        }

        if (Math.trunc(payment) !== 0) {
            if (payment > t.loanBalance) {
                errors.push('Actual collection is greater than the loan balance.');
                t.error = true;
                t.paymentCollection = 0;
            } else if (payment === t.activeLoan
                || (payment > t.activeLoan && payment % t.activeLoan === 0)
                || payment === t.loanBalance
                || (payment > 0 && payment < t.activeLoan)) {
                t._dirty = true;
                t.error = false;

                t.paymentCollection = payment;
                const prevLoanBalance = t.loanBalance;
                t.loanBalance = t.loanBalance - payment;
                t.total = t.total + payment;
                t.excess = 0;

                if (payment > t.activeLoan) {
                    t.mcbu = safeNumber(t.prevData.mcbu);
                    t.excess = payment - t.activeLoan;
                    t.mispayment = false;
                    const noPayments = parseInt(payment) / parseInt(t.activeLoan);
                    t.noOfPayments = t.noOfPayments + noPayments;
                    t.mcbuCol = getMinMcbu(t, noPayments);
                    t.mcbu = t.mcbu ? parseFloat(t.mcbu) + t.mcbuCol : 0 + t.mcbuCol;
                    t.mcbuError = false;
                } else if (payment < t.activeLoan) {
                    t.excess = 0;
                    t.mispayment = true;
                    t.error = true;       // cleared by a remark (past due, delinquent, excused, collection-*)
                } else {
                    t.mcbu = safeNumber(t.prevData.mcbu);
                    t.mcbuCol = getMinMcbu(t, 1);
                    t.mcbu = t.mcbu ? parseFloat(t.mcbu) + t.mcbuCol : 0 + t.mcbuCol;
                    t.mcbuError = false;
                    t.mispayment = false;
                    t.noOfPayments = t.noOfPayments + 1;
                }

                setHistory(t, prevLoanBalance);

                if (t.loanBalance <= 0) {
                    t.fullPayment = t.amountRelease;
                    t.amountRelease = 0;
                }

                const minMcbuCol = getMinMcbu(t, payment / t.activeLoan);
                if (!t.mcbuCol || t.mcbuCol < minMcbuCol) {
                    t.mcbuError = true;
                }
            } else if (payment % t.activeLoan !== 0) {
                t.paymentCollection = payment;
                t.error = true;           // cleared by a collection-* / past due / delinquent / excused remark
                const rv = t.remarks?.value;
                if (rv === 'past due' || rv?.startsWith('excused-') || rv?.startsWith('delinquent') || rv?.startsWith('collection-')) {
                    t.error = false;
                }
            }
        } else {
            t.paymentCollection = 0;
            t.mcbuCol = 0;
            t.mispayment = false;
            t.remarks = '';
        }

        t._dirty = true;
        return { row: t, errors, warnings: [] };
    }

    // ------------------------------------------------------------------------------------------
    // type 'mcbuCol' (+ onBlur validation)
    // ------------------------------------------------------------------------------------------
    function applyMcbuCol(row, rawValue) {
        const errors = [];
        const warnings = [];
        const t = clone(row);
        const mcbuCol = rawValue === '' || rawValue === null || rawValue === undefined ? 0 : (parseFloat(rawValue) || 0);

        if (t.prevData == null) t.prevData = snapshotPrev(t);
        t.mcbu = t.prevData.mcbu;

        if (mcbuCol >= 0) {
            if (t.dcmc || t.mpdc) {
                if (t.prevData?.activeLoan > 0 && t.prevData.activeLoan == mcbuCol) {
                    errors.push('MCBU Collection should not be equal to the target collection. Use the normal transaction.');
                    t.mcbuError = true;
                    t.mcbuCol = mcbuCol;
                } else {
                    t.mcbuCol = mcbuCol;
                    t.mcbu += mcbuCol;
                    t.prevData = { ...t.prevData, mcbuCol, csfCollection: 0 };
                }
            } else {
                const minMcbuCol = getMinMcbu(t, t.paymentCollection / t.activeLoan, t.remarks);
                if (mcbuCol > 0 && mcbuCol < minMcbuCol) {
                    t.mcbuError = true;
                    t.mcbuCol = mcbuCol;
                } else {
                    t.mcbuError = false;
                    t.mcbuCol = mcbuCol;
                    t.mcbu += mcbuCol;
                    t.prevData = { ...t.prevData, mcbuCol };
                }
            }
            t._dirty = true;
        } else {
            t.mcbuCol = 0;
        }

        // handlePaymentValidation(..., 'mcbuCol') runs on blur
        const minOnBlur = getMinMcbu(t, t.paymentCollection / t.activeLoan, t.remarks);
        if (!mcbuCol || (mcbuCol < minOnBlur && Number.isInteger(minOnBlur))) {
            warnings.push(`Minimum MCBU collection is ${minOnBlur}.`);
            t.mcbuError = true;
        } else if (mcbuCol > 5 && mcbuCol % 5 !== 0) {
            warnings.push('MCBU collection must be divisible by 5.');
            t.mcbuError = true;
        } else {
            t.mcbuError = false;
        }

        return { row: t, errors, warnings };
    }

    // ------------------------------------------------------------------------------------------
    // type 'csfCol' (+ onBlur validation)
    // ------------------------------------------------------------------------------------------
    function applyCsfCol(row, rawValue) {
        const warnings = [];
        const t = clone(row);
        const csfCol = rawValue === '' || rawValue === null || rawValue === undefined ? 0 : (parseFloat(rawValue) || 0);

        if (t.prevData == null) t.prevData = snapshotPrev(t);
        t.csf = safeNumber(t.prevData.csf);

        if (csfCol >= 0) {
            if (csfCol > 0 && csfCol < minCsfCollection) {
                t.csfError = true;
                t.csfCollection = csfCol;
            } else {
                t.csfError = false;
                t.csfCollection = csfCol;
                t.csf += csfCol;
                t.prevData = { ...t.prevData, csfCollection: csfCol };
            }
            t._dirty = true;
        } else {
            t.csfCollection = 0;
        }

        if (!csfCol || csfCol < minCsfCollection) {
            warnings.push(`Minimum CSF collection is ${minCsfCollection}.`);
            t.csfError = true;
        } else if (csfCol > 5 && csfCol % 5 !== 0) {
            warnings.push('CSF collection must be divisible by 5.');
            t.csfError = true;
        } else {
            t.csfError = false;
        }

        return { row: t, errors: [], warnings };
    }

    // ------------------------------------------------------------------------------------------
    // type 'remarks'
    // ------------------------------------------------------------------------------------------
    function applyRemarks(row, remarks) {
        const errors = [];
        const warnings = [];
        const effects = {};
        let t = clone(row);
        const v = remarks?.value;
        const prevV = t.remarks?.value;                  // the remark BEFORE this change

        const fail = (msg) => { errors.push(msg); return { row: t, errors, warnings, effects }; };

        if (UPLOAD_BLOCKED_REMARKS.includes(v)) return fail('This remark must be processed online.');
        if (t.status !== 'active') return fail('Only active rows can be uploaded.');

        // pre-check shared by reloaner / double payment / advance payment
        let mcbuErrorData = false;
        if (v && MCBU_CHECK_REMARKS.includes(v)) {
            const activeLoan = t.activeLoan > 0 ? t.activeLoan : t.history?.activeLoan;
            const expectedMcbu = getMinMcbu(t, t.paymentCollection / activeLoan, remarks);
            if (!t.mcbuCol) {
                t.mcbuError = true;
                errors.push('No MCBU Collection detected.');
                mcbuErrorData = true;
            } else if (t.mcbuCol < expectedMcbu) {
                t.mcbuError = true;
                errors.push(`MCBU Collection is below the expected amount of ${expectedMcbu}.`);
                mcbuErrorData = true;
            } else {
                t.mcbuError = false;
            }
        }

        // the page's toast-only branches: nothing else changes on the row
        if (t.loanBalance > 0 && t.remarks && prevV !== 'matured-past due'
            && v && (v.startsWith('offset') || v.startsWith('reloaner')) && t.mcbu < t.loanBalance) {
            return fail('Invalid remarks. Should only choose a reloaner/offset remarks.');
        }
        if (!isDaily && t.hasMcbuWithdrawal && v?.startsWith('offset')) {
            return fail(`Invalid remarks. Slot No ${t.slotNo} has MCBU withdrawal transaction. Should only choose a reloaner remarks.`);
        }
        if (mcbuErrorData) return { row: t, errors, warnings, effects };

        // ---- always reset these fields -----------------------------------------------------
        t.error = false; t.dcmc = false; t.mpdc = false;
        if (t.prevData != null) {
            t.targetCollection = t.prevData.activeLoan;
            t.activeLoan = t.prevData.activeLoan;
            t.pastDue = t.prevData.pastDue;
            t.advanceDays = t.prevData.advanceDays;
        } else {
            t.prevData = snapshotPrev(t);
        }

        t.mcbuReturnAmt = 0;
        t.csfReturnAmt = 0;
        if (isDaily) t.allowMcbuCollection = false;
        else { t.maturedPD = false; t.maturedPastDue = 0; }

        t.csfIn = calculateCsfIn(1);
        if (!t.hasMcbuWithdrawal) t.mcbuWithdrawal = 0;
        if (!t.hasCsfWithdrawal) t.csfWithdrawal = 0;

        t.targetCollection = t.activeLoan;
        t.excused = false;
        t.delinquent = false;
        if (isDaily) { t.maturedPD = false; t.maturedPastDue = 0; }

        // ---- OFFSET -----------------------------------------------------------------------
        if (v && v.startsWith('offset')) {
            if (parseFloat(t.loanBalance) !== 0 && !t.maturedPD && t.mcbu < t.loanBalance && (t.remarks && prevV !== 'matured-past due')) {
                t.error = true;
                errors.push('Please enter the full balance before closing the loan account.');
            } else {
                t.error = false;
                effects.needsCloseRemarks = true;

                if (t.history && (t.history.remarks?.value?.startsWith('offset') || t.history.remarks?.value?.startsWith('reloaner'))) {
                    t.mcbu = t.prevData.mcbu;
                    t.csf = t.prevData.csf;
                }
                if (t.mcbu !== t.prevData.mcbu && t.mcbuCol && t.mcbuCol > 0) t.mcbu = t.mcbu - t.mcbuCol;
                if (t.csf !== t.prevData.csf && t.csfCollection && t.csfCollection > 0) t.csf = t.csf - t.csfCollection;

                t.mcbuCol = 0;
                t.csfCollection = 0;
                t.pastDue = 0;

                t.mcbuReturnAmt = parseFloat(t.mcbu);
                t.csfReturnAmt = t.csf;
                t.mcbuReturnAmt += t.csf;       // same as the page: the return amount is MCBU + CSF

                t.mcbu = 0; t.mcbuError = false;
                t.csf = 0;  t.csfError = false;

                if (t.loanBalance === 0 && t.paymentCollection === 0) t.fullPayment = t.history?.amountRelease;

                t = removeCsfIn(t);
            }
            t.mispayment = false;

        // ---- PAST DUE ---------------------------------------------------------------------
        } else if (v === 'past due') {
            t.pastDue = t.pastDue !== '-' ? t.pastDue + t.activeLoan : t.activeLoan;
            t.mispayment = false;
            t.error = false;
            t.excused = true;
            t.mcbuError = false;
            if (t.mcbuCol && t.mcbuCol > 0) t.mcbu = t.mcbu - t.mcbuCol;
            if (safeNumber(t.csfCollection) > 0) t.csf = t.csf - t.csfCollection;
            t.mcbuCol = 0;
            t.csfCollection = 0;
            t = removeCsfIn(t);

        // ---- DELINQUENT / EXCUSED -----------------------------------------------------------
        } else if (v && (v.startsWith('delinquent') || v.startsWith('excused-'))) {
            t.error = false;
            t.mcbuError = false;

            if (!isDaily) {
                if (t.mcbuCol && t.mcbuCol > 0) t.mcbu = t.mcbu - t.mcbuCol;
                t.mcbuCol = 0;
            }

            if (v.startsWith('delinquent')) {
                if (t.mcbu >= t.loanBalance) {
                    errors.push('Invalid remarks. MCBU is greater than the loan balance. Please contact admin for assistance.');
                    t.error = true;
                } else {
                    t.delinquent = true;
                }
            }
            if (v.startsWith('excused-')) t.excused = true;

            if (v === 'delinquent-offset') {
                if (t.paymentCollection > 0 && t.paymentCollection == t.activeLoan) {
                    t = removeCsfIn(t);
                } else {
                    t.error = true;
                    errors.push('Invalid remarks. Delinquent for Offset must be equal to the target collection.');
                }
            }

            if (v === 'delinquent-mcbu') {
                if (t.mcbu >= t.loanBalance) {
                    errors.push('Invalid remarks. MCBU is greater than the loan balance. Please contact admin for assistance.');
                    t.error = true;
                } else {
                    t.dcmc = true;
                    if (t.paymentCollection > 0) t.loanBalance = t.loanBalance + t.paymentCollection;
                    t.mispayment = true;
                    t.activeLoan = 0;
                    t.targetCollection = 0;
                    if (t.mcbuCol > 0) {
                        t.mcbu = t.mcbu > 0 ? t.mcbu - t.mcbuCol : 0;
                        t.mcbuCol = 0;
                        t.noOfPayments = t.noOfPayments - 1;
                    }
                    t.paymentCollection = 0;
                    warnings.push("Don't forget the collection amount in MCBU Collection.");
                    if (isDaily) t.allowMcbuCollection = true;
                    t = removeCsfIn(t);
                }
            } else {
                if (v === 'delinquent-offset') {
                    t.mispayment = false;
                } else if (t.paymentCollection > t.activeLoan) {
                    t.error = true;
                    errors.push('Remarks is not valid due to the amount in Actual Collection.');
                } else {
                    // daily and weekly both test the NEW remark (the weekly page used to test the previous one
                    // and was fixed to match daily)
                    if (v === 'delinquent') {
                        if (t.paymentCollection > 0) {
                            t.loanBalance += t.paymentCollection;
                            t.noOfPayments = t.prevData?.noOfPayments;
                        }
                        t.paymentCollection = 0;
                    }
                    t.targetCollection = 0;
                    t.activeLoan = 0;
                    t.mispayment = true;
                }

                if (!t.error) {
                    if (t.mcbuCol && t.mcbuCol > 0) t.mcbu = t.mcbu - t.mcbuCol;
                    if (safeNumber(t.csfCollection) > 0) t.csf = t.csf - t.csfCollection;
                    t.mcbuCol = 0;
                    t.csfCollection = 0;
                    t = removeCsfIn(t);
                }
            }

        // ---- PAST DUE COLLECTION ------------------------------------------------------------
        } else if (v === 'past due collection') {
            if (t.pastDue > 0 && t.paymentCollection > t.activeLoan && !t.maturedPD
                && (t.paymentCollection > t.activeLoan && t.paymentCollection % t.activeLoan === 0)) {
                const pastDueCol = t.paymentCollection - t.activeLoan;
                if (pastDueCol > t.pastDue) {
                    t.excess = pastDueCol - t.pastDue;
                    t.pastDue = 0;
                } else {
                    t.pastDue = t.pastDue > 0 ? t.pastDue - pastDueCol : 0;
                    t.excess = 0;
                }
                t.error = false;
                t.mcbuError = false;
                t = removeCsfIn(t);
            } else {
                t.error = true;
                errors.push('Invalid remarks.');
            }

        // ---- DOUBLE PAYMENT -----------------------------------------------------------------
        } else if (v === 'double payment') {
            if (t.activeLoan * 2 != t.paymentCollection || t.paymentCollection == 0) {
                t.error = true;
                errors.push('Invalid remarks. Payment is not double to be considered as double payment.');
            }
            if (t.loanBalance <= 0) {
                t.error = true;
                errors.push('Invalid remarks. Please mark it as Reloaner or Offset.');
            }
            t.csfIn = calculateCsfIn(2);

        // ---- ADVANCE PAYMENT ----------------------------------------------------------------
        } else if (v === 'advance payment') {
            if (t.excess > 0) {
                const advanceDays = parseFloat(t.paymentCollection) / parseFloat(t.activeLoan);
                t.advanceDays = t.advanceDays ? t.advanceDays + (advanceDays - 1) : advanceDays - 1;
                t.error = false;
                t.csfIn = calculateCsfIn(advanceDays);
            } else {
                t.error = true;
                errors.push("Invalid remarks. There's no excess amount to be considered as advance payment.");
            }
            if (t.loanBalance <= 0) {
                t.error = true;
                errors.push('Invalid remarks. Please mark it as Reloaner or Offset.');
            }

        // ---- EXCUSED ADVANCE PAYMENT --------------------------------------------------------
        } else if (v === 'excused advance payment') {
            if (t.prevData != null) {
                t.targetCollection = t.prevData.activeLoan;
                t.advanceDays = t.prevData.advanceDays;
            } else {
                t.prevData = snapshotPrev(t);
            }

            if (t.advanceDays > 0) {
                t.history = { ...t.history, advanceDays: t.advanceDays };
                if (t.paymentCollection > 0) {
                    t.loanBalance += t.paymentCollection;
                    t.paymentCollection = 0;
                    if (t.mcbuCol > 0) {
                        t.mcbu -= t.mcbuCol;
                        t.noOfPayments -= 1;
                        t.mcbuCol = 0;
                    }
                }
                t.disableMcbuCol = true;
                t.disableCsfCol = true;
                t.advanceDays = t.advanceDays - 1;
                t.targetCollection = 0;
                t.activeLoan = 0;
                t.paymentCollection = 0;
                t.mispayment = false;
                t.error = false;
                t.mcbuError = false;
                t.csfError = false;
                t = removeCsfIn(t);
            } else {
                t.error = true;
                errors.push('Yesterday transaction is not an Advanced payment.');
            }

        // ---- COLLECTION-* (overstated / understated) ----------------------------------------
        } else if (v && v.startsWith('collection-')) {
            t.error = false;
            const payment = t.paymentCollection;
            const loanBalance = t.mispayment ? t.history?.loanBalance : t.loanBalance;
            const overUnder = loanBalance % t.activeLoan;

            if (overUnder > 0 && payment > 0) {
                const paymentOverUnder = payment % t.activeLoan;

                if (overUnder === paymentOverUnder || overUnder === payment) {
                    const newPayment = payment - overUnder;
                    const noOfPayments = newPayment / t.activeLoan;

                    if (newPayment > t.activeLoan) {
                        t.excess = newPayment - t.activeLoan;
                        t.noOfPayments = parseInt(t.noOfPayments) + noOfPayments;
                        const excessMcbu = t.excess / t.activeLoan;
                        t.mcbuCol = getMinMcbu(t, excessMcbu + 1, remarks);
                        t.mcbu = t.mcbu ? parseFloat(t.mcbu) + t.mcbuCol : 0 + t.mcbuCol;
                    } else if (payment < t.activeLoan) {
                        t.excess = 0;
                        t.mcbuCol = 0;
                        t.noOfPayments = parseInt(t.noOfPayments);
                    } else {
                        t.noOfPayments = parseInt(t.noOfPayments) + 1;
                        t.mcbuCol = getMinMcbu(t, 1, remarks);
                        t.mcbu = t.mcbu ? parseFloat(t.mcbu) + t.mcbuCol : 0 + t.mcbuCol;
                    }

                    t.mispayment = false;
                    if (overUnder !== payment) t.loanBalance -= payment;

                    setHistory(t);

                    if (t.loanBalance <= 0) {
                        t.fullPayment = t.amountRelease;
                        t.amountRelease = 0;
                    }
                } else if (overUnder > paymentOverUnder) {
                    t.error = true;
                    errors.push('Invalid remarks. Wrong Overstated/Understated amount added in payment collection.');
                } else {
                    t.error = true;
                    errors.push('Invalid remarks. No Overstated/Understated added in payment collection.');
                }
            } else {
                t.error = true;
                errors.push('Invalid remarks. No Overstated / Understated in loan balance.');
            }

        // ---- RELOANER / PENDING / anything else --------------------------------------------
        } else {
            if (v === RELOANER) {
                const prevWasReloanerOrOffset = !!t.remarks && (
                    prevV?.startsWith(isDaily ? 'reloaner-' : 'reloaner') || prevV?.startsWith('offset')
                );
                if (prevWasReloanerOrOffset && !t.hasMcbuWithdrawal && !t.hasCsfWithdrawal) {
                    t.mcbu = t.prevData?.mcbu ? t.prevData.mcbu : 0;
                }

                t.mcbu = t.mcbu - safeNumber(t.mcbuCol);
                t.mcbuCol = 0;

                const activeLoan = t.activeLoan > 0 ? t.activeLoan : (t.history?.activeLoan || 0);
                if (t.paymentCollection > 0 && activeLoan > 0) {
                    t.mcbuCol = getMinMcbu(t, t.paymentCollection / activeLoan, remarks);
                }
                if (t.mcbuCol > 0) {
                    const currentMcbu = t.mcbu ? parseFloat(t.mcbu) : 0;
                    t.mcbu = currentMcbu + t.mcbuCol;
                }
                if (t.prevData) t.prevData = { ...t.prevData, mcbuCol: t.mcbuCol };
            }

            t.closeRemarks = '';
            t.error = false;
            t.mcbuError = false;
            t.csfError = false;
            t.mispayment = false;
        }

        if (!t.error) {
            t.remarks = remarks;
            t._dirty = true;
            t.mcbuHistory = { mcbu: t.mcbu, mcbuCol: t.mcbuCol };
            if (t.history != null) t.history = { ...t.history, remarks };
            else setHistory(t);
        }

        return { row: t, errors, warnings, effects };
    }

    // ------------------------------------------------------------------------------------------
    // one template row -> the finished row, in the order a person would fill it in
    //   input: { paymentCollection, mcbuCol?, csfCollection?, remarks?, closeRemarks? }
    // ------------------------------------------------------------------------------------------
    function applyUploadRow(row, input) {
        const errors = [];
        const warnings = [];
        const effects = {};
        let cur = clone(row);

        const take = (r) => {
            cur = r.row;
            errors.push(...(r.errors || []));
            warnings.push(...(r.warnings || []));
            Object.assign(effects, r.effects || {});
        };
        const has = (x) => x !== undefined && x !== null && x !== '';

        take(applyPayment(cur, input.paymentCollection));

        // daily: MCBU is not typed on the page, the minimum is added automatically
        if (!isDaily && has(input.mcbuCol)) take(applyMcbuCol(cur, input.mcbuCol));

        if (safeNumber(input.csfCollection) > 0) {
            if (!ctx.isCsfCollectionAllowed?.(cur)) {
                errors.push('CSF collection is not allowed for this client.');
            } else {
                take(applyCsfCol(cur, input.csfCollection));
            }
        }

        const rv = input.remarks?.value;
        if (rv) take(applyRemarks(cur, input.remarks));

        // delinquent-mcbu / matured collection clear the MCBU on the remark; the amount is typed afterwards
        if ((cur.dcmc || cur.mpdc) && has(input.mcbuCol)) take(applyMcbuCol(cur, input.mcbuCol));

        if (rv?.startsWith('offset')) {
            if (safeNumber(cur.loanBalance) !== 0) {
                errors.push('Offset needs the full balance to be paid in Actual Collection.');
            }
            if (typeof input.closeRemarks !== 'string' || input.closeRemarks.trim().length < 3) {
                errors.push('Offset needs close-account remarks.');
            } else {
                cur.closeRemarks = input.closeRemarks.trim();
                cur.disableMcbuCol = true;
                cur.disableCsfCol = true;
            }
        }

        if (cur.mcbuError) warnings.push('MCBU Collection needs a check before the collection can be submitted.');
        if (cur.csfError) warnings.push('CSF Collection needs a check before the collection can be submitted.');

        if (cur.error && errors.length === 0) {
            errors.push('The amount does not match the target collection. Use the target (or a multiple of it), or choose a remark: past due, delinquent, excused or collection-*.');
        }

        return { ok: errors.length === 0 && !cur.error, row: cur, errors, warnings, effects };
    }

    return { applyPayment, applyMcbuCol, applyCsfCol, applyRemarks, applyUploadRow };
}