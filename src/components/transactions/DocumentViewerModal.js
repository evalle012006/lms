import React, { useState } from 'react';
import { X, Download, ExternalLink, AlertCircle } from 'lucide-react';

/**
 * Modal component for viewing uploaded documents inline
 * Supports: Images, PDFs, Word, Excel, PowerPoint, and other common formats
 */
export default function DocumentViewerModal({ 
    isOpen, 
    onClose, 
    documentUrl,
    clientName,
    unclaimedAmount 
}) {
    const [viewerError, setViewerError] = useState(false);

    if (!isOpen || !documentUrl) return null;

    // Determine file type from URL
    const fileExtension = documentUrl.split('.').pop().toLowerCase();
    
    // File type categories
    const isImage = /^(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileExtension);
    const isPDF = fileExtension === 'pdf';
    const isWord = /^(doc|docx)$/i.test(fileExtension);
    const isExcel = /^(xls|xlsx|csv)$/i.test(fileExtension);
    const isPowerPoint = /^(ppt|pptx)$/i.test(fileExtension);
    const isOfficeDoc = isWord || isExcel || isPowerPoint;
    
    // Use Google Docs Viewer for PDFs and Office documents
    // This prevents download issues with DigitalOcean Spaces
    const getViewerUrl = () => {
        if (isImage) {
            return documentUrl;
        }
        
        if (isPDF || isOfficeDoc) {
            // Google Docs Viewer for reliable inline viewing
            const encodedUrl = encodeURIComponent(documentUrl);
            return `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
        }
        
        return documentUrl;
    };

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = documentUrl;
        const extension = fileExtension || 'file';
        link.download = `unclaimed-${clientName?.replace(/\s+/g, '_')}_${unclaimedAmount}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleOpenNewTab = () => {
        window.open(documentUrl, '_blank');
    };

    const handleViewerError = () => {
        setViewerError(true);
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div 
                    className="relative bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                MCBU/CSF Document
                                {isWord && <span className="ml-2 text-sm text-gray-500">(Word)</span>}
                                {isExcel && <span className="ml-2 text-sm text-gray-500">(Excel)</span>}
                                {isPowerPoint && <span className="ml-2 text-sm text-gray-500">(PowerPoint)</span>}
                                {isPDF && <span className="ml-2 text-sm text-gray-500">(PDF)</span>}
                            </h3>
                            {clientName && (
                                <p className="text-sm text-gray-600 mt-1">
                                    {clientName} - ₱{unclaimedAmount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleDownload}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                                title="Download document"
                            >
                                <Download className="h-5 w-5" />
                            </button>
                            <button
                                onClick={handleOpenNewTab}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                                title="Open in new tab"
                            >
                                <ExternalLink className="h-5 w-5" />
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                                title="Close"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Document Viewer */}
                    <div className="flex-1 overflow-auto bg-gray-100 p-4">
                        {viewerError ? (
                            // Error fallback - offer download
                            <div className="flex items-center justify-center h-64">
                                <div className="text-center">
                                    <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                                    <p className="text-gray-700 font-medium mb-2">
                                        Unable to preview this document
                                    </p>
                                    <p className="text-gray-600 text-sm mb-4">
                                        The document could not be loaded in the viewer.
                                    </p>
                                    <div className="flex gap-3 justify-center">
                                        <button
                                            onClick={handleDownload}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                                        >
                                            <Download className="h-4 w-4" />
                                            Download File
                                        </button>
                                        <button
                                            onClick={handleOpenNewTab}
                                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            Open in New Tab
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : isImage ? (
                            // Image Display
                            <div className="flex items-center justify-center">
                                <img
                                    src={documentUrl}
                                    alt="MCBU/CSF Document"
                                    className="max-w-full h-auto rounded-lg shadow-lg"
                                    onError={handleViewerError}
                                />
                            </div>
                        ) : isPDF ? (
                            // PDF Display - Using Google Docs Viewer (prevents auto-download)
                            <div className="h-full" style={{ minHeight: '700px' }}>
                                <iframe
                                    src={getViewerUrl()}
                                    className="w-full border-0 rounded-lg bg-white"
                                    style={{ height: '700px' }}
                                    title="PDF Viewer"
                                    onError={handleViewerError}
                                />
                                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                                    <strong>Note:</strong> Document is being displayed using Google Docs Viewer to prevent automatic downloads. 
                                    If it doesn't load, try downloading or opening in a new tab.
                                </div>
                            </div>
                        ) : isOfficeDoc ? (
                            // Office Documents (Word, Excel, PowerPoint) via Google Docs Viewer
                            <div className="h-full" style={{ minHeight: '700px' }}>
                                <iframe
                                    src={getViewerUrl()}
                                    className="w-full border-0 rounded-lg bg-white"
                                    style={{ height: '700px' }}
                                    title={`${isWord ? 'Word' : isExcel ? 'Excel' : 'PowerPoint'} Viewer`}
                                    onError={handleViewerError}
                                />
                                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                                    <strong>Note:</strong> Document is being displayed using Google Docs Viewer. 
                                    If it doesn't load, try downloading or opening in a new tab.
                                </div>
                            </div>
                        ) : (
                            // Unsupported file type - offer download
                            <div className="flex items-center justify-center h-64">
                                <div className="text-center">
                                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-700 font-medium mb-2">
                                        Cannot preview this file type
                                    </p>
                                    <p className="text-gray-600 text-sm mb-1">
                                        File type: .{fileExtension}
                                    </p>
                                    <p className="text-gray-500 text-xs mb-4">
                                        Preview is available for images, PDFs, Word, Excel, and PowerPoint files
                                    </p>
                                    <button
                                        onClick={handleDownload}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 mx-auto"
                                    >
                                        <Download className="h-4 w-4" />
                                        Download File
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                            Close
                        </button>
                        <button
                            onClick={handleDownload}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
                        >
                            <Download className="h-4 w-4" />
                            Download
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}