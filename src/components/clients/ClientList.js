// src/components/clients/ClientList.js
import React, { useState, useEffect } from 'react';
import ClientRowCard from './ClientRowCard';
import ClientRowDense, { GRID_TEMPLATE } from './ClientRowDense';
import Spinner from '@/components/Spinner';
import { useBulkSignedUrls } from '@/hooks/useBulkSignedUrls';

const DESKTOP_BREAKPOINT = 768;

function useIsDesktop() {
    const [isDesktop, setIsDesktop] = useState(
        typeof window !== 'undefined' ? window.innerWidth >= DESKTOP_BREAKPOINT : true
    );
    useEffect(() => {
        const onResize = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return isDesktop;
}

function DenseHeader({ variant }) {
    const isProspect = variant === 'prospect';
    const cols = isProspect
        ? ['', 'Name', 'Address', 'Group', 'Loan Officer', 'Delinquent', 'Status', 'CI Name', 'Group Leader', 'Actions']
        : ['', 'Name', 'Address', 'Group', 'Loan Officer', 'Slot No.', 'Loan Status', 'Active Loan', 'Loan Balance', 'Delinquent', 'Status', 'CI Name', 'Group Leader', 'Actions'];
    return (
        <div
            className="grid items-center gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide"
            style={{ gridTemplateColumns: GRID_TEMPLATE[isProspect ? 'prospect' : 'loan'] }}
        >
            {cols.map((label, i) => <div key={i}>{label}</div>)}
        </div>
    );
}

function getPageNumbers(current, total, delta = 1) {
    const pages = [];
    const range = [];
    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
        range.push(i);
    }
    pages.push(1);
    if (range[0] > 2) pages.push('…');
    pages.push(...range);
    if (range[range.length - 1] < total - 1) pages.push('…');
    if (total > 1) pages.push(total);
    return pages;
}

export default function ClientList({
    clients, loading, error, pagination, page, goToPage, onClientClick, rowVariant = 'loan',
    currentUser, onQuickEdit, onQrGenerated,
    removeClient, patchClient,
}) {
    const isDesktop = useIsDesktop();
    const photoKeys = clients.map(c => c.profile).filter(Boolean);
    const { urlMap } = useBulkSignedUrls(photoKeys);

    if (loading && clients.length === 0) {
        return <div className="flex justify-center py-16"><Spinner /></div>;
    }
    if (error) {
        return <div className="text-center py-16 text-sm text-red-500">{error}</div>;
    }
    if (!loading && clients.length === 0) {
        return <div className="text-center py-16 text-sm text-gray-400">No clients found.</div>;
    }

    const handleDeleted = (clientId) => removeClient(clientId);
    const handleExcluded = (clientId) => removeClient(clientId);

    return (
        <div>
            {isDesktop ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto" style={{ minHeight: clients.length < 4 ? '220px' : undefined }}>
                    <div className="min-w-max">
                        <DenseHeader variant={rowVariant} />
                        {clients.map(c => (
                            <ClientRowDense key={c._id} client={c} onClick={onClientClick} variant={rowVariant}
                                photoUrl={c.profile ? urlMap[c.profile] : null}
                                currentUser={currentUser}
                                onDeleted={handleDeleted} onExcluded={handleExcluded}
                                onQuickEdit={onQuickEdit} 
                                onQrGenerated={onQrGenerated}
                            />
                        ))}
                    </div>
                </div>
            ) : (
                <div>
                    {clients.map(c => (
                        <ClientRowCard key={c._id} client={c} onClick={onClientClick} variant={rowVariant}
                            photoUrl={c.profile ? urlMap[c.profile] : null}
                            currentUser={currentUser}
                            onDeleted={handleDeleted} onExcluded={handleExcluded}
                            onQuickEdit={onQuickEdit} 
                            onQrGenerated={onQrGenerated}
                        />
                    ))}
                </div>
            )}

            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-1">
                    <p className="text-sm text-gray-500">
                        Page <span className="font-semibold text-gray-900">{pagination.page}</span> of{' '}
                        <span className="font-semibold text-gray-900">{pagination.totalPages}</span>
                        {' · '}{pagination.total} clients
                    </p>
                    <div className="flex items-center gap-1">
                        <button type="button" onClick={() => goToPage(page - 1)} disabled={!pagination.hasPrev}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white">
                            Previous
                        </button>
                        {getPageNumbers(pagination.page, pagination.totalPages).map((p, i) =>
                            p === '…' ? (
                                <span key={`ellipsis-${i}`} className="px-2 text-gray-400">…</span>
                            ) : (
                                <button key={p} type="button" onClick={() => goToPage(p)}
                                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${p === pagination.page ? 'bg-teal-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
                                    {p}
                                </button>
                            )
                        )}
                        <button type="button" onClick={() => goToPage(page + 1)} disabled={!pagination.hasNext}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white">
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}