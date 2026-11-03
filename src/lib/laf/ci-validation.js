// src/lib/laf/ci-validation.js
// Server-side validation for CI investigation saves. Shared by
// api/v2/laf/ci/investigate.js (online) and api/v2/laf/ci/offline-sync.js
// (offline drafts) so the two routes can't drift apart.
//
// The client (CIReviewPanel) already enforces these rules for UX, but the
// server must not trust it: direct POSTs, stale bundles and old offline
// drafts all bypass the UI.

import { isBlank, trimText } from '@/lib/validation-utils';

// Returns an error message string, or null when the payload is valid.
// `ciQuestions` comes from settings.ciQuestions — the `required` flag is read
// from there, NOT from the client-supplied ciAnswers entries.
export function validateCIPayload(
    { decision, declineReason, businessVerified, addressVerified, ciAnswers },
    ciQuestions = []
) {
    if (decision !== 'approved' && decision !== 'declined') {
        return 'Invalid decision.';
    }
    if (!businessVerified || !addressVerified) {
        return 'Business and address verification are required.';
    }
    if (decision === 'declined' && isBlank(declineReason)) {
        return 'A decline reason is required.';
    }

    const answerByQuestionId = new Map(
        (Array.isArray(ciAnswers) ? ciAnswers : []).map(a => [a?.questionId, a?.answer])
    );
    const unanswered = (Array.isArray(ciQuestions) ? ciQuestions : [])
        .filter(q => q?.required && isBlank(answerByQuestionId.get(q.id)));

    if (unanswered.length > 0) {
        return `Required CI questions unanswered: ${unanswered.map(q => q.question).join('; ')}`;
    }
    return null;
}

// Trim every answer so "  ok " is stored as "ok" and optional blanks as ''.
export function normalizeCIAnswers(ciAnswers) {
    return (Array.isArray(ciAnswers) ? ciAnswers : []).map(a => ({
        ...a,
        answer: trimText(a?.answer),
    }));
}