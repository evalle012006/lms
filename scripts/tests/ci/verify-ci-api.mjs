// Checks the CI scoping changes against a RUNNING server (staging/local). Node 18+.
// Required env: TOKEN_A (area_admin), TOKEN_S (admin), AREA_BRANCH_CODES (A's branch codes, comma-separated)
// Optional env: BASE_URL, TOKEN_LO, LAF_API_KEY, GROUP_ID, QR_TOKEN
import dotenv from 'dotenv';
dotenv.config({ path: '.env.verify', override: true, quiet: true });   // the file always wins over stale shell exports
const E = process.env;
const BASE = (E.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
for (const k of ['TOKEN_A', 'TOKEN_S', 'AREA_BRANCH_CODES']) {
    if (!E[k]) { console.error(`Missing env ${k}`); process.exit(2); }
}
const AREA = new Set(E.AREA_BRANCH_CODES.split(',').map(s => s.trim()).filter(Boolean));
const A = E.TOKEN_A, S = E.TOKEN_S;

async function call(token, method, path, body, headers = {}) {
    const res = await fetch(BASE + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json };
}
let failed = 0;
const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  -> ${detail}`}`);
    if (!ok) failed++;
};
const skip = (name, why) => console.log(`SKIP  ${name}  -> ${why}`);
const msg = (r) => r.json?.message || r.json?.errorMsg?.[0] || '';
const NF = /not found/i;
const L = '/api/v2/laf';

// ── discovery as admin: one in-area and one out-of-area application
const q = (s) => `${L}/applications/list?status=${s}&limit=100&offset=0`;
const sPending  = await call(S, 'GET', q('pending'));
const sPromoted = await call(S, 'GET', q('promoted'));
const otherPending  = (sPending.json?.applications  || []).find(r => !AREA.has(r.branchCode) && r.lafPhotoKey);
const otherPromoted = (sPromoted.json?.applications || []).find(r => !AREA.has(r.branchCode));

// T1 list
const aList = await call(A, 'GET', q('pending'));
const aRows = aList.json?.applications || [];
check('T1 list: area_admin gets rows', aList.json?.success === true && aRows.length > 0, JSON.stringify(aList.json)?.slice(0, 120));
const outside = [...new Set(aRows.map(r => r.branchCode).filter(c => !AREA.has(c)))];
check('T1 list: every row is in the area', outside.length === 0,
    `outside AREA_BRANCH_CODES: ${outside.join(',')} (if they belong to the area_admin's area, add them to AREA_BRANCH_CODES)`);
check('T1 list: total is smaller than admin total', (aList.json?.total ?? 0) < (sPending.json?.total ?? Infinity));
check('T1 list: no faceTemplate / governmentIdNumber in rows', aRows.every(r => !('faceTemplate' in r) && !('governmentIdNumber' in r)));
const own = aRows[0];

// T2 detail
if (own) {
    const d = await call(A, 'GET', `${L}/ci/${encodeURIComponent(own.ciReferenceCode)}`);
    check('T2 detail: own CI opens', d.json?.success === true);
    check('T2 detail: no faceTemplate, has hasFaceTemplate flag',
        d.json?.application && !('faceTemplate' in d.json.application) && typeof d.json.application.hasFaceTemplate === 'boolean');
}
if (otherPending) {
    const code = encodeURIComponent(otherPending.ciReferenceCode);
    const dA = await call(A, 'GET', `${L}/ci/${code}`);
    const dS = await call(S, 'GET', `${L}/ci/${code}`);
    check('T2 detail: control, admin can open it', dS.json?.success === true);
    check('T2 detail: area_admin cannot open other-area CI', dA.json?.success === false, msg(dA));
} else skip('T2 other-area detail', 'no out-of-area pending application found');

// T3 duplicate queue
const pvA = await call(A, 'GET', `${L}/pending-validation-list?limit=50`);
const pvS = await call(S, 'GET', `${L}/pending-validation-list?limit=50`);
check('T3 dup queue: A is a subset of admin total', (pvA.json?.total ?? 0) <= (pvS.json?.total ?? 0));
check('T3 dup queue: no faceTemplate in rows', (pvA.json?.applications || []).every(r => !('faceTemplate' in r)));

// T4 signed URLs
if (own && otherPending) {
    const keys = [own.lafPhotoKey, otherPending.lafPhotoKey];
    const uA = await call(A, 'POST', '/api/signed-url-bulk', { keys });
    const uS = await call(S, 'POST', '/api/signed-url-bulk', { keys });
    check('T4 signed urls: control, admin gets both', !!uS.json?.urlMap?.[keys[0]] && !!uS.json?.urlMap?.[keys[1]]);
    check('T4 signed urls: A gets own, not the other area', !!uA.json?.urlMap?.[keys[0]] && !uA.json?.urlMap?.[keys[1]]);
} else skip('T4 signed urls', 'need an own and an out-of-area pending application');

