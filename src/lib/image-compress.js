// lib/image-compress.js
export async function compressImage(file, { maxDimension = 1600, quality = 0.85 } = {}) {
    if (!file?.type?.startsWith('image/')) return file;
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
                (blob) => resolve(blob
                    ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
                    : file),
                'image/jpeg',
                quality
            );
        };
        img.onerror = () => resolve(file);
        img.src = url;
    });
}

/**
 * Convenience helper: compress then enforce a hard max size, throwing a
 * user-facing error if the compressed result is still too large. Use this
 * at call sites that need a client-side size gate (upload forms with a
 * maxMB prop, camera capture, etc).
 *
 * @param {File} file
 * @param {{ maxMB?: number, maxDimension?: number, quality?: number }} opts
 * @returns {Promise<File>}
 */
export async function compressImageOrThrow(file, opts = {}) {
    const { maxMB = 5, ...compressOpts } = opts;
    const compressed = await compressImage(file, compressOpts);
    if (compressed.size > maxMB * 1024 * 1024) {
        throw new Error(`Photo still too large after compression. Max ${maxMB}MB.`);
    }
    return compressed;
}