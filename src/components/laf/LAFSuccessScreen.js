import React from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

const LAFSuccessScreen = ({ ciReferenceCode, branchName }) => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
            <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Application Submitted!
            </h1>
            <p className="text-gray-500 text-sm mb-6">
                Your loan application at <strong>{branchName}</strong> has been 
                received and is pending credit investigation.
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
                <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">
                    Your CI Reference Code
                </p>
                <p className="text-2xl font-mono font-bold text-gray-900 tracking-wider">
                    {ciReferenceCode}
                </p>
            </div>

            <div className="text-left space-y-2 text-sm text-gray-600">
                <p className="font-semibold text-gray-800">What happens next?</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>A Credit Investigator will visit your address for field investigation.</li>
                    <li>Once approved, you will be contacted by your branch.</li>
                    <li>Keep your CI Reference Code — you may be asked for it.</li>
                </ol>
            </div>

            <p className="mt-6 text-xs text-gray-400">
                Please screenshot or write down your reference code.
            </p>
        </div>
    </div>
);

export default LAFSuccessScreen;