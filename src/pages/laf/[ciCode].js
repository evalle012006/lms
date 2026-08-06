// src/pages/laf/[ciCode].js
// QR scan landing page — always scanned by staff (BM or LO), never by the client.
//
// IF LOGGED IN:
//   → redirect to /transactions/ci-investigation?code=CI-XXXX
//   → CI page auto-loads the application (useEffect reads ?code= param)
//
// IF NOT LOGGED IN:
//   → show reference code + "Please log in" prompt
//   → after login, redirect back here → triggers the logged-in path above

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';

const LAFCIRedirect = () => {
    const router      = useRouter();
    const { ciCode }  = router.query;
    const currentUser = useSelector(s => s.user?.data);
    const isLoggedIn  = !!currentUser?._id;

    // Logged-in staff — redirect immediately to CI Investigation
    useEffect(() => {
        if (!ciCode) return;
        if (isLoggedIn) {
            router.replace(`/transactions/ci-investigation?code=${ciCode}`);
        }
    }, [ciCode, isLoggedIn, router]);

    if (!ciCode) return null;

    // Logged in — brief loading state while redirect fires
    if (isLoggedIn) {
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
    }

    // Not logged in — show reference code so staff can log in and proceed
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-8 text-center">
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center
                    justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-blue-600" fill="none"
                        stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                </div>

                <h1 className="text-lg font-bold text-gray-900 mb-1">
                    Staff Login Required
                </h1>
                <p className="text-sm text-gray-500 mb-5">
                    Please log in to open this application in CI Investigation.
                </p>

                {/* Reference code visible so staff can note it manually if needed */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                        CI Reference Code
                    </p>
                    <p className="font-mono font-bold text-gray-900 text-base tracking-wider">
                        {ciCode}
                    </p>
                </div>

                <a
                    href={`/login?redirect=${encodeURIComponent(`/laf/${ciCode}`)}`}
                    className="block w-full py-2.5 bg-blue-600 text-white text-sm
                        font-semibold rounded-xl hover:bg-blue-700 transition-colors">
                    Log In
                </a>

                <p className="text-xs text-gray-400 mt-4">
                    After logging in, this QR code will automatically open
                    the application in the CI Investigation page.
                </p>
            </div>
        </div>
    );
};

export default LAFCIRedirect;