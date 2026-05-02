// src/components/laf/PublicLAFForm.js
import React, { useState, useRef, useCallback } from 'react';
import { Formik } from 'formik';
import * as yup from 'yup';
import { toast } from 'react-toastify';
import LAFPhotoStep from './LAFPhotoStep';
import LAFSuccessScreen from './LAFSuccessScreen';
import LAFBiometricStep from './LAFBiometricStep';

// ── Per-step schemas for Next button validation only ──────────────────────
const step1Schema = yup.object().shape({
    firstName:     yup.string().required('First name is required'),
    lastName:      yup.string().required('Last name is required'),
    middleName:    yup.string().required('Middle name is required'),
    birthdate:     yup.string().required('Birthdate is required'),
    contactNumber: yup.string().required('Contact number is required'),
});

const step2Schema = yup.object().shape({
    addressStreetNo:          yup.string().required('Street / House no. is required'),
    addressBarangayDistrict:  yup.string().required('Barangay is required'),
    addressMunicipalityCity:  yup.string().required('Municipality / City is required'),
    addressProvince:          yup.string().required('Province is required'),
});

const step3Schema = yup.object().shape({
    loanAmount:             yup.number().typeError('Must be a number').positive('Must be positive').required('Loan amount is required'),
    loanPurpose:            yup.string().required('Loan purpose is required'),
    guarantorFirstName:     yup.string().required('Guarantor first name is required'),
    guarantorLastName:      yup.string().required('Guarantor last name is required'),
    guarantorRelationship:  yup.string().required('Relationship is required'),
    guarantorContactNumber: yup.string().required('Guarantor contact is required'),
});

// Full schema used only on final submit
const fullSchema = yup.object().shape({
    firstName:               yup.string().required('First name is required'),
    lastName:                yup.string().required('Last name is required'),
    middleName:              yup.string().required('Middle name is required'),
    birthdate:               yup.string().required('Birthdate is required'),
    contactNumber:           yup.string().required('Contact number is required'),
    addressStreetNo:         yup.string().required('Street / House no. is required'),
    addressBarangayDistrict: yup.string().required('Barangay is required'),
    addressMunicipalityCity: yup.string().required('Municipality / City is required'),
    addressProvince:         yup.string().required('Province is required'),
    loanAmount:              yup.number().typeError('Must be a number').positive('Must be positive').required('Loan amount is required'),
    loanPurpose:             yup.string().required('Loan purpose is required'),
    guarantorFirstName:      yup.string().required('Guarantor first name is required'),
    guarantorLastName:       yup.string().required('Guarantor last name is required'),
    guarantorRelationship:   yup.string().required('Relationship is required'),
    guarantorContactNumber:  yup.string().required('Guarantor contact is required'),
});

const stepSchemas = { 1: step1Schema, 2: step2Schema, 3: step3Schema };

// Step 0 = Photo, Steps 1-3 = Formik form, Step 4 = Biometric
const STEPS = ['Photo', 'Personal', 'Address', 'Loan & Guarantor', 'Biometric'];
const BIOMETRIC_STEP = 4;
const LAST_FORMIK_STEP = 3;

