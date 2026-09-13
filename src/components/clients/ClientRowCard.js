// src/components/clients/ClientRowCard.js
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import ClientAvatar from './ClientAvatar';
import ClientRowActions from './ClientRowActions';
import { statusPillClass } from './statusPillStyles';
import { formatPricePhp, UppercaseFirstLetter } from '@/lib/utils';

export default function ClientRowCard({
    client, onClick, variant = 'loan', photoUrl,
    currentUser, onDeleted, onExcluded, onQuickEdit, onQrGenerated,
}) {
    const [expanded, setExpanded] = useState(false);
    const isProspect = variant === 'prospect';
    const loan  = client.loans?.[0] ?? null;
    const group = client.group?.[0] ?? null;
    const lo    = client.lo?.[0] ?? null;
    const fullName = client.fullName
        || [client.lastName, client.firstName].filter(Boolean).join(', ')
        || 'Unknown';

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-2 overflow-hidden">
            <div className="w-full flex items-center gap-3 p-3">
                <button type="button" onClick={() => onClick?.(client)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <ClientAvatar name={fullName} src={photoUrl} size={40} />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{UppercaseFirstLetter(fullName)}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusPillClass(loan?.status || client.status)}`}>
                                {loan?.status || client.status}
                            </span>
                            {client.delinquent && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Delinquent</span>
                            )}
                            {isProspect && client.duplicate && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Duplicate</span>
                            )}
                        </div>
                    </div>
                    {isProspect ? (
                        <div className="text-right max-w-[100px]">
                            <p className="text-xs text-gray-400">CI Name</p>
                            <p className="text-sm font-medium text-gray-900 truncate">{client.ciName || '-'}</p>
                        </div>
                    ) : (
                        <div className="text-right">
                            <p className="text-xs text-gray-400">Balance</p>
                            <p className="text-sm font-semibold text-gray-900">{formatPricePhp(loan?.loanBalance || 0)}</p>
                        </div>
                    )}
                </button>

                <ClientRowActions
                    client={client}
                    currentUser={currentUser}
                    variant={variant}
                    onDeleted={onDeleted}
                    onExcluded={onExcluded}
                    onQuickEdit={onQuickEdit}
                    onQrGenerated={onQrGenerated}
                />

                <button type="button" onClick={() => setExpanded(v => !v)} className="p-1"
                    aria-label={expanded ? 'Collapse details' : 'Expand details'}>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {expanded && (
                <div className="px-3 pb-3 pt-1 border-t border-gray-50 grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                    {isProspect ? (
                        <>
                            <DetailField label="Group" value={group ? UppercaseFirstLetter(group.name) : '-'} />
                            <DetailField label="Loan Officer" value={lo ? UppercaseFirstLetter(`${lo.firstName} ${lo.lastName}`) : '-'} />
                            <DetailField label="Group Leader" value={client.groupLeader ? 'Yes' : 'No'} />
                            <DetailField label="Branch" value={client.branchName || '-'} />
                        </>
                    ) : (
                        <>
                            <DetailField label="Group" value={group ? UppercaseFirstLetter(group.name) : '-'} />
                            <DetailField label="Loan Officer" value={lo ? UppercaseFirstLetter(`${lo.firstName} ${lo.lastName}`) : '-'} />
                            <DetailField label="Slot #" value={loan?.slotNo ?? '-'} />
                            <DetailField label="Cycle" value={loan?.loanCycle ?? '-'} />
                            <DetailField label="MCBU" value={formatPricePhp(loan?.mcbu || 0)} />
                            <DetailField label="CSF" value={formatPricePhp(loan?.csf || 0)} />
                            <DetailField label="Payments" value={`${loan?.noOfPayments ?? 0} / ${loan?.loanTerms ?? '-'}`} />
                            <DetailField label="Active Loan" value={formatPricePhp(loan?.activeLoan || 0)} />
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function DetailField({ label, value }) {
    return (
        <div>
            <p className="text-gray-400 uppercase tracking-wide text-[10px] font-semibold mb-0.5">{label}</p>
            <p className="text-gray-700 font-medium">{value}</p>
        </div>
    );
}