// T5 write endpoints, against an already-promoted OTHER-area application (nothing can change)
if (otherPromoted) {
    const code = otherPromoted.ciReferenceCode;
    const inv = (t) => call(t, 'POST', `${L}/ci/investigate`, {
        ciReferenceCode: code, tempApplicationId: otherPromoted._id, decision: 'declined',
        declineReason: 'verify-script', businessVerified: true, addressVerified: true, ciAnswers: [],
    });
    const [iA, iS] = [await inv(A), await inv(S)];
    if (!/already been promoted/i.test(msg(iS))) skip('T5a investigate', `control did not reach the promoted check (${msg(iS)})`);
    else check('T5a investigate: A cannot see other-area application', NF.test(msg(iA)), msg(iA));

    const pr = (t) => call(t, 'POST', `${L}/promote/${encodeURIComponent(code)}`);
    const [pA, pS] = [await pr(A), await pr(S)];
    check('T5b promote: A gets not-found, admin reaches the status check', NF.test(msg(pA)) && !NF.test(msg(pS)), `A:"${msg(pA)}" S:"${msg(pS)}"`);

    const as = (t) => call(t, 'POST', `${L}/applications/assign`, { applicationIds: [otherPromoted._id], action: 'claim' });
    const [aA, aS] = [await as(A), await as(S)];
    check('T5c assign: A gets not-found, admin reaches the pending check', NF.test(msg(aA)) && !NF.test(msg(aS)), `A:"${msg(aA)}" S:"${msg(aS)}"`);

    const vd = (t) => call(t, 'POST', `${L}/validate-duplicate`, { ciReferenceCode: code, action: 'approve' });
    const [vA, vS] = [await vd(A), await vd(S)];
    check('T5d validate-duplicate: A gets not-found', NF.test(msg(vA)) && !NF.test(msg(vS)), `A:"${msg(vA)}" S:"${msg(vS)}"`);

    if (E.TOKEN_LO) {
        const iL = await inv(E.TOKEN_LO);
        check('T5e investigate: loan officer is refused', /not allowed/i.test(msg(iL)), msg(iL));
    } else skip('T5e role refusal', 'set TOKEN_LO to test');

    // T6 client-level endpoints
    const otherClientId = otherPromoted.promotedClientId || otherPromoted.existingClientId;
    if (otherClientId && own) {
        const bi = await call(A, 'POST', '/api/v2/clients/by-ids', { ids: [otherClientId], ciReferenceCode: own.ciReferenceCode });
        check('T6a by-ids: other-area client is not returned', (bi.json?.clients || []).length === 0);
        const ftA = await call(A, 'GET', `/api/v2/clients/face-template?clientId=${otherClientId}`);
        const ftS = await call(S, 'GET', `/api/v2/clients/face-template?clientId=${otherClientId}`);
        check('T6b face-template: control, admin can read', ftS.json?.success === true);
        check('T6b face-template: A cannot read another area client', ftA.json?.success === false, msg(ftA));
    } else skip('T6 client endpoints', 'no client id found on the other-area application');
} else skip('T5/T6', 'no out-of-area promoted application found');

// T7 group-leader-check
if (otherPending?.groupId) {
    const gA = await call(A, 'GET', `${L}/group-leader-check?groupId=${otherPending.groupId}`);
    const gS = await call(S, 'GET', `${L}/group-leader-check?groupId=${otherPending.groupId}`);
    check('T7 group-leader-check: control, admin ok', gS.json?.success === true);
    check('T7 group-leader-check: A refused for another area group', gA.json?.success === false, msg(gA));
}

// T8 public lookup (needs LAF_API_KEY + GROUP_ID)
if (E.LAF_API_KEY && E.GROUP_ID) {
    const h = { 'x-laf-api-key': E.LAF_API_KEY };
    const noTok = await call(null, 'GET', `/api/public/laf/lookup-client?mode=all&groupId=${E.GROUP_ID}`, undefined, h);
    check('T8 lookup-client: no QR token is refused',
        noTok.json?.success === false && /QR/i.test(noTok.json?.message || ''),
        `status ${noTok.status} ${JSON.stringify(noTok.json)?.slice(0, 160)}`);
    if (E.QR_TOKEN) {
        const ok = await call(null, 'GET', `/api/public/laf/lookup-client?mode=all&groupId=${E.GROUP_ID}&qrToken=${encodeURIComponent(E.QR_TOKEN)}`, undefined, h);
        check('T8 lookup-client: valid token works', ok.json?.success === true,
            `status ${ok.status} ${JSON.stringify(ok.json)?.slice(0, 160)}`);
        const withId = (ok.json?.clients || []).filter(c => c.governmentIdNumber);
        if (ok.json?.success !== true || withId.length === 0) {
            skip('T8 lookup-client: ID numbers are masked', 'no client with an ID number in the response to inspect');
        } else {
            check('T8 lookup-client: ID numbers are masked',
                withId.every(c => c.governmentIdNumber.includes('•')),
                withId.slice(0, 3).map(c => c.governmentIdNumber).join(','));
        }
    }
} else skip('T8 public lookup', 'set LAF_API_KEY and GROUP_ID (and QR_TOKEN) to test');

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed');
process.exit(failed ? 1 : 0);