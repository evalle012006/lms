// src/components/ci/CISearchForm.js
import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { toast } from 'react-toastify';

const CISearchForm = ({ onFound }) => {
    const [refCode, setRefCode] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        const code = refCode.trim().toUpperCase();
        if (!code) {
            toast.error('Please enter a CI Reference Code.');
            return;
        }
        setLoading(true);
        try {
            const res = await fetchWrapper.get(
                getApiBaseUrl() + `laf/ci/${encodeURIComponent(code)}`
            );
            if (!res.success) {
                toast.error(res.message || 'Reference code not found.');
                return;
            }
            onFound?.(res);
        } catch {
            toast.error('Failed to retrieve application.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSearch} className="flex gap-3">
            <input
                type="text"
                value={refCode}
                onChange={e => setRefCode(e.target.value.toUpperCase())}
                placeholder="e.g. CI-XXXX-XXXXXXXX-XXXXXX"
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg
                    text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500
                    uppercase placeholder:normal-case placeholder:font-sans"
            />
            <button
                type="submit"
                disabled={loading || !refCode.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white
                    text-sm font-medium rounded-lg hover:bg-blue-700
                    disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Search className="w-4 h-4" />
                }
                {loading ? 'Searching…' : 'Search'}
            </button>
        </form>
    );
};

export default CISearchForm;