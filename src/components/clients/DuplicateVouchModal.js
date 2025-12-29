import React, { useState } from 'react';
import Dialog from '@/lib/ui/Dialog';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import ButtonSolid from '@/lib/ui/ButtonSolid';

/**
 * Modal for capturing the vouch message when managers approve duplicate clients.
 * This message explains why the client is confirmed not to be a duplicate.
 */
const DuplicateVouchModal = ({ 
    show, 
    onClose, 
    onConfirm, 
    selectedCount = 0,
    isLoading = false 
}) => {
    const [vouchMessage, setVouchMessage] = useState('');
    const [error, setError] = useState('');

    const handleConfirm = () => {
        // Validate the vouch message
        if (!vouchMessage || vouchMessage.trim().length === 0) {
            setError('Please provide a reason for vouching that this client is not a duplicate.');
            return;
        }

        if (vouchMessage.trim().length < 10) {
            setError('Please provide a more detailed explanation (at least 10 characters).');
            return;
        }

        setError('');
        onConfirm(vouchMessage.trim());
    };

    const handleClose = () => {
        setVouchMessage('');
        setError('');
        onClose();
    };

    return (
        <Dialog show={show}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                        <svg 
                            className="h-6 w-6 text-yellow-600" 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                        >
                            <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                            />
                        </svg>
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                            Confirm Duplicate Client Approval
                        </h3>
                        <div className="mt-2">
                            <p className="text-sm text-gray-500 mb-4">
                                You are about to approve <strong>{selectedCount}</strong> client(s) 
                                that were marked as potential duplicates. Please provide a reason 
                                explaining why you believe {selectedCount > 1 ? 'these clients are' : 'this client is'} not 
                                {selectedCount > 1 ? ' duplicates' : ' a duplicate'}.
                            </p>
                            
                            <div className="mt-4">
                                <label 
                                    htmlFor="vouchMessage" 
                                    className="block text-sm font-medium text-gray-700 mb-1"
                                >
                                    Vouch Reason <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    id="vouchMessage"
                                    rows="4"
                                    value={vouchMessage}
                                    onChange={(e) => {
                                        setVouchMessage(e.target.value);
                                        if (error) setError('');
                                    }}
                                    className={`
                                        block w-full px-3 py-2 text-sm text-gray-900 
                                        bg-gray-50 rounded-lg border 
                                        ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}
                                    `}
                                    placeholder="Example: Verified client identity through valid government ID. Client has different birth date and address from the flagged duplicate..."
                                    disabled={isLoading}
                                />
                                {error && (
                                    <p className="mt-1 text-sm text-red-500">{error}</p>
                                )}
                                <p className="mt-1 text-xs text-gray-400">
                                    This message will be saved as part of the client's record for audit purposes.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <ButtonSolid 
                    label={isLoading ? "Processing..." : "Confirm & Approve"}
                    type="button" 
                    className="w-full sm:w-auto sm:ml-3 p-2" 
                    onClick={handleConfirm}
                    disabled={isLoading}
                />
                <ButtonOutline 
                    label="Cancel" 
                    type="button" 
                    className="mt-3 w-full sm:mt-0 sm:w-auto p-2" 
                    onClick={handleClose}
                    disabled={isLoading}
                />
            </div>
        </Dialog>
    );
};

export default DuplicateVouchModal;