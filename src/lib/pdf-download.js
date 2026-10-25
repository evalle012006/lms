// src/lib/pdf-download.js
// "Download PDF" for the printable documents (LAF, NDS / disclosure).
//
// Uses html2pdf.js. The document is rendered to page images, so the text in the PDF is not
// selectable. If you need searchable, vector PDFs, that is a server-side job (headless Chrome).
//
// What this adds over calling html2pdf directly:
//
//  1. Images are inlined first (signed cross-origin URLs would otherwise taint the canvas).
//     An image that cannot be fetched is replaced by a labelled placeholder; the caller is
//     told how many were skipped. Needs CORS (GET) on the storage bucket.
//  2. The live document is untouched: everything happens on a clone.
//  3. Page breaks avoid cutting table rows and honour `break-before` rules (multi-page mode).
//  4. Optional `renderWidth`: lay the clone out at a fixed CSS width, off-screen, with the
//     root's own padding/margin/max-width removed, so the PDF wraps like the on-screen modal.
//  5. Fonts are settled before capture, in the live document AND html2canvas's cloned iframe.
//  6. Tailwind text-baseline fix: restores `display: inline-block` for html2canvas's 1x1
//     baseline probe image (Tailwind preflight sets img { display: block }).
//  7. (NEW) `format`: any jsPDF page format, e.g. [215.9, 330.2] for 8.5in x 13in folio.
//  8. (NEW) `cloneClass`: a class added to the clone, so scoped CSS (e.g. a compact layout
//     written as ".laf-fit-compact .x { ... }") applies to the exported copy only.
//  9. (NEW) `fitOnePage`: render once to a canvas and place it on a SINGLE page, scaled to fit
//     (aspect ratio preserved). It never slices, so it can never produce a second page.
//     Requires `jspdf` (html2pdf.js's own dependency; `npm i jspdf` to make it explicit).

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

// Best-effort: make sure every @font-face in `doc` is loaded (or give up after 4s).
async function settleFonts(doc) {
    try {
        if (!doc || !doc.fonts) return;
        await Promise.race([
            Promise.all(Array.from(doc.fonts).map((face) => face.load().catch(() => null))),
            new Promise((resolve) => setTimeout(resolve, 4000)),
        ]);
        await doc.fonts.ready;
    } catch (e) {
        /* never let font loading block the export */
    }
}

const METRICS_FIX_CSS = 'img[width="1"][height="1"]{display:inline-block !important;}';

function injectMetricsFix(doc) {
    const style = doc.createElement('style');
    style.setAttribute('data-pdf-metrics-fix', '');
    style.textContent = METRICS_FIX_CSS;
    doc.head.appendChild(style);
    return style;
}

// Lay the clone out at a fixed width, off-screen, inside the live document (so the
// app's global/Tailwind CSS applies). Inline styles beat the utility classes
// (p-8, max-width, auto margins) that the on-screen version uses for its own chrome.
function stageForRender(clone, renderWidth) {
    const holder = document.createElement('div');
    holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText =
        `position:fixed;left:-100000px;top:0;width:${renderWidth}px;` +
        'background:#fff;pointer-events:none;';
    clone.style.width = '100%';
    clone.style.maxWidth = 'none';
    clone.style.margin = '0';
    clone.style.minHeight = '0';
    clone.style.padding = '0';
    // Small buffer under the last line so the capture never clips the final text line.
    clone.style.paddingBottom = '24px';
    clone.style.boxSizing = 'border-box';
    holder.appendChild(clone);
    document.body.appendChild(holder);
    return holder;
}

/**
 * @param {HTMLElement} element  the printable area
 * @param {object} options
 * @param {string}  options.filename     with or without .pdf
 * @param {'portrait'|'landscape'} [options.orientation='portrait']
 * @param {number}  [options.margin=10]  millimetres
 * @param {number}  [options.scale=2]    render scale; higher is sharper and larger
 * @param {string[]} [options.avoidBreakInside]  selectors a page break should not split
 * @param {number|null} [options.renderWidth=null]  CSS px to lay the document out at
 * @param {string|number[]} [options.format='a4']  jsPDF page format, or [width, height] in mm
 * @param {boolean} [options.fitOnePage=false]  scale the whole document onto a single page
 * @param {string|null} [options.cloneClass=null]  class added to the clone (scoped CSS hook)
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
        renderWidth = null,
        format = 'a4',
        fitOnePage = false,
        cloneClass = null,
    } = options;

    const html2pdf = (await import('html2pdf.js')).default;
    if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready;

    const clone = element.cloneNode(true);
    // Compact rules are scoped as ".laf-fit-compact .x"; descendants of the clone match.
    if (cloneClass) clone.classList.add(cloneClass);

    const results = await Promise.all(Array.from(clone.querySelectorAll('img')).map(inlineImage));
    const skippedImages = results.filter((ok) => !ok).length;

    const holder = renderWidth ? stageForRender(clone, renderWidth) : null;
    // Staging can pull in font weights/styles the page hasn't used yet; wait for them,
    // then one frame so layout is final before html2pdf measures anything.
    await settleFonts(document);
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));

    let metricsFix = null;
    try {
        metricsFix = injectMetricsFix(document);
        const name = safeFilename(filename.replace(/\.pdf$/i, ''));

        const opts = {
            margin,
            filename: `${name}.pdf`,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: {
                scale,
                useCORS: true,
                allowTaint: false, // images are inlined, so the canvas stays exportable
                backgroundColor: '#ffffff',
                logging: false,
                // html2canvas awaits this; the cloned document has its own FontFaceSet
                onclone: (clonedDoc) => {
                    injectMetricsFix(clonedDoc);
                    return settleFonts(clonedDoc);
                },
            },
            jsPDF: { unit: 'mm', format, orientation },
            pagebreak: { mode: ['css', 'legacy'], avoid: avoidBreakInside },
        };

        if (fitOnePage) {
            // Render once to a canvas, then place it on a single page, scaled to fit.
            const canvas = await html2pdf().set(opts).from(clone).toCanvas().get('canvas');
            const { jsPDF } = await import('jspdf');
            const pdf = new jsPDF({ unit: 'mm', format, orientation });
            const innerW = pdf.internal.pageSize.getWidth() - margin * 2;
            const innerH = pdf.internal.pageSize.getHeight() - margin * 2;
            const k = Math.min(innerW / canvas.width, innerH / canvas.height);
            const w = canvas.width * k;
            const h = canvas.height * k;
            pdf.addImage(
                canvas.toDataURL('image/jpeg', 0.95),
                'JPEG',
                margin + (innerW - w) / 2,
                margin,
                w,
                h
            );
            pdf.save(`${name}.pdf`);
        } else {
            await html2pdf().set(opts).from(clone).save();
        }
    } finally {
        if (metricsFix) metricsFix.remove();
        if (holder) holder.remove();
    }

    return { skippedImages };
}