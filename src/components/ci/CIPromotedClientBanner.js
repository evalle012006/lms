// src/components/ci/CIPromotedClientBanner.js
// FIX: Accept loanHistory as prop from ci-investigation/index.js (already fetched there)
// — eliminates duplicate loan-history API call
// — fixes stuck "Loading..." button (banner was re-fetching but parent already had data)

import React, { useMemo } from 'react';
import { useRouter } from 'next/router';
import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react';

const CIPromotedClientBanner = ({ application, investigation, currentUser, loanHistory }) => {
    const router = useRouter();

    const clientId         = application?.existingClientId || application?.promotedClientId;
    const isExistingClient = !!(application?.existingClientId);

    // Derive slot/cycle from the loanHistory prop (already fetched by parent page)
    // loanHistory = array of loan objects for existingClientId, or null for new prospects
    const { existingSlotNo, existingLoanCycle, hasPendingLoan, groupNotAvailable } = useMemo(() => {
        if (!loanHistory) {
            return { existingSlotNo: null, existingLoanCycle: null, hasPendingLoan: false };
        }

        const pending = loanHistory.some(l => l.status === 'pending');

        const latestLoan = [...loanHistory]
            .filter(l => l.status !== 'pending')
            .sort((a, b) =>
                new Date(b.insertedDateTime || b.dateAdded || 0) -
                new Date(a.insertedDateTime || a.dateAdded || 0)
            )[0];

        return {
            existingSlotNo:    latestLoan?.slotNo    ? String(latestLoan.slotNo)                    : null,
            existingLoanCycle: latestLoan?.loanCycle ? String((latestLoan.loanCycle || 0) + 1)      : null,
            hasPendingLoan:    pending,
            groupNotAvailable: application?.groupStatus !== 'available',
        };
    }, [loanHistory, application.groupStatus]);

    // For new prospects: loanHistory null means still loading (parent hasn't fetched yet)
    // For existing clients: loanHistory is always fetched by loadApplication in parent
    // Loading while parent fetches loan-history (null = not yet received)
    const isLoading = loanHistory === null;

    const handleAddLoan = () => {
        if (!clientId) return;
        if (groupNotAvailable) return;

        const q = new URLSearchParams();

        q.set('clientId', clientId);
        if (application?.groupId)    q.set('groupId',    application.groupId);
        if (application?.loId)       q.set('loId',       application.loId);
        if (application?.clientType) q.set('clientType', application.clientType);
        if (application?.groupName)  q.set('groupName',  application.groupName);

        // slotNo + loanCycle — derived from loanHistory prop, no extra fetch needed
        if (existingSlotNo)    q.set('slotNo',    existingSlotNo);
        if (existingLoanCycle) q.set('loanCycle', existingLoanCycle);

        // CI Name from investigation record
        const ciName = investigation?.picUserName || '';
        if (ciName) q.set('ciName', ciName);

        // Client identity
        if (application?.firstName)   q.set('firstName',   application.firstName);
        if (application?.lastName)    q.set('lastName',    application.lastName);
        if (application?.middleName)  q.set('middleName',  application.middleName);
        if (application?.birthdate)   q.set('birthdate',   application.birthdate);
        if (application?.lafPhotoUrl) q.set('photoUrl',    encodeURIComponent(application.lafPhotoUrl));

        // Contact: prefer contactNumber, fall back to clientChanges
        const contact = application?.contactNumber
            || application?.clientChanges?.contactNumber
            || '';
        if (contact) q.set('contactNumber', contact);
        if (application?.address) q.set('address', application.address);

        // Guarantor from LAF
        if (application?.guarantorFirstName)     q.set('gFN',      application.guarantorFirstName);
        if (application?.guarantorLastName)      q.set('gLN',      application.guarantorLastName);
        if (application?.guarantorRelationship)  q.set('gRel',     application.guarantorRelationship);
        if (application?.guarantorContactNumber) q.set('gContact', application.guarantorContactNumber);
        if (application?.guarantorBirthDate)     q.set('gBD',      application.guarantorBirthDate);
        if (application?.guarantorCivilStatus)   q.set('gCS',      application.guarantorCivilStatus);
        if (application?.guarantorBusiness)      q.set('gBiz',     application.guarantorBusiness);
        if (application?.guarantorDailyIncome)   q.set('gDI',      application.guarantorDailyIncome);
        if (application?.guarantorAddress)       q.set('gAddr',    application.guarantorAddress);

        router.push(`/transactions/loan-applications/add?${q.toString()}`);
    };

    // Message text — clearer for existing vs new clients
    const statusMessage = isExistingClient
        ? 'Client record updated from LAF application.'
        : 'New client record has been created.';

    // Button state
    const buttonReady = !hasPendingLoan && !isLoading && !groupNotAvailable;

    return (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-green-900">✓ Promoted to Client</p>
                    <p className="text-xs text-green-700 mt-0.5">{statusMessage}</p>

                    {hasPendingLoan ? (
                        <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-xs font-semibold text-amber-800">
                                Loan application already exists
                            </p>
                            <p className="text-xs text-amber-700 mt-0.5">
                                This client already has a pending loan application.
                                Go to Loan Applications to view or approve it.
                            </p>
                        </div>
                    ) : groupNotAvailable ? (
                        <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-xs font-semibold text-amber-800">
                                Group not available for loan application
                            </p>
                            <p className="text-xs text-amber-700 mt-0.5">
                                This client is part of a group that is not available for loan applications.
                                Please check the group status before proceeding.
                            </p>
                        </div>
                    ) : isLoading ? (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-green-600">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Checking loan status...
                        </div>
                    ) : (
                        currentUser?.role?.rep <= 3 && clientId && (
                            <button
                                type="button"
                                onClick={handleAddLoan}
                                disabled={!buttonReady}
                                className="mt-3 flex items-center gap-1.5 px-4 py-2
                                    bg-green-600 text-white text-xs font-semibold
                                    rounded-lg hover:bg-green-700 transition-colors
                                    disabled:opacity-60 disabled:cursor-wait">
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        Add Loan Application
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </>
                                )}
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default CIPromotedClientBanner;