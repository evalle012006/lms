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