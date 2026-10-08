// src/lib/face-capture-utils.js
// Shared frame-capture quality helpers for face enrollment (FaceLivenessStep)
// and face verification (FaceVerifyStep). Centralized so tuning constants
// (brightness threshold, sample count) only need updating in one place.

export const MIN_BRIGHTNESS          = 40;   // 0-255 scale — UNTUNED, needs calibration against real branch photos
export const FRAME_SAMPLE_COUNT      = 4;
export const FRAME_SAMPLE_INTERVAL_MS = 60;
export const THUMBNAIL_WIDTH  = 320;
export const THUMBNAIL_HEIGHT = 240;

// Draws the current video frame onto a fresh canvas at native resolution.
// Always capture to a canvas BEFORE running detection — detection is async
// and the live <video> element keeps advancing while it runs, so anything
// read from `video` directly after an await may not be the frame that was
// actually analyzed.
export function captureFrame(video) {
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
}

export function getAverageBrightness(canvas) {
    const ctx = canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return sum / (data.length / 4);
}

// Cheap proxy for sharpness — samples luminance gradient magnitude on a
// sparse grid rather than a full Laplacian convolution over every pixel.
// Good enough to RANK a handful of near-identical frames against each
// other; not a general-purpose blur metric.
export function getSharpness(canvas) {
    const ctx = canvas.getContext('2d');
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let variance = 0, count = 0;
    for (let y = 1; y < height - 1; y += 4) {
        for (let x = 1; x < width - 1; x += 4) {
            const i      = (y * width + x) * 4;
            const iRight = (y * width + x + 1) * 4;
            const iDown  = ((y + 1) * width + x) * 4;
            const lum  = 0.299 * data[i]      + 0.587 * data[i + 1]      + 0.114 * data[i + 2];
            const lumR = 0.299 * data[iRight] + 0.587 * data[iRight + 1] + 0.114 * data[iRight + 2];
            const lumD = 0.299 * data[iDown]  + 0.587 * data[iDown + 1]  + 0.114 * data[iDown + 2];
            variance += (lum - lumR) ** 2 + (lum - lumD) ** 2;
            count++;
        }
    }
    return count > 0 ? variance / count : 0;
}

// Samples several frames over a short window and returns the sharpest one,
// as a single frozen canvas. Both face detection AND the saved thumbnail
// must be derived from this SAME canvas — never re-read from `video`
// afterward, or the two can drift apart again.
export async function captureBestFrame(video, {
    sampleCount = FRAME_SAMPLE_COUNT,
    intervalMs  = FRAME_SAMPLE_INTERVAL_MS,
} = {}) {
    let bestCanvas    = null;
    let bestSharpness = -1;
    for (let i = 0; i < sampleCount; i++) {
        const candidate = captureFrame(video);
        const sharpness = getSharpness(candidate);
        if (sharpness > bestSharpness) {
            bestSharpness = sharpness;
            bestCanvas    = candidate;
        }
        if (i < sampleCount - 1) await new Promise(r => setTimeout(r, intervalMs));
    }
    return bestCanvas;
}

export function isTooDark(canvas, threshold = MIN_BRIGHTNESS) {
    return getAverageBrightness(canvas) < threshold;
}

// Downscales a full-resolution canvas to a small debug/reference thumbnail,
// preserving aspect ratio (fit-within a bounding box) rather than stretching
// to an exact width/height — stretching a 16:9 source into a 4:3 box
// visibly squashes faces.
export async function canvasToDebugThumbnail(canvas) {
    const sourceRatio = canvas.width / canvas.height;
    const boxRatio     = THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT;

    let drawWidth, drawHeight;
    if (sourceRatio > boxRatio) {
        // source is wider than the box — constrain by width
        drawWidth  = THUMBNAIL_WIDTH;
        drawHeight = THUMBNAIL_WIDTH / sourceRatio;
    } else {
        // source is taller/narrower than the box — constrain by height
        drawHeight = THUMBNAIL_HEIGHT;
        drawWidth  = THUMBNAIL_HEIGHT * sourceRatio;
    }

    const thumb = document.createElement('canvas');
    thumb.width  = Math.round(drawWidth);
    thumb.height = Math.round(drawHeight);
    thumb.getContext('2d').drawImage(canvas, 0, 0, thumb.width, thumb.height);

    return new Promise((resolve) => {
        thumb.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
    });
}