// ── Step indicator ────────────────────────────────────────────────────────
const StepBar = ({ current, total, labels }) => (
    <div className="flex items-center justify-between mb-8">
        {labels.map((label, i) => (
            <React.Fragment key={label}>
                <div className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center
                        text-sm font-semibold transition-colors ${
                        i < current
                            ? 'bg-green-500 text-white'
                            : i === current
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-500'
                    }`}>
                        {i < current ? '✓' : i + 1}
                    </div>
                    <span className={`text-xs hidden sm:block ${
                        i === current ? 'text-blue-600 font-medium' : 'text-gray-400'
                    }`}>
                        {label}
                    </span>
                </div>
                {i < total - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 ${
                        i < current ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                )}
            </React.Fragment>
        ))}
    </div>
);

// ── Field helpers ─────────────────────────────────────────────────────────
const Field = ({ label, error, children }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        {children}
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
);

const Input = ({ name, value, onChange, onBlur, placeholder, type = 'text', error }) => (
    <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none
            focus:ring-2 focus:ring-blue-500 transition-colors ${
            error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
        }`}
    />
);

// ── Main component ────────────────────────────────────────────────────────
const PublicLAFForm = ({ branchId, branchName, branchCode, qrToken }) => {
    const formikRef = useRef();
    const [step, setStep]                           = useState(0);
    const [lafPhotoKey, setLafPhotoKey]             = useState(null);
    const [photoUploading, setPhotoUploading]       = useState(false);
    const [submitting, setSubmitting]               = useState(false);
    const [submitted, setSubmitted]                 = useState(false);
    const [ciCode, setCiCode]                       = useState('');
    const [biometricData, setBiometricData]         = useState(null);
    const [biometricVerified, setBiometricVerified] = useState(false);

    // ── Photo upload ──────────────────────────────────────────────────────
    const handlePhotoReady = useCallback(async (file) => {
        if (!file) { setLafPhotoKey(null); return; }
        setPhotoUploading(true);
        try {
            // Sanitize uuid — only alphanumeric (no hyphens or specials)
            // that match the multer key sanitizer in upload.js
            const uuid = `laf${Date.now()}`;

            const formData = new FormData();
            formData.append('file', file);
            formData.append('origin', 'laf-photos');
            formData.append('uuid', uuid);

            const res  = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();

            if (!data.fileKey) {
                const reason = data.error || data.details || 'Upload failed';
                throw new Error(reason);
            }
            setLafPhotoKey(data.fileKey);
        } catch (err) {
            console.error('LAF photo upload error:', err);
            toast.error(`Photo upload failed: ${err.message || 'Please try again.'}`);
            setLafPhotoKey(null);
        } finally {
            setPhotoUploading(false);
        }
    }, []);

    // ── Step navigation ───────────────────────────────────────────────────
    const goNext = useCallback(async () => {
        // Step 0: Photo validation
        if (step === 0) {
            if (!lafPhotoKey) {
                toast.error('Please capture your photo before continuing.');
                return;
            }
            setStep(1);
            return;
        }

        // Step 4: Biometric — no Next (has its own Submit button)
        if (step === BIOMETRIC_STEP) return;

        // Steps 1-3: Formik validation
        const formik = formikRef.current;
        if (!formik) return;

        const schema = stepSchemas[step];
        if (schema) {
            try {
                await schema.validate(formik.values, { abortEarly: false });
                formik.setErrors({});
                formik.setTouched({}, false);
                setStep(s => s + 1);
            } catch (err) {
                const touched = {};
                const errors  = {};
                err.inner.forEach(e => {
                    touched[e.path] = true;
                    errors[e.path]  = e.message;
                });
                formik.setTouched(touched, false);
                formik.setErrors(errors);
            }
        } else {
            setStep(s => s + 1);
        }
    }, [step, lafPhotoKey]);

    const goPrev = useCallback(() => {
        setStep(s => Math.max(s - 1, 0));
    }, []);

    // ── Final submit ──────────────────────────────────────────────────────
    const handleSubmit = useCallback(async (values) => {
        if (!lafPhotoKey) {
            toast.error('Client photo is required.');
            return;
        }
        if (!biometricVerified || !biometricData) {
            toast.error('Biometric verification is required before submitting.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch('/api/public/laf/submit', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    branchId,
                    qrToken,
                    ...values,
                    loanAmount: parseFloat(values.loanAmount) || 0,
                    lafPhotoKey,
                    ...biometricData, // biometricCredentialId, publicKey, counter, etc.
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Submission failed');
            setCiCode(data.ciReferenceCode);
            setSubmitted(true);
        } catch (err) {
            toast.error(err.message || 'An error occurred. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }, [branchId, qrToken, lafPhotoKey, biometricVerified, biometricData]);

    if (submitted) {
        return <LAFSuccessScreen ciReferenceCode={ciCode} branchName={branchName} />;
    }

    // Whether the Formik section should be visible
    const showFormik = step >= 1 && step <= LAST_FORMIK_STEP;

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-lg mx-auto">

                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Loan Application</h1>
                    <p className="text-sm text-gray-500 mt-1">{branchName}</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <StepBar current={step} total={STEPS.length} labels={STEPS} />

                    {/* ── Step 0: Photo ─────────────────────────────────── */}
                    {step === 0 && (
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800 mb-4">
                                Client Photo
                            </h2>
                            <LAFPhotoStep
                                onPhotoReady={handlePhotoReady}
                                uploading={photoUploading}
                            />
                            <div className="mt-6 flex justify-end">
                                <button
                                    type="button"
                                    onClick={goNext}
                                    disabled={!lafPhotoKey || photoUploading}
                                    className="px-6 py-2.5 bg-blue-600 text-white text-sm
                                        font-medium rounded-lg hover:bg-blue-700
                                        disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 4: Biometric ─────────────────────────────── */}
                    {step === BIOMETRIC_STEP && (
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800 mb-4">
                                Identity Verification
                            </h2>
                            <LAFBiometricStep
                                onVerified={(data) => {
                                    setBiometricData(data);
                                    setBiometricVerified(true);
                                }}
                                verified={biometricVerified}
                            />
                            <div className="mt-6 flex justify-between">
                                <button
                                    type="button"
                                    onClick={goPrev}
                                    disabled={submitting}
                                    className="px-5 py-2.5 border border-gray-300
                                        text-gray-700 text-sm font-medium rounded-lg
                                        hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={() => formikRef.current?.submitForm()}
                                    disabled={!biometricVerified || submitting}
                                    className="px-6 py-2.5 bg-green-600 text-white text-sm
                                        font-medium rounded-lg hover:bg-green-700
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                        flex items-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4" fill="none"
                                                viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12"
                                                    r="10" stroke="currentColor" strokeWidth="4"/>
                                                <path className="opacity-75" fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                            </svg>
                                            Submitting…
                                        </>
                                    ) : 'Submit Application'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Steps 1–3: Formik form — kept mounted, hidden via display ── */}
                    {/* Using display:none instead of unmounting preserves form state  */}
                    <div style={{ display: showFormik ? 'block' : 'none' }}>
                        <Formik
                            innerRef={formikRef}
                            initialValues={{
                                firstName: '', lastName: '', middleName: '',
                                birthdate: '', contactNumber: '',
                                addressStreetNo: '', addressBarangayDistrict: '',
                                addressMunicipalityCity: '', addressProvince: '',
                                addressZipCode: '',
                                loanAmount: '', loanPurpose: '',
                                guarantorFirstName: '', guarantorLastName: '',
                                guarantorRelationship: '', guarantorContactNumber: '',
                            }}
                            validationSchema={fullSchema}
                            onSubmit={handleSubmit}
                            validateOnChange={true}
                            validateOnBlur={false}
                            validateOnMount={false}
                        >
                            {({ values, errors, touched, handleChange, handleBlur, handleSubmit: fSubmit }) => (
                                <form onSubmit={fSubmit} autoComplete="off" noValidate>

                                    {/* ── Step 1: Personal ─────────────────── */}
                                    <div style={{ display: step === 1 ? 'block' : 'none' }}>
                                        <h2 className="text-lg font-semibold text-gray-800 mb-4">
                                            Personal Information
                                        </h2>
                                        <div className="space-y-4">
                                            <Field label="Last Name *"
                                                error={touched.lastName && errors.lastName}>
                                                <Input name="lastName" value={values.lastName}
                                                    onChange={handleChange} onBlur={handleBlur}
                                                    placeholder="DELA CRUZ"
                                                    error={touched.lastName && errors.lastName} />
                                            </Field>
                                            <Field label="First Name *"
                                                error={touched.firstName && errors.firstName}>
                                                <Input name="firstName" value={values.firstName}
                                                    onChange={handleChange} onBlur={handleBlur}
                                                    placeholder="JUAN"
                                                    error={touched.firstName && errors.firstName} />
                                            </Field>
                                            <Field label="Middle Name *"
                                                error={touched.middleName && errors.middleName}>
                                                <Input name="middleName" value={values.middleName}
                                                    onChange={handleChange} onBlur={handleBlur}
                                                    placeholder="SANTOS or N/A"
                                                    error={touched.middleName && errors.middleName} />
                                            </Field>
                                            <Field label="Birthdate *"
                                                error={touched.birthdate && errors.birthdate}>
                                                <Input name="birthdate" value={values.birthdate}
                                                    onChange={handleChange} onBlur={handleBlur}
                                                    type="date"
                                                    error={touched.birthdate && errors.birthdate} />
                                            </Field>
                                            <Field label="Contact Number *"
                                                error={touched.contactNumber && errors.contactNumber}>
                                                <Input name="contactNumber" value={values.contactNumber}
                                                    onChange={handleChange} onBlur={handleBlur}
                                                    placeholder="09xxxxxxxxx"
                                                    error={touched.contactNumber && errors.contactNumber} />
                                            </Field>
                                        </div>
                                    </div>

                                    {/* ── Step 2: Address ──────────────────── */}
                                    <div style={{ display: step === 2 ? 'block' : 'none' }}>
                                        <h2 className="text-lg font-semibold text-gray-800 mb-4">
                                            Address
                                        </h2>
                                        <div className="space-y-4">
                                            <Field label="House / Street No. *"
                                                error={touched.addressStreetNo && errors.addressStreetNo}>
                                                <Input name="addressStreetNo"
                                                    value={values.addressStreetNo}
                                                    onChange={handleChange} onBlur={handleBlur}
                                                    placeholder="123 Rizal St."
                                                    error={touched.addressStreetNo && errors.addressStreetNo} />
                                            </Field>
                                            <Field label="Barangay *"
                                                error={touched.addressBarangayDistrict && errors.addressBarangayDistrict}>
                                                <Input name="addressBarangayDistrict"
                                                    value={values.addressBarangayDistrict}
                                                    onChange={handleChange} onBlur={handleBlur}
                                                    placeholder="Brgy. San Isidro"
                                                    error={touched.addressBarangayDistrict && errors.addressBarangayDistrict} />
                                            </Field>
                                            <Field label="Municipality / City *"
                                                error={touched.addressMunicipalityCity && errors.addressMunicipalityCity}>
                                                <Input name="addressMunicipalityCity"
                                                    value={values.addressMunicipalityCity}
                                                    onChange={handleChange} onBlur={handleBlur}
                                                    placeholder="Quezon City"
                                                    error={touched.addressMunicipalityCity && errors.addressMunicipalityCity} />
                                            </Field>
                                            <Field label="Province *"
                                                error={touched.addressProvince && errors.addressProvince}>
                                                <Input name="addressProvince"
                                                    value={values.addressProvince}
                                                    onChange={handleChange} onBlur={handleBlur}
                                                    placeholder="Metro Manila"
                                                    error={touched.addressProvince && errors.addressProvince} />
                                            </Field>
                                            <Field label="ZIP Code"
                                                error={touched.addressZipCode && errors.addressZipCode}>
                                                <Input name="addressZipCode"
                                                    value={values.addressZipCode}
                                                    onChange={handleChange} onBlur={handleBlur}
                                                    placeholder="1100"
                                                    error={touched.addressZipCode && errors.addressZipCode} />
                                            </Field>
                                        </div>
                                    </div>

                                    {/* ── Step 3: Loan & Guarantor ─────────── */}
                                    <div style={{ display: step === 3 ? 'block' : 'none' }}>
                                        <h2 className="text-lg font-semibold text-gray-800 mb-4">
                                            Loan Details & Guarantor
                                        </h2>
                                        <div className="space-y-4">
                                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                <p className="text-xs font-semibold text-gray-600 mb-3">
                                                    Loan Information
                                                </p>
                                                <div className="space-y-3">
                                                    <Field label="Loan Amount *"
                                                        error={touched.loanAmount && errors.loanAmount}>
                                                        <Input name="loanAmount"
                                                            value={values.loanAmount}
                                                            onChange={handleChange} onBlur={handleBlur}
                                                            type="number" placeholder="5000"
                                                            error={touched.loanAmount && errors.loanAmount} />
                                                    </Field>
                                                    <Field label="Loan Purpose *"
                                                        error={touched.loanPurpose && errors.loanPurpose}>
                                                        <Input name="loanPurpose"
                                                            value={values.loanPurpose}
                                                            onChange={handleChange} onBlur={handleBlur}
                                                            placeholder="Business Capital"
                                                            error={touched.loanPurpose && errors.loanPurpose} />
                                                    </Field>
                                                </div>
                                            </div>

                                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                <p className="text-xs font-semibold text-gray-600 mb-3">
                                                    Guarantor Information
                                                </p>
                                                <div className="space-y-3">
                                                    <Field label="Guarantor Last Name *"
                                                        error={touched.guarantorLastName && errors.guarantorLastName}>
                                                        <Input name="guarantorLastName"
                                                            value={values.guarantorLastName}
                                                            onChange={handleChange} onBlur={handleBlur}
                                                            placeholder="Last Name"
                                                            error={touched.guarantorLastName && errors.guarantorLastName} />
                                                    </Field>
                                                    <Field label="Guarantor First Name *"
                                                        error={touched.guarantorFirstName && errors.guarantorFirstName}>
                                                        <Input name="guarantorFirstName"
                                                            value={values.guarantorFirstName}
                                                            onChange={handleChange} onBlur={handleBlur}
                                                            placeholder="First Name"
                                                            error={touched.guarantorFirstName && errors.guarantorFirstName} />
                                                    </Field>
                                                    <Field label="Relationship *"
                                                        error={touched.guarantorRelationship && errors.guarantorRelationship}>
                                                        <Input name="guarantorRelationship"
                                                            value={values.guarantorRelationship}
                                                            onChange={handleChange} onBlur={handleBlur}
                                                            placeholder="Spouse / Parent / Sibling"
                                                            error={touched.guarantorRelationship && errors.guarantorRelationship} />
                                                    </Field>
                                                    <Field label="Guarantor Contact *"
                                                        error={touched.guarantorContactNumber && errors.guarantorContactNumber}>
                                                        <Input name="guarantorContactNumber"
                                                            value={values.guarantorContactNumber}
                                                            onChange={handleChange} onBlur={handleBlur}
                                                            placeholder="09xxxxxxxxx"
                                                            error={touched.guarantorContactNumber && errors.guarantorContactNumber} />
                                                    </Field>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Navigation — only shown on steps 1-3 ─── */}
                                    <div className="mt-6 flex justify-between">
                                        <button
                                            type="button"
                                            onClick={goPrev}
                                            className="px-5 py-2.5 border border-gray-300
                                                text-gray-700 text-sm font-medium rounded-lg
                                                hover:bg-gray-50"
                                        >
                                            Back
                                        </button>
                                        {/* Always show Next for steps 1-3 — step 4 has its own Submit */}
                                        <button
                                            type="button"
                                            onClick={goNext}
                                            className="px-6 py-2.5 bg-blue-600 text-white
                                                text-sm font-medium rounded-lg hover:bg-blue-700"
                                        >
                                            Next
                                        </button>
                                    </div>

                                </form>
                            )}
                        </Formik>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default PublicLAFForm;