// Lightweight connectivity probe — no auth, no DB, returns 200 instantly.
// Used by offline components to verify real internet before uploading.
export default function handler(req, res) {
    res.status(200).end();
}