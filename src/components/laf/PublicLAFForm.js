// src/components/laf/PublicLAFForm.js — Phase 2
// Client type selection, Government ID, updated step flows per type
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Formik }     from 'formik';
import * as yup       from 'yup';
import { toast }      from 'react-toastify';
import LAFPhotoStep        from './LAFPhotoStep';
import LAFSuccessScreen    from './LAFSuccessScreen';
import FaceLivenessStep from './FaceLivenessStep';
import LAFOfflineConfirmation from './LAFOfflineConfirmation';
import LAFQueuePanel       from './LAFQueuePanel';
import PhotoCapture        from '@/components/clients/PhotoCapture';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useLAFOfflineQueue, MAX_ENTRIES } from '@/hooks/useLAFOfflineQueue';
import { usePublicSignedUrl }               from '@/hooks/usePublicSignedUrl';

// ID number format validation — regex + friendly hint per type
const ID_FORMAT_RULES = {
    philsys:    { pattern: /^\d{4}-\d{4}-\d{4}$/, hint: 'Format: 1234-5678-9012' },
    passport:   { pattern: /^[A-Z]{1,2}\d{6,8}[A-Z0-9]?$/, hint: 'Format: A1234567 or AA1234567' },
    drivers:    { pattern: /^[A-Z]\d{2}-\d{2}-\d{6}$/, hint: 'Format: A01-23-456789' },
    sss:        { pattern: /^\d{2}-\d{7}-\d{1}$/, hint: 'Format: 12-3456789-0' },
    gsis:       { pattern: /^\d{11}$/, hint: '11-digit GSIS number' },
    philhealth: { pattern: /^\d{2}-\d{9}-\d{1}$/, hint: 'Format: 12-345678901-2' },
    voters:     { pattern: /^\d{13}$/, hint: '13-digit voter ID number' },
    umid:       { pattern: /^\d{4}-\d{7}-\d{1}$/, hint: 'Format: 1234-5678901-2' },
    tin:        { pattern: /^\d{3}-\d{3}-\d{3}(-\d{3})?$/, hint: 'Format: 123-456-789 or 123-456-789-000' },
    prc:        { pattern: /^\d{7}$/, hint: '7-digit PRC number' },
    // Types with no strict format — accept any non-empty value
    postal:  null, senior: null, pwd: null, barangay: null,
};

function validateIdNumber(idType, idNumber) {
    if (!idType || !idNumber?.trim()) return null;
    const rule = ID_FORMAT_RULES[idType];
    if (!rule) return null; // no format rule — accept anything
    if (!rule.pattern.test(idNumber.trim())) {
        return rule.hint;
    }
    return null;
}

const PH_ID_TYPES = [
    { value: 'philsys',    label: 'PhilSys / National ID' },
    { value: 'passport',   label: 'Passport' },
    { value: 'drivers',    label: "Driver's License" },
    { value: 'sss',        label: 'SSS ID' },
    { value: 'gsis',       label: 'GSIS ID' },
    { value: 'philhealth', label: 'PhilHealth ID' },
    { value: 'voters',     label: "Voter's ID" },
    { value: 'postal',     label: 'Postal ID' },
    { value: 'umid',       label: 'UMID' },
    { value: 'tin',        label: 'TIN ID' },
    { value: 'prc',        label: 'PRC ID' },
    { value: 'senior',     label: "Senior Citizen's ID" },
    { value: 'pwd',        label: 'PWD ID' },
    { value: 'barangay',   label: 'Barangay ID' },
];

const CLIENT_TYPES = [
    { value: 'prospect', label: 'Prospect',      desc: 'First-time applicant' },
    { value: 'reloan',   label: 'Reloan',         desc: 'Has active/ongoing loan' },
    { value: 'pending',  label: 'Pending Member', desc: 'Loan completed, applying again' },
    { value: 'balik',    label: 'Balik',          desc: 'Returning after loan offset/closure' },
];

const Field = ({ label, error, required, children }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        {children}
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
);

const Input = ({ name, value, onChange, onBlur, placeholder, type = 'text', error, readOnly, noUppercase }) => {
    // Auto-uppercase text inputs — numeric and date fields are excluded
    const handleChange = (e) => {
        if (!noUppercase && type === 'text' && e.target.value) {
            e.target.value = e.target.value.toUpperCase();
        }
        onChange?.(e);
    };
    return (
        <input name={name} type={type} value={value}
            onChange={handleChange} onBlur={onBlur} placeholder={placeholder} readOnly={readOnly}
            style={!noUppercase && type === 'text' ? { textTransform: 'uppercase' } : {}}
            className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                readOnly ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                    : error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}
        />
    );
};

// Public API header — includes x-laf-api-key for all public LAF endpoint calls
const lafApiHeaders = () => ({
    'Content-Type':   'application/json',
    'x-laf-api-key':  process.env.NEXT_PUBLIC_LAF_API_KEY || '',
});

const publicFetch = (url, opts = {}) => fetch(url, {
    ...opts,
    headers: { ...lafApiHeaders(), ...(opts.headers || {}) },
});

async function compressImage(file, maxW = 1200, q = 0.82) {
    return new Promise(resolve => {
        const img = new window.Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const scale = Math.min(1, maxW / img.width);
            const c = document.createElement('canvas');
            c.width = Math.round(img.width * scale);
            c.height = Math.round(img.height * scale);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            c.toBlob(blob => {
                if (!blob) { resolve(file); return; }
                resolve(new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() }));
            }, 'image/jpeg', q);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
    });
}

const StepBar = ({ current, total, labels }) => (
    <div className="flex items-center justify-between mb-6 overflow-x-auto pb-1">
        {labels.map((label, i) => (
            <React.Fragment key={label}>
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${i < current ? 'bg-green-500 text-white' : i === current ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                        {i < current ? '✓' : i + 1}
                    </div>
                    <span className={`text-[10px] hidden sm:block text-center max-w-[56px] leading-tight ${i === current ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>{label}</span>
                </div>
                {i < labels.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${i < current ? 'bg-green-400' : 'bg-gray-200'}`} />}
            </React.Fragment>
        ))}
    </div>
);

