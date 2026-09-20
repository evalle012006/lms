// src/components/clients/ClientRowDense.js
import React from 'react';
import ClientAvatar from './ClientAvatar';
import ClientRowActions from './ClientRowActions';
import { statusPillClass } from './statusPillStyles';
import { formatPricePhp, UppercaseFirstLetter } from '@/lib/utils';

export const GRID_TEMPLATE = {
    loan:     '40px 200px 220px 120px 160px 90px 110px 110px 110px 100px 90px 150px 110px 60px',
    prospect: '40px 200px 220px 120px 160px 100px 90px 150px 110px 60px',
};

function formatAddress(client) {
    return [
        client.addressStreetNo,
        client.addressBarangayDistrict,
        client.addressMunicipalityCity,
        client.addressProvince,
        client.addressZipCode,
    ].filter(Boolean).join(' ') || '-';
}

export default function ClientRowDense({
    client, onClick, variant = 'loan', photoUrl,
    currentUser, onDeleted, onExcluded, onQuickEdit, onQrGenerated,
}) {
    const isProspect = variant === 'prospect';
    const loan  = client.loans?.[0] ?? null;
    const group = client.group?.[0] ?? null;
    const lo    = client.lo?.[0] ?? null;
    const fullName = client.fullName
        || [client.lastName, client.firstName].filter(Boolean).join(', ')
        || 'Unknown';
    const loName = lo ? UppercaseFirstLetter(`${lo.lastName}, LO${lo.loNo ?? ''} - ${lo.firstName}`) : '-';

    return (
        <div
            className="grid items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer text-sm"
            style={{ gridTemplateColumns: GRID_TEMPLATE[isProspect ? 'prospect' : 'loan'] }}
            onClick={() => onClick?.(client)}
        >
            <ClientAvatar name={fullName} src={photoUrl} size={32} />
            <p className="font-medium text-gray-900 truncate">{UppercaseFirstLetter(fullName)}</p>
            <p className="text-gray-500 text-xs leading-snug">{formatAddress(client)}</p>
            <p className="text-gray-700 truncate">{group ? UppercaseFirstLetter(group.name) : '-'}</p>
            <p className="text-gray-700 truncate">{loName}</p>

            {!isProspect && (
                <>
                    <p className="text-gray-700">{loan?.slotNo ?? '-'}</p>
                    <span className={`justify-self-start px-2 py-0.5 rounded-full text-xs font-medium ${statusPillClass(loan?.status)}`}>
                        {loan?.status ? UppercaseFirstLetter(loan.status) : '-'}
                    </span>
                    <p className="text-gray-700">{loan ? formatPricePhp(loan.activeLoan || 0) : '-'}</p>
                    <p className="text-gray-900 font-medium">{loan ? formatPricePhp(loan.loanBalance || 0) : '-'}</p>
                </>
            )}

            <p className="text-gray-700">{client.delinquent ? 'Yes' : 'No'}</p>
            <span className={`justify-self-start px-2 py-0.5 rounded-full text-xs font-medium ${statusPillClass(client.status)}`}>
                {client.status ? UppercaseFirstLetter(client.status) : '-'}
            </span>
            <p className="text-gray-700 truncate">{client.ciName || '-'}</p>
            <p className="text-gray-700">{client.groupLeader ? 'Yes' : 'No'}</p>

            <div onClick={(e) => e.stopPropagation()}>
                <ClientRowActions
                    client={client}
                    currentUser={currentUser}
                    variant={variant}
                    onDeleted={onDeleted}
                    onExcluded={onExcluded}
                    onQuickEdit={onQuickEdit}
                    onQrGenerated={onQrGenerated}
                />
            </div>
        </div>
    );
}