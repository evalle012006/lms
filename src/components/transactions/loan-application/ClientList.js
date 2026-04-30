import React, { useState, useMemo } from 'react';
import { UppercaseFirstLetter } from '@/lib/utils';
import { useBulkSignedUrls } from '@/hooks/useBulkSignedUrls';
import placeholder from '/public/images/image-placeholder.png';

/**
 * ClientList
 * CI Investigation-style scrollable client list with profile photo thumbnails,
 * fuzzy name search, and selected highlight with blue left border.
 *
 * Props:
 *   clients      — array of client objects (from Redux clientList)
 *   selectedId   — currently selected client._id
 *   onSelect     — (client) => void
 *   disabled     — greys out and blocks interaction when no group selected
 */
const ClientList = ({ clients = [], selectedId, onSelect, disabled = false }) => {
    const [search, setSearch] = useState('');

    // Collect all profile photo keys for bulk signed-URL fetch
    const photoKeys = useMemo(
        () => clients.map(c => c.profile).filter(Boolean),
        [clients]
    );
    const { urlMap } = useBulkSignedUrls(photoKeys);

    // Fuzzy name filter (first + last name)
    const filtered = useMemo(() => {
        if (!search.trim()) return clients;
        const q = search.trim().toLowerCase();
        return clients.filter(c => {
            const full = `${c.firstName} ${c.lastName} ${c.middleName || ''}`.toLowerCase();
            return full.includes(q);
        });
    }, [clients, search]);

    if (disabled) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </div>
                <p className="text-sm font-medium text-gray-400">Select a group first</p>
                <p className="text-xs text-gray-300 mt-1">Clients will appear here after selecting a group</p>
            </div>
        );
    }

    return (
        <div>
            {/* Fuzzy search */}
            <div className="mb-3">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
            </div>

            {/* Count */}
            {clients.length > 0 && (
                <p className="text-xs text-gray-400 mb-2">
                    {filtered.length} of {clients.length} client{clients.length !== 1 ? 's' : ''}
                </p>
            )}

            {/* List */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
                {filtered.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-400">
                        {clients.length === 0 ? 'No clients in this group' : 'No clients match your search'}
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
                        {filtered.map(client => {
                            const isSelected = selectedId === client._id || selectedId === client.value;
                            const photoUrl   = urlMap[client.profile] || null;

                            return (
                                <button
                                    key={client._id}
                                    type="button"
                                    onClick={() => onSelect(client, photoUrl)}
                                    className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors ${
                                        isSelected
                                            ? 'bg-teal-50 border-l-4 border-l-teal-500'
                                            : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                                    }`}
                                >
                                    {/* Profile photo — use pre-resolved URL from useBulkSignedUrls */}
                                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200">
                                        {client.profile ? (
                                            <img
                                                src={photoUrl || placeholder.src}
                                                alt={client.firstName}
                                                className="object-cover w-full h-full"
                                                onError={e => { e.target.src = placeholder.src; }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400 bg-gray-100">
                                                {client.firstName?.[0]}{client.lastName?.[0]}
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium truncate ${isSelected ? 'text-teal-800' : 'text-gray-900'}`}>
                                            {UppercaseFirstLetter(`${client.lastName}, ${client.firstName}`)}
                                            {client.middleName ? ` ${client.middleName}` : ''}
                                        </p>
                                        {(client.slotNo || client.groupName) && (
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {client.slotNo ? `Slot ${client.slotNo}` : ''}
                                                {client.slotNo && client.groupName ? ' · ' : ''}
                                                {client.groupName || ''}
                                            </p>
                                        )}
                                        {client.ciName && (
                                            <p className="text-xs text-gray-400 mt-0.5">CI: {client.ciName}</p>
                                        )}
                                    </div>

                                    {/* Selected checkmark */}
                                    {isSelected && (
                                        <div className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientList;