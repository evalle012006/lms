import React, { useState } from 'react';
import { toast } from 'react-toastify';
import PhotoCapture from '@/components/clients/PhotoCapture';
import Spinner from '@/components/Spinner';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { compressImage } from '@/lib/image-compress';

// Offline-mode replacement for FaceVerifyStep: capture the client's photo, upload it, record it
// against the loan. Remounted per client (key={clientId}) so state never leaks between clients.
const DisbursementClientPhotoStep = ({ loan, clientId, clientName, onSaved }) => {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [saving, setSaving] = useState(false);

    const handleFileReady = (f) => {
        setFile(f || null);
        setPreview(f ? URL.createObjectURL(f) : null);
    };

    const handleSave = async () => {
        if (!file || saving) return;
        setSaving(true);
        try {
            const compressed = await compressImage(file, { maxDimension: 1200, quality: 0.8 });
            const fd = new FormData();
            fd.append('file', compressed);
            fd.append('origin', 'disbursement');
            fd.append('uuid', `client-${loan._id}`);

            const up = await fetch('/api/upload', { method: 'POST', body: fd });
            const ct = up.headers.get('content-type') || '';
            if (!ct.includes('application/json')) {
                throw new Error(up.status === 413 ? 'Photo is too large.' : `Upload error (${up.status}).`);
            }
            const data = await up.json();
            if (!data.fileKey) throw new Error(data.error || 'Upload failed.');

            const rec = await fetchWrapper.post(getApiBaseUrl() + 'clients/disbursement-photo', {
                loanId: loan._id, clientId, photoKey: data.fileKey,
            });
            if (!rec?.success) {
                toast.error(rec?.message || 'The photo was not recorded.');
                return;
            }
            toast.success(`Photo saved for ${clientName}.`);
            onSaved(data.fileKey);
        } catch (err) {
            toast.error(err.message || 'Upload failed. Check the connection and try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-3">
            <p className="text-xs text-gray-400">
                Photo of: <span className="font-medium text-gray-600">{clientName}</span>
            </p>
            <PhotoCapture
                onFileReady={handleFileReady}
                label="Take or upload the client's photo"
                maxMB={5}
                facingMode="user"
                allowUpload={true}
                preview={preview}
            />
            {saving && (
                <div className="flex items-center gap-2 text-xs text-gray-400"><Spinner /> Saving…</div>
            )}
            <ButtonSolid
                label={saving ? 'Saving…' : 'Save Client Photo'}
                type="button"
                className={`p-2 w-full ${(!file || saving) ? '!bg-gray-300 !text-gray-500 cursor-not-allowed' : ''}`}
                onClick={handleSave}
                disabled={!file || saving}
            />
        </div>
    );
};

export default DisbursementClientPhotoStep;