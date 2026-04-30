import React, { useEffect, useState, useCallback } from 'react';
import { QrCode, Download, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import moment from 'moment';
import QRCode from 'qrcode'; // npm install qrcode

const BranchQRTable = () => {
    const [branches, setBranches] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [generating, setGenerating] = useState(null); // branchId being generated

    const fetchBranches = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchWrapper.get(getApiBaseUrl() + 'laf/qr/list');
            if (res.success) setBranches(res.branches);
            else toast.error(res.message || 'Failed to load branches.');
        } catch {
            toast.error('Error loading branch list.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchBranches(); }, [fetchBranches]);

    const handleGenerate = async (branch) => {
        setGenerating(branch._id);
        try {
            const res = await fetchWrapper.post(getApiBaseUrl() + 'laf/qr/generate', {
                branchId: branch._id,
            });
            if (!res.success) throw new Error(res.message);
            toast.success(`QR code generated for ${branch.name}`);
            fetchBranches();
        } catch (err) {
            toast.error(err.message || 'Failed to generate QR code.');
        } finally {
            setGenerating(null);
        }
    };

    const handleDownload = async (branch) => {
        if (!branch.qrToken) {
            toast.error('No QR code yet. Generate one first.');
            return;
        }
        try {
            const publicUrl = `${process.env.NEXT_PUBLIC_LOCAL_HOST}/apply/${branch.qrToken}`;
            const dataUrl   = await QRCode.toDataURL(publicUrl, {
                width: 512,
                margin: 2,
                color: { dark: '#000000', light: '#FFFFFF' },
            });
            const link      = document.createElement('a');
            link.download   = `QR-${branch.name}-${branch.code}.png`;
            link.href       = dataUrl;
            link.click();
        } catch {
            toast.error('Failed to generate QR image.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-gray-200 text-left">
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Branch</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Code</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600">QR Status</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Generated</th>
                        <th className="pb-3 font-semibold text-gray-600">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {branches.map(branch => (
                        <tr key={branch._id} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 pr-4 font-medium text-gray-900">
                                {branch.name}
                            </td>
                            <td className="py-3 pr-4 text-gray-500 font-mono">
                                {branch.code}
                            </td>
                            <td className="py-3 pr-4">
                                {branch.qrToken ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5
                                        bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                        <QrCode className="w-3 h-3" /> Active
                                    </span>
                                ) : (
                                    <span className="inline-flex px-2 py-0.5 bg-gray-100
                                        text-gray-500 text-xs font-medium rounded-full">
                                        No QR
                                    </span>
                                )}
                            </td>
                            <td className="py-3 pr-4 text-gray-400 text-xs">
                                {branch.qrGeneratedAt
                                    ? moment(branch.qrGeneratedAt).format('MMM DD, YYYY')
                                    : '—'}
                            </td>
                            <td className="py-3">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleGenerate(branch)}
                                        disabled={generating === branch._id}
                                        title={branch.qrToken
                                            ? 'Regenerate QR (invalidates old)'
                                            : 'Generate QR'}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                                            font-medium border border-blue-300 text-blue-600
                                            rounded-lg hover:bg-blue-50 disabled:opacity-50
                                            disabled:cursor-not-allowed"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${
                                            generating === branch._id ? 'animate-spin' : ''
                                        }`} />
                                        {branch.qrToken ? 'Regenerate' : 'Generate'}
                                    </button>
                                    {branch.qrToken && (
                                        <button
                                            onClick={() => handleDownload(branch)}
                                            title="Download QR image"
                                            className="flex items-center gap-1.5 px-3 py-1.5
                                                text-xs font-medium border border-gray-300
                                                text-gray-600 rounded-lg hover:bg-gray-50"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            Download
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default BranchQRTable;