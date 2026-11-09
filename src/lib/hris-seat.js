/**
 * hris-seat.js  ->  lms/src/lib/hris-seat.js
 * ------------------------------------------
 * Shared building blocks for the /api/v2/hris/* endpoints.
 * A "seat" is a row in `users`. See database/postgre-migrations/004_hris_integration.sql.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createGraphType, queryQl, updateQl, insertQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';

const bcrypt = require('bcryptjs');

// ── GraphQL type refs (call with a unique alias per statement) ───────────────
export const USER_REF    = createGraphType('users', '_id');
export const HISTORY_REF = createGraphType('hris_seat_history', '_id');
export const MIRROR_REF  = createGraphType('hris_user_sync', '_id');

/** users.root can be NULL on old rows, and `_neq: true` would silently drop those. */
export const NOT_ROOT = { _or: [{ root: { _eq: false } }, { root: { _is_null: true } }] };

export const SEAT_FIELDS = `
    _id email firstName lastName number position profile role status root loNo
    employee_no isVacant designatedBranch areaId regionId divisionId
`;

// ── small helpers ────────────────────────────────────────────────────────────
export const sendJson = (res, body, status = 200) =>
    res.status(status)
        .setHeader('Content-Type', 'application/json')
        .setHeader('Cache-Control', 'no-store')
        .end(JSON.stringify(body));

export const nz = (v) => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
};
export const normalizeEmployeeNo = (v) => {
    const s = String(v ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
    return s || null;
};
export const normalizeCode = (v) => String(v ?? '').trim().toUpperCase();
export const today = () => new Date().toISOString().slice(0, 10);
export const roleLabel = (shortCode) =>
    String(shortCode || '').split('_').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const dateOnly = (v) => {
    const s = nz(v);
    return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

const sortKeys = (o) =>
    Array.isArray(o) ? o.map(sortKeys)
    : o && typeof o === 'object' ? Object.keys(o).sort().reduce((a, k) => { a[k] = sortKeys(o[k]); return a; }, {})
    : o;
export const stableHash = (obj) =>
    crypto.createHash('sha1').update(JSON.stringify(sortKeys(obj))).digest('hex');

/** A password nobody knows. NEVER blank: a blank password goes into the NO_PASS login flow. */
export const unusablePasswordHash = () =>
    bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), bcrypt.genSaltSync(8), null);

/**
 * Branch code a seat belongs to. For branch_manager / cashier / loan_officer, users.designatedBranch
 * holds the SAME code as branches.code (in LMS and HRIS). That code is the ONLY branch key used here:
 * designatedBranchId is never read, because HRIS has no mapping for it. Area admins store a JSON list in
 * designatedBranch: that is not one code, so it returns null. A seat with no code is never vacated for a
 * branch change; it only produces a warning.
 */
