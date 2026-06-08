// src/pages/laf/[ciCode].js
// QR scan landing page — redirects logged-in staff to CI Investigation
// with the application auto-loaded. Non-logged-in users see a simple
// reference code display to show branch staff.

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { XCircle } from 'lucide-react';

const LAFCIRedirect = () => {
    const router      = useRouter();
    const { ciCode }  = router.query;
    const currentUser = useSelector(s => s.user?.data);
    const isLoggedIn  = !!currentUser?._id;

    useEffect(() => {
        if (!ciCode) return;
        if (isLoggedIn) {
            // Redirect to CI Investigation page with code pre-filled
            router.replace(`/transactions/ci-investigation?code=${ciCode}`);
        }
    }, [ciCode, isLoggedIn, router]);

    if (!ciCode) return null;

    // Not logged in — show reference code for staff to enter manually
    if (!isLoggedIn) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-8 text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center
                        justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-blue-600" fill="none"
                            stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round"
                                strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0
                                01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414
                                5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h1 className="text-lg font-bold text-gray-900 mb-2">
                        Loan Application Reference
                    </h1>
                    <p className="text-sm text-gray-500 mb-5">
                        Please show this reference code to your Branch Manager or Loan Officer.
                    </p>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5">
                        <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">
                            CI Reference Code
                        </p>
                        <p className="text-xl font-mono font-bold text-gray-900 tracking-wider">
                            {ciCode}
                        </p>
                    </div>
                    <p className="text-xs text-gray-400">
                        Staff members can scan this QR code or enter the reference
                        code above in the CI Investigation page.
                    </p>
                </div>
            </div>
        );
    }

    // Logged in — brief loading state while redirect fires
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
                <svg className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3"
                    fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                <p className="text-sm text-gray-500">Opening CI Investigation...</p>
            </div>
        </div>
    );
};

export default LAFCIRedirect;