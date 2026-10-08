// src/hooks/useLoanApplicationView.js
// Which version of the Loan Approval page a user sees: 'classic' or 'v2'.
//
//   - Users who cannot open the new page (isEligibleForLoanApplicationV2) always
//     get classic and no switch button.
//   - Everyone else gets what they last chose, remembered per user in this
//     browser (a shared branch PC does not leak one person's choice to the next).
//   - Before they have chosen: LOAN_APPLICATION_DEFAULT_VIEW. Flipping that one
//     constant to 'v2' is the cutover.
//
// `ready` stays false until the user is loaded and the choice has been read from
// the browser, so the page never flashes the wrong version first.

import { useCallback, useEffect, useState } from 'react';
import {
    isEligibleForLoanApplicationV2,
    LOAN_APPLICATION_DEFAULT_VIEW,
} from '@/lib/loan-application-v2-gate';

const VIEWS = ['classic', 'v2'];
const storageKey = (userId) => `lms.loanApplicationView.${userId}`;

export function readStoredLoanApplicationView(userId) {
    try {
        const value = window.localStorage.getItem(storageKey(userId));
        return VIEWS.includes(value) ? value : null;
    } catch (e) {
        return null; // storage blocked: fall back to the default
    }
}

export function storeLoanApplicationView(userId, view) {
    try {
        window.localStorage.setItem(storageKey(userId), view);
    } catch (e) {
        // not remembered, still works for this visit
    }
}

export function useLoanApplicationView(currentUser) {
    const userId = currentUser?._id;
    const eligible = isEligibleForLoanApplicationV2(currentUser);
    const [view, setViewState] = useState(null); // null = not decided yet

    useEffect(() => {
        if (!userId) return;
        if (!eligible) {
            setViewState('classic');
            return;
        }
        setViewState(readStoredLoanApplicationView(userId) ?? LOAN_APPLICATION_DEFAULT_VIEW);
    }, [userId, eligible]);

    const setView = useCallback((next) => {
        if (!VIEWS.includes(next) || !userId) return;
        storeLoanApplicationView(userId, next);
        setViewState(next);
    }, [userId]);

    return { view, setView, ready: view !== null, canSwitch: eligible };
}