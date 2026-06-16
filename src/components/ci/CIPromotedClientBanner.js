// src/components/ci/CIPromotedClientBanner.js
import React from 'react';
import { useRouter } from 'next/router';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';

const CIPromotedClientBanner = ({ application, currentUser }) => {
    const [loanState, setLoanState] = React.useState(null);
    const [loanId,    setLoanId]    = React.useState(null);
    const router = useRouter();

    React.useEffect(() => {
        if (!application?.promotedClientId) return;
        fetchWrapper.get(
            getApiBaseUrl() + `clients/loan-history?clientId=${application.promotedClientId}`
        ).then(res => {
            const latest = res.loans?.[0] || null;
            setLoanState(latest ? latest.status : 'none');
            setLoanId(latest?._id || null);
        }).catch(() => setLoanState('none'));
    }, [application?.promotedClientId]);

    const handleAction = () => {
        if (loanId && (loanState === 'pending' || loanState === 'active')) {
            router.push(`/transactions/loan-applications/edit/${loanId}`);
        } else {
            const q = new URLSearchParams();
            if (application?.promotedClientId) q.set('clientId', application.promotedClientId);
            if (application?.groupId)          q.set('groupId',  application.groupId);
            if (application?.loId)             q.set('loId',     application.loId);
            q.set('clientType', loanState === 'completed' ? 'active' : 'pending');
            router.push(`/transactions/loan-applications/add?${q.toString()}`);
        }
    };

    const cfg = {
        none:      { color: 'blue',  label: 'Add Loan',         desc: 'Client promoted. No loan added yet.'  },
        pending:   { color: 'amber', label: 'View / Edit Loan', desc: 'Loan added, pending approval.'        },
        active:    { color: 'green', label: 'View Loan',        desc: 'Loan is active.'                      },
        completed: { color: 'gray',  label: 'View History',     desc: 'Last loan completed.'                 },
    }[loanState] ?? { color: 'blue', label: 'View Loans', desc: 'Client has been promoted.' };

    const cm = {
        blue:  { wrap: 'bg-blue-50 border-blue-200',   title: 'text-blue-800',  sub: 'text-blue-600',  btn: 'bg-blue-600 hover:bg-blue-700'   },
        amber: { wrap: 'bg-amber-50 border-amber-200', title: 'text-amber-800', sub: 'text-amber-600', btn: 'bg-amber-600 hover:bg-amber-700' },
        green: { wrap: 'bg-green-50 border-green-200', title: 'text-green-800', sub: 'text-green-600', btn: 'bg-green-600 hover:bg-green-700' },
        gray:  { wrap: 'bg-gray-50 border-gray-200',   title: 'text-gray-800',  sub: 'text-gray-600',  btn: 'bg-gray-600 hover:bg-gray-700'   },
    }[cfg.color];

    return (
        <div className={`p-4 border rounded-xl ${cm.wrap}`}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className={`text-sm font-semibold ${cm.title}`}>✓ Promoted to Client</p>
                    <p className={`text-xs mt-0.5 ${cm.sub}`}>
                        {loanState === null ? 'Checking loan status...' : cfg.desc}
                    </p>
                </div>
                {loanState !== null && (
                    <button type="button" onClick={handleAction}
                        className={`flex-shrink-0 px-3 py-1.5 text-white text-xs font-semibold
                            rounded-lg transition-colors ${cm.btn}`}>
                        {cfg.label}
                    </button>
                )}
            </div>
        </div>
    );
};

export default CIPromotedClientBanner;