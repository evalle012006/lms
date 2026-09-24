// src/components/transactions/loan-application/LafCiGallery.js
// Shows every photo/document captured from the LAF application through to
// the CI investigation, per client, at the top of the disbursement modal —
// so the approver can eyeball application-time evidence before touching the
// disbursement photo step.
//
// Data source: GET laf/ci/${ciReferenceCode} (existing endpoint, already
// used by CIReviewPanel) — reused as-is rather than adding a parallel query.
// That endpoint only pre-resolves lafPhotoKey and investigation.selfieKey to
// signed URLs (the only two any prior caller needed); governmentIdPhotoKey
// comes back as a raw key and is resolved here via the generic
// useBulkSignedUrls hook instead of changing a shared endpoint for one
// caller's needs.
//
// selfieWithIdPhotoKey is deliberately NOT shown: it's gated behind the
// requireSelfieWithId system setting, which has no admin UI to enable it —
// so in practice this field is always null and the tile would just be
// permanent dead weight.
import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { useBulkSignedUrls } from '@/hooks/useBulkSignedUrls';
import Spinner from '@/components/Spinner';
import PhotoComparisonOverlay from '@/components/shared/PhotoComparisonOverlay';

const DOC_SLOTS = [
    { key: 'lafPhotoUrl',            label: 'Applicant Photo (LAF)', resolved: true },
    { key: 'governmentIdPhotoKey',   label: 'Government ID',         resolved: false },
];

const LafCiGallery = ({ loans = [] }) => {
    const [byRefCode, setByRefCode] = useState({}); // refCode -> { application, investigation }
    const [loading, setLoading] = useState(true);
    const [zoom, setZoom] = useState(null); // { url, label, name } | null

    const refCodes = [...new Set(loans.map(l => l.ciReferenceCode).filter(Boolean))];

    useEffect(() => {
        if (!refCodes.length) { setLoading(false); return; }
        let cancelled = false;
        setLoading(true);
        Promise.all(
            refCodes.map(code =>
                fetchWrapper.get(getApiBaseUrl() + `laf/ci/${encodeURIComponent(code)}`)
                    .then(r => ({ code, data: r?.success ? r : null }))
                    .catch(() => ({ code, data: null }))
            )
        ).then(results => {
            if (cancelled) return;
            const map = {};
            results.forEach(({ code, data }) => { if (data) map[code] = data; });
            setByRefCode(map);
            setLoading(false);
        });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refCodes.join('|')]);

    // Raw (unresolved) keys across every application/investigation, for one bulk lookup.
    const unresolvedKeys = Object.values(byRefCode).flatMap(({ application }) => [
        application?.governmentIdPhotoKey,
    ]).filter(Boolean);
    const { urlMap } = useBulkSignedUrls(unresolvedKeys);

    if (!refCodes.length) return null; // no LAF-linked loans in this batch — nothing to show

    return (
        <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">
                Application &amp; Investigation Documents
            </p>
            {loading ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 ml-1">
                    <Spinner /> Loading application documents…
                </div>
            ) : (
                <div className="space-y-3">
                    {refCodes.map(code => {
                        const entry = byRefCode[code];
                        if (!entry) {
                            return (
                                <p key={code} className="text-xs text-amber-600 ml-1">
                                    Could not load documents for reference {code}.
                                </p>
                            );
                        }
                        const { application, investigation } = entry;
                        const name = `${application.firstName || ''} ${application.lastName || ''}`.trim() || code;

                        const tiles = [
                            ...DOC_SLOTS.map(slot => ({
                                label: slot.label,
                                url: slot.resolved
                                    ? application[slot.key]
                                    : (application[slot.key] ? urlMap[application[slot.key]] : null),
                            })),
                            { label: 'CI Selfie', url: investigation?.selfieUrl || null },
                        ];

                        return (
                            <div key={code} className="border border-gray-100 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-gray-700">{name}</span>
                                    <span className="text-[11px] text-gray-400 font-mono">{code}</span>
                                </div>
                                <div className="flex gap-3 flex-wrap">
                                    {tiles.map(t => (
                                        <DocTile key={t.label} {...t}
                                            onClick={() => t.url && setZoom({ url: t.url, label: t.label, name })} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {zoom && (
                <PhotoComparisonOverlay
                    leftUrl={zoom.url}
                    rightUrl={null}
                    leftLabel={zoom.label}
                    rightLabel=""
                    title={`${zoom.label} — ${zoom.name}`}
                    onClose={() => setZoom(null)}
                />
            )}
        </div>
    );
};

const DocTile = ({ label, url, onClick }) => (
    <div className="text-center">
        {url ? (
            <img src={url} alt={label} onClick={onClick}
                className="w-16 h-16 rounded-lg object-cover border border-gray-200 cursor-pointer" />
        ) : (
            <div className="w-16 h-16 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center">
                <ImageOff className="w-4 h-4 text-gray-300" />
            </div>
        )}
        <p className="text-[10px] text-gray-400 mt-0.5 max-w-[64px] truncate">{label}</p>
    </div>
);

export default LafCiGallery;