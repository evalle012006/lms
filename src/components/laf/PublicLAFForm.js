import React, { useState, useRef, useCallback } from 'react';
import { Formik }     from 'formik';
import * as yup       from 'yup';
import { toast }      from 'react-toastify';
import LAFPhotoStep   from './LAFPhotoStep';
import LAFSuccessScreen from './LAFSuccessScreen';
import LAFBiometricStep from './LAFBiometricStep';
import PhotoCapture   from '@/components/clients/PhotoCapture';

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

const Input = ({ name, value, onChange, onBlur, placeholder, type = 'text', error, readOnly }) => (
    <input name={name} type={type} value={value}
        onChange={onChange} onBlur={onBlur} placeholder={placeholder} readOnly={readOnly}
        className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
            readOnly ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                : error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}
    />
);

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
    loanAmount: yup.number().typeError('Must be a number').positive().required('Required'),
    loanPurpose: yup.string().required('Required'),
    guarantorFirstName: yup.string().required('Required'), guarantorLastName: yup.string().required('Required'),
    guarantorRelationship: yup.string().required('Required'), guarantorContactNumber: yup.string().required('Required'),
});

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
    const STEPS = (() => {
        if (!clientType) return ['Type'];
        const isExisting = clientType === 'reloan' || clientType === 'pending';
        if (isExisting) {
            const s = ['Type', 'Photo', 'Lookup', 'Confirm', 'Loan'];
            if (requireClientBiometric) s.push('Biometric');
            return s;
        }
        // prospect or balik
        const s = ['Type', 'Photo'];
        if (requireGovernmentId) s.push('ID');
        s.push('Personal', 'Address', 'Loan');
        if (requireClientBiometric) s.push('Biometric');
        return s;
    })();

    const si = name => STEPS.indexOf(name);

    const [step, setStep] = useState(0);
    const [lafPhotoFile, setLafPhotoFile] = useState(null);
    const [lafPhotoPreview, setLafPhotoPreview] = useState(null);
    const [idType, setIdType] = useState('');
    const [idNumber, setIdNumber] = useState('');
    const [idPhotoFile, setIdPhotoFile] = useState(null);
    const [selfieWithIdFile, setSelfieWithIdFile] = useState(null);
    const [idErrors, setIdErrors] = useState({});
    const [lookupLastName, setLookupLastName] = useState('');
    const [lookupSlotNo, setLookupSlotNo] = useState('');
    const [lookupLooking, setLookupLooking] = useState(false);
    const [foundClient, setFoundClient] = useState(null);
    const [detailFlags, setDetailFlags] = useState({});
    const [biometricData, setBiometricData] = useState(null);
    const [biometricVerified, setBiometricVerified] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [ciCode, setCiCode] = useState('');

    const isExistingClient  = clientType === 'reloan' || clientType === 'pending';
    const isProspectOrBalik = clientType === 'prospect' || clientType === 'balik';

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
        if (!lookupLastName.trim()) { toast.error('Please enter your last name.'); return; }
        if (!lookupSlotNo) { toast.error('Please select your slot number.'); return; }
        setLookupLooking(true);
        try {
            const p = new URLSearchParams({ groupId, lastName: lookupLastName.trim(), slotNo: lookupSlotNo });
            const res = await fetch(`/api/public/laf/lookup-client?${p}`);
            const data = await res.json();
            if (data.success && data.client) { setFoundClient(data.client); }
            else { setFoundClient(null); toast.error(data.message || 'Not found. Check your details.'); }
        } catch { toast.error('Lookup failed.'); }
        finally { setLookupLooking(false); }
    };

    const goNext = useCallback(async () => {
        const cur = step;
        if (cur === 0) { if (!clientType) { toast.error('Please select membership type.'); return; } setStep(1); return; }
        if (cur === si('Photo')) { if (!lafPhotoFile) { toast.error('Please capture or upload your photo.'); return; } setStep(s => s + 1); return; }
        if (cur === si('ID')) {
            const errs = {};
            if (!idType) errs.idType = 'Required';
            if (!idNumber.trim()) errs.idNumber = 'Required';
            if (!idPhotoFile) errs.idPhoto = 'Required';
            if (requireSelfieWithId && !selfieWithIdFile) errs.selfieWithId = 'Required';
            if (Object.keys(errs).length) { setIdErrors(errs); return; }
            setIdErrors({}); setStep(s => s + 1); return;
        }
        if (cur === si('Lookup')) { if (!foundClient) { toast.error('Please find your record first.'); return; } setStep(s => s + 1); return; }
        if (cur === si('Confirm')) { setStep(s => s + 1); return; }
        if (cur === si('Personal')) { await validateAndNext(personalSchema, formikRef.current?.values, formikRef.current); return; }
        if (cur === si('Address')) { await validateAndNext(addressSchema, formikRef.current?.values, formikRef.current); return; }
        if (cur === si('Loan')) { await validateAndNext(loanSchema, formikRef.current?.values, formikRef.current); return; }
        setStep(s => s + 1);
    }, [step, clientType, lafPhotoFile, idType, idNumber, idPhotoFile, selfieWithIdFile, requireSelfieWithId, foundClient, si]);

    const goPrev = () => setStep(s => Math.max(s - 1, 0));

    const handleSubmit = useCallback(async (values) => {
        if (!lafPhotoFile) { toast.error('Photo required.'); return; }
        if (requireClientBiometric && isProspectOrBalik && !biometricVerified) { toast.error('Biometric verification required.'); return; }
        setSubmitting(true);
        try {
            const uuid = `laf${Date.now()}`;
            const lafPhotoKey = await uploadFile(lafPhotoFile, 'laf-photos', uuid);
            let governmentIdPhotoKey = null, selfieWithIdPhotoKey = null;
            if (requireGovernmentId && idPhotoFile) governmentIdPhotoKey = await uploadFile(idPhotoFile, 'laf-id-photos', uuid);
            if (requireSelfieWithId && selfieWithIdFile) selfieWithIdPhotoKey = await uploadFile(selfieWithIdFile, 'laf-selfie-with-id', uuid);
            const res = await fetch('/api/public/laf/submit', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    groupId, loId, branchId, qrToken, clientType,
                    existingClientId: foundClient?._id || null,
                    existingLoanId: foundClient?.loanId || null,
                    detailFlags: Object.keys(detailFlags).filter(k => detailFlags[k]),
                    ...values,
                    loanAmount: parseFloat(values.loanAmount) || 0,
                    lafPhotoKey, governmentIdPhotoKey, selfieWithIdPhotoKey,
                    governmentIdType: idType || null, governmentIdNumber: idNumber || null,
                    landmark: values.landmark || null, distanceFromBranch: values.distanceFromBranch || null,
                    ...(requireClientBiometric && biometricData ? biometricData : {}),
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
        requireSelfieWithId, isProspectOrBalik, uploadFile]);

    if (submitted) return <LAFSuccessScreen ciReferenceCode={ciCode} groupName={groupName} branchName={branchName} />;

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
        loanAmount: '', loanPurpose: '',
        guarantorFirstName: '', guarantorLastName: '', guarantorRelationship: '', guarantorContactNumber: '',
        ...preFilledValues,
    };

    const roFields = isExistingClient && !!foundClient;
    const bioIdx = si('Biometric');

    return (
        <div className="min-h-screen bg-gray-50 py-6 px-4">
            <div className="max-w-lg mx-auto">
                <div className="text-center mb-5">
                    <h1 className="text-xl font-bold text-gray-900">Loan Application</h1>
                    <p className="text-xs text-gray-500 mt-0.5">{groupName} · {branchName}</p>
                    {loName && <p className="text-xs text-gray-400 mt-0.5">Loan Officer: {loName}</p>}
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <StepBar current={step} total={STEPS.length} labels={STEPS} />

                    {/* Step 0: Client Type */}
                    {step === 0 && (
                        <div>
                            <h2 className="text-base font-semibold text-gray-800 mb-4">Are you a new or existing member?</h2>
                            <div className="space-y-2">
                                {CLIENT_TYPES.map(ct => (
                                    <button key={ct.value} type="button"
                                        onClick={() => { setClientType(ct.value); setFoundClient(null); setDetailFlags({}); }}
                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${clientType === ct.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                                        <p className="text-sm font-semibold text-gray-900">{ct.label}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{ct.desc}</p>
                                    </button>
                                ))}
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
                            <LAFPhotoStep onPhotoReady={file => { if (!file) { setLafPhotoFile(null); setLafPhotoPreview(null); return; } setLafPhotoFile(file); setLafPhotoPreview(URL.createObjectURL(file)); }} uploading={false} preview={lafPhotoPreview} />
                            <NavBtns onBack={goPrev} onNext={goNext} nextDisabled={!lafPhotoFile} />
                        </div>
                    )}

                    {/* Government ID */}
                    {requireGovernmentId && si('ID') !== -1 && step === si('ID') && (
                        <div>
                            <h2 className="text-base font-semibold text-gray-800 mb-4">Government ID</h2>
                            <div className="space-y-5">
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">A valid government-issued ID is required to verify your identity.</div>
                                <Field label="ID Type" required error={idErrors.idType}>
                                    <select value={idType} onChange={e => setIdType(e.target.value)}
                                        className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${idErrors.idType ? 'border-red-400' : 'border-gray-300'}`}>
                                        <option value="">Select ID type...</option>
                                        {PH_ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </Field>
                                <Field label="ID Number" required error={idErrors.idNumber}>
                                    <Input name="idNumber" value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="Enter your ID number" error={idErrors.idNumber} />
                                </Field>
                                <Field label="Photo of ID" required error={idErrors.idPhoto}>
                                    <p className="text-xs text-gray-500 mb-2">Take a clear photo of your government ID (front side).</p>
                                    <PhotoCapture onFileReady={setIdPhotoFile} label="Take/upload ID photo" facingMode="environment" maxMB={10} />
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
                            <NavBtns onBack={goPrev} onNext={goNext} />
                        </div>
                    )}

                    {/* Existing client lookup */}
                    {isExistingClient && step === si('Lookup') && (
                        <div>
                            <h2 className="text-base font-semibold text-gray-800 mb-4">Find Your Member Record</h2>
                            <div className="space-y-4">
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">Enter your last name and slot number to find your existing member record.</div>
                                <Field label="Last Name" required>
                                    <Input name="ln" value={lookupLastName} onChange={e => setLookupLastName(e.target.value)} placeholder="Enter your last name" />
                                </Field>
                                <Field label="Slot Number" required>
                                    <select value={lookupSlotNo} onChange={e => setLookupSlotNo(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="">Select slot number...</option>
                                        {Array.from({ length: 30 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </Field>
                                <button type="button" onClick={handleLookup} disabled={lookupLooking}
                                    className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                                    {lookupLooking ? (<><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Searching...</>) : 'Find My Record'}
                                </button>
                                {foundClient && (
                                    <div className="p-4 bg-green-50 border border-green-300 rounded-xl">
                                        <p className="text-xs font-semibold text-green-700 mb-1">✓ Member found:</p>
                                        <p className="text-sm font-bold text-gray-900">{foundClient.lastName}, {foundClient.firstName} {foundClient.middleName || ''}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Slot {foundClient.slotNo} · {foundClient.contactNumber || '—'}</p>
                                    </div>
                                )}
                            </div>
                            <NavBtns onBack={goPrev} onNext={goNext} nextDisabled={!foundClient} />
                        </div>
                    )}

                    {/* Confirm existing client */}
                    {isExistingClient && step === si('Confirm') && foundClient && (
                        <div>
                            <h2 className="text-base font-semibold text-gray-800 mb-4">Confirm Your Details</h2>
                            <div className="space-y-3">
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">Review your details. If anything has changed, tick "Changed" — the investigator will update your record.</div>
                                {[
                                    { key: 'name',    label: 'Full Name',      value: `${foundClient.lastName}, ${foundClient.firstName} ${foundClient.middleName || ''}` },
                                    { key: 'contact', label: 'Contact Number',  value: foundClient.contactNumber || '—' },
                                    { key: 'address', label: 'Address',         value: [foundClient.addressStreetNo, foundClient.addressBarangayDistrict, foundClient.addressMunicipalityCity, foundClient.addressProvince].filter(Boolean).join(', ') || '—' },
                                ].map(({ key, label, value }) => (
                                    <div key={key} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                                        <div className="flex-1"><p className="text-xs text-gray-500">{label}</p><p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p></div>
                                        <label className="flex items-center gap-1.5 text-xs text-amber-600 flex-shrink-0">
                                            <input type="checkbox" checked={detailFlags[key] || false} onChange={e => setDetailFlags(p => ({ ...p, [key]: e.target.checked }))} className="rounded" />
                                            Changed
                                        </label>
                                    </div>
                                ))}
                                {Object.values(detailFlags).some(Boolean) && (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">Flagged changes will be reviewed during your CI investigation visit.</div>
                                )}
                            </div>
                            <NavBtns onBack={goPrev} onNext={goNext} />
                        </div>
                    )}

                    {/* Formik steps: Personal, Address, Loan */}
                    {(step === si('Personal') || step === si('Address') || step === si('Loan')) && (
                        <Formik initialValues={initialValues} validationSchema={yup.object()} onSubmit={handleSubmit} innerRef={formikRef} enableReinitialize={!!foundClient}>
                            {({ values, touched, errors, handleChange, handleBlur, submitForm }) => (
                                <form autoComplete="off">
                                    {step === si('Personal') && (
                                        <div>
                                            <h2 className="text-base font-semibold text-gray-800 mb-4">Personal Information</h2>
                                            <div className="space-y-4">
                                                <Field label="First Name" required error={touched.firstName && errors.firstName}><Input name="firstName" value={values.firstName} onChange={handleChange} onBlur={handleBlur} placeholder="Juan" error={touched.firstName && errors.firstName} readOnly={roFields} /></Field>
                                                <Field label="Last Name" required error={touched.lastName && errors.lastName}><Input name="lastName" value={values.lastName} onChange={handleChange} onBlur={handleBlur} placeholder="dela Cruz" error={touched.lastName && errors.lastName} readOnly={roFields} /></Field>
                                                <Field label="Middle Name" required error={touched.middleName && errors.middleName}><Input name="middleName" value={values.middleName} onChange={handleChange} onBlur={handleBlur} placeholder="Santos" error={touched.middleName && errors.middleName} readOnly={roFields} /></Field>
                                                <Field label="Birthdate" required error={touched.birthdate && errors.birthdate}><Input name="birthdate" value={values.birthdate} onChange={handleChange} onBlur={handleBlur} type="date" error={touched.birthdate && errors.birthdate} readOnly={roFields} /></Field>
                                                <Field label="Contact Number" required error={touched.contactNumber && errors.contactNumber}><Input name="contactNumber" value={values.contactNumber} onChange={handleChange} onBlur={handleBlur} placeholder="09XX XXX XXXX" error={touched.contactNumber && errors.contactNumber} /></Field>
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
                                                <Field label="ZIP Code"><Input name="addressZipCode" value={values.addressZipCode} onChange={handleChange} onBlur={handleBlur} placeholder="1400" /></Field>
                                                <Field label="Landmark (optional)"><Input name="landmark" value={values.landmark} onChange={handleChange} onBlur={handleBlur} placeholder="Near Jollibee, beside Barangay Hall..." /></Field>
                                                <Field label="Distance from Branch (optional)"><Input name="distanceFromBranch" value={values.distanceFromBranch} onChange={handleChange} onBlur={handleBlur} placeholder="e.g. 2 km, 30 min by tricycle" /></Field>
                                            </div>
                                        </div>
                                    )}
                                    {step === si('Loan') && (
                                        <div>
                                            <h2 className="text-base font-semibold text-gray-800 mb-4">Loan & Guarantor</h2>
                                            <div className="space-y-4">
                                                <Field label="Loan Amount (₱)" required error={touched.loanAmount && errors.loanAmount}><Input name="loanAmount" value={values.loanAmount} onChange={handleChange} onBlur={handleBlur} type="number" placeholder="5000" error={touched.loanAmount && errors.loanAmount} /></Field>
                                                <Field label="Loan Purpose" required error={touched.loanPurpose && errors.loanPurpose}><Input name="loanPurpose" value={values.loanPurpose} onChange={handleChange} onBlur={handleBlur} placeholder="Livelihood, education..." error={touched.loanPurpose && errors.loanPurpose} /></Field>
                                                <div className="pt-2 border-t border-gray-100">
                                                    <p className="text-sm font-semibold text-gray-700 mb-3">Guarantor / Co-maker</p>
                                                    <div className="space-y-3">
                                                        <Field label="First Name" required error={touched.guarantorFirstName && errors.guarantorFirstName}><Input name="guarantorFirstName" value={values.guarantorFirstName} onChange={handleChange} onBlur={handleBlur} placeholder="Maria" error={touched.guarantorFirstName && errors.guarantorFirstName} /></Field>
                                                        <Field label="Last Name" required error={touched.guarantorLastName && errors.guarantorLastName}><Input name="guarantorLastName" value={values.guarantorLastName} onChange={handleChange} onBlur={handleBlur} placeholder="Santos" error={touched.guarantorLastName && errors.guarantorLastName} /></Field>
                                                        <Field label="Relationship" required error={touched.guarantorRelationship && errors.guarantorRelationship}><Input name="guarantorRelationship" value={values.guarantorRelationship} onChange={handleChange} onBlur={handleBlur} placeholder="Spouse, sibling..." error={touched.guarantorRelationship && errors.guarantorRelationship} /></Field>
                                                        <Field label="Contact Number" required error={touched.guarantorContactNumber && errors.guarantorContactNumber}><Input name="guarantorContactNumber" value={values.guarantorContactNumber} onChange={handleChange} onBlur={handleBlur} placeholder="09XX XXX XXXX" error={touched.guarantorContactNumber && errors.guarantorContactNumber} /></Field>
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
                    )}

                    {/* Biometric */}
                    {bioIdx !== -1 && step === bioIdx && (
                        <div>
                            <h2 className="text-base font-semibold text-gray-800 mb-4">Identity Verification</h2>
                            {isExistingClient && (
                                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                                    Biometric is recommended. If your device does not support it, you may skip — it will be captured at disbursement.
                                </div>
                            )}
                            <LAFBiometricStep onVerified={d => { setBiometricData(d); setBiometricVerified(true); }} verified={biometricVerified} />
                            <div className="mt-6 flex justify-between">
                                <button type="button" onClick={goPrev} disabled={submitting} className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50">Back</button>
                                <div className="flex gap-2">
                                    {isExistingClient && !biometricVerified && (
                                        <button type="button" onClick={() => formikRef.current?.submitForm()} disabled={submitting}
                                            className="px-4 py-2.5 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50">Skip & Submit</button>
                                    )}
                                    <button type="button" onClick={() => formikRef.current?.submitForm()}
                                        disabled={submitting || (isProspectOrBalik && !biometricVerified)}
                                        className="px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                                        {submitting ? (<><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Submitting…</>) : (biometricVerified ? 'Submit Application' : (isProspectOrBalik ? 'Verify Biometric First' : 'Submit Application'))}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PublicLAFForm;