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
//  4. (NEW) Optional `renderWidth`: the clone is laid out at a fixed CSS width in an
//     off-screen holder, with the root's own padding/margin/max-width removed, before
//     it is handed to html2pdf. Without it, html2pdf lays a detached clone out at the
//     PDF's inner page width and the document's own padding stacks on top of the PDF
//     margin, so the PDF wraps differently from the on-screen modal (narrower text
//     column, extra wrapping in table cells) and its page breaks land in different
//     places. With renderWidth set to the modal's content width, the layout matches
//     the modal and the PDF margin is the only margin.
//     Opt-in: callers that don't pass it behave exactly as before.
//
//  5. (NEW) Fonts are settled before capture, in the live document AND in the iframe that
//     html2canvas builds. html2canvas measures text boxes in that iframe, then draws the
//     glyphs with whatever font is available at paint time. If the app's web fonts are
//     still loading in one of the two (this app logs Chrome's "Slow network ... Fallback
//     font will be used while loading" intervention), the boxes come from fallback-font
//     metrics and the text is drawn lower than its box, so table borders and signature
//     lines run through it, and the result differs from export to export.
//
//  6. (NEW) Text-baseline fix for Tailwind. To place text vertically, html2canvas builds a
//     hidden 1x1 <img>, aligns it to the baseline and reads its offsetTop. Tailwind's
//     preflight sets `img { display: block }`, which drops that probe onto its own line,
//     so the measured baseline is too low and every glyph is drawn about half a font-size
//     below its box (table borders and signature lines then run through the text).
//     While exporting, a rule restores `display: inline-block` for that probe only
//     (matched by its width="1" height="1"). html2canvas runs the probe in the MAIN
//     document, so the rule is injected there (and into its cloned iframe) and removed
//     again afterwards. Real images are unaffected.
//
// Page-break control (html2pdf has no CSS "keep together" support): every element
// matching `avoidBreakInside` that would straddle a page edge is pushed whole to the
// next page. There is no "keep heading with next paragraph" — wrap a heading and the
// block it introduces in one `.avoid-break` element instead.

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
// Returns the holder so the caller can remove it afterwards.
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
    // Small buffer under the last line: the final page of the export was being clipped
    // through the last text line (capture height ending slightly short of the content).
    clone.style.paddingBottom = '24px';
    clone.style.boxSizing = 'border-box';
    holder.appendChild(clone);
    document.body.appendChild(holder);
    return holder;
}

/**
 * @param {HTMLElement} element  the printable area (what react-to-print prints)
 * @param {object} options
 * @param {string}  options.filename     with or without .pdf
 * @param {'portrait'|'landscape'} [options.orientation='portrait']
 * @param {number}  [options.margin=10]  millimetres
 * @param {number}  [options.scale=2]    render scale; higher is sharper and larger
 * @param {string[]} [options.avoidBreakInside]  selectors a page break should not split
 * @param {number|null} [options.renderWidth=null]  CSS px to lay the document out at
 *        before capture (see note 4 above). Use the on-screen content width.
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
    } = options;

    const html2pdf = (await import('html2pdf.js')).default;
    if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready;

    const clone = element.cloneNode(true);
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
                    // html2canvas awaits this; the cloned document has its own FontFaceSet
                    onclone: (clonedDoc) => {
                        injectMetricsFix(clonedDoc);
                        return settleFonts(clonedDoc);
                    },
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation },
                pagebreak: { mode: ['css', 'legacy'], avoid: avoidBreakInside },
            })
            .from(clone)
            .save();
    } finally {
        if (metricsFix) metricsFix.remove();
        if (holder) holder.remove();
    }

    return { skippedImages };
}