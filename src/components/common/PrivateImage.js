import { useState } from 'react';
import Image from 'next/image';
import { useSignedUrl } from "hooks/useSignedUrl";
import placeholder from '/public/images/image-placeholder.png';

/**
 * PrivateImage
 *
 * Drop-in replacement for <Image> when displaying private DigitalOcean Spaces files.
 * Automatically fetches a pre-signed URL from /api/signed-url.
 *
 * Accepts either:
 *  - A new storage key:   "lms/clients/uuid/filename.png"
 *  - A legacy full URL:   "https://ambercashph.sgp1.digitaloceanspaces.com/lms/..."
 *  - A blob URL:          "blob:http://..." → used as-is (local upload preview)
 *  - null / undefined:    shows placeholder
 *
 * Props mirror Next.js <Image> — pass layout, objectFit, className etc. normally.
 * Pass `fallback` to override the default placeholder image.
 *
 * Usage:
 *   <PrivateImage src={client.profile} alt="Client" layout="fill" objectFit="cover" />
 */
export default function PrivateImage({ src, alt = 'Image', fallback, ...imageProps }) {
  const { signedUrl, loading } = useSignedUrl(src);
  const [imgError, setImgError] = useState(false);

  const fallbackSrc = fallback || placeholder;
  const displaySrc = loading || !signedUrl || imgError ? fallbackSrc : signedUrl;

  return (
    <Image
      {...imageProps}
      src={displaySrc}
      alt={alt}
      onError={() => setImgError(true)}
      // Reset error state when src changes
      key={signedUrl || 'placeholder'}
    />
  );
}