export function seatBranchCode(seat) {
    const raw = nz(seat?.designatedBranch);
    return raw && !/^[\[{]/.test(raw) ? normalizeCode(raw) : null;
}

/** Escape regex metacharacters so a branch code is matched literally. */
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Hasura filter: accounts whose designatedBranch IS this branch code. Case-insensitive and tolerant of
 * stray spaces, because some LMS branch codes are stored with a trailing space (e.g. "B144 ").
 */
export const branchFilter = (branch) => ({
    designatedBranch: { _iregex: `^\\s*${escapeRegex(String(branch.code).trim())}\\s*$` },
});

// ── loaders ──────────────────────────────────────────────────────────────────
export async function loadBranches(graph) {
    const rows = await graph
        .query(queryQl(createGraphType('branches', '_id code name')('branches'), {}))
        .then((r) => r.data?.branches ?? []);
    const byId = new Map();
    const byCode = new Map();
    rows.forEach((b) => {
        byId.set(b._id, b);
        if (b.code) byCode.set(normalizeCode(b.code), b);
    });
    return { rows, byId, byCode };
}

export async function loadSeatsByEmployeeNos(graph, nos) {
    if (!nos.length) return new Map();
    const rows = await graph
        .query(queryQl(createGraphType('users', SEAT_FIELDS)('seats_by_no'), {
            where: { employee_no: { _in: nos } },
        }))
        .then((r) => r.data?.seats_by_no ?? []);
    return new Map(rows.map((u) => [u.employee_no, u]));
}

export async function loadSeatById(graph, id) {
    const [row] = await graph
        .query(queryQl(createGraphType('users', SEAT_FIELDS)('seat_by_id'), { where: { _id: { _eq: id } } }))
        .then((r) => r.data?.seat_by_id ?? []);
    return row ?? null;
}

// ── payloads ─────────────────────────────────────────────────────────────────
const CLEARED_BIOMETRIC = {
    biometricCredentialId: null,
    biometricPublicKey: null,
    biometricCounter: 0,
    biometricRegisteredAt: null,
    biometricDeviceName: null,
};
const CLEARED_SESSION = { logged: false, lastLogin: null, loginAttempts: 0, lockedUntil: null };

const hasLoNo = (loNo) => loNo !== null && loNo !== undefined && loNo !== '';
export const squash = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');

/**
 * Names as the LMS shows them. LMS convention for loan officers: firstName = "LO{n} - FIRST NAMES",
 * lastName = surname (e.g. "LO3 - JEFFREY" / "ABABON"). That is kept for loan-officer seats; other roles
 * use the plain HRIS names.
 */
export function personNames(staff, seat) {
    const first = squash(staff.first_name);
    const last = squash(staff.last_name);
    if (seat?.role?.shortCode !== 'loan_officer' || !hasLoNo(seat.loNo)) return { firstName: first, lastName: last };
    return { firstName: `LO${Number(seat.loNo)} - ${first}`.trim(), lastName: last };
}

/**
 * What a VACANT seat looks like. Keeps: _id, email, role, branch/area ids, loNo.
 * Loan officers get the LMS placeholder convention "LO {n} {branch name}" (e.g. "LO 6 Zamboanga I").
 */
export function vacantSet({ role, branchCode, branchName, loNo }) {
    const lo = role === 'loan_officer' && hasLoNo(loNo);
    return {
        firstName: lo ? `LO ${Number(loNo)} ${branchName ?? branchCode ?? ''}`.trim() : 'Vacant',
        lastName: lo ? '' : `${roleLabel(role)}${branchCode ? ` ${branchCode}` : ''}`,
        number: null,
        profile: null,
        position: roleLabel(role),
        employee_no: null,
        isVacant: true,
        password: unusablePasswordHash(),
        mustChangePassword: true,
        status: 'active',
        dateModified: today(),
        ...CLEARED_BIOMETRIC,
        ...CLEARED_SESSION,
    };
}

/** What an OCCUPIED seat looks like right after assignment. */
export function assignSet({ staff, passwordHash, seat }) {
    return {
        ...personNames(staff, seat),
        number: nz(staff.contact),
        position: nz(staff.position),
        employee_no: normalizeEmployeeNo(staff.employee_no),
        isVacant: false,
        password: passwordHash,
        mustChangePassword: true,
        status: 'active',
        dateModified: today(),
        ...CLEARED_BIOMETRIC,
        ...CLEARED_SESSION,
    };
}

/** Person fields kept in step with HRIS on an already-occupied seat. */
export const refreshSet = (staff, seat) => ({
    ...personNames(staff, seat),
    number: nz(staff.contact),
    position: nz(staff.position),
    dateModified: today(),
});

// ── statements ───────────────────────────────────────────────────────────────
/** Reset a seat + close its history row + clear the HRIS block flag. One mutation, one transaction. */
export function vacateStatements({ seat, reason, actor, branches, alias }) {
    const now = new Date().toISOString();
    const branchCode = seatBranchCode(seat);
    const branchName = branchCode ? branches?.byCode?.get(branchCode)?.name : undefined;
    return [
        updateQl(USER_REF(`${alias}_user`), {
            where: { _id: { _eq: seat._id } },
            set: vacantSet({ role: seat.role?.shortCode, branchCode, branchName, loNo: seat.loNo }),
        }),
        updateQl(HISTORY_REF(`${alias}_hist`), {
            where: { seat_id: { _eq: seat._id }, vacated_at: { _is_null: true } },
            set: { vacated_at: now, vacated_reason: reason, vacated_by: actor },
        }),
        ...(seat.employee_no
            ? [updateQl(MIRROR_REF(`${alias}_mirror`), {
                where: { employee_no: { _eq: seat.employee_no } },
                set: { access_blocked: false, modified_date: now },
            })]
            : []),
    ];
}

export const historyInsert = (alias, row) =>
    insertQl(HISTORY_REF(alias), { objects: [row] });

// ── mirror (hris_user_sync) ──────────────────────────────────────────────────
export function mirrorBase(s) {
    const branchId = s.branch_id === null || s.branch_id === undefined || s.branch_id === '' ? null : Number(s.branch_id);
    return {
        hris_id: String(s.id),
        employee_no: normalizeEmployeeNo(s.employee_no),
        company_id: nz(s.company_id),
        first_name: nz(s.first_name),
        last_name: nz(s.last_name),
        middle_name: nz(s.middle_name),
        full_name: nz(s.fullname ?? s.full_name),
        email: nz(s.email),
        contact: nz(s.contact),
        status: nz(s.status),
        position: nz(s.position),
        department: nz(s.department),
        area: nz(s.area),
        region: nz(s.region),
        division: nz(s.division),
        hris_branch_id: Number.isFinite(branchId) ? branchId : null,
        hris_branch_code: nz(s.branch_code),
        hris_branch_name: nz(s.branch_name),
        start_date: dateOnly(s.start_date),
        regularization_date: dateOnly(s.regularization_date),
        address: nz(s.address),
        municipality: nz(s.municipality),
        province: nz(s.province),
        on_leave: s.on_leave === true,
    };
}

/** Full hris_user_sync row for an insert/upsert. payload_hash lets sync skip unchanged rows. */
export function mirrorRowFor(s, now = new Date().toISOString()) {
    const base = mirrorBase(s);
    return {
        _id: generateUUID(),
        ...base,
        payload_hash: stableHash(base),
        raw_payload: s,
        last_synced_at: now,
        modified_date: now,
    };
}

export const MIRROR_UPDATE_COLUMNS = [
    'employee_no', 'company_id', 'first_name', 'last_name', 'middle_name', 'full_name', 'email', 'contact',
    'status', 'position', 'department', 'area', 'region', 'division',
    'hris_branch_id', 'hris_branch_code', 'hris_branch_name',
    'start_date', 'regularization_date', 'address', 'municipality', 'province',
    'on_leave', 'payload_hash', 'raw_payload', 'last_synced_at', 'modified_date',
];

/** Upsert mirror rows keyed on hris_id. `rows` come from mirrorRowFor(). */
export const mirrorUpsert = (alias, rows) =>
    insertQl(MIRROR_REF(alias), {
        objects: rows,
        on_conflict: { constraint: 'hris_user_sync_hris_id_key', update_columns: MIRROR_UPDATE_COLUMNS },
    });

// ── seat presentation (for the HRIS dropdown) ────────────────────────────────
export function seatView(u, { branchesByCode, namesById = new Map() }) {
    const code = seatBranchCode(u);
    const branch = (code && branchesByCode?.get(code)) || null;
    const scope =
        code ? `${code} ${branch?.name ?? ''}`.trim()
        : u.areaId && u.role?.shortCode === 'area_admin' ? namesById.get(u.areaId)
        : u.regionId && u.role?.shortCode === 'regional_manager' ? namesById.get(u.regionId)
        : u.divisionId && u.role?.shortCode === 'deputy_director' ? namesById.get(u.divisionId)
        : null;
    const loTag = u.loNo !== null && u.loNo !== undefined ? `LO #${Number(u.loNo)}` : null;
    return {
        _id: u._id,
        email: u.email,
        loNo: u.loNo === null || u.loNo === undefined ? null : Number(u.loNo),
        role: u.role?.shortCode ?? null,
        branch_code: code ?? null,
        branch_name: branch?.name ?? null,
        scope: scope ?? null,
        kind: u.isVacant ? 'vacant' : u.employee_no ? 'linked' : 'unlinked',
        name: u.isVacant ? null : `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || null,
        label: [u.isVacant ? null : `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(), loTag, scope, u.email]
            .filter(Boolean).join(' · '),
    };
}

// ── profile picture cleanup (best effort, after a successful vacate) ─────────
const PROFILE_DIR = path.resolve('./public/images/profiles');
export function removeProfileFile(profile) {
    try {
        if (!profile) return;
        const target = path.join(PROFILE_DIR, path.basename(String(profile)));
        if (!target.startsWith(PROFILE_DIR + path.sep)) return;
        fs.rmSync(target, { recursive: true, force: true });
    } catch (e) {
        console.error('[hris-seat] profile cleanup failed:', e.message);
    }
}