// src/components/ci/CIPromotedClientBanner.js
// FIX: Pass groupName, loName, client identity, guarantor, and ciName in URL
// FIX: Existing clients skip loan-history check — show Add Loan immediately

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';

const CIPromotedClientBanner = ({ application, investigation, currentUser }) => {
    const router = useRouter();

    const clientId         = application?.existingClientId || application?.promotedClientId;
    const isExistingClient = !!(application?.existingClientId);

    const [loanStatus, setLoanStatus] = useState(isExistingClient ? 'no_loan' : null);

    useEffect(() => {
        if (isExistingClient || !clientId) return;
        fetchWrapper.get(getApiBaseUrl() + `clients/loan-history?clientId=${clientId}`)
            .then(res => {
                const pendingLoan = (res.loans || []).find(l => l.status === 'pending');
                setLoanStatus(pendingLoan ? 'has_loan' : 'no_loan');
            })
            .catch(() => setLoanStatus('no_loan'));
    }, [clientId, isExistingClient]);

    useEffect(() => {
        if (loanStatus !== null) return;
        const t = setTimeout(() => setLoanStatus(prev => prev ?? 'no_loan'), 5000);
        return () => clearTimeout(t);
    }, [loanStatus]);

    const handleAddLoan = () => {
        if (!clientId) return;
        const q = new URLSearchParams();

        q.set('clientId', clientId);
        if (application?.groupId)    q.set('groupId',    application.groupId);
        if (application?.loId)       q.set('loId',       application.loId);
        if (application?.clientType) q.set('clientType', application.clientType);
        if (application?.groupName)  q.set('groupName',  application.groupName);

        // CI Name — from investigation record (picUserName = investigator who approved)
        const ciName = investigation?.picUserName || '';
        if (ciName) q.set('ciName', ciName);

        // Client identity — lets AddLoanPage build selectedClientObj without list fetch
        if (application?.firstName)     q.set('firstName',     application.firstName);
        if (application?.lastName)      q.set('lastName',      application.lastName);
        if (application?.middleName)    q.set('middleName',    application.middleName);
        if (application?.contactNumber) q.set('contactNumber', application.contactNumber);
        if (application?.address)       q.set('address',       application.address);

        // Guarantor from LAF — authoritative; client record may have stale '.' placeholders
        if (application?.guarantorFirstName)    q.set('gFN',      application.guarantorFirstName);
        if (application?.guarantorLastName)     q.set('gLN',      application.guarantorLastName);
        if (application?.guarantorRelationship) q.set('gRel',     application.guarantorRelationship);
        if (application?.guarantorContactNumber) q.set('gContact', application.guarantorContactNumber);
        if (application?.guarantorBirthDate)    q.set('gBD',      application.guarantorBirthDate);
        if (application?.guarantorCivilStatus)  q.set('gCS',      application.guarantorCivilStatus);
        if (application?.guarantorBusiness)     q.set('gBiz',     application.guarantorBusiness);
        if (application?.guarantorDailyIncome)  q.set('gDI',      application.guarantorDailyIncome);

        router.push(`/transactions/loan-applications/add?${q.toString()}`);
    };

    const clientTypeLine = {
        reloan:   'Reloan client',
        pending:  'Pending Member',
        balik:    'Balik client',
        prospect: 'New client',
    }[application?.clientType] || 'Client';

    return (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-green-900">✓ Promoted to Client</p>
                    <p className="text-xs text-green-700 mt-0.5">
                        {clientTypeLine} — record has been created/updated.
                    </p>
                    {loanStatus === null ? (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-green-600">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Checking loan status...
                        </div>
                    ) : loanStatus === 'has_loan' ? (
                        <p className="text-xs text-green-600 mt-2">
                            A pending loan application exists for this client.
                        </p>
                    ) : (
                        currentUser?.role?.rep <= 3 && clientId && (
                            <button type="button" onClick={handleAddLoan}
                                className="mt-3 flex items-center gap-1.5 px-4 py-2
                                    bg-green-600 text-white text-xs font-semibold
                                    rounded-lg hover:bg-green-700 transition-colors">
                                Add Loan Application
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default CIPromotedClientBanner;