const NavBtns = ({ onBack, onNext, nextLabel = 'Next', nextDisabled, submitting, isSubmit }) => (
    <div className="mt-6 flex justify-between">
        <button type="button" onClick={onBack}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
            disabled={submitting}>Back</button>
        <button type={isSubmit ? 'button' : 'button'} onClick={onNext}
            disabled={nextDisabled || submitting}
            className={`px-6 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2 ${isSubmit ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {submitting ? (<><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Submitting…</>) : nextLabel}
        </button>
    </div>
);

const personalSchema = yup.object().shape({
    firstName: yup.string().required('Required'), lastName: yup.string().required('Required'),
    middleName: yup.string().required('Required'), birthdate: yup.string().required('Required'),
    contactNumber: yup.string().required('Required'),
});
const addressSchema = yup.object().shape({
    addressStreetNo: yup.string().required('Required'), addressBarangayDistrict: yup.string().required('Required'),
    addressMunicipalityCity: yup.string().required('Required'), addressProvince: yup.string().required('Required'),
});
const loanSchema = yup.object().shape({
    // loanAmount: yup.number().typeError('Must be a number').positive().required('Required'),
    loanPurpose: yup.string().required('Required'),
    guarantorFirstName: yup.string().required('Required'), guarantorLastName: yup.string().required('Required'),
    guarantorRelationship: yup.string().required('Required'), guarantorContactNumber: yup.string().required('Required'),
});

// ── ClientPhoto — profile photo with broken URL fallback to initials ────────
const ClientPhoto = ({ photoUrl, firstName, lastName, onZoom, size = 'md' }) => {
    const [broken, setBroken] = React.useState(false);
    const sizeClasses = size === 'lg'
        ? 'w-14 h-14 border-2 border-green-400 text-sm'
        : 'w-10 h-10 border border-gray-300 text-xs';
    const showPhoto = photoUrl && !broken;
    return (
        <button
            type="button"
            onClick={() => showPhoto && onZoom?.()}
            className={`flex-shrink-0 rounded-full overflow-hidden ${sizeClasses}
                ${showPhoto ? 'cursor-zoom-in' : 'cursor-default'}`}
        >
            {showPhoto ? (
                <img
                    src={photoUrl}
                    alt="Client"
                    className="w-full h-full object-cover"
                    onError={() => setBroken(true)}
                />
            ) : (
                <div className={`w-full h-full rounded-full bg-gray-200 border-2 border-gray-300
                    flex items-center justify-center font-bold text-gray-400 ${sizeClasses}`}>
                    {(firstName?.[0] || '?')}{(lastName?.[0] || '')}
                </div>
            )}
        </button>
    );
};

// ── BalikMatchCard — each card in multi-match list has its own signed URL ──
const BalikMatchCard = ({ match, branchName, onSelect }) => {
    const { signedUrl: photoUrl } = usePublicSignedUrl(match.profile || null);
    return (
        <button type="button" onClick={onSelect}
            className="w-full text-left flex items-center gap-3 p-3 bg-white border border-gray-200
                rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors">
            <ClientPhoto
                photoUrl={photoUrl}
                firstName={match.firstName}
                lastName={match.lastName}
                size="md"
            />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                    {match.lastName}, {match.firstName} {match.middleName || ''}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                    {branchName || 'Unknown Branch'}
                    {match.lastLoan ? ` · Last loan: ₱${Number(match.lastLoan.amountRelease).toLocaleString()} (Cycle ${match.lastLoan.loanCycle})` : ''}
                </p>
            </div>
        </button>
    );
};

const PublicLAFForm = ({
    groupId, groupName, loId, loName,
    branchId, branchName, qrToken,
    requireClientBiometric = true,
    requireGovernmentId    = true,
    requireSelfieWithId    = false,
}) => {
    const formikRef = useRef();
    const [clientType, setClientType] = useState(null);

    // Build steps based on clientType
    // ── Online status — must be declared BEFORE STEPS useMemo ──────────────
    const { isOnline, wasOffline } = useOnlineStatus();

    const existingClientHasId = !!(foundClient?.governmentIdType && foundClient?.governmentIdNumber);

    // Lock existingClientHasId value at the moment foundClient is first set.
    // This prevents STEPS from changing (and step indices shifting) when foundClient changes.
    const lockedHasId = React.useRef(false);
    React.useEffect(() => {
        if (foundClient) {
            lockedHasId.current = existingClientHasId;
        } else {
            lockedHasId.current = false;
        }
    }, [foundClient]);  // only update when foundClient changes, not on every render

    // STEPS is memoised — only recomputes when the values that determine step count change.
    // This prevents step indices from shifting under the user mid-flow (which caused
    // si('Biometric') to not match the current step number).
    const STEPS = React.useMemo(() => {
        if (!clientType) return ['Type'];
        const isExisting = clientType === 'reloan' || clientType === 'pending';
        // Biometric is skipped in offline mode — captured at disbursement
        const addBiometric = requireClientBiometric && isOnline;
        if (isExisting) {
            const s = ['Type', 'Lookup', 'Confirm', 'Photo'];
            // Show ID step if: settings require it OR client has no ID yet
            if (requireGovernmentId || idStepNeeded) s.push('ID');
            s.push('Loan');
            if (addBiometric) s.push('Biometric');
            return s;
        }
        if (clientType === 'balik') {
            const s = ['Type', 'Lookup'];
            if (requireGovernmentId) s.push('ID');
            s.push('Photo', 'Personal', 'Address', 'Loan');
            if (addBiometric) s.push('Biometric');
            return s;
        }
        // Prospect
        const s = ['Type', 'Photo'];
        if (requireGovernmentId) s.push('ID');
        s.push('Personal', 'Address', 'Loan');
        if (addBiometric) s.push('Biometric');
        return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientType, requireClientBiometric, isOnline, requireGovernmentId, idStepNeeded]);

    // si() recalculates on every render since STEPS is now a stable memo value
    const si = React.useCallback(
        (name) => STEPS.indexOf(name),
        [STEPS]
    );

    const [step, setStep] = useState(0);
    const [lafPhotoFile, setLafPhotoFile] = useState(null);
    const [lafPhotoPreview, setLafPhotoPreview] = useState(null);
    const [idType, setIdType] = useState('');
    const [idNumber, setIdNumber] = useState('');
    const [idPhotoFile, setIdPhotoFile] = useState(null);
    const [idPhotoPreview, setIdPhotoPreview] = useState(null);
    const [selfieWithIdFile, setSelfieWithIdFile] = useState(null);
    const [idErrors, setIdErrors] = useState({});
    const [idDuplicate, setIdDuplicate] = useState(null);
    const [idDupChecking, setIdDupChecking] = useState(false);
    const [lookupLastName,   setLookupLastName]   = useState('');
    const [lookupFirstName,  setLookupFirstName]  = useState('');
    const [lookupMiddleName, setLookupMiddleName] = useState('');
    const [lookupSlotNo,     setLookupSlotNo]     = useState('');
    const [lookupBranchId,   setLookupBranchId]   = useState('');
    const [lookupLooking,    setLookupLooking]     = useState(false);
    const [foundClient,      setFoundClient]       = useState(null);
    const [detailFlags,      setDetailFlags]       = useState({});
    // Inline edits from Confirm step — only changed fields, keyed by field name
    const [clientChanges,    setClientChanges]     = useState({});
    const [branchList,       setBranchList]        = useState([]);
    const [balikMatches,     setBalikMatches]      = useState([]);
    // ── Offline client cache — localStorage with 8h TTL ─────────────────────
    const CACHE_KEY  = `ambercash_laf_offline_${groupId}`;
    const CACHE_TTL  = 24 * 60 * 60 * 1000; // 24 hours — matches CI cache TTL

    const loadCacheFromStorage = () => {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const { clients, cachedAt } = JSON.parse(raw);
            if (Date.now() - cachedAt > CACHE_TTL) {
                localStorage.removeItem(CACHE_KEY); // expired
                return null;
            }
            return { clients, cachedAt };
        } catch { return null; }
    };

    const storedCache = loadCacheFromStorage();
    const [cachedClients,    setCachedClients]     = useState(storedCache?.clients || null);
    const [cacheLoading,     setCacheLoading]      = useState(false);
    const [cacheReady,       setCacheReady]        = useState(!!storedCache);
    const [cachedAt,         setCachedAt]          = useState(storedCache?.cachedAt || null);
    const [idStepNeeded,     setIdStepNeeded]      = useState(false);
    const [photoZoom,        setPhotoZoom]         = useState(false);

    // Resolve signed URL for found client's existing profile photo
    const { signedUrl: foundClientPhotoUrl } = usePublicSignedUrl(foundClient?.profile || null);

    // Pre-load group clients for offline lookup — called before going to field
    const loadGroupClientsForOffline = React.useCallback(async () => {
        if (!groupId || cacheLoading) return;
        setCacheLoading(true);
        try {
            const res  = await publicFetch(
                `/api/public/laf/lookup-client?groupId=${groupId}&mode=all`
            );
            const data = await res.json();  // publicFetch returns raw Response — must parse
            if (data.success && data.clients) {
                const now = Date.now();
                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                        clients:  data.clients,
                        cachedAt: now,
                    }));
                } catch (e) {
                    console.warn('localStorage write failed — cache in memory only:', e);
                }
                setCachedClients(data.clients);
                setCachedAt(now);
                setCacheReady(true);
                toast.success(`${data.clients.length} member records cached for offline use.`);
            } else {
                toast.error(data.message || 'Failed to cache member records. Please try again.');
            }
        } catch {
            toast.error('Could not load member records. Check connection and try again.');
        } finally {
            setCacheLoading(false);
        }
    }, [groupId, cacheLoading]);

    // Pre-fill government ID fields from foundClient when lookup completes
    React.useEffect(() => {
        if (!foundClient) return;
        if (foundClient.governmentIdType   && !idType)   setIdType(foundClient.governmentIdType);
        if (foundClient.governmentIdNumber && !idNumber) setIdNumber(foundClient.governmentIdNumber);
    }, [foundClient]);

    // Pre-populate LAF photo step with existing client photo when signed URL resolves.
    // Checks the URL loads before setting preview — avoids broken image in photo step.
    useEffect(() => {
        if (!foundClientPhotoUrl || lafPhotoFile || lafPhotoPreview) return;
        const img = new window.Image();
        img.onload  = () => setLafPhotoPreview(foundClientPhotoUrl);
        img.onerror = () => {}; // broken URL — leave preview empty, user must take new photo
        img.src = foundClientPhotoUrl;
    }, [foundClientPhotoUrl]);
    const [duplicates,     setDuplicates]     = useState([]);
    const [dupChecking,    setDupChecking]    = useState(false);
    const [dupWarningAcked,setDupWarningAcked]= useState(false);
    const [biometricData, setBiometricData] = useState(null);
    const [biometricVerified, setBiometricVerified] = useState(false);

    // Load branch list for Balik lookup branch filter
    useEffect(() => {
        if (clientType !== 'balik' || branchList.length > 0) return;
        publicFetch('/api/public/laf/branch-list')
            .then(r => r.json())
            .then(d => { if (d.success) setBranchList(d.branches || []); })
            .catch(() => {});
    }, [clientType, branchList.length]);
    const [submitting, setSubmitting] = useState(false);
    const [submitted,  setSubmitted]  = useState(false);
    const [ciCode,     setCiCode]     = useState('');

    // ── Offline mode ──────────────────────────────────────────────────────
    const currentUserToken = useSelector(s => s.user?.token || s.auth?.token || null);
    const {
        queue, stats, addEntry, removeEntry,
        markSynced, markFailed, clearSynced, getAll,
    } = useLAFOfflineQueue(qrToken);

    const [showQueue,        setShowQueue]        = useState(false);
    const [lastQueuedEntry,  setLastQueuedEntry]  = useState(null);
    const [offlineConfirmed, setOfflineConfirmed] = useState(false);
    const [syncing,          setSyncing]          = useState(false);
    const [syncProgress,     setSyncProgress]     = useState(null);
    const [syncResults,      setSyncResults]      = useState([]);

    const isExistingClient  = clientType === 'reloan' || clientType === 'pending';
    // For biometric: only Prospect requires it mandatorily.
    // Balik, Reloan, Pending — attempt but skippable (captured at disbursement if missed)
    const biometricRequired = clientType === 'prospect';

    const uploadFile = useCallback(async (file, origin, uuid) => {
        const compressed = await compressImage(file);
        const fd = new FormData();
        fd.append('file', compressed); fd.append('origin', origin); fd.append('uuid', uuid || `laf${Date.now()}`);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) throw new Error(res.status === 413 ? 'File too large.' : `Upload error (${res.status})`);
        const data = await res.json();
        if (!data.fileKey) throw new Error('Upload failed');
        return data.fileKey;
    }, []);

    // ── Blob → base64 helper ─────────────────────────────────────────────
    const blobToBase64 = (blob) => new Promise((resolve, reject) => {
        if (!blob) { resolve(null); return; }
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

    // ── Sync offline queue ────────────────────────────────────────────────
    const syncQueue = useCallback(async () => {
        if (syncing) return;
        const token = currentUserToken;
        if (!token) {
            toast.error('You must be logged in to sync. Please log in and try again.');
            return;
        }
        const pending = queue.filter(e => e.status === 'pending');
        if (pending.length === 0) { toast.info('Nothing to sync.'); return; }
        setSyncing(true);
        setSyncProgress({ current: 0, total: pending.length });
        const results = [];
        for (let i = 0; i < pending.length; i++) {
            const entry = pending[i];
            setSyncProgress({ current: i + 1, total: pending.length });
            try {
                const [lafB64, idB64, selfieB64] = await Promise.all([
                    blobToBase64(entry.lafPhotoBlob),
                    blobToBase64(entry.idPhotoBlob),
                    blobToBase64(entry.selfieBlob),
                ]);
                const res = await fetch('/api/v2/laf/sync', {
                    method:  'POST',
                    headers: {
                        'Content-Type':  'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        ...entry.formData,
                        offlineId:      entry.id,
                        lafPhotoBase64: lafB64,
                        idPhotoBase64:  idB64,
                        selfieBase64:   selfieB64,
                    }),
                });
                const data = await res.json();
                if (data.success) {
                    await markSynced(entry.id, data.ciReferenceCode);
                    results.push({ id: entry.id, success: true, ciCode: data.ciReferenceCode });
                } else {
                    await markFailed(entry.id, data.message || 'Sync failed');
                    results.push({ id: entry.id, success: false, error: data.message });
                }
            } catch (err) {
                await markFailed(entry.id, err.message || 'Network error');
                results.push({ id: entry.id, success: false, error: err.message });
            }
        }
        setSyncing(false);
        setSyncProgress(null);
        setSyncResults(results);
        const ok  = results.filter(r => r.success).length;
        const bad = results.filter(r => !r.success).length;
        if (ok > 0)  toast.success(`${ok} application${ok > 1 ? 's' : ''} synced successfully.`);
        if (bad > 0) toast.error(`${bad} application${bad > 1 ? 's' : ''} failed to sync.`);

        // Clear ALL offline caches after sync — force fresh data on next prepare
        if (ok > 0) {
            try {
                // Clear LAF member cache (group-scoped key)
                localStorage.removeItem(CACHE_KEY);
                // Clear CI field cache
                localStorage.removeItem('ci_field_cache');
                setCachedClients(null);
                setCacheReady(false);
                setCachedAt(null);
            } catch (e) {
                console.warn('Failed to clear offline caches after sync:', e);
            }
        }
    }, [syncing, queue, markSynced, markFailed, currentUserToken, CACHE_KEY]);

    // ── REMOVED: standalone checkDuplicates function that was called post-step-advance.
    // Duplicate check is now inlined in goNext under the Personal step handler
    // to ensure it runs BEFORE setStep — see FIX below.

    const validateAndNext = async (schema, values, form) => {
        try {
            await schema.validate(values, { abortEarly: false });
            form.setErrors({}); setStep(s => s + 1);
        } catch (err) {
            const t = {}, e = {};
            err.inner.forEach(x => { t[x.path] = true; e[x.path] = x.message; });
            form.setTouched(t, false); form.setErrors(e);
        }
    };

    const handleLookup = async () => {
        // Offline: search cached clients instead of hitting API
        if (!isOnline) {
            if (!cachedClients) {
                toast.error('No cached data. Please use Prepare for Field while online first.');
                return;
            }
            const term = lookupLastName.trim().toLowerCase();
            const matches = cachedClients.filter(cl => {
                const nameMatch = cl.lastName?.toLowerCase().includes(term);
                const slotMatch = !lookupSlotNo || String(cl.slotNo) === String(lookupSlotNo);
                return nameMatch && slotMatch;
            });
            if (matches.length === 0) {
                toast.error('Member not found in cached records. Check the name or slot number.');
            } else if (matches.length > 1 && clientType === 'balik') {
                setBalikMatches(matches);
                setFoundClient(null);
            } else {
                const found = matches[0];
                setFoundClient(found);
                const hasId = !!(found.governmentIdType && found.governmentIdNumber);
                setIdStepNeeded(!hasId);
            }
            return;
        }
        if (clientType === 'balik') {
            if (!lookupFirstName.trim()) { toast.error('Please enter your first name.'); return; }
            if (!lookupLastName.trim())  { toast.error('Please enter your last name.'); return; }
        } else {
            if (!lookupLastName.trim()) { toast.error('Please enter your last name.'); return; }
            if (!lookupSlotNo) { toast.error('Please select your slot number.'); return; }
        }
        setLookupLooking(true);
        try {
            const mode = clientType === 'pending' ? 'pending'
                       : clientType === 'balik'   ? 'balik'
                       : 'reloan';
            const p = new URLSearchParams({ mode, groupId });
            if (clientType === 'balik') {
                // Balik: firstName + lastName mandatory, middleName + branchId optional
                p.set('firstName', lookupFirstName.trim());
                p.set('lastName',  lookupLastName.trim());
                if (lookupMiddleName.trim()) p.set('middleName', lookupMiddleName.trim());
                if (lookupBranchId)         p.set('branchId',   lookupBranchId);
            } else {
                p.set('branchId', branchId);
                p.set('lastName', lookupLastName.trim());
                p.set('slotNo',   lookupSlotNo || '1');
            }
            const res  = await publicFetch(`/api/public/laf/lookup-client?${p}`);
            const data = await res.json();
            if (data.success && data.multipleFound) {
                setBalikMatches(data.clients || []);
                setFoundClient(null);
            } else if (data.success && data.client) {
                setBalikMatches([]);
                setFoundClient(data.client);
                // Signal STEPS to include ID step if client has no ID on record
                const hasId = !!(data.client.governmentIdType && data.client.governmentIdNumber);
                setIdStepNeeded(!hasId);
                lockedHasId.current = hasId;
            } else {
                setFoundClient(null);
                setBalikMatches([]);
                toast.error(data.message || 'Not found. Check your details.');
            }
        } catch { toast.error('Lookup failed.'); }
        finally { setLookupLooking(false); }
    };

    const goNext = useCallback(async () => {
        const cur = step;
        if (cur === 0) { if (!clientType) { toast.error('Please select membership type.'); return; } setStep(1); return; }
        if (cur === si('Photo')) {
            // Allow proceeding if there's a new photo OR an existing profile photo loaded
            if (!lafPhotoFile && !lafPhotoPreview) {
                toast.error('Please capture or upload your photo.');
                return;
            }
            setStep(s => s + 1);
            return;
        }
        if (cur === si('ID')) {
            // Existing client with ID on record — confirm only (no recapture)
            if (isExistingClient && existingClientHasId) {
                if (!idType)   setIdType(foundClient?.governmentIdType   || '');
                if (!idNumber) setIdNumber(foundClient?.governmentIdNumber || '');
                setIdErrors({}); setStep(s => s + 1); return;
            }
            // Validate fields first
            const errs = {};
            if (!idType) errs.idType = 'Required';
            if (!idNumber.trim()) {
                errs.idNumber = 'Required';
            } else {
                const fmtError = validateIdNumber(idType, idNumber);
                if (fmtError) errs.idNumber = fmtError;
            }
            if (!idPhotoFile) errs.idPhoto = 'Required';
            if (requireSelfieWithId && !selfieWithIdFile) errs.selfieWithId = 'Required';
            if (Object.keys(errs).length) { setIdErrors(errs); return; }
            setIdErrors({});
            // Check for duplicate ID number — block if already registered to another client
            setIdDupChecking(true);
            try {
                const p = new URLSearchParams({ idType, idNumber: idNumber.trim() });
                // Pass existingClientId so reloan/pending/balik don't block on their own ID
                if (foundClient?._id) p.set('existingClientId', foundClient._id);
                const res  = await publicFetch(`/api/public/laf/check-id-duplicate?${p}`);
                const data = await res.json();
                if (data.isDuplicate && data.conflicts?.length > 0) {
                    setIdDuplicate(data);
                    setIdDupChecking(false);
                    return; // Block — show warning in UI
                }
            } catch { /* fail open */ }
            setIdDuplicate(null);
            setIdDupChecking(false);
            setStep(s => s + 1);
            return;
        }
        if (cur === si('Lookup')) {
            // Balik can skip lookup if no match found
            if (!foundClient && clientType !== 'balik') {
                toast.error('Please find your record first.');
                return;
            }
            setStep(s => s + 1);
            return;
        }
        if (cur === si('Confirm')) {
            setStep(s => s + 1);
            return;
        }

        // ── FIX: Personal step — check duplicates BEFORE advancing ──────────────
        // Previously: validateAndNext() advanced the step first, then checkDuplicates()
        // was called after — by the time duplicates were found, user was already on
        // the Address step so the warning was invisible.
        // Now: validate → check duplicates → only then advance.
        if (cur === si('Personal')) {
            const form = formikRef.current;
            if (!form) return;

            // Step 1: validate fields — stop if invalid
            try {
                await personalSchema.validate(form.values, { abortEarly: false });
                form.setErrors({});
                form.setTouched({}, false);
            } catch (err) {
                const t = {}, e = {};
                err.inner.forEach(x => { t[x.path] = true; e[x.path] = x.message; });
                form.setTouched(t, false);
                form.setErrors(e);
                return; // invalid — do not proceed
            }

            // Step 2: for Prospect, check name duplicates BEFORE advancing
            // dupWarningAcked = user already confirmed "this is a different person"
            if (clientType === 'prospect' && !dupWarningAcked) {
                setDupChecking(true);
                try {
                    const p = new URLSearchParams({
                        firstName: form.values.firstName.trim(),
                        lastName:  form.values.lastName.trim(),
                    });
                    if (form.values.birthdate) p.set('birthdate', form.values.birthdate);
                    const res  = await publicFetch(`/api/public/laf/check-duplicate?${p}`);
                    const data = await res.json();
                    const found = data.success ? (data.duplicates || []) : [];
                    setDuplicates(found);
                    if (found.length > 0) {
                        // Block — warning panel is now visible on THIS step
                        // User must click "This is a different person" to set dupWarningAcked
                        setDupChecking(false);
                        return;
                    }
                } catch { /* fail open — don't block on network error */ }
                finally { setDupChecking(false); }
            }

            // Step 3: advance
            setStep(s => s + 1);
            return;
        }
        // ── END FIX ─────────────────────────────────────────────────────────────

        if (cur === si('Address')) { await validateAndNext(addressSchema, formikRef.current?.values, formikRef.current); return; }
        if (cur === si('Loan')) { await validateAndNext(loanSchema, formikRef.current?.values, formikRef.current); return; }
        setStep(s => s + 1);
    }, [step, clientType, lafPhotoFile, lafPhotoPreview, idType, idNumber, idPhotoFile,
        selfieWithIdFile, requireSelfieWithId, foundClient, si, dupWarningAcked,
        existingClientHasId, isExistingClient]);

    const goPrev = () => setStep(s => Math.max(s - 1, 0));

    const handleSubmit = useCallback(async (values) => {
        // ── Validate: same existing client already queued offline ─────────
        if (foundClient?._id && (clientType === 'reloan' || clientType === 'pending' || clientType === 'balik')) {
            const alreadyQueued = queue.some(
                e => e.status !== 'failed' &&
                     e.formData?.existingClientId === foundClient._id
            );
            if (alreadyQueued) {
                toast.error(
                    `${foundClient.lastName}, ${foundClient.firstName} already has a ` +
                    `pending application in the queue. Sync first before submitting another.`
                );
                return;
            }
        }

        // ── Offline mode: save to queue instead of submitting ─────────────
        if (!isOnline) {
            if (stats.isFull) {
                toast.error('Queue is full (30 clients). Please sync before adding more.');
                return;
            }
            if (!lafPhotoFile && !lafPhotoPreview && !foundClient?.profile) { toast.error('Photo required.'); return; }
            const entryId = await addEntry(
                {
                    ...values,
                    qrToken, groupId, loId, branchId,
                    clientType,
                    existingClientId: foundClient?._id   || null,
                    clientChanges:    Object.fromEntries(
                        Object.entries(clientChanges).filter(([, v]) => v?.trim())
                    ),
                    existingLoanId:   foundClient?.loanId || null,
                    detailFlags:      Object.keys(detailFlags).filter(k => detailFlags[k]),
                    governmentIdType:   idType   || null,
                    governmentIdNumber: idNumber || null,
                    // loanAmount: parseFloat(values.loanAmount) || 0,
                    loanAmount: 0,
                },
                {
                    lafPhoto:     lafPhotoFile,
                    idPhoto:      idPhotoFile,
                    selfieWithId: selfieWithIdFile,
                }
            );
            if (!entryId) {
                toast.error('Failed to save to queue. Please try again.');
                return;
            }
            const saved = queue.find(e => e.id === entryId) || { id: entryId, formData: values };
            setLastQueuedEntry({ id: entryId, formData: { ...values, firstName: values.firstName, lastName: values.lastName } });
            setOfflineConfirmed(true);
            return;
        }

        // ── Online mode: normal submit ────────────────────────────────────
        if (!lafPhotoFile) { toast.error('Photo required.'); return; }
        if (requireClientBiometric && biometricRequired && !biometricVerified) { toast.error('Biometric verification required.'); return; }
        setSubmitting(true);
        try {
            const uuid = `laf${Date.now()}`;
            // Use new photo if taken, otherwise reuse existing profile key
            let lafPhotoKey;
            if (lafPhotoFile) {
                lafPhotoKey = await uploadFile(lafPhotoFile, 'laf-photos', uuid);
            } else if (foundClient?.profile) {
                lafPhotoKey = foundClient.profile; // reuse existing stored key
            } else {
                toast.error('Photo required.');
                setSubmitting(false);
                return;
            }
            let governmentIdPhotoKey = null, selfieWithIdPhotoKey = null;
            if (requireGovernmentId && idPhotoFile) governmentIdPhotoKey = await uploadFile(idPhotoFile, 'laf-id-photos', uuid);
            if (requireSelfieWithId && selfieWithIdFile) selfieWithIdPhotoKey = await uploadFile(selfieWithIdFile, 'laf-selfie-with-id', uuid);
            const res = await publicFetch('/api/public/laf/submit', {
                method: 'POST',
                body: JSON.stringify({
                    groupId, loId, branchId, qrToken, clientType,
                    existingClientId: foundClient?._id || null,
                    clientChanges:    Object.fromEntries(
                        Object.entries(clientChanges).filter(([, v]) => v?.trim())
                    ),
                    existingLoanId: foundClient?.loanId || null,
                    detailFlags: Object.keys(detailFlags).filter(k => detailFlags[k]),
                    ...values,
                    loanAmount: parseFloat(values.loanAmount) || 0,
                    lafPhotoKey, governmentIdPhotoKey, selfieWithIdPhotoKey,
                    governmentIdType: idType || null, governmentIdNumber: idNumber || null,
                    landmark: values.landmark || null, distanceFromBranch: values.distanceFromBranch || null,
                    // Balik history — pass old assignment from lookup
                    oldGroupId:            foundClient?.oldGroupId  || null,
                    oldLoId:               foundClient?.oldLoId     || null,
                    // Duplicate / Balik flags
                    isDuplicateFlagged:    (clientType === 'prospect' && duplicates.length > 0 && !dupWarningAcked)
                                            ? true
                                            : (duplicates.length > 0 && dupWarningAcked),
                    duplicateCandidateIds: duplicates.map(d => d._id),
                    isBalikUnmatched:      clientType === 'balik' && !foundClient,
                    // FIX: face liveness fields — removed old WebAuthn biometric spread
                    // biometricData now contains faceTemplate/faceEnrolledAt/livenessScore
                    // from FaceLivenessStep, NOT WebAuthn credential fields
                    faceTemplate:   biometricData?.faceTemplate
                        ? JSON.stringify(biometricData.faceTemplate)
                        : null,
                    faceEnrolledAt: biometricData?.faceEnrolledAt || null,
                    livenessScore:  biometricData?.livenessScore  || null,
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Submission failed');
            setCiCode(data.ciReferenceCode); setSubmitted(true);
        } catch (err) { toast.error(err.message || 'An error occurred.'); }
        finally { setSubmitting(false); }
    }, [lafPhotoFile, idPhotoFile, selfieWithIdFile, biometricVerified, biometricData,
        groupId, loId, branchId, qrToken, clientType, idType, idNumber,
        foundClient, detailFlags, requireClientBiometric, requireGovernmentId,
        requireSelfieWithId, biometricRequired, uploadFile, duplicates, dupWarningAcked,
        clientChanges]);

    // ── Reset form for "Add Another Client" ──────────────────────────────
    const resetForNextClient = useCallback(() => {
        setSubmitted(false);
        setCiCode('');
        setStep(0);
        setClientType(null);
        setLafPhotoFile(null);
        setLafPhotoPreview(null);
        setIdType('');
        setIdNumber('');
        setIdPhotoFile(null);
        setIdPhotoPreview(null);
        setSelfieWithIdFile(null);
        setIdErrors({});
        setIdDuplicate(null);
        setIdDupChecking(false);
        setIdStepNeeded(false);
        setClientChanges({});
        setLookupLastName('');
        setLookupFirstName('');
        setLookupMiddleName('');
        setLookupSlotNo('');
        setLookupBranchId('');
        setBalikMatches([]);
        setLookupLooking(false);
        setFoundClient(null);
        setDetailFlags({});
        setDuplicates([]);
        setDupWarningAcked(false);
        setBiometricData(null);
        setBiometricVerified(false);
        setOfflineConfirmed(false);
        setLastQueuedEntry(null);
        formikRef.current?.resetForm();
    }, []);

    // ── Offline no-cache gate ──────────────────────────────────────────────
    // If offline and no cached clients loaded, block the form and prompt to prepare.
    // Prospect doesn't need cache (no lookup) so only gate when form needs lookup.
    const needsLookupOnline = !isOnline && !cacheReady &&
        (clientType === 'reloan' || clientType === 'pending' || clientType === 'balik');
    // Show prepare prompt at top of step 0 (not a full block — let prospect through)

    if (submitted) return (
        <LAFSuccessScreen
            ciReferenceCode={ciCode}
            groupName={groupName}
            branchName={branchName}
            onAddAnother={resetForNextClient}
        />
    );

    // Offline confirmation screen
    if (offlineConfirmed && lastQueuedEntry) {
        return (
            <div className="min-h-screen bg-gray-50 py-6 px-4">
                <div className="max-w-lg mx-auto">
                    <div className="text-center mb-5">
                        <h1 className="text-xl font-bold text-gray-900">Loan Application</h1>
                        <p className="text-xs text-gray-500 mt-0.5">{groupName} · {branchName}</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                        <LAFOfflineConfirmation
                            entry={lastQueuedEntry}
                            stats={stats}
                            onAddAnother={resetForNextClient}
                            onViewQueue={() => setShowQueue(true)}
                            MAX_ENTRIES={MAX_ENTRIES}
                        />
                    </div>
                </div>
                <LAFQueuePanel
                    isOpen={showQueue}
                    onClose={() => setShowQueue(false)}
                    queue={queue}
                    onRemove={removeEntry}
                    isSyncing={syncing}
                    syncProgress={syncProgress}
                />
            </div>
        );
    }

    const preFilledValues = foundClient ? {
        firstName: foundClient.firstName || '', lastName: foundClient.lastName || '',
        middleName: foundClient.middleName || '', birthdate: foundClient.birthdate || '',
        contactNumber: foundClient.contactNumber || '',
        addressStreetNo: foundClient.addressStreetNo || '',
        addressBarangayDistrict: foundClient.addressBarangayDistrict || '',
        addressMunicipalityCity: foundClient.addressMunicipalityCity || '',
        addressProvince: foundClient.addressProvince || '',
        addressZipCode: foundClient.addressZipCode || '',
    } : {};

    const initialValues = {
        firstName: '', lastName: '', middleName: '', birthdate: '', contactNumber: '',
        addressStreetNo: '', addressBarangayDistrict: '', addressMunicipalityCity: '',
        addressProvince: '', addressZipCode: '', landmark: '', distanceFromBranch: '',
        // loanAmount: '',
        loanPurpose: '',
        guarantorFirstName: '', guarantorLastName: '', guarantorRelationship: '', guarantorContactNumber: '',
        ...preFilledValues,
    };

    const roFields = isExistingClient && !!foundClient;
    const bioIdx = si('Biometric');

    return (
        <>
        <div className="min-h-screen bg-gray-50 py-6 px-4">
            <div className="max-w-lg mx-auto">
                <div className="text-center mb-5">
                    <h1 className="text-xl font-bold text-gray-900">Loan Application</h1>
                    <p className="text-xs text-gray-500 mt-0.5">{groupName} · {branchName}</p>
                    {loName && <p className="text-xs text-gray-400 mt-0.5">Loan Officer: {loName}</p>}
                </div>

                {/* Prepare for Field — always visible above card when online ── */}
                {isOnline && !cacheReady && (
                    <div className="mb-3 px-4 py-2.5 bg-blue-50 border border-blue-200
                        rounded-xl flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold text-blue-800">
                                📶 Going to the field?
                            </p>
                            <p className="text-xs text-blue-600 mt-0.5">
                                Cache member records so lookup works without internet.
                            </p>
                        </div>
                        <button type="button" onClick={loadGroupClientsForOffline}
                            disabled={cacheLoading}
                            className="flex-shrink-0 px-3 py-1.5 bg-blue-600 text-white
                                text-xs font-semibold rounded-lg hover:bg-blue-700
                                disabled:opacity-50 transition-colors">
                            {cacheLoading ? 'Caching…' : 'Prepare for Field'}
                        </button>
                    </div>
                )}
                {isOnline && cacheReady && cachedAt && (
                    <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200
                        rounded-xl text-xs text-green-700 flex items-center justify-between gap-2">
                        <span>✓ {cachedClients?.length} members cached — expires {
                            new Date(cachedAt + 8 * 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }</span>
                        <button type="button" onClick={loadGroupClientsForOffline}
                            disabled={cacheLoading}
                            className="text-green-600 underline text-xs disabled:opacity-50">
                            Refresh
                        </button>
                    </div>
                )}

                {/* ── Offline banner ───────────────────────────────────── */}
                {!isOnline && (
                    <div className="mb-4 p-3 bg-red-600 text-white rounded-xl text-sm font-semibold flex items-start gap-2">
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                        <div>
                            <p>⚠ Offline Mode — Do NOT refresh or close this page.</p>
                            <p className="text-xs font-normal mt-0.5 text-red-100">
                                Submissions will be saved to this device and synced when internet returns.
                                Biometric capture is skipped — will be done at disbursement.
                                {stats.pending > 0 && ` · ${stats.pending} client${stats.pending > 1 ? 's' : ''} queued`}
                            </p>
                        </div>
                    </div>
                )}

                {/* No-cache offline warning — separate from the red banner */}
                {!isOnline && !cacheReady && (
                    <div className="mb-3 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl">
                        <p className="text-xs font-semibold text-amber-800">
                            ⚠ No member data cached
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                            Member lookup (Reloan, Pending, Balik) will not work.
                            Only <strong>Prospect</strong> applications can be submitted offline.
                            Go online and tap <strong>Prepare for Field</strong> to enable full offline support.
                        </p>
                    </div>
                )}

                {/* ── Back online — sync banner ─────────────────────────── */}
                {isOnline && wasOffline && stats.pending > 0 && (
                    <div className="mb-4 p-3 bg-green-600 text-white rounded-xl text-sm flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                            </svg>
                            <div>
                                <p className="font-semibold">Back Online</p>
                                <p className="text-xs text-green-100">{stats.pending} application{stats.pending > 1 ? 's' : ''} ready to sync</p>
                            </div>
                        </div>
                        <button type="button" onClick={syncQueue}
                            disabled={syncing}
                            className="px-4 py-2 bg-white text-green-700 text-xs font-bold rounded-lg
                                hover:bg-green-50 disabled:opacity-50 flex items-center gap-1.5">
                            {syncing ? (
                                <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Syncing…</>
                            ) : 'Sync Now'}
                        </button>
                    </div>
                )}

                {/* ── View queue button (visible when entries exist) ─────── */}
                {stats.total > 0 && (
                    <button type="button" onClick={() => setShowQueue(true)}
                        className="w-full mb-4 py-2 border border-gray-200 text-gray-600 text-xs
                            font-medium rounded-xl hover:bg-gray-50 flex items-center justify-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
                        </svg>
                        View Queue ({stats.pending} pending{stats.synced > 0 ? `, ${stats.synced} synced` : ''})
                    </button>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <StepBar current={step} total={STEPS.length} labels={STEPS} />

                    {/* Step 0: Client Type */}
                    {step === 0 && (
                        <div>
                            <h2 className="text-base font-semibold text-gray-800 mb-4">Are you a new or existing member?</h2>
                            <div className="space-y-2">
                                {CLIENT_TYPES.map(ct => {
                                    const isBalikOffline = ct.value === 'balik' && !isOnline;
                                    const isLookupOffline = !isOnline && !cacheReady &&
                                        (ct.value === 'reloan' || ct.value === 'pending');
                                    const isDisabled = isBalikOffline || isLookupOffline;
                                    return (
                                    <button key={ct.value} type="button"
                                        disabled={isDisabled}
                                        onClick={() => {
                                            if (isDisabled) return;
                                            setClientType(ct.value);
                                            setFoundClient(null);
                                            setIdStepNeeded(false);
                                            setDetailFlags({});
                                            setClientChanges({});
                                        }}
                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                                            isDisabled
                                                ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                                                : clientType === ct.value
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : 'border-gray-200 bg-white hover:border-blue-300'
                                        }`}>
                                        <p className={`text-sm font-semibold ${isDisabled ? 'text-gray-400' : 'text-gray-900'}`}>
                                            {ct.label}
                                            {isBalikOffline && <span className="ml-2 text-xs font-normal text-amber-600">Online only</span>}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {isBalikOffline
                                                ? 'Balik clients require server-side cross-branch matching — not available offline'
                                                : isLookupOffline
                                                    ? 'Requires cached data — use Prepare for Field'
                                                    : ct.desc}
                                        </p>
                                    </button>
                                    );
                                })}
                            </div>
                            <div className="mt-6 flex justify-end">
                                <button type="button" onClick={goNext} disabled={!clientType}
                                    className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">Next</button>
                            </div>
                        </div>
                    )}

                    {/* Photo */}
                    {step === si('Photo') && (
                        <div>
                            <h2 className="text-base font-semibold text-gray-800 mb-4">Your Photo</h2>
                            {/* Show context only when photo preview successfully loaded */}
                            {lafPhotoPreview && foundClientPhotoUrl && !lafPhotoFile && (
                                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                                    ℹ Current photo loaded from your record. Take a new photo below to replace it.
                                </div>
                            )}
                            <LAFPhotoStep onPhotoReady={file => { if (!file) { setLafPhotoFile(null); setLafPhotoPreview(foundClientPhotoUrl || null); return; } setLafPhotoFile(file); setLafPhotoPreview(URL.createObjectURL(file)); }} uploading={false} preview={lafPhotoPreview} />
                            {lafPhotoFile && (
                                <p className="text-xs text-green-600 mt-2">
                                    {foundClient?.profile
                                        ? '✓ New photo captured — will replace existing'
                                        : '✓ Photo captured'}
                                </p>
                            )}
                            <NavBtns onBack={goPrev} onNext={goNext} nextDisabled={!lafPhotoFile} />
                        </div>
                    )}

                    {/* Government ID */}
                    {requireGovernmentId && si('ID') !== -1 && step === si('ID') && (
                        <div>
                            <h2 className="text-base font-semibold text-gray-800 mb-4">Government ID</h2>

                            {/* Existing client WITH ID on record — show pre-filled + allow photo replacement */}
                            {isExistingClient && existingClientHasId ? (
                                <div className="space-y-4">
                                    <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">
                                        ✓ Government ID on record. Please confirm your details below.
                                    </div>
                                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                                        <p className="text-xs text-gray-400 mb-0.5">ID Type</p>
                                        <p className="text-sm font-semibold text-gray-800">
                                            {PH_ID_TYPES.find(t => t.value === foundClient?.governmentIdType)?.label || foundClient?.governmentIdType || '—'}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                                        <p className="text-xs text-gray-400 mb-0.5">ID Number</p>
                                        <p className="text-sm font-semibold text-gray-800">
                                            {foundClient?.governmentIdNumber || '—'}
                                        </p>
                                    </div>
                                    {/* ID photo — pre-populate if on record, allow replacement */}
                                    <Field label="ID Photo" error={null}>
                                        <p className="text-xs text-gray-500 mb-2">
                                            Your ID photo is on record. You may take a new photo to update it.
                                        </p>
                                        <PhotoCapture
                                            onFileReady={file => {
                                                setIdPhotoFile(file);
                                                setIdPhotoPreview(file ? URL.createObjectURL(file) : null);
                                            }}
                                            label={idPhotoFile ? 'Replace ID photo' : 'Update ID photo (optional)'}
                                            facingMode="environment"
                                            maxMB={10}
                                            preview={idPhotoPreview}
                                            existingPhotoKey={foundClient?.governmentIdPhotoKey}
                                        />
                                        {idPhotoFile && (
                                            <p className="text-xs text-blue-600 mt-1">✓ New ID photo captured — will replace the existing one</p>
                                        )}
                                    </Field>
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                                        If your ID type or number has changed, please inform your Loan Officer to update your records.
                                    </div>
                                </div>
                            ) : (
                                /* No ID on record OR prospect/balik — full capture */
                                <div className="space-y-5">
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                                        {isExistingClient
                                            ? 'No government ID found on your record. Please provide your ID to update your profile.'
                                            : 'A valid government-issued ID is required to verify your identity.'}
                                    </div>
                                    {/* ID duplicate warning — no names/refs exposed */}
                                    {idDuplicate && (
                                        <div className="p-3 bg-red-50 border border-red-300 rounded-xl">
                                            <p className="text-xs font-semibold text-red-700 mb-1">
                                                ⛔ Government ID already in use
                                            </p>
                                            <p className="text-xs text-red-600 mb-2">{idDuplicate.message}</p>
                                            {/* FIX: removed conflict detail rows — no names or ref codes returned from API */}
                                            <p className="text-xs text-red-500 mt-2">
                                                Please use a different ID, or select Reloan / Pending / Balik if this is an existing client.
                                            </p>
                                        </div>
                                    )}
                                    {idDupChecking && (
                                        <div className="flex items-center gap-2 text-xs text-gray-400">
                                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                            </svg>
                                            Checking ID number...
                                        </div>
                                    )}
                                    <Field label="ID Type" required error={idErrors.idType}>
                                        <select value={idType} onChange={e => { setIdType(e.target.value); setIdDuplicate(null); }}
                                            className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${idErrors.idType ? 'border-red-400' : 'border-gray-300'}`}>
                                            <option value="">Select ID type...</option>
                                            {PH_ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="ID Number" required error={idErrors.idNumber || idDuplicate?.message}>
                                        <Input name="idNumber" noUppercase value={idNumber}
                                            onChange={e => { setIdNumber(e.target.value); setIdDuplicate(null); setIdErrors(p => ({ ...p, idNumber: null })); }}
                                            onBlur={async (e) => {
                                                const val = e.target.value?.trim();
                                                if (!val || !idType) return;
                                                setIdDupChecking(true);
                                                try {
                                                    const p = new URLSearchParams({ idType, idNumber: val });
                                                    if (foundClient?._id) p.set('existingClientId', foundClient._id);
                                                    const res  = await publicFetch(`/api/public/laf/check-id-duplicate?${p}`);
                                                    const data = await res.json();
                                                    if (data.isDuplicate) setIdDuplicate(data);
                                                    else setIdDuplicate(null);
                                                } catch { /* fail open */ }
                                                finally { setIdDupChecking(false); }
                                            }}
                                            placeholder="Enter your ID number"
                                            error={idErrors.idNumber} />
                                        {idType && ID_FORMAT_RULES[idType] && (
                                            <p className="mt-1 text-xs text-blue-500 font-medium">
                                                {ID_FORMAT_RULES[idType].hint}
                                            </p>
                                        )}
                                    </Field>
                                    <Field label="Photo of ID" required error={idErrors.idPhoto}>
                                        <p className="text-xs text-gray-500 mb-2">Take a clear photo of your government ID (front side).</p>
                                        <PhotoCapture
                                            onFileReady={file => { setIdPhotoFile(file); setIdPhotoPreview(file ? URL.createObjectURL(file) : null); }}
                                            label="Take/upload ID photo" facingMode="environment" maxMB={10}
                                            preview={idPhotoPreview}
                                        />
                                        {idPhotoFile && <p className="text-xs text-green-600 mt-1">✓ ID photo captured</p>}
                                    </Field>
                                    {requireSelfieWithId && (
                                        <Field label="Selfie Holding ID" required error={idErrors.selfieWithId}>
                                            <p className="text-xs text-gray-500 mb-2">Take a selfie holding your ID next to your face.</p>
                                            <PhotoCapture onFileReady={setSelfieWithIdFile} label="Take selfie with ID" facingMode="user" maxMB={10} />
                                            {selfieWithIdFile && <p className="text-xs text-green-600 mt-1">✓ Selfie captured</p>}
                                        </Field>
                                    )}
                                </div>
                            )}
                            {/* FIX: block Next while duplicate detected or check running */}
                            <NavBtns onBack={goPrev} onNext={goNext} nextDisabled={!!idDuplicate || idDupChecking} />
                        </div>
                    )}

                    {/* Lookup step — reloan/pending/balik */}
                    {(isExistingClient || clientType === 'balik') && step === si('Lookup') && (
                        <div>
                            <h2 className="text-base font-semibold text-gray-800 mb-4">Find Your Member Record</h2>
                            <div className="space-y-4">
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                                    {clientType === 'balik'
                                        ? 'Enter your last name to find your previous member record. Your loan must have been offset/closed.'
                                        : clientType === 'pending'
                                            ? 'Enter your last name and slot number. Your latest loan must be completed (fully paid).'
                                            : 'Enter your last name and slot number. You must have an active loan to apply for Reloan.'}
                                </div>
                                {clientType === 'balik' ? (<>
                                    <Field label="First Name" required>
                                        <Input name="fn" value={lookupFirstName} onChange={e => setLookupFirstName(e.target.value.toUpperCase())} placeholder="JUAN" />
                                    </Field>
                                    <Field label="Last Name" required>
                                        <Input name="ln" value={lookupLastName} onChange={e => setLookupLastName(e.target.value.toUpperCase())} placeholder="DELA CRUZ" />
                                    </Field>
                                    <Field label="Middle Name (optional)">
                                        <Input name="mn" value={lookupMiddleName} onChange={e => setLookupMiddleName(e.target.value.toUpperCase())} placeholder="SANTOS or leave blank" />
                                    </Field>
                                    <Field label="Previous Branch (optional)">
                                        <select value={lookupBranchId} onChange={e => setLookupBranchId(e.target.value)}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                            <option value="">All branches</option>
                                            {branchList.map(b => <option key={b._id} value={b._id}>{b.name} ({b.code})</option>)}
                                        </select>
                                    </Field>
                                </>) : (<>
                                    <Field label="Last Name" required>
                                        <Input name="ln" noUppercase value={lookupLastName} onChange={e => setLookupLastName(e.target.value)} placeholder="Enter your last name" />
                                    </Field>
                                    <Field label="Slot Number" required>
                                        <select value={lookupSlotNo} onChange={e => setLookupSlotNo(e.target.value)}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                            <option value="">Select slot number...</option>
                                            {Array.from({ length: 30 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                    </Field>
                                </>)}
                                <button type="button" onClick={handleLookup} disabled={lookupLooking}
                                    className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                                    {lookupLooking ? (<><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Searching...</>) : 'Find My Record'}
                                </button>
                                {/* Multiple Balik matches — show selection list */}
                                {clientType === 'balik' && balikMatches.length > 1 && !foundClient && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-amber-700">
                                            ⚠ Multiple matching records found. Please select the correct one:
                                        </p>
                                        {balikMatches.map(m => (
                                            <BalikMatchCard key={m._id} match={m}
                                                branchName={branchList.find(b => b._id === m.branchId)?.name}
                                                onSelect={() => { setFoundClient(m); setBalikMatches([]); }}
                                            />
                                        ))}
                                    </div>
                                )}

                                {foundClient && (
                                    <div className="p-4 bg-green-50 border border-green-300 rounded-xl space-y-2">
                                        <p className="text-xs font-semibold text-green-700">✓ Member found:</p>
                                        {/* Profile photo + name side by side */}
                                        <div className="flex items-center gap-3">
                                            <ClientPhoto
                                                photoUrl={foundClientPhotoUrl}
                                                firstName={foundClient.firstName}
                                                lastName={foundClient.lastName}
                                                onZoom={() => setPhotoZoom(true)}
                                                size="lg"
                                            />
                                            <p className="text-sm font-bold text-gray-900">
                                                {foundClient.lastName}, {foundClient.firstName} {foundClient.middleName || ''}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                                            {/* Delinquent — shown for all types */}
                                            <div className={`col-span-2 flex items-center gap-2 px-3 py-2 rounded-lg ${
                                                foundClient.delinquent ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
                                            }`}>
                                                <span className={`text-xs font-semibold ${
                                                    foundClient.delinquent ? 'text-red-600' : 'text-green-700'
                                                }`}>
                                                    {foundClient.delinquent ? '⚠ Delinquent: Yes' : '✓ Delinquent: No'}
                                                </span>
                                            </div>

                                            {clientType === 'balik' ? (<>
                                                {/* Balik — resolve branch name from cached branchList */}
                                                <div className="col-span-2">
                                                    <p className="text-xs text-gray-400">Previous Branch</p>
                                                    <p className="text-xs font-semibold text-gray-800">
                                                        {branchList.find(b => b._id === foundClient.branchId)?.name || foundClient.branchId || '—'}
                                                    </p>
                                                </div>
                                            </>) : (<>
                                                {/* Reloan / Pending — slot + loan details */}
                                                <div>
                                                    <p className="text-xs text-gray-400">Slot No.</p>
                                                    <p className="text-xs font-semibold text-gray-800">{foundClient.slotNo}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-400">Loan Status</p>
                                                    <p className={`text-xs font-semibold capitalize ${
                                                        foundClient.loanStatus === 'active'  ? 'text-green-700' :
                                                        foundClient.loanStatus === 'pending' ? 'text-amber-700' :
                                                        'text-gray-700'
                                                    }`}>{foundClient.loanStatus || '—'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-400">Amount Released</p>
                                                    <p className="text-xs font-semibold text-gray-800">
                                                        ₱{foundClient.amountRelease ? Number(foundClient.amountRelease).toLocaleString() : '—'}
                                                    </p>
                                                </div>
                                            </>)}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <NavBtns
                                onBack={goPrev}
                                onNext={goNext}
                                nextDisabled={
                                    (clientType !== 'balik' && !foundClient) ||
                                    balikMatches.length > 1
                                }
                                nextLabel={clientType === 'balik' && !foundClient && balikMatches.length === 0 ? 'Skip & Enter Manually' : 'Next'}
                            />
                        </div>
                    )}

                    {/* Confirm step — reloan/pending/balik (if match found) */}
                    {(isExistingClient || clientType === 'balik') && step === si('Confirm') && foundClient && (
                        <div>
                            <h2 className="text-base font-semibold text-gray-800 mb-4">Confirm Your Details</h2>
                            <div className="space-y-3">

                                {/* ── Read-only fields ── */}
                                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Member Information</p>
                                    {[
                                        ['First Name',  foundClient.firstName],
                                        ['Birthdate',   foundClient.birthdate],
                                        ['Branch',      foundClient.branchName || '—'],
                                        ['Slot No.',    foundClient.slotNo     || '—'],
                                    ].map(([label, value]) => (
                                        <div key={label} className="flex justify-between text-sm">
                                            <span className="text-gray-500">{label}</span>
                                            <span className="font-medium text-gray-900">{value || '—'}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* ── Editable fields ── */}
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 mb-1">
                                    Update any details that have changed since your last loan.
                                </div>

                                {/* Last Name */}
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">
                                        Last Name
                                        <span className="ml-1 text-gray-400 font-normal">(current: {foundClient.lastName})</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Leave blank if unchanged"
                                        value={clientChanges.lastName || ''}
                                        onChange={e => setClientChanges(p => ({ ...p, lastName: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl
                                            focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                                    />
                                </div>

                                {/* Middle Name */}
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">
                                        Middle Name
                                        <span className="ml-1 text-gray-400 font-normal">(current: {foundClient.middleName || 'none'})</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Leave blank if unchanged"
                                        value={clientChanges.middleName || ''}
                                        onChange={e => setClientChanges(p => ({ ...p, middleName: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl
                                            focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                                    />
                                </div>

                                {/* Contact Number */}
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">
                                        Contact Number
                                        <span className="ml-1 text-gray-400 font-normal">(current: {foundClient.contactNumber || '—'})</span>
                                    </label>
                                    <input
                                        type="tel"
                                        placeholder="Leave blank if unchanged"
                                        value={clientChanges.contactNumber || ''}
                                        onChange={e => setClientChanges(p => ({ ...p, contactNumber: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl
                                            focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                                    />
                                </div>

                                {/* Address */}
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">Address</label>
                                    <p className="text-xs text-gray-400 mb-1">
                                        Current: {[foundClient.addressStreetNo, foundClient.addressBarangayDistrict,
                                            foundClient.addressMunicipalityCity, foundClient.addressProvince]
                                            .filter(Boolean).join(', ') || '—'}
                                    </p>
                                    <input type="text" placeholder="Street / House No. (leave blank if unchanged)"
                                        value={clientChanges.addressStreetNo || ''}
                                        onChange={e => setClientChanges(p => ({ ...p, addressStreetNo: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl
                                            focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white mb-1.5" />
                                    <input type="text" placeholder="Barangay / District"
                                        value={clientChanges.addressBarangayDistrict || ''}
                                        onChange={e => setClientChanges(p => ({ ...p, addressBarangayDistrict: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl
                                            focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white mb-1.5" />
                                    <input type="text" placeholder="Municipality / City"
                                        value={clientChanges.addressMunicipalityCity || ''}
                                        onChange={e => setClientChanges(p => ({ ...p, addressMunicipalityCity: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl
                                            focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white mb-1.5" />
                                    <input type="text" placeholder="Province"
                                        value={clientChanges.addressProvince || ''}
                                        onChange={e => setClientChanges(p => ({ ...p, addressProvince: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl
                                            focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
                                </div>

                                {/* Summary of changes */}
                                {Object.entries(clientChanges).some(([, v]) => v?.trim()) && (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                                        ✎ Changes will be applied to this member's record when promoted.
                                    </div>
                                )}
                            </div>
                            <NavBtns onBack={goPrev} onNext={goNext} />
                        </div>
                    )}

                    {/* Formik — ALWAYS mounted so ref + values persist across steps */}
                    <div style={{ display: (step === si('Personal') || step === si('Address') || step === si('Loan')) ? 'block' : 'none' }}>
                    <Formik initialValues={initialValues} validationSchema={yup.object()} onSubmit={handleSubmit} innerRef={formikRef} enableReinitialize={!!foundClient}>
                            {({ values, touched, errors, handleChange, handleBlur, submitForm }) => (
                                <form autoComplete="off">
                                    {step === si('Personal') && (
                                        <div>
                                            <h2 className="text-base font-semibold text-gray-800 mb-4">Personal Information</h2>

                                            {/* Duplicate warning — Prospect only */}
                                            {clientType === 'prospect' && duplicates.length > 0 && !dupWarningAcked && (
                                                <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-xl">
                                                    <p className="text-xs font-semibold text-amber-800 mb-2">
                                                        ⚠ Possible duplicate member found:
                                                    </p>
                                                    {duplicates.map(d => (
                                                        <div key={d._id} className="text-xs text-amber-700 py-1 border-b border-amber-100 last:border-0">
                                                            {d.lastName}, {d.firstName} {d.middleName || ''} · {d.branchName || 'Unknown Branch'} · Status: {d.status}
                                                        </div>
                                                    ))}
                                                    <p className="text-xs text-amber-600 mt-2">
                                                        If this is the same person, please use Reloan, Pending Member, or Balik instead.
                                                        Otherwise, tap below to continue as a new Prospect.
                                                    </p>
                                                    <button type="button"
                                                        onClick={() => setDupWarningAcked(true)}
                                                        className="mt-2 px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700">
                                                        This is a different person — Continue
                                                    </button>
                                                </div>
                                            )}
                                            {clientType === 'prospect' && dupChecking && (
                                                <div className="mb-3 text-xs text-gray-400 flex items-center gap-1.5">
                                                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                                    </svg>
                                                    Checking for existing members...
                                                </div>
                                            )}

                                            <div className="space-y-4">
                                                <Field label="First Name" required error={touched.firstName && errors.firstName}><Input name="firstName" value={values.firstName} onChange={handleChange} onBlur={handleBlur} placeholder="Juan" error={touched.firstName && errors.firstName} readOnly={roFields} /></Field>
                                                <Field label="Last Name" required error={touched.lastName && errors.lastName}><Input name="lastName" value={values.lastName} onChange={handleChange} onBlur={handleBlur} placeholder="dela Cruz" error={touched.lastName && errors.lastName} readOnly={roFields} /></Field>
                                                <Field label="Middle Name" required error={touched.middleName && errors.middleName}><Input name="middleName" value={values.middleName} onChange={handleChange} onBlur={handleBlur} placeholder="Santos" error={touched.middleName && errors.middleName} readOnly={roFields} /></Field>
                                                <Field label="Birthdate" required error={touched.birthdate && errors.birthdate}><Input name="birthdate" value={values.birthdate} onChange={handleChange} onBlur={handleBlur} type="date" error={touched.birthdate && errors.birthdate} readOnly={roFields} /></Field>
                                                <Field label="Contact Number" required error={touched.contactNumber && errors.contactNumber}><Input name="contactNumber" noUppercase value={values.contactNumber} onChange={handleChange} onBlur={handleBlur} placeholder="09XX XXX XXXX" error={touched.contactNumber && errors.contactNumber} /></Field>
                                            </div>
                                        </div>
                                    )}
                                    {step === si('Address') && (
                                        <div>
                                            <h2 className="text-base font-semibold text-gray-800 mb-4">Address</h2>
                                            <div className="space-y-4">
                                                <Field label="Street / House No." required error={touched.addressStreetNo && errors.addressStreetNo}><Input name="addressStreetNo" value={values.addressStreetNo} onChange={handleChange} onBlur={handleBlur} placeholder="123 Rizal St." error={touched.addressStreetNo && errors.addressStreetNo} readOnly={roFields} /></Field>
                                                <Field label="Barangay" required error={touched.addressBarangayDistrict && errors.addressBarangayDistrict}><Input name="addressBarangayDistrict" value={values.addressBarangayDistrict} onChange={handleChange} onBlur={handleBlur} placeholder="Brgy. San Jose" error={touched.addressBarangayDistrict && errors.addressBarangayDistrict} readOnly={roFields} /></Field>
                                                <Field label="Municipality / City" required error={touched.addressMunicipalityCity && errors.addressMunicipalityCity}><Input name="addressMunicipalityCity" value={values.addressMunicipalityCity} onChange={handleChange} onBlur={handleBlur} placeholder="Caloocan City" error={touched.addressMunicipalityCity && errors.addressMunicipalityCity} readOnly={roFields} /></Field>
                                                <Field label="Province" required error={touched.addressProvince && errors.addressProvince}><Input name="addressProvince" value={values.addressProvince} onChange={handleChange} onBlur={handleBlur} placeholder="Metro Manila" error={touched.addressProvince && errors.addressProvince} readOnly={roFields} /></Field>
                                                <Field label="ZIP Code"><Input name="addressZipCode" noUppercase value={values.addressZipCode} onChange={handleChange} onBlur={handleBlur} placeholder="1400" /></Field>
                                                <Field label="Landmark (optional)"><Input name="landmark" noUppercase value={values.landmark} onChange={handleChange} onBlur={handleBlur} placeholder="Near Jollibee, beside Barangay Hall..." /></Field>
                                                <Field label="Distance from Branch (optional)"><Input name="distanceFromBranch" noUppercase value={values.distanceFromBranch} onChange={handleChange} onBlur={handleBlur} placeholder="e.g. 2 km, 30 min by tricycle" /></Field>
                                            </div>
                                        </div>
                                    )}
                                    {step === si('Loan') && (
                                        <div>
                                            <h2 className="text-base font-semibold text-gray-800 mb-4">Loan & Guarantor</h2>
                                            <div className="space-y-4">
                                                {/* <Field label="Loan Amount (₱)" required error={touched.loanAmount && errors.loanAmount}><Input name="loanAmount" value={values.loanAmount} onChange={handleChange} onBlur={handleBlur} type="number" placeholder="5000" error={touched.loanAmount && errors.loanAmount} /></Field> */}
                                                <Field label="Loan Purpose" required error={touched.loanPurpose && errors.loanPurpose}><Input name="loanPurpose" noUppercase value={values.loanPurpose} onChange={handleChange} onBlur={handleBlur} placeholder="Livelihood, education..." error={touched.loanPurpose && errors.loanPurpose} /></Field>
                                                <div className="pt-2 border-t border-gray-100">
                                                    <p className="text-sm font-semibold text-gray-700 mb-3">Guarantor / Co-maker</p>
                                                    <div className="space-y-3">
                                                        <Field label="First Name" required error={touched.guarantorFirstName && errors.guarantorFirstName}><Input name="guarantorFirstName" value={values.guarantorFirstName} onChange={handleChange} onBlur={handleBlur} placeholder="Maria" error={touched.guarantorFirstName && errors.guarantorFirstName} /></Field>
                                                        <Field label="Last Name" required error={touched.guarantorLastName && errors.guarantorLastName}><Input name="guarantorLastName" value={values.guarantorLastName} onChange={handleChange} onBlur={handleBlur} placeholder="Santos" error={touched.guarantorLastName && errors.guarantorLastName} /></Field>
                                                        <Field label="Relationship" required error={touched.guarantorRelationship && errors.guarantorRelationship}><Input name="guarantorRelationship" noUppercase value={values.guarantorRelationship} onChange={handleChange} onBlur={handleBlur} placeholder="Spouse, sibling..." error={touched.guarantorRelationship && errors.guarantorRelationship} /></Field>
                                                        <Field label="Contact Number" required error={touched.guarantorContactNumber && errors.guarantorContactNumber}><Input name="guarantorContactNumber" noUppercase value={values.guarantorContactNumber} onChange={handleChange} onBlur={handleBlur} placeholder="09XX XXX XXXX" error={touched.guarantorContactNumber && errors.guarantorContactNumber} /></Field>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="mt-6 flex justify-between">
                                        <button type="button" onClick={goPrev} className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">Back</button>
                                        {step === si('Loan') && bioIdx === -1 ? (
                                            <button type="button" onClick={() => submitForm()} disabled={submitting}
                                                className="px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                                                {submitting ? (<><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Submitting…</>) : 'Submit Application'}
                                            </button>
                                        ) : (
                                            <button type="button" onClick={goNext} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">Next</button>
                                        )}
                                    </div>
                                </form>
                            )}
                        </Formik>
                    </div>

                    {/* Biometric — skipped entirely in offline mode */}
                    {bioIdx !== -1 && step === bioIdx && isOnline && (
                        <div>
                            <h2 className="text-base font-semibold text-gray-800 mb-4">Identity Verification</h2>
                            {!biometricRequired && (
                                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                                    Biometric is recommended. If your device does not support it, you may skip — it will be captured at disbursement.
                                </div>
                            )}
                            <FaceLivenessStep
                                onVerified={d => { setBiometricData(d); setBiometricVerified(true); }}
                                verified={biometricVerified}
                            />
                            <div className="mt-6 flex justify-between">
                                <button type="button" onClick={goPrev} disabled={submitting} className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50">Back</button>
                                <div className="flex gap-2">
                                    {!biometricRequired && !biometricVerified && (
                                        <button type="button"
                                        onClick={() => handleSubmit(formikRef.current?.values || {})}
                                        disabled={submitting}
                                        className="px-4 py-2.5 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50">Skip & Submit</button>
                                    )}
                                    <button type="button"
                                        onClick={() => handleSubmit(formikRef.current?.values || {})}
                                        disabled={submitting || (biometricRequired && !biometricVerified)}
                                        className="px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                                        {submitting ? (<><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Submitting…</>) : (biometricVerified ? 'Submit Application' : (biometricRequired ? 'Verify Biometric First' : 'Submit Application'))}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
        {/* Photo zoom modal */}
        {photoZoom && foundClientPhotoUrl && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black bg-opacity-80"
                onClick={() => setPhotoZoom(false)}>
                <div className="relative max-w-sm w-full mx-4">
                    <img src={foundClientPhotoUrl} alt="Client profile"
                        className="w-full rounded-2xl shadow-2xl object-contain max-h-[80vh]"
                        onError={e => {
                            e.target.style.display = 'none';
                            setPhotoZoom(false);
                        }} />
                    <button type="button" onClick={() => setPhotoZoom(false)}
                        className="absolute top-3 right-3 w-8 h-8 bg-black bg-opacity-50 text-white
                            rounded-full flex items-center justify-center text-sm hover:bg-opacity-70">
                        ✕
                    </button>
                    <p className="text-center text-white text-xs mt-2 opacity-70">Tap anywhere to close</p>
                </div>
            </div>
        )}
        <LAFQueuePanel
            isOpen={showQueue}
            onClose={() => setShowQueue(false)}
            queue={queue}
            onRemove={removeEntry}
            isSyncing={syncing}
            syncProgress={syncProgress}
        />
        </>
    );
};

export default PublicLAFForm;