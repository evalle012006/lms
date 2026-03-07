import React, { useState } from 'react';
import { X, Download, ExternalLink, AlertCircle } from 'lucide-react';
import { useSignedUrl } from "hooks/useSignedUrl";

/**
 * DocumentViewerModal
 *
 * Updated to support private DigitalOcean Spaces files.
 * Pass either a storage key or a legacy full URL as `documentUrl`.
 * The component automatically resolves it to a pre-signed URL.
 */
export default function DocumentViewerModal({
  isOpen,
  onClose,
  documentUrl,   // storage key OR legacy full URL
  clientName,
  unclaimedAmount
}) {
  const [viewerError, setViewerError] = useState(false);
  const { signedUrl, loading, error } = useSignedUrl(documentUrl);

  if (!isOpen || !documentUrl) return null;

  // Determine file type from the key/URL (extension is in the filename either way)
  const fileExtension = documentUrl.split('.').pop().toLowerCase();

  const isImage = /^(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileExtension);
  const isPDF = fileExtension === 'pdf';
  const isWord = /^(doc|docx)$/i.test(fileExtension);
  const isExcel = /^(xls|xlsx|csv)$/i.test(fileExtension);
  const isPowerPoint = /^(ppt|pptx)$/i.test(fileExtension);
  const isOfficeDoc = isWord || isExcel || isPowerPoint;

  const getViewerUrl = () => {
    if (!signedUrl) return null;
    if (isImage) return signedUrl;
    if (isPDF || isOfficeDoc) {
      // Google Docs Viewer works with signed URLs
      return `https://docs.google.com/viewer?url=${encodeURIComponent(signedUrl)}&embedded=true`;
    }
    return signedUrl;
  };

  const handleDownload = () => {
    if (!signedUrl) return;
    const link = document.createElement('a');
    link.href = signedUrl;
    const extension = fileExtension || 'file';
    link.download = `unclaimed-${clientName?.replace(/\s+/g, '_')}_${unclaimedAmount}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenNewTab = () => {
    if (signedUrl) window.open(signedUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Document Viewer</h2>
            {clientName && (
              <p className="text-sm text-gray-500">{clientName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenNewTab}
              disabled={loading || !signedUrl}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              <ExternalLink size={14} />
              Open in Tab
            </button>
            <button
              onClick={handleDownload}
              disabled={loading || !signedUrl}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              <Download size={14} />
              Download
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden p-4 min-h-[60vh]">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Loading document...</div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle size={18} />
                <span>Failed to load document. Please try again.</span>
              </div>
            </div>
          )}

          {!loading && !error && signedUrl && (
            <>
              {isImage && !viewerError && (
                <img
                  src={getViewerUrl()}
                  alt="Document"
                  className="max-w-full max-h-full object-contain mx-auto"
                  onError={() => setViewerError(true)}
                />
              )}
              {(isPDF || isOfficeDoc) && !viewerError && (
                <iframe
                  src={getViewerUrl()}
                  className="w-full h-full min-h-[55vh]"
                  title="Document Viewer"
                  onError={() => setViewerError(true)}
                />
              )}
              {viewerError && (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <AlertCircle size={32} className="text-yellow-500" />
                  <p className="text-gray-600">Cannot preview this file inline.</p>
                  <button
                    onClick={handleOpenNewTab}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Open in New Tab
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}