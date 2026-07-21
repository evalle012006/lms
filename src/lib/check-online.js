// Real connectivity check — navigator.onLine is unreliable on mobile.
// Returns true only if our server actually responds within timeoutMs.
export async function checkRealConnectivity(timeoutMs = 3000) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch('/api/ping', {
            method: 'HEAD',
            cache:  'no-store',
            signal: controller.signal,
        });
        clearTimeout(timer);
        return res.ok;
    } catch {
        return false;
    }
}