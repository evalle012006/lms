// src/lib/qrBadge.js
// Composites a scannable QR image with readable identifying text (client
// name, branch, group) into ONE PNG. This matters because the modal's
// surrounding on-screen text (name/branch shown separately in the UI)
// never travels with the file once it's downloaded or printed — anyone
// handling a printed QR badge needs the identifying info baked into the
// same image, not just visible in the browser at generation time.

/**
 * @param {string} qrDataUrl — the raw QR code image (from QRCode.toDataURL)
 * @param {{ clientName?: string, branchName?: string, groupName?: string }} info
 * @param {number} qrSize — the QR image's pixel width/height (must match what was used to generate qrDataUrl)
 * @returns {Promise<string>} a new PNG data URL with text composited below the QR
 */
export function buildQrBadgeDataUrl(qrDataUrl, info, qrSize = 220) {
    return new Promise((resolve, reject) => {
        const { clientName, branchName, groupName } = info || {};

        const padding = 16;
        const nameFontSize = 16;
        const detailFontSize = 12;
        const lineGap = 6;

        // Only reserve space for lines that actually have content — a
        // client/branch missing shouldn't leave an ugly gap.
        const detailLine = [branchName, groupName].filter(Boolean).join('  ·  ');
        const textLines = [
            clientName ? { text: clientName, size: nameFontSize, weight: '600', color: '#111827' } : null,
            detailLine ? { text: detailLine, size: detailFontSize, weight: '400', color: '#6B7280' } : null,
        ].filter(Boolean);

        const textBlockHeight = textLines.length
            ? textLines.reduce((sum, l) => sum + l.size + lineGap, 0) + padding
            : 0;

        const canvas = document.createElement('canvas');
        canvas.width = qrSize + padding * 2;
        canvas.height = qrSize + padding * 2 + textBlockHeight;
        const ctx = canvas.getContext('2d');

        // White background — a QR on a transparent PNG looks broken when
        // printed on anything but pure white paper.
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const qrImg = new Image();
        qrImg.onload = () => {
            ctx.drawImage(qrImg, padding, padding, qrSize, qrSize);

            let y = padding + qrSize + padding;
            textLines.forEach(line => {
                ctx.font = `${line.weight} ${line.size}px -apple-system, Segoe UI, Roboto, sans-serif`;
                ctx.fillStyle = line.color;
                ctx.textAlign = 'center';
                y += line.size;
                // Truncate an overly long line rather than let it overflow
                // the canvas width — a long client/branch/group combo could
                // otherwise run off the edges.
                let text = line.text;
                const maxWidth = canvas.width - padding * 2;
                while (ctx.measureText(text).width > maxWidth && text.length > 3) {
                    text = text.slice(0, -4) + '…';
                }
                ctx.fillText(text, canvas.width / 2, y);
                y += lineGap;
            });

            resolve(canvas.toDataURL('image/png'));
        };
        qrImg.onerror = reject;
        qrImg.src = qrDataUrl;
    });
}