// Opens the camera and guarantees nobody is left holding a live stream.
export function stopStream(stream) {
    if (!stream || typeof stream.getTracks !== 'function') return;
    stream.getTracks().forEach((t) => { try { t.stop(); } catch { /* already stopped */ } });
}

/**
 * streamRef  — { current } the caller keeps its stream in
 * isActive   — () => boolean; false once the caller has unmounted
 * Throws whatever getUserMedia throws (NotAllowedError etc.).
 */
export async function openCameraStream({ streamRef, isActive = () => true, constraints }) {
    // A second open (double click) must not orphan the first stream
    stopStream(streamRef.current);
    streamRef.current = null;

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    // The component unmounted while the camera was opening: release it right away
    if (!isActive()) {
        stopStream(stream);
        return null;
    }
    streamRef.current = stream;
    return stream;
}