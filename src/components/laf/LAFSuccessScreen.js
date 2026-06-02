// src/components/laf/LAFSuccessScreen.js
// Phase 4 — Updated with ciReferenceCode QR + download button.
// The QR URL points to /laf/[ciCode] which requires login to view.
// Client saves/screenshots this QR and presents it to BM at disbursement,
// or LO scans it on the CI Investigation page to auto-populate the CI code.

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, Download, Copy } from 'lucide-react';
import { toast } from 'react-toastify';
import QRCode from 'qrcode';

// FIX: added onAddAnother prop — renders "Submit Another Application" button
const LAFSuccessScreen = ({ ciReferenceCode, groupName, branchName, onAddAnother }) => {
    const canvasRef = useRef();
    const [qrDataUrl, setQrDataUrl] = useState(null);

    const qrUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/laf/${ciReferenceCode}`
        : `/laf/${ciReferenceCode}`;

    useEffect(() => {
        if (!ciReferenceCode) return;
        QRCode.toDataURL(qrUrl, {
            width:                400,
            margin:               2,
            color:                { dark: '#1e293b', light: '#ffffff' },
            errorCorrectionLevel: 'H',
        }).then(setQrDataUrl).catch(console.error);
    }, [ciReferenceCode, qrUrl]);

    const handleDownload = () => {
        if (!qrDataUrl) return;
        const a      = document.createElement('a');
        a.href       = qrDataUrl;
        a.download   = `ambercash-laf-${ciReferenceCode}.png`;
        a.click();
        toast.success('QR code downloaded.');
    };

    const handleCopyCode = () => {
        navigator.clipboard.writeText(ciReferenceCode).then(() => {
            toast.success('Reference code copied.');
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-8 text-center">
                {/* Icon */}
                <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-9 h-9 text-green-600" />
                    </div>
                </div>

                <h1 className="text-xl font-bold text-gray-900 mb-1">
                    Application Submitted!
                </h1>
                <p className="text-gray-500 text-sm mb-6">
                    Your loan application at <strong>{branchName}</strong>
                    {groupName ? ` (${groupName})` : ''} has been received
                    and is pending credit investigation.
                </p>

                {/* CI Reference Code */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                    <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">
                        CI Reference Code
                    </p>
                    <div className="flex items-center justify-center gap-2">
                        <p className="text-xl font-mono font-bold text-gray-900 tracking-wider">
                            {ciReferenceCode}
                        </p>
                        <button type="button" onClick={handleCopyCode}
                            className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                            title="Copy code">
                            <Copy className="w-4 h-4 text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* QR Code */}
                {qrDataUrl ? (
                    <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">
                            Save this QR code — present it to your Branch Manager
                            when collecting your loan or to your Loan Officer
                            during the CI investigation.
                        </p>
                        <div className="flex justify-center mb-3">
                            <div className="border-4 border-blue-600 rounded-xl overflow-hidden shadow-md">
                                <img src={qrDataUrl} alt="Application QR Code"
                                    className="w-48 h-48 object-contain" />
                            </div>
                        </div>
                        <button type="button" onClick={handleDownload}
                            className="w-full flex items-center justify-center gap-2 py-2.5
                                bg-blue-600 text-white text-sm font-semibold rounded-xl
                                hover:bg-blue-700 transition-colors">
                            <Download className="w-4 h-4" />
                            Download QR Code
                        </button>
                    </div>
                ) : (
                    <div className="flex justify-center mb-4">
                        <div className="w-48 h-48 bg-gray-100 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                        </div>
                    </div>
                )}

                {/* What happens next */}
                <div className="text-left bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <p className="text-xs font-semibold text-blue-900 mb-2">What happens next?</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-blue-800">
                        <li>A Credit Investigator will visit your address.</li>
                        <li>Once approved, you will be contacted by your branch.</li>
                        <li>Present this QR code when collecting your loan.</li>
                    </ol>
                </div>

                <p className="mt-4 text-xs text-gray-400">
                    Screenshot or download your QR code for safekeeping.
                </p>

                {/* FIX: Submit another application button — only shown when handler provided */}
                {onAddAnother && (
                    <button
                        type="button"
                        onClick={onAddAnother}
                        className="mt-4 w-full py-3 border-2 border-blue-600 text-blue-600
                            text-sm font-semibold rounded-xl hover:bg-blue-50 transition-colors"
                    >
                        + Submit Another Application
                    </button>
                )}
            </div>
        </div>
    );
};

export default LAFSuccessScreen;