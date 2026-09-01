// src/components/settings/users/AddUpdateUserPage.js
//
// v3 — addresses this round's feedback:
//  1. Assignment card redesigned as a vertical stepped hierarchy (icon per
//     level, connecting line, Branch visually terminal) instead of one
//     wrapped line of text.
//  2. Position field moved out of Basic Information and into Role &
//     Assignment, directly under Role — matches the fact that Position now
//     auto-fills FROM Role, so visually pairing them makes the relationship
//     legible instead of implicit.
//  3. LO Number: the OLD drawer (AddUpdateUserDrawer.js) treated this as a
//     fixed 1–20 select, not free text — my earlier FormInput version was
//     wrong, not just unpolished. Restored as a select, and it's now
//     auto-suggested: on selecting a branch for a Loan Officer role, this
//     fetches that branch's existing LOs, computes which of 1–20 are taken,
//     and pre-selects the lowest free number. Taken numbers are shown
//     disabled in the dropdown rather than silently hidden, so a BM can see
//     why 1–3 aren't offered instead of wondering if the list is broken.
//  4. Field clearing: previously, switching role only cleared fields at
//     SUBMIT time (via the transactionType/occurence conditionals in
//     handleSaveUpdate) — the underlying Formik state for now-hidden fields
//     (loNo, designatedBranch, areaId/regionId/divisionId) kept whatever was
//     last typed until save. That's a real bug, not just messy state:
//     switch Role A → B → back to A without saving, and B's leftover values
//     could still be sitting in fields A doesn't render but DOES submit.
//     clearIrrelevantFields() now runs on every role change and every branch
//     change, and buildHierarchyPayload() was tightened to explicitly null
//     every hierarchy-ish field for roles that don't use it (mirrors
//     buildHierarchyFields in pages/api/v2/users/save.js, including its
//     rep===1 branch, which the last version silently skipped).

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Formik } from 'formik';
import * as yup from 'yup';
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
    UserIcon, ShieldCheckIcon, MapPinIcon, CameraIcon,
    TrashIcon, ChevronDownIcon, BuildingLibraryIcon,
    GlobeAltIcon, Squares2X2Icon, BuildingOffice2Icon,
    LockClosedIcon, FingerPrintIcon, KeyIcon,
    ClipboardIcon, CheckIcon,
} from '@heroicons/react/24/outline';

import { fetchWrapper } from "@/lib/fetch-wrapper";
import { getApiBaseUrl, ACCELERATED_WEEKLY_CATEGORIES } from "@/lib/constants";
import { checkFileSize, generateUUID, UppercaseFirstLetter } from "@/lib/utils";
import { setBranchList } from "@/redux/actions/branchActions";
import { setAreaList } from "@/redux/actions/areaActions";
import { setRegionList } from "@/redux/actions/regionActions";
import { setDivisionList } from "@/redux/actions/divisionActions";

import moment from "moment";
import Spinner from "@/components/Spinner";
import PrivateImage from "@/components/common/PrivateImage";

const LO_NUMBER_RANGE = Array.from({ length: 20 }, (_, i) => i + 1);

// ─────────────────────────────────────────────────────────────────────────
// Custom form primitives — not @/lib/ui/InputText or @/lib/ui/select.
// ─────────────────────────────────────────────────────────────────────────

const FormInput = ({ name, label, value, onChange, placeholder, disabled, error, type = 'text' }) => (
    <div className="w-full">
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
        <input
            id={name} name={name} type={type} value={value ?? ''} onChange={onChange}
            placeholder={placeholder} disabled={disabled} autoComplete="off"
            className={`
                w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900
                placeholder:text-gray-400 transition-colors
                focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500
                disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
                ${error ? 'border-red-400' : 'border-gray-300'}
            `}
        />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
);

const FormSelect = ({ name, label, value, options = [], onChange, placeholder = 'Select…', disabled, error, hint }) => {
    const selected = options.find(o => String(o.value) === String(value));
    return (
        <div className="w-full">
            <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
            <div className="relative">
                <select
                    id={name} name={name} value={value ?? ''} disabled={disabled}
                    onChange={(e) => onChange(name, e.target.value)}
                    className={`
                        w-full appearance-none rounded-lg border px-3.5 py-2.5 pr-9 text-sm
                        bg-white transition-colors cursor-pointer
                        focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500
                        disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
                        ${selected ? 'text-gray-900' : 'text-gray-400'}
                        ${error ? 'border-red-400' : 'border-gray-300'}
                    `}
                >
                    <option value="" disabled>{placeholder}</option>
                    {options.map(opt => (
                        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                            {opt.label}{opt.disabled ? ' (taken)' : ''}
                        </option>
                    ))}
                </select>
                <ChevronDownIcon className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
    );
};

const SegmentedControl = ({ name, label, value, options, onChange }) => (
    <div className="w-full">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
        <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-1 gap-1">
            {options.map(opt => {
                const active = value === opt.value;
                return (
                    <button
                        key={opt.value} type="button" onClick={() => onChange(name, opt.value)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            active ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    </div>
);

// Shown once after creating a user or resetting a password. Deliberately a
// blocking modal, not a toast — a toast auto-dismisses and this is the only
// place the plaintext password ever appears, so it needs to stay up until
// the admin has actually copied or written it down.
export const PasswordRevealModal = ({ password, context, userName, onClose }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(password);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard API can fail (permissions, non-HTTPS context) —
            // the password is still selectable/visible, so this isn't fatal.
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                        <KeyIcon className="w-5 h-5 text-teal-600" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900">
                        {context === 'created' ? 'User Created' : 'Password Reset'}
                    </h3>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                    {context === 'created'
                        ? `Here's the temporary password for ${userName || 'this user'}. Write it down or copy it now — it won't be shown again.`
                        : `Here's the new temporary password for ${userName || 'this user'}. Write it down or copy it now — it won't be shown again.`}
                </p>

                <div className="flex items-center gap-2 mb-2">
                    <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-lg font-mono font-semibold tracking-widest text-center text-gray-900">
                        {password}
                    </code>
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="px-3 py-3 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 transition-colors flex-shrink-0"
                        title="Copy to clipboard"
                    >
                        {copied ? <CheckIcon className="w-5 h-5 text-teal-600" /> : <ClipboardIcon className="w-5 h-5" />}
                    </button>
                </div>
                {copied && <p className="text-xs text-teal-600 mb-4">Copied to clipboard.</p>}
                {!copied && <div className="mb-4" />}

                <p className="text-xs text-gray-400 mb-5">
                    The user will be asked to set a new password on first login.
                </p>

                <button
                    type="button"
                    onClick={onClose}
                    className="w-full px-4 py-2.5 rounded-lg bg-teal-600 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
                >
                    I've saved it — Continue
                </button>
            </div>
        </div>
    );
};

const SectionCard = ({ icon: Icon, title, subtitle, children }) => (
    <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
            {Icon && <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />}
            <div>
                <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
    </div>
);

// ── Assignment — vertical stepped hierarchy ─────────────────────────────
const HIERARCHY_LEVELS = [
    { key: 'division', icon: GlobeAltIcon },
    { key: 'region',   icon: Squares2X2Icon },
    { key: 'area',     icon: BuildingLibraryIcon },
    { key: 'branch',   icon: BuildingOffice2Icon },
];

const AssignmentHierarchy = ({ chain }) => {
    const hasAny = chain && (chain.division || chain.region || chain.area || chain.branch);
    if (!hasAny) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center">
                <MapPinIcon className="w-8 h-8 text-gray-200 mb-2" />
                <p className="text-xs text-gray-400">Select an assignment above to see where this person sits in the org.</p>
            </div>
        );
    }

    const levels = HIERARCHY_LEVELS.filter(l => chain[l.key]);

    return (
        <div className="py-1">
            {levels.map((level, i) => {
                const isLast = i === levels.length - 1;
                const Icon = level.icon;
                return (
                    <div key={level.key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                            <div className={`
                                w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
                                ${isLast ? 'bg-teal-600' : 'bg-teal-100'}
                            `}>
                                <Icon className={`w-3.5 h-3.5 ${isLast ? 'text-white' : 'text-teal-600'}`} />
                            </div>
                            {!isLast && <div className="w-px flex-1 bg-teal-200 my-0.5" style={{ minHeight: '1.25rem' }} />}
                        </div>
                        <div className={`pb-4 ${isLast ? '' : ''}`}>
                            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">
                                {level.key}
                            </p>
                            <p className={`text-sm ${isLast ? 'font-semibold text-teal-700' : 'text-gray-600'}`}>
                                {UppercaseFirstLetter(chain[level.key])}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// Resolves the Division/Region/Area/Branch chain to display in the Assignment
// card. Which fields matter depends on the role: branch-based roles (rep>=3)
// resolve everything from the selected branch; rep 2 roles resolve from
// whichever single node they pick (area_admin→area, regional_manager→region,
// deputy_director→division) and inherit the parents from that node's record.
const resolveAssignmentChain = (selectedRole, values, { branchList, areaList, regionList, divisionList }) => {
    if (!selectedRole) return {};

    if (selectedRole.rep >= 3) {
        const branch = branchList.find(b => b.code === values.designatedBranch);
        if (!branch) return {};
        return {
            division: divisionList.find(d => d._id === branch.divisionId)?.name,
            region: regionList.find(r => r._id === branch.regionId)?.name,
            area: areaList.find(a => a._id === branch.areaId)?.name,
            branch: branch.name ? `${branch.name}${branch.code ? ` (${branch.code})` : ''}` : null,
        };
    }

    if (selectedRole.shortCode === 'area_admin') {
        const area = areaList.find(a => a._id === values.areaId);
        if (!area) return {};
        return {
            division: divisionList.find(d => d._id === area.divisionId)?.name,
            region: regionList.find(r => r._id === area.regionId)?.name,
            area: area.name,
        };
    }

    if (selectedRole.shortCode === 'regional_manager') {
        const region = regionList.find(r => r._id === values.regionId);
        if (!region) return {};
        return {
            division: divisionList.find(d => d._id === region.divisionId)?.name,
            region: region.name,
        };
    }

    if (selectedRole.shortCode === 'deputy_director') {
        const division = divisionList.find(d => d._id === values.divisionId);
        if (!division) return {};
        return { division: division.name };
    }

    return {};
};

// Role → hierarchy field derivation, mirrors buildHierarchyFields server-side
// in pages/api/v2/users/save.js — including its explicit-null rep===1 case.
const buildHierarchyPayload = (selectedRole, values, { areaList, regionList, divisionList, branchList }) => {
    const base = { areaId: null, regionId: null, divisionId: null, designatedBranchId: null, designatedBranch: null, loNo: null };

    if (selectedRole.rep === 1) {
        return base;
    }

    if (selectedRole.rep === 2) {
        if (selectedRole.shortCode === 'area_admin') {
            const a = areaList.find(a => a._id === values.areaId);
            return { ...base, areaId: a?._id ?? null, regionId: a?.regionId ?? null, divisionId: a?.divisionId ?? null, designatedBranch: values.designatedBranch || '[]' };
        }
        if (selectedRole.shortCode === 'regional_manager') {
            const r = regionList.find(r => r._id === values.regionId);
            return { ...base, regionId: r?._id ?? null, divisionId: r?.divisionId ?? null };
        }
        if (selectedRole.shortCode === 'deputy_director') {
            const d = divisionList.find(d => d._id === values.divisionId);
            return { ...base, divisionId: d?._id ?? null };
        }
        return base;
    }

    if (selectedRole.rep >= 3) {
        const b = branchList.find(b => b.code === values.designatedBranch);
        return {
            ...base,
            areaId: b?.areaId ?? null,
            regionId: b?.regionId ?? null,
            divisionId: b?.divisionId ?? null,
            designatedBranchId: b?._id ?? null,
            designatedBranch: values.designatedBranch || null,
            loNo: selectedRole.rep === 4 ? (values.loNo ? +values.loNo : null) : null,
        };
    }

    return base;
};

const DEFAULT_USER = {};

const AddUpdateUserPage = ({ mode = 'add', userId = null, onBack, onSuccess }) => {
    const hiddenInput = useRef(null);
    const formikRef = useRef();
    const dispatch = useDispatch();

    const currentUser  = useSelector(state => state.user.data);
    const currentDate  = useSelector(state => state.systemSettings.currentDate);
    const branchList   = useSelector(state => state.branch.list);
    const divisionList = useSelector(state => state.division.list);
    const areaList     = useSelector(state => state.area.list);
    const regionList   = useSelector(state => state.region.list);

    const [roles, setRoles] = useState([]);
    const [rolesLoading, setRolesLoading] = useState(true);

    const [loading, setLoading]   = useState(mode === 'edit');
    const [saving, setSaving]     = useState(false);
    const [uploading, setUploading] = useState(false);
    const [photoHover, setPhotoHover] = useState(false);

    const [user, setUser] = useState(DEFAULT_USER);
    const [photo, setPhoto] = useState('');
    const [image, setImage] = useState(null);
    const [pendingUserId] = useState(() => userId || generateUUID());

    const [role, setRole] = useState(null);
    const [positionTouched, setPositionTouched] = useState(false);
    const [occurence, setOccurence] = useState('daily');
    const [weeklyScheduleType, setWeeklyScheduleType] = useState('standard');
    const [acceleratedCategory, setAcceleratedCategory] = useState(null);

    // Existing LO numbers for whichever branch is currently selected —
    // drives the "taken" state / auto-suggestion in the LO Number dropdown.
    const [takenLoNumbers, setTakenLoNumbers] = useState([]);
    const [loNumbersLoading, setLoNumbersLoading] = useState(false);

    // Security section state (edit mode only) — reset password / biometric
    // removal / account unlock. Kept local rather than routed through Formik
    // since these are direct side-effecting actions, not form fields that
    // get submitted with the rest of the profile.
    const [resettingPassword, setResettingPassword] = useState(false);
    const [removingBiometric, setRemovingBiometric] = useState(false);
    const [biometricRemoved, setBiometricRemoved]   = useState(false);
    const [unlocking, setUnlocking] = useState(false);
    const [unlocked, setUnlocked]   = useState(false);

    // Shown once after creating a user or resetting a password — holds the
    // plaintext temp password just long enough for the admin to copy it.
    // Not stored anywhere beyond this component's state; closing it discards it.
    const [passwordModal, setPasswordModal] = useState(null); // { password, context: 'created' | 'reset' }

    // Only admins (rep 1) get the destructive security actions — mirrors the
    // existing gating on the "Reset Password" row action in settings/users/index.js.
    const isAdmin = currentUser?.role?.rep === 1 || currentUser?.root === true;

    const selectedRole = useMemo(() => {
        if (!role) return null;
        const [rep, shortCode] = role.split('-') ?? [];
        const base = roles.find(r => r.rep === +rep);
        return base ? { ...base, shortCode } : null;
    }, [role, roles]);

    // ── Self-contained reference data fetching ──────────────────────────
    useEffect(() => {
        (async () => {
            setRolesLoading(true);
            try {
                const response = await fetchWrapper.get(getApiBaseUrl() + 'roles/list');
                if (response.success) {
                    setRoles((response.roles || []).map(r => ({
                        ...r, value: r.rep + '-' + r.shortCode, label: UppercaseFirstLetter(r.name),
                    })));
                } else {
                    toast.error('Error retrieving roles list.');
                }
            } catch {
                toast.error('Error retrieving roles list.');
            } finally {
                setRolesLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        if (branchList?.length) return;
        (async () => {
            const response = await fetchWrapper.get(getApiBaseUrl() + 'branches/list');
            if (response.success) {
                dispatch(setBranchList((response.branches || []).map(b => ({ ...b, value: b.code, label: UppercaseFirstLetter(b.name) }))));
            }
        })();
    }, [branchList, dispatch]);

    useEffect(() => {
        if (areaList?.length) return;
        (async () => {
            const response = await fetchWrapper.get(getApiBaseUrl() + 'areas/list');
            if (response.success) {
                dispatch(setAreaList((response.areas || []).map(a => ({ ...a, value: a._id, label: UppercaseFirstLetter(a.name) }))));
            }
        })();
    }, [areaList, dispatch]);

    useEffect(() => {
        if (regionList?.length) return;
        (async () => {
            const response = await fetchWrapper.get(getApiBaseUrl() + 'regions/list');
            if (response.success) {
                dispatch(setRegionList((response.regions || []).map(r => ({ ...r, value: r._id, label: UppercaseFirstLetter(r.name) }))));
            }
        })();
    }, [regionList, dispatch]);

    useEffect(() => {
        if (divisionList?.length) return;
        (async () => {
            const response = await fetchWrapper.get(getApiBaseUrl() + 'divisions/list');
            if (response.success) {
                dispatch(setDivisionList((response.divisions || []).map(d => ({ ...d, value: d._id, label: UppercaseFirstLetter(d.name) }))));
            }
        })();
    }, [divisionList, dispatch]);

    // ── Load user in edit mode ──────────────────────────────────────────
    const getUser = useCallback(async () => {
        if (mode !== 'edit' || !userId) return;
        setLoading(true);
        try {
            const response = await fetchWrapper.get(getApiBaseUrl() + 'users?' + new URLSearchParams({ _id: userId }));
            if (response.success) {
                setUser(response.user);
                setPhoto(response.user.profile || '');
                if (response.user.role) {
                    const r = typeof response.user.role === 'string' ? JSON.parse(response.user.role) : response.user.role;
                    setRole(r.rep + '-' + r.shortCode);
                }
                setOccurence(response.user.transactionType || 'daily');
                setWeeklyScheduleType(response.user.weeklyScheduleType || 'standard');
                setAcceleratedCategory(response.user.acceleratedCategory || null);
                setPositionTouched(!!response.user.position);
            } else {
                toast.error('Failed to load user.');
                onBack?.();
            }
        } catch {
            toast.error('Error while loading user.');
            onBack?.();
        } finally {
            setLoading(false);
        }
    }, [mode, userId, onBack]);

    useEffect(() => { getUser(); }, [getUser]);

    // ── LO numbers in use for the currently-selected branch ─────────────
    const fetchTakenLoNumbers = useCallback(async (branchCode) => {
        if (!branchCode) { setTakenLoNumbers([]); return; }
        setLoNumbersLoading(true);
        try {
            const response = await fetchWrapper.get(
                getApiBaseUrl() + 'users/list?' + new URLSearchParams({ branchCode })
            );
            if (response.success) {
                const taken = (response.users || [])
                    .filter(u => u.role?.rep === 4 && u._id !== (mode === 'edit' ? userId : null))
                    .map(u => u.loNo)
                    .filter(Boolean);
                setTakenLoNumbers(taken);
            }
        } catch {
            // Non-fatal — LO Number just won't auto-suggest/block; user can still pick manually.
        } finally {
            setLoNumbersLoading(false);
        }
    }, [mode, userId]);

    const loNumberOptions = useMemo(() => LO_NUMBER_RANGE.map(n => ({
        label: `LO ${n}`,
        value: n,
        disabled: takenLoNumbers.includes(n),
    })), [takenLoNumbers]);

    const initialValues = useMemo(() => ({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        number: user.number || '',
        position: user.position || '',
        role: user.role ? (() => {
            const r = typeof user.role === 'string' ? JSON.parse(user.role) : user.role;
            return r.rep + '-' + r.shortCode;
        })() : '',
        loNo: user.loNo ? parseInt(user.loNo) : null,
        transactionType: user.transactionType || 'daily',
        weeklyScheduleType: user.weeklyScheduleType || 'standard',
        acceleratedCategory: user.acceleratedCategory || null,
        designatedBranch: user.designatedBranch || '',
        areaId: user?.areaId || '',
        regionId: user?.regionId || '',
        divisionId: user?.divisionId || '',
    }), [user]);

    const validationSchema = useMemo(() => yup.object().shape({
        firstName: yup.string().required('Please enter first name'),
        lastName: yup.string().required('Please enter last name'),
        email: yup.string().email('Please enter a valid email address').required('Please enter email address'),
        number: yup.string().required('Please enter phone number'),
        position: yup.string().required('Please enter position'),
        role: yup.string().required('Please select a role'),
        designatedBranch: yup.string().nullable().when([], {
            is: () => selectedRole && selectedRole.rep >= 3,
            then: (schema) => schema.required('Please select a branch'),
            otherwise: (schema) => schema.nullable(),
        }),
        loNo: yup.number().nullable().when([], {
            is: () => selectedRole && selectedRole.rep === 4,
            then: (schema) => schema.required('Please select an LO number'),
            otherwise: (schema) => schema.nullable(),
        }),
        acceleratedCategory: yup.string().nullable().when(['transactionType', 'weeklyScheduleType'], {
            is: (t, w) => t === 'weekly' && w === 'accelerated',
            then: (schema) => schema.required('Please select a group category'),
            otherwise: (schema) => schema.nullable(),
        }),
    }), [selectedRole]);

    // ── Clears fields that no longer apply once role/rep changes, so hidden
    //    inputs can't silently carry stale values into the submit payload. ──
    const clearIrrelevantFields = useCallback((newRoleObj) => {
        const form = formikRef.current;
        if (!form) return;
        const rep = newRoleObj?.rep;

        if (rep !== 4) {
            form.setFieldValue('loNo', null);
            setTakenLoNumbers([]);
        }
        if (rep !== 2 || newRoleObj?.shortCode !== 'area_admin') {
            if (rep < 3) form.setFieldValue('areaId', '');
        }
        if (rep !== 2 || newRoleObj?.shortCode !== 'regional_manager') {
            if (rep < 3) form.setFieldValue('regionId', '');
        }
        if (rep !== 2 || newRoleObj?.shortCode !== 'deputy_director') {
            if (rep < 3) form.setFieldValue('divisionId', '');
        }
        if (rep < 3) {
            form.setFieldValue('designatedBranch', '');
        }
        if (rep !== 4) {
            // Transaction Schedule is Loan Officer–only now — Branch Manager
            // no longer shows or keeps these fields either.
            setOccurence('daily');
            setWeeklyScheduleType('standard');
            setAcceleratedCategory(null);
            form.setFieldValue('transactionType', 'daily');
            form.setFieldValue('weeklyScheduleType', 'standard');
            form.setFieldValue('acceleratedCategory', null);
        }
    }, []);

    // ── Handlers ─────────────────────────────────────────────────────────
    const handleRoleChange = useCallback((field, value) => {
        const form = formikRef.current;
        form.setFieldValue(field, value);
        setRole(value);

        const [rep, shortCode] = value.split('-');
        const matched = roles.find(r => r.rep === +rep && r.shortCode === shortCode);

        clearIrrelevantFields(matched);

        if (matched && !positionTouched) {
            form.setFieldValue('position', matched.label);
        }
    }, [roles, positionTouched, clearIrrelevantFields]);

    const handlePositionChange = useCallback((e) => {
        setPositionTouched(true);
        formikRef.current.setFieldValue('position', e.target.value);
    }, []);

    const handleFieldSelect = useCallback((field, value) => {
        formikRef.current.setFieldValue(field, value);
    }, []);

    // Branch selection (rep >= 3) drives the LO-number lookup.
    const handleBranchChange = useCallback((field, value) => {
        const form = formikRef.current;
        form.setFieldValue(field, value);
        form.setFieldValue('loNo', null);
        if (selectedRole?.rep === 4) {
            fetchTakenLoNumbers(value);
        }
    }, [selectedRole, fetchTakenLoNumbers]);

    // Auto-suggest the lowest free LO number once taken numbers are known.
    useEffect(() => {
        if (selectedRole?.rep !== 4) return;
        const form = formikRef.current;
        if (!form || form.values.loNo) return; // don't clobber an explicit pick or edit-mode existing value
        const next = LO_NUMBER_RANGE.find(n => !takenLoNumbers.includes(n));
        if (next) form.setFieldValue('loNo', next);
    }, [takenLoNumbers, selectedRole]);

    const handleTransactionTypeChange = useCallback((field, value) => {
        formikRef.current.setFieldValue(field, value);
        setOccurence(value);
        if (value !== 'weekly') {
            setWeeklyScheduleType('standard');
            formikRef.current.setFieldValue('weeklyScheduleType', 'standard');
            setAcceleratedCategory(null);
            formikRef.current.setFieldValue('acceleratedCategory', null);
        }
    }, []);

    const handleWeeklyScheduleTypeChange = useCallback((field, value) => {
        formikRef.current.setFieldValue(field, value);
        setWeeklyScheduleType(value);
        if (value !== 'accelerated') {
            setAcceleratedCategory(null);
            formikRef.current.setFieldValue('acceleratedCategory', null);
        }
    }, []);

    const handleAcceleratedCategoryChange = useCallback((field, value) => {
        formikRef.current.setFieldValue(field, value);
        setAcceleratedCategory(value);
    }, []);

    const handleFileChange = useCallback((e) => {
        const fileUploaded = e.target.files[0];
        if (!fileUploaded) return;
        const fileSizeMsg = checkFileSize(fileUploaded.size);
        if (fileSizeMsg) { toast.error(fileSizeMsg); return; }
        setPhoto(URL.createObjectURL(fileUploaded));
        setImage(fileUploaded);
        e.target.value = '';
    }, []);

    const handleRemoveImage = useCallback(() => {
        setPhoto('');
        setImage(null);
        if (hiddenInput.current) hiddenInput.current.value = '';
    }, []);

    const uploadPhotoIfNeeded = async () => {
        if (!image) return user.profile || null;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', image);
            formData.append('origin', 'profiles');
            formData.append('uuid', pendingUserId);
            const response = await fetch('/api/upload', { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Upload failed');
            const data = await response.json();
            return data.fileKey;
        } finally {
            setUploading(false);
        }
    };

    // ── Security actions (edit mode, admin only) ────────────────────────
    const handleResetPassword = useCallback(async () => {
        if (!confirm(
            `Reset password for ${user.firstName} ${user.lastName}? ` +
            `This will also remove their fingerprint login — they'll need to sign in with a new password and re-register biometrics.`
        )) return;
        setResettingPassword(true);
        try {
            const response = await fetchWrapper.post(getApiBaseUrl() + 'users/reset-password', { _id: userId });
            if (response.success) {
                setBiometricRemoved(true);
                setPasswordModal({ password: response.tempPassword, context: 'reset' });
            } else {
                toast.error(response.message || 'Failed to reset password.');
            }
        } catch {
            toast.error('An error occurred while resetting the password.');
        } finally {
            setResettingPassword(false);
        }
    }, [user, userId]);

    const handleRemoveBiometric = useCallback(async () => {
        if (!confirm(`Remove fingerprint login for ${user.firstName} ${user.lastName}? They will need to re-register on next login.`)) return;
        setRemovingBiometric(true);
        try {
            const response = await fetchWrapper.post(getApiBaseUrl() + 'users/biometric-remove', { userId });
            if (response.success) {
                setBiometricRemoved(true);
                toast.success('Fingerprint login removed.');
            } else {
                toast.error('Failed to remove fingerprint.');
            }
        } catch {
            toast.error('An error occurred.');
        } finally {
            setRemovingBiometric(false);
        }
    }, [user, userId]);

    const handleUnlockAccount = useCallback(async () => {
        setUnlocking(true);
        try {
            const response = await fetchWrapper.sendData(getApiBaseUrl() + 'users/', {
                _id: userId,
                loginAttempts: 0,
                lockedUntil: null,
                role: JSON.stringify(typeof user.role === 'string' ? JSON.parse(user.role) : user.role),
            });
            if (response.success) {
                toast.success('Account unlocked.');
                setUnlocked(true);
            } else {
                toast.error(response.message || 'Failed to unlock account.');
            }
        } catch {
            toast.error('Failed to unlock account.');
        } finally {
            setUnlocking(false);
        }
    }, [user, userId]);

    const handleSaveUpdate = useCallback(async (values, actions) => {
        setSaving(true);
        try {
            const roleShortCode = values.role.split('-')[1];
            const matchedRole = roles.find(r => r.shortCode === roleShortCode);
            if (!matchedRole) { toast.error('Invalid role selected.'); return; }

            const hierarchy = buildHierarchyPayload(matchedRole, values, { areaList, regionList, divisionList, branchList });

            let profileKey;
            try {
                profileKey = await uploadPhotoIfNeeded();
            } catch {
                toast.error('Failed to upload photo. Please try again.');
                return;
            }

            const payload = {
                ...values,
                ...hierarchy,
                _id: mode === 'add' ? pendingUserId : userId,
                role: JSON.stringify(matchedRole),
                profile: profileKey,
                currentDate,
                transactionType: matchedRole.rep === 4 ? occurence : null,
                weeklyScheduleType: (matchedRole.rep === 4 && occurence === 'weekly') ? weeklyScheduleType : null,
                acceleratedCategory: (matchedRole.rep === 4 && occurence === 'weekly' && weeklyScheduleType === 'accelerated')
                    ? acceleratedCategory
                    : null,
            };

            const apiUrl = mode === 'add' ? getApiBaseUrl() + 'users/save/' : getApiBaseUrl() + 'users/';
            const response = mode === 'add'
                ? await fetchWrapper.post(apiUrl, payload)
                : await fetchWrapper.sendData(apiUrl, payload);

            if (response.error) {
                toast.error(response.message || 'Save failed.');
            } else if (response.success) {
                if (mode === 'add' && response.tempPassword) {
                    // Hold navigation until the admin has acknowledged the password —
                    // onSuccess fires from the modal's Continue button instead of here.
                    setPasswordModal({ password: response.tempPassword, context: 'created' });
                } else {
                    toast.success(mode === 'add' ? 'User successfully added.' : 'User successfully updated.');
                    onSuccess?.();
                }
            } else {
                toast.error('Unexpected response. Please try again.');
            }
        } catch (error) {
            console.error(error);
            toast.error('An error occurred. Please try again.');
        } finally {
            setSaving(false);
            actions.setSubmitting(false);
        }
    }, [mode, userId, pendingUserId, roles, areaList, regionList, divisionList, branchList,
        currentDate, occurence, weeklyScheduleType, acceleratedCategory, onSuccess, image, user.profile]);

    if (loading) {
        return <div className="flex items-center justify-center h-full min-h-[400px]"><Spinner /></div>;
    }

    const handlePasswordModalClose = () => {
        const wasCreate = passwordModal?.context === 'created';
        setPasswordModal(null);
        if (wasCreate) {
            toast.success('User successfully added.');
            onSuccess?.();
        } else {
            toast.success('Password reset. The user will need to sign in with the new password and re-register biometrics.', { autoClose: 6000 });
        }
    };

    return (
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {passwordModal && (
                <PasswordRevealModal
                    password={passwordModal.password}
                    context={passwordModal.context}
                    userName={`${user.firstName || formikRef.current?.values?.firstName || ''} ${user.lastName || formikRef.current?.values?.lastName || ''}`.trim()}
                    onClose={handlePasswordModalClose}
                />
            )}

            <div className="flex items-center gap-3 mb-6">
                <button type="button" onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors text-sm">
                    ← Back
                </button>
                <h1 className="text-lg font-semibold text-gray-900">
                    {mode === 'add' ? 'Add User' : 'Edit User'}
                </h1>
            </div>

            <Formik
                enableReinitialize={true}
                innerRef={formikRef}
                initialValues={initialValues}
                validationSchema={validationSchema}
                onSubmit={handleSaveUpdate}
            >
                {({ values, touched, errors, handleChange, handleSubmit }) => (
                    <form onSubmit={handleSubmit} autoComplete="off">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                            {/* ── Left rail — photo + assignment hierarchy ── */}
                            <div className="lg:col-span-4 lg:sticky lg:top-6 space-y-6">
                                <SectionCard icon={UserIcon} title="Profile Photo">
                                    <div className="flex flex-col items-center">
                                        <div
                                            className="relative w-36 h-36 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-md cursor-pointer group"
                                            onMouseEnter={() => setPhotoHover(true)}
                                            onMouseLeave={() => setPhotoHover(false)}
                                            onClick={() => hiddenInput.current?.click()}
                                        >
                                            {photo ? (
                                                photo.startsWith('blob:')
                                                    ? <img src={photo} alt="Preview" className="w-full h-full object-cover" />
                                                    : <PrivateImage fileKey={photo} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                                                    <UserIcon className="w-16 h-16 text-gray-300" />
                                                </div>
                                            )}
                                            <div className={`absolute inset-0 bg-black/50 flex items-center justify-center gap-3 transition-opacity ${photoHover ? 'opacity-100' : 'opacity-0 group-active:opacity-100'}`}>
                                                <CameraIcon className="w-6 h-6 text-white" />
                                            </div>
                                        </div>
                                        <input ref={hiddenInput} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                        <div className="flex gap-2 mt-4">
                                            <button type="button" onClick={() => hiddenInput.current?.click()} disabled={uploading || saving}
                                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
                                                {photo ? 'Replace' : 'Upload'}
                                            </button>
                                            {photo && (
                                                <button type="button" onClick={handleRemoveImage} disabled={uploading || saving}
                                                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center gap-1">
                                                    <TrashIcon className="w-3.5 h-3.5" /> Remove
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-3 text-center">
                                            {uploading ? 'Uploading…' : 'Uploads when you save the form.'}
                                        </p>
                                    </div>
                                </SectionCard>

                                {selectedRole && selectedRole.rep !== 1 && (
                                    <SectionCard icon={MapPinIcon} title="Assignment" subtitle="Where this person sits in the org">
                                        <AssignmentHierarchy
                                            chain={resolveAssignmentChain(selectedRole, values, { branchList, areaList, regionList, divisionList })}
                                        />
                                    </SectionCard>
                                )}
                            </div>

                            {/* ── Right — form fields ─────────────────────── */}
                            <div className="lg:col-span-8 space-y-6">
                                <SectionCard icon={UserIcon} title="Basic Information">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormInput name="firstName" label="First Name" value={values.firstName} onChange={handleChange} placeholder="Enter first name" error={touched.firstName && errors.firstName} />
                                        <FormInput name="lastName" label="Last Name" value={values.lastName} onChange={handleChange} placeholder="Enter last name" error={touched.lastName && errors.lastName} />
                                        <FormInput name="email" label="Email Address" value={values.email} onChange={handleChange} placeholder="name@company.com" disabled={mode === 'edit'} error={touched.email && errors.email} />
                                        <FormInput name="number" label="Phone Number" value={values.number} onChange={handleChange} placeholder="Enter phone number" error={touched.number && errors.number} />
                                    </div>
                                </SectionCard>

                                <SectionCard icon={ShieldCheckIcon} title="Role & Assignment">
                                    <div className="space-y-4">
                                        <FormSelect
                                            name="role" label="Role" value={values.role} options={roles}
                                            onChange={handleRoleChange}
                                            placeholder={rolesLoading ? 'Loading roles…' : 'Select a role'}
                                            disabled={rolesLoading}
                                            error={touched.role && errors.role}
                                        />

                                        {/* Position sits directly under Role since it auto-fills from it. */}
                                        <FormInput
                                            name="position" label="Position" value={values.position}
                                            onChange={handlePositionChange} placeholder="Auto-filled from Role, or type your own"
                                            error={touched.position && errors.position}
                                        />

                                        {selectedRole?.shortCode?.includes('area_admin') && (
                                            <FormSelect name="areaId" label="Area" value={values.areaId} options={areaList} onChange={handleFieldSelect} placeholder="Select area" error={touched.areaId && errors.areaId} />
                                        )}
                                        {selectedRole?.shortCode?.includes('regional_manager') && (
                                            <FormSelect name="regionId" label="Region" value={values.regionId} options={regionList} onChange={handleFieldSelect} placeholder="Select region" error={touched.regionId && errors.regionId} />
                                        )}
                                        {selectedRole?.shortCode?.includes('deputy_director') && (
                                            <FormSelect name="divisionId" label="Division" value={values.divisionId} options={divisionList} onChange={handleFieldSelect} placeholder="Select division" error={touched.divisionId && errors.divisionId} />
                                        )}

                                        {selectedRole && selectedRole.rep >= 3 && (
                                            <FormSelect
                                                name="designatedBranch" label="Branch" value={values.designatedBranch} options={branchList}
                                                onChange={handleBranchChange} placeholder="Select branch"
                                                error={touched.designatedBranch && errors.designatedBranch}
                                            />
                                        )}

                                        {selectedRole && selectedRole.rep === 4 && (
                                            <FormSelect
                                                name="loNo" label="LO Number" value={values.loNo} options={loNumberOptions}
                                                onChange={handleFieldSelect}
                                                placeholder={
                                                    !values.designatedBranch ? 'Select a branch first'
                                                    : loNumbersLoading ? 'Checking availability…'
                                                    : 'Select LO number'
                                                }
                                                disabled={!values.designatedBranch || loNumbersLoading}
                                                error={touched.loNo && errors.loNo}
                                                hint={values.designatedBranch && !loNumbersLoading ? 'Lowest available number pre-selected — change if needed.' : undefined}
                                            />
                                        )}
                                    </div>
                                </SectionCard>

                                {selectedRole && selectedRole.rep === 4 && (
                                    <SectionCard title="Transaction Schedule">
                                        <div className="space-y-5">
                                            <SegmentedControl
                                                name="transactionType" label="Transaction Type" value={values.transactionType}
                                                options={[{ label: 'Daily', value: 'daily' }, { label: 'Weekly', value: 'weekly' }]}
                                                onChange={handleTransactionTypeChange}
                                            />
                                            {values.transactionType === 'weekly' && (
                                                <>
                                                    <SegmentedControl
                                                        name="weeklyScheduleType" label="Weekly Schedule Type" value={values.weeklyScheduleType}
                                                        options={[{ label: 'Standard', value: 'standard' }, { label: 'Accelerated', value: 'accelerated' }]}
                                                        onChange={handleWeeklyScheduleTypeChange}
                                                    />
                                                    {values.weeklyScheduleType === 'accelerated' && (
                                                        <FormSelect
                                                            name="acceleratedCategory" label="Group Category" value={values.acceleratedCategory}
                                                            options={ACCELERATED_WEEKLY_CATEGORIES.map(c => ({ label: c.label, value: c.key }))}
                                                            onChange={handleAcceleratedCategoryChange} placeholder="Select a category"
                                                            error={touched.acceleratedCategory && errors.acceleratedCategory}
                                                        />
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </SectionCard>
                                )}

                                {mode === 'edit' && (
                                    <SectionCard icon={LockClosedIcon} title="Security">
                                        <div className="space-y-4">
                                            {/* Account lock banner */}
                                            {user?.lockedUntil && moment().isBefore(moment(user.lockedUntil)) && !unlocked && (
                                                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3 flex-wrap">
                                                    <div>
                                                        <p className="text-sm font-semibold text-red-700">🔒 Account Locked</p>
                                                        <p className="text-xs text-red-500 mt-0.5">
                                                            Unlocks at {moment(user.lockedUntil).format('MMM D, h:mm A')}
                                                            {' · '}{user.loginAttempts || 0} failed attempt{user.loginAttempts !== 1 ? 's' : ''}
                                                        </p>
                                                    </div>
                                                    {isAdmin && (
                                                        <button
                                                            type="button"
                                                            onClick={handleUnlockAccount}
                                                            disabled={unlocking}
                                                            className="flex-shrink-0 px-3 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                                                        >
                                                            {unlocking ? 'Unlocking…' : 'Unlock Now'}
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Fingerprint / biometric status — visible to any editor, action gated to admin */}
                                            <div className="p-4 border border-gray-200 rounded-xl">
                                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                            user.biometricCredentialId && !biometricRemoved ? 'bg-teal-100' : 'bg-gray-100'
                                                        }`}>
                                                            <FingerPrintIcon className={`w-4 h-4 ${
                                                                user.biometricCredentialId && !biometricRemoved ? 'text-teal-600' : 'text-gray-400'
                                                            }`} />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-700">Fingerprint Login</p>
                                                            <p className="text-xs text-gray-400 mt-0.5">
                                                                {user.biometricCredentialId && !biometricRemoved
                                                                    ? `Registered${user.biometricDeviceName ? ` · ${user.biometricDeviceName}` : ''}${user.biometricRegisteredAt ? ` · ${moment(user.biometricRegisteredAt).format('MMM D, YYYY')}` : ''}`
                                                                    : 'Not registered'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {isAdmin && user.biometricCredentialId && !biometricRemoved && (
                                                        <button
                                                            type="button"
                                                            onClick={handleRemoveBiometric}
                                                            disabled={removingBiometric}
                                                            className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                                                        >
                                                            {removingBiometric ? 'Removing…' : 'Remove'}
                                                        </button>
                                                    )}
                                                    {!(user.biometricCredentialId && !biometricRemoved) && (
                                                        <span className="text-xs text-gray-400 italic">User registers on login</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Password reset — admin only */}
                                            {isAdmin && (
                                                <div className="p-4 border border-gray-200 rounded-xl flex items-center justify-between gap-3 flex-wrap">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                            <KeyIcon className="w-4 h-4 text-gray-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-700">Password</p>
                                                            <p className="text-xs text-gray-400 mt-0.5">
                                                                Resetting also clears fingerprint login.
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={handleResetPassword}
                                                        disabled={resettingPassword}
                                                        className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                                                    >
                                                        {resettingPassword ? 'Resetting…' : 'Reset Password'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </SectionCard>
                                )}

                                <div className="flex justify-end gap-3 pt-2 pb-8">
                                    <button type="button" onClick={onBack} disabled={saving}
                                        className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={saving || uploading}
                                        className="px-5 py-2.5 rounded-lg bg-teal-600 text-sm font-semibold text-white hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                                        {saving && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                                        {saving ? 'Saving…' : (mode === 'add' ? 'Add User' : 'Save Changes')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form>
                )}
            </Formik>
        </div>
    );
};

export default AddUpdateUserPage;