import React, { useState, useEffect, useCallback } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { UppercaseFirstLetter } from '@/lib/utils';
import Spinner from '@/components/Spinner';

const OffsetClientTable = ({ branchId, loId, groupId, onSelect, selectedId }) => {
    const [rows, setRows]       = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch]   = useState('');
    const [pg, setPg]           = useState({
        page: 1, totalPages: 1, total: 0, hasNext: false, hasPrev: false,
    });

    const fetchPage = useCallback(async (page = 1, searchVal = '') => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: 15 });
            if (branchId) params.set('branchId', branchId);
            if (loId)     params.set('loId', loId);
            if (groupId)  params.set('groupId', groupId);
            if (searchVal.trim()) params.set('search', searchVal.trim());

            const res = await fetchWrapper.get(
                getApiBaseUrl() + 'clients/list-offset-paginated?' + params
            );
            if (res.success) {
                setRows(res.clients || []);
                setPg(res.pagination || { page: 1, totalPages: 1, total: 0, hasNext: false, hasPrev: false });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [branchId, loId, groupId]);

    useEffect(() => { fetchPage(1, ''); }, [fetchPage]);

    const handleSearch = (e) => { e.preventDefault(); fetchPage(1, search); };

    return (
        <div>
            <form onSubmit={handleSearch} className="flex gap-2 mb-3">
                <input
                    type="text" value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <button type="submit" className="px-4 py-2 bg-teal-600 text-white text-xs rounded-lg hover:bg-teal-700 font-medium">
                    Search
                </button>
            </form>

            {loading ? (
                <div className="flex justify-center py-6"><Spinner /></div>
            ) : (
                <>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Name</th>
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Group</th>
                                    <th className="w-8"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="text-center py-6 text-gray-400 text-sm">
                                            No offset clients found
                                        </td>
                                    </tr>
                                ) : rows.map(c => (
                                    <tr
                                        key={c._id}
                                        onClick={() => onSelect(c)}
                                        className={`border-t border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                                            selectedId === c._id ? 'bg-teal-50 border-l-4 border-l-teal-500' : ''
                                        }`}
                                    >
                                        <td className="px-3 py-2 font-medium text-gray-900">
                                            {UppercaseFirstLetter(`${c.lastName}, ${c.firstName}`)}
                                        </td>
                                        <td className="px-3 py-2 text-gray-500">{c.groupName || '—'}</td>
                                        <td className="px-3 py-2 text-center text-teal-600 font-bold">
                                            {selectedId === c._id ? '✓' : ''}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-gray-400">
                            {pg.total} clients · page {pg.page} of {pg.totalPages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button" disabled={!pg.hasPrev}
                                onClick={() => fetchPage(pg.page - 1, search)}
                                className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                            >
                                Prev
                            </button>
                            <button
                                type="button" disabled={!pg.hasNext}
                                onClick={() => fetchPage(pg.page + 1, search)}
                                className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default OffsetClientTable;