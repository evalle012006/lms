import React, { useState, useRef } from 'react';
import { toast } from 'react-toastify';
import { X, Upload, FileText } from 'lucide-react';

/**
 * Modal component for uploading MCBU/CSF form document
 * Supports both single and batch claiming
 */
export default function ClaimTransactionModal({ 
    isOpen, 
    onClose, 
    onClaim, 
    transaction,
    transactions = [], // For batch mode
    isBatch = false
}) {
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const fileInputRef = useRef(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [processedCount, setProcessedCount] = useState(0);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            toast.error('File size must be less than 10MB');
            return;
        }

        // Validate file type (images and PDFs)
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Please select an image (JPG, PNG, GIF) or PDF file');
            return;
        }

        setSelectedFile(file);

        // Create preview for images
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result);
            };
            reader.readAsDataURL(file);
        } else {
            setPreview(null);
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        setPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async () => {
        if (!selectedFile) {
            toast.error('Please select a document to upload');
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        try {
            // For batch mode, upload the document once and use it for all transactions
            const targetTransaction = isBatch ? transactions[0] : transaction;
            
            // Upload file to DigitalOcean Spaces
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('origin', 'unclaimed-transactions');
            formData.append('uuid', targetTransaction.cashCollectionId);

            setUploadProgress(30);

            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!uploadResponse.ok) {
                throw new Error('Failed to upload document');
            }

            const uploadResult = await uploadResponse.json();

            if (!uploadResult.fileUrl) {
                throw new Error('No file URL returned from upload');
            }

            setUploadProgress(60);

            if (isBatch) {
                // Batch mode: prepare payload with only required fields
                const transactionsWithDoc = transactions.map(tx => ({
                    cashCollectionId: tx.cashCollectionId,
                    clientId: tx.clientId,
                    groupId: tx.groupId,
                    branchId: tx.branchId,
                    areaId: tx.areaId,
                    regionId: tx.regionId,
                    divisionId: tx.divisionId,
                    loanId: tx.loanId,
                    documentUrl: uploadResult.fileUrl
                }));

                setProcessedCount(0);
                for (let i = 0; i < transactionsWithDoc.length; i++) {
                    setProcessedCount(i + 1);
                    setUploadProgress(60 + (40 * (i + 1) / transactionsWithDoc.length));
                }

                await onClaim(transactionsWithDoc);
            } else {
                // Single mode: send only required fields
                setUploadProgress(90);
                await onClaim({
                    cashCollectionId: transaction.cashCollectionId,
                    clientId: transaction.clientId,
                    groupId: transaction.groupId,
                    branchId: transaction.branchId,
                    areaId: transaction.areaId,
                    regionId: transaction.regionId,
                    divisionId: transaction.divisionId,
                    loanId: transaction.loanId,
                    documentUrl: uploadResult.fileUrl
                });
            }

            setUploadProgress(100);

            // Reset state
            handleRemoveFile();
            onClose();

        } catch (error) {
            console.error('Error uploading document:', error);
            toast.error('Failed to upload document. Please try again.');
        } finally {
            setUploading(false);
            setUploadProgress(0);
            setProcessedCount(0);
        }
    };

    const handleCancel = () => {
        handleRemoveFile();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
                onClick={handleCancel}
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                        <h3 className="text-xl font-semibold text-gray-900">
                            {isBatch ? `Claim ${transactions.length} Transactions` : 'Claim Unclaimed Transaction'}
                        </h3>
                        <button
                            onClick={handleCancel}
                            className="text-gray-400 hover:text-gray-500 transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6">
                        {/* Transaction Details */}
                        <div className="mb-6 bg-gray-50 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                {isBatch ? 'Batch Summary' : 'Transaction Details'}
                            </h4>
                            {isBatch ? (
                                <div className="space-y-2">
                                    <div className="text-sm">
                                        <span className="text-gray-600">Total Transactions:</span>
                                        <span className="ml-2 font-medium">{transactions.length}</span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-gray-600">Total Unclaimed Amount:</span>
                                        <span className="ml-2 font-medium text-green-600">
                                            ₱{transactions.reduce((sum, t) => sum + (t.unclaimedAmount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="mt-3 max-h-32 overflow-y-auto">
                                        <span className="text-xs text-gray-600">Clients:</span>
                                        <div className="mt-1 space-y-1">
                                            {transactions.slice(0, 5).map((t, idx) => (
                                                <div key={idx} className="text-xs text-gray-700">
                                                    • {t.clientName} - ₱{t.unclaimedAmount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </div>
                                            ))}
                                            {transactions.length > 5 && (
                                                <div className="text-xs text-gray-500 italic">
                                                    ... and {transactions.length - 5} more
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-gray-600">Client:</span>
                                        <span className="ml-2 font-medium">{transaction?.clientName}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Branch:</span>
                                        <span className="ml-2 font-medium">{transaction?.branchName}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Group:</span>
                                        <span className="ml-2 font-medium">{transaction?.groupName}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Slot No:</span>
                                        <span className="ml-2 font-medium">{transaction?.slotNo}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Unclaimed Amount:</span>
                                        <span className="ml-2 font-medium text-green-600">
                                            ₱{transaction?.unclaimedAmount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Upload Section */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Upload MCBU and CSF Form <span className="text-red-500">*</span>
                            </label>
                            <p className="text-sm text-gray-500 mb-4">
                                Please upload a clear photo or PDF of the signed MCBU and CSF form document.
                            </p>

                            {/* File Input (hidden) */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,.pdf"
                                onChange={handleFileSelect}
                                className="hidden"
                            />

                            {/* Upload Area */}
                            {!selectedFile ? (
                                <button
                                    type="button"
                                    onClick={handleUploadClick}
                                    className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                                >
                                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                    <p className="mt-2 text-sm text-gray-600">
                                        Click to upload or drag and drop
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500">
                                        PNG, JPG, GIF, PDF up to 10MB
                                    </p>
                                </button>
                            ) : (
                                <div className="border border-gray-300 rounded-lg p-4">
                                    {/* Preview */}
                                    {preview ? (
                                        <div className="mb-4">
                                            <img 
                                                src={preview} 
                                                alt="Preview" 
                                                className="max-h-64 mx-auto rounded-lg"
                                            />
                                        </div>
                                    ) : (
                                        <div className="mb-4 flex items-center justify-center p-8 bg-gray-50 rounded-lg">
                                            <FileText className="h-16 w-16 text-gray-400" />
                                        </div>
                                    )}

                                    {/* File Info */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {selectedFile.name}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleRemoveFile}
                                            disabled={uploading}
                                            className="ml-4 text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Remove
                                        </button>
                                    </div>

                                    {/* Change File Button */}
                                    <button
                                        type="button"
                                        onClick={handleUploadClick}
                                        disabled={uploading}
                                        className="mt-3 w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                                    >
                                        Change File
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Info Message */}
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <p className="text-sm text-blue-800">
                                <strong>Note:</strong> {isBatch 
                                    ? `This document will be applied to all ${transactions.length} selected transactions. The process cannot be undone.`
                                    : 'Once you proceed, the transaction will be marked as claimed and cannot be undone. Make sure the document is clear and properly filled out.'}
                            </p>
                        </div>

                        {/* Upload Progress */}
                        {uploading && uploadProgress > 0 && (
                            <div className="mt-4">
                                <div className="flex justify-between text-sm text-gray-600 mb-2">
                                    <span>{isBatch ? 'Processing batch claim...' : 'Uploading document...'}</span>
                                    <span>{Math.round(uploadProgress)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                    ></div>
                                </div>
                                {isBatch && processedCount > 0 && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        Processed {processedCount} of {transactions.length} transactions
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={uploading}
                            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={uploading || !selectedFile}
                            className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {uploading ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Uploading...
                                </>
                            ) : (
                                'Claim Transaction'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}