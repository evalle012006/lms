// Checks the face re-enrollment / activity / client-scope changes against a RUNNING server (staging/local). Node 18+.
// Required env: TOKEN_A (area_admin), TOKEN_S (admin), AREA_BRANCH_CODES (A's branch codes, comma-separated)
// Optional env: BASE_URL, TOKEN_LO (loan officer),
//               OTHER_CLIENT_ID (a client OUTSIDE A's area) and OWN_CLIENT_ID (a client INSIDE it) — skips discovery
// Reuses .env.verify, like verify-ci-api.mjs. Every write-path check below is built to be REFUSED before any write.
// Exit codes: 0 all passed · 1 a check failed · 2 NOTHING WAS VERIFIED (could not find a client to test with)
import dotenv from 'dotenv';
dotenv.config({ path: '.env.verify', override: true, quiet: true });
const E = process.env;
const BASE = (E.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
for (const k of ['TOKEN_A', 'TOKEN_S', 'AREA_BRANCH_CODES']) {
    if (!E[k]) { console.error(`Missing env ${k}`); process.exit(2); }
}
const AREA = new Set(E.AREA_BRANCH_CODES.split(',').map(s => s.trim()).filter(Boolean));
// tolerate a pasted "Bearer " prefix — call() adds it itself
const clean = (t) => (t ? t.replace(/^Bearer\s+/i, '').trim() : t);
const A = clean(E.TOKEN_A), S = clean(E.TOKEN_S), LO = clean(E.TOKEN_LO);

async function call(token, method, path, body) {
    const res = await fetch(BASE + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
const msg = (r) => r.json?.message || '';
const NF = /not found/i;
const L = '/api/v2/laf';
const clientOf = (r) => r?.promotedClientId || r?.existingClientId;

// ── discovery: one in-area and one out-of-area promoted client (or take them from env)
function summarize(label, r) {
    const rows = r.json?.applications || [];
    const withClient = rows.filter(x => clientOf(x));
    const outside = rows.filter(x => x.branchCode && !AREA.has(x.branchCode));
    const noCode = rows.filter(x => !x.branchCode);
    console.log(
        `INFO  ${label}: HTTP ${r.status}, success=${r.json?.success === true}, rows=${rows.length}, ` +
        `withClientId=${withClient.length}, outsideArea=${outside.length}` +
        `${noCode.length ? `, MISSING branchCode=${noCode.length}` : ''}` +
        `${r.json?.success === false || r.status >= 400 ? `, message="${msg(r)}"` : ''}`
    );
    return rows;
}
const q = (s) => `${L}/applications/list?status=${s}&limit=100&offset=0`;
const sRes = await call(S, 'GET', q('promoted'));
const aRes = await call(A, 'GET', q('promoted'));
const sRows = summarize('admin promoted list', sRes);
const aRows = summarize('area_admin promoted list', aRes);

// A rejected token makes every later check meaningless — say so plainly instead of guessing
const rejected = [['TOKEN_S', sRes], ['TOKEN_A', aRes]].filter(([, r]) => r.status === 401 || r.status === 403);
if (rejected.length) {
    console.log(`\nNOT VERIFIED: ${rejected.map(([n]) => n).join(' and ')} rejected by ${BASE} (HTTP ${rejected[0][1].status} "${msg(rejected[0][1])}").`);
    console.log('  • the token expired            -> log in again and copy a fresh one');
    console.log('  • wrong environment            -> BASE_URL must be the deployment that issued the token');
    console.log('  • token copied from the app    -> DevTools > Network > any /api/v2 request > Authorization header (the value after "Bearer ")');
    process.exit(2);
}
const seen = [...new Set(sRows.map(r => r.branchCode).filter(Boolean))];
if (seen.length) console.log(`INFO  branch codes seen by admin: ${seen.join(', ')}  |  AREA_BRANCH_CODES: ${[...AREA].join(', ')}`);

const otherApp = sRows.find(r => r.branchCode && !AREA.has(r.branchCode) && clientOf(r));
const ownApp   = aRows.find(r => clientOf(r));
const otherClientId = E.OTHER_CLIENT_ID || clientOf(otherApp);
const ownClientId   = E.OWN_CLIENT_ID   || clientOf(ownApp);

if (!otherClientId) {
    console.log('\nNOT VERIFIED: no client outside the area_admin\'s area could be found.');
    console.log('  • HTTP 401/403 or success=false above      -> TOKEN_S is expired or wrong (refresh .env.verify)');
    console.log('  • outsideArea=0                            -> staging has no promoted application outside that area, or AREA_BRANCH_CODES covers every branch');
    console.log('  • MISSING branchCode                       -> the list rows carry no branchCode; set OTHER_CLIENT_ID / OWN_CLIENT_ID instead');
    console.log('  Find ids with SQL, then put them in .env.verify:');
    console.log('    SELECT c."_id", b."code" FROM client c JOIN branches b ON b."_id" = c."branchId"');
    console.log("    WHERE b.\"code\" NOT IN ('<codes from AREA_BRANCH_CODES>') AND c.status IN ('active','pending') LIMIT 5;   -- OTHER_CLIENT_ID");
    console.log("    ... AND b.\"code\" IN ('<codes from AREA_BRANCH_CODES>') ...                                                    -- OWN_CLIENT_ID");
    process.exit(2);
}
console.log(`INFO  testing with OTHER_CLIENT_ID=${otherClientId}${ownClientId ? `, OWN_CLIENT_ID=${ownClientId}` : ' (no own-area client)'}`);

// A valid-looking recapture body: refused by role/scope/validation long before any write
const template = Array.from({ length: 128 }, () => 0.5);
const recaptureBody = (clientId, over = {}) => ({
    clientId, loanId: 'verify-script-loan', ciReferenceCode: 'VERIFY', faceTemplate: template,
    photoKey: 'verify.jpg', reason: 'verify script - must be refused', ...over,
});

// T1 clients GET: scope + no biometrics
const gS = await call(S, 'GET', `/api/v2/clients?clientId=${otherClientId}`);
check('T1 clients GET: control, admin can read other-area client', !!gS.json?.client, `HTTP ${gS.status} ${JSON.stringify(gS.json)?.slice(0, 120)}`);
check('T1 clients GET: no faceTemplate in the response', gS.json?.client && !('faceTemplate' in gS.json.client));
const gA = await call(A, 'GET', `/api/v2/clients?clientId=${otherClientId}`);
check('T1 clients GET: area_admin gets not-found for other-area client', gA.json?.success === true && gA.json?.client === null, JSON.stringify(gA.json)?.slice(0, 120));
if (ownClientId) {
    const gOwn = await call(A, 'GET', `/api/v2/clients?clientId=${ownClientId}`);
    check('T1 clients GET: area_admin can read an own-area client', !!gOwn.json?.client);
} else skip('T1 own client', 'no in-area client found (set OWN_CLIENT_ID)');

// T2 clients POST: out-of-scope is refused BEFORE any write
const pA = await call(A, 'POST', '/api/v2/clients', { _id: otherClientId });
check('T2 clients POST: area_admin gets not-found for other-area client', NF.test(msg(pA)), msg(pA));

// T3 for-review: scoped
const rS = await call(S, 'GET', `/api/v2/face-verify-attempts/for-review?clientId=${otherClientId}`);
const rA = await call(A, 'GET', `/api/v2/face-verify-attempts/for-review?clientId=${otherClientId}`);
check('T3 for-review: control, admin allowed', rS.json?.success === true);
check('T3 for-review: area_admin refused for other-area client', rA.json?.success === false, msg(rA));

// T4 activity: scoped, sanitized, role-gated
const acS = await call(S, 'GET', `/api/v2/clients/activity?clientId=${otherClientId}&limit=50`);
const acA = await call(A, 'GET', `/api/v2/clients/activity?clientId=${otherClientId}&limit=50`);
check('T4 activity: control, admin allowed', acS.json?.success === true && Array.isArray(acS.json?.events));
check('T4 activity: area_admin refused for other-area client', acA.json?.success === false, msg(acA));
const leaked = JSON.stringify(acS.json?.events || []).match(/beforeData|afterData|ipAddress|userAgent|faceTemplate/);
check('T4 activity: no raw audit / biometric fields in events', !leaked, leaked?.[0]);
if (LO) {
    const acL = await call(LO, 'GET', `/api/v2/clients/activity?clientId=${ownClientId || otherClientId}`);
    check('T4 activity: loan officer refused', acL.json?.success === false, msg(acL));
} else skip('T4 role refusal', 'set TOKEN_LO to test');

// T5 recapture-face: refusals only (nothing here can reach a write)
const rcA = await call(A, 'POST', '/api/v2/clients/recapture-face', recaptureBody(otherClientId));
check('T5a recapture: area_admin gets not-found for other-area client', NF.test(msg(rcA)), msg(rcA));
const rcS = await call(S, 'POST', '/api/v2/clients/recapture-face', recaptureBody(otherClientId, { reason: 'short' }));
check('T5b recapture: endpoint reachable, short reason refused', /reason of at least/i.test(msg(rcS)), msg(rcS));
if (LO) {
    const rcL = await call(LO, 'POST', '/api/v2/clients/recapture-face', recaptureBody(otherClientId));
    check('T5c recapture: loan officer refused', /only an admin/i.test(msg(rcL)), msg(rcL));
} else skip('T5c recapture role refusal', 'set TOKEN_LO to test');

// T6 override: administrators only
const ovA = await call(A, 'POST', '/api/v2/face-verify-attempts/override', recaptureBody(otherClientId));
check('T6a override: area_admin (not an administrator) refused', /administrator/i.test(msg(ovA)), msg(ovA));
const ovS = await call(S, 'POST', '/api/v2/face-verify-attempts/override', { ...recaptureBody(otherClientId), reason: 'short' });
check('T6b override: endpoint reachable, short reason refused', /reason of at least/i.test(msg(ovS)), msg(ovS));
if (LO) {
    const ovL = await call(LO, 'POST', '/api/v2/face-verify-attempts/override', recaptureBody(otherClientId));
    check('T6c override: loan officer refused', /administrator/i.test(msg(ovL)), msg(ovL));
} else skip('T6c override role refusal', 'set TOKEN_LO to test');

// T7 laf-ci-history scope (only passes once step 18 is applied)
const hS = await call(S, 'GET', `/api/v2/clients/laf-ci-history?clientId=${otherClientId}`);
const hA = await call(A, 'GET', `/api/v2/clients/laf-ci-history?clientId=${otherClientId}`);
check('T7 laf-ci-history: control, admin allowed', hS.json?.success === true);
check('T7 laf-ci-history: area_admin refused for other-area client (step 18)', hA.json?.success === false, msg(hA));

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed');
process.exit(failed ? 1 : 0);