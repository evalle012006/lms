// src/components/transactions/loan-application-v2/QrScanDialog.js
// Camera QR scanner. Opens the rear camera, decodes frames with jsQR, and hands the
// first decoded text to `onScan`. It does not interpret the text; see lib/qr-scan.js.
//
//   - needs the `jsqr` package:  npm i jsqr. It is loaded ON DEMAND, the first time
//     this dialog opens, so it adds nothing to the Loan Application page's own load.
//   - getUserMedia only works on https (or localhost); the dialog says so when the
//     browser refuses
//   - the camera is released on close, on a successful scan and on unmount
//   - decodes about 8 frames a second on a downscaled copy, which is plenty for a
//     QR code held in front of a phone and keeps the CPU cool

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';

const FRAME_INTERVAL_MS = 120;
const MAX_DECODE_WIDTH = 640;

const DECODER_LOAD_ERROR = 'The scanner could not be loaded. Check your connection and try again.';

function describeCameraError(error) {
    if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
        return 'Camera permission was denied. Allow camera access for this site in the browser settings, then try again.';
    }
    if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') {
        return 'No camera was found on this device.';
    }
    if (error?.name === 'NotReadableError') {
        return 'The camera is being used by another app.';
    }
    return 'The camera could not be started.';
}

export default function QrScanDialog({ open, title = 'Scan QR code', hint, onClose, onScan }) {
    const videoRef = useRef(null);
    const onScanRef = useRef(onScan);
    const [status, setStatus] = useState('starting'); // starting | scanning | error
    const [message, setMessage] = useState('');

    useEffect(() => { onScanRef.current = onScan; }, [onScan]);

    useEffect(() => {
        if (!open) return undefined;

        setStatus('starting');
        setMessage('');

        let stream = null;
        let decode = null; // jsQR, once it has loaded
        let frame = 0;
        let stopped = false;
        let lastTick = 0;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const stop = () => {
            stopped = true;
            if (frame) cancelAnimationFrame(frame);
            if (stream) stream.getTracks().forEach((track) => track.stop());
            stream = null;
        };

        const loop = (now) => {
            if (stopped) return;
            frame = requestAnimationFrame(loop);
            if (now - lastTick < FRAME_INTERVAL_MS) return;
            lastTick = now;

            const video = videoRef.current;
            if (!decode || !video || video.readyState < 2 || !video.videoWidth) return;

            const scale = Math.min(1, MAX_DECODE_WIDTH / video.videoWidth);
            const width = Math.round(video.videoWidth * scale);
            const height = Math.round(video.videoHeight * scale);
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(video, 0, 0, width, height);
            const image = ctx.getImageData(0, 0, width, height);
            const found = decode(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
            if (found && found.data) {
                stop();
                onScanRef.current?.(found.data);
            }
        };

        (async () => {
            if (!navigator.mediaDevices?.getUserMedia) {
                setStatus('error');
                setMessage(
                    window.isSecureContext === false
                        ? 'The camera needs a secure (https) connection.'
                        : 'This browser does not allow camera access.'
                );
                return;
            }
            // Fetch the decoder while the camera starts (and the permission prompt is
            // up). A failure here is only reported after the camera has been released.
            const decoderLoad = import('jsqr').then((mod) => mod.default || mod);
            decoderLoad.catch(() => {});

            try {
                const media = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' } },
                    audio: false,
                });
                if (stopped) { // closed while the permission prompt was open
                    media.getTracks().forEach((track) => track.stop());
                    return;
                }
                stream = media;

                try {
                    decode = await decoderLoad;
                } catch (e) {
                    stop();
                    setStatus('error');
                    setMessage(DECODER_LOAD_ERROR);
                    return;
                }
                if (stopped) return;

                const video = videoRef.current;
                video.srcObject = media;
                video.setAttribute('playsinline', 'true'); // iOS Safari: stay inline
                video.muted = true;
                await video.play();
                setStatus('scanning');
                frame = requestAnimationFrame(loop);
            } catch (e) {
                if (stopped) return;
                setStatus('error');
                setMessage(describeCameraError(e));
            }
        })();

        return stop;
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60"
            onClick={onClose}
            role="presentation"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="relative bg-black" style={{ aspectRatio: '1 / 1' }}>
                    <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                    {status === 'scanning' && (
                        <div
                            className="absolute border-2 border-white rounded-lg pointer-events-none"
                            style={{ inset: '15%', boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }}
                        />
                    )}
                    {status === 'starting' && (
                        <div className="absolute inset-0 flex items-center justify-center text-white">
                            <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                    )}
                    {status === 'error' && (
                        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white bg-gray-900">
                            {message}
                        </div>
                    )}
                </div>

                <p className="px-4 py-3 text-xs text-gray-500">
                    {hint || 'Hold the QR code inside the frame. It is read automatically.'}
                </p>
            </div>
        </div>
    );
}