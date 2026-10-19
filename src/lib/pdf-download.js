// src/lib/pdf-download.js
// "Download PDF" for the printable documents (LAF, NDS / disclosure).
//
// Uses html2pdf.js, which is already a dependency and is what LAFModal's dormant
// handleDownloadPDF used. The document is rendered to page images, so the text in the
// PDF is not selectable and a page is a few hundred KB to a few MB. If you need
// searchable, vector PDFs, that is a server-side job (headless Chrome), not this.
//
// What this adds over calling html2pdf directly:
//
//  1. Images are inlined first. The client's photo is a signed URL on another
//     origin (the Spaces bucket). html2canvas with allowTaint draws such an image
//     but then refuses to export the canvas, so the whole PDF used to fail. Here
//     each <img> is fetched and swapped for a data: URL on a COPY of the document;
//     one that cannot be fetched is replaced by a labelled placeholder, the PDF is
//     still produced, and the caller is told how many were skipped.
//     Fetching a cross-origin image needs the bucket to send CORS headers (allow GET
//     from your app's origin); without that, photos are skipped, nothing else breaks.
//  2. The page is the user's live document, untouched: everything happens on a clone.
//  3. Page breaks avoid cutting table rows in half, and honour the document's own
//     `break-before` / `page-break-before` rules. ("avoid-all" is not used: it pushes
//     any element that crosses a page edge to the next page and leaves large gaps.)

const DEFAULT_AVOID = ['tr', 'img', '.avoid-break'];
const PLACEHOLDER_FALLBACK_PX = { width: 120, height: 120 };

export function safeFilename(name, fallback = 'document') {
    const cleaned = String(name ?? '')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '')
        .replace(/\s+/g, '_');
    return cleaned || fallback;
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Could not read the image.'));
        reader.readAsDataURL(blob);
    });
}

function placeholderFor(img) {
    const placeholder = document.createElement('div');
    const width = Number(img.getAttribute('width')) || img.width || PLACEHOLDER_FALLBACK_PX.width;
    const height = Number(img.getAttribute('height')) || img.height || PLACEHOLDER_FALLBACK_PX.height;
    placeholder.style.cssText =
        `width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center;` +
        'border:1px dashed #9ca3af;color:#6b7280;font-size:10px;text-align:center;box-sizing:border-box;';
    placeholder.textContent = 'Photo unavailable';
    return placeholder;
}

// true when the image is now embedded (or already was), false when it was replaced
async function inlineImage(img) {
    const src = img.currentSrc || img.getAttribute('src');
    if (!src || src.startsWith('data:')) return true;
    try {
        const response = await fetch(src, { mode: 'cors', credentials: 'same-origin' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const dataUrl = await blobToDataUrl(await response.blob());
        img.removeAttribute('srcset'); // next/image sets one; it would override the new src
        img.removeAttribute('sizes');
        img.setAttribute('src', dataUrl);
        if (typeof img.decode === 'function') await img.decode().catch(() => {});
        return true;
    } catch (e) {
        img.replaceWith(placeholderFor(img));
        return false;
    }
}

/**
 * @param {HTMLElement} element  the printable area (what react-to-print prints)
 * @param {object} options
 * @param {string}  options.filename     with or without .pdf
 * @param {'portrait'|'landscape'} [options.orientation='portrait']
 * @param {number}  [options.margin=10]  millimetres
 * @param {number}  [options.scale=2]    render scale; higher is sharper and larger
 * @param {string[]} [options.avoidBreakInside]  selectors a page break should not split
 * @returns {Promise<{ skippedImages: number }>}
 */
export async function downloadElementAsPdf(element, options = {}) {
    if (!element) throw new Error('Nothing to export.');
    const {
        filename = 'document',
        orientation = 'portrait',
        margin = 10,
        scale = 2,
        avoidBreakInside = DEFAULT_AVOID,
    } = options;

    const html2pdf = (await import('html2pdf.js')).default;
    if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready;

    const clone = element.cloneNode(true);
    const results = await Promise.all(Array.from(clone.querySelectorAll('img')).map(inlineImage));
    const skippedImages = results.filter((ok) => !ok).length;

    const name = safeFilename(filename.replace(/\.pdf$/i, ''));
    await html2pdf()
        .set({
            margin,
            filename: `${name}.pdf`,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: {
                scale,
                useCORS: true,
                allowTaint: false, // images are inlined, so the canvas stays exportable
                backgroundColor: '#ffffff',
                logging: false,
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation },
            pagebreak: { mode: ['css', 'legacy'], avoid: avoidBreakInside },
        })
        .from(clone)
        .save();

    return { skippedImages };
}