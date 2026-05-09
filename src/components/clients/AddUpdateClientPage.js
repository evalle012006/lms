import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import { Formik } from 'formik';
import * as yup from 'yup';
import moment from 'moment';
import { ArrowLeftIcon, UserIcon, MapPinIcon,
    PhoneIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { checkFileSize, generateUUID } from '@/lib/utils';
import Spinner from '../Spinner';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import InputText from '@/lib/ui/InputText';
import SelectDropdown from '@/lib/ui/select';
import PrivateImage from '@/components/common/PrivateImage';
import ClientEntryPanel from './ClientEntryPanel';
import placeholder from '/public/images/image-placeholder.png';
import { calculateAge } from '@/lib/date-utils';
import ClientBiometricSection from './ClientBiometricSection';

// ── Section card wrapper ──────────────────────────────────────────────────
const SectionCard = ({ icon: Icon, title, subtitle, children }) => (
    <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100
            bg-gray-50 rounded-t-xl">
            {Icon && <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />}
            <div>
                <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                {subtitle && (
                    <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
                )}
            </div>
        </div>
        <div className="p-6">{children}</div>
    </div>
);

// ── Read-only field row ───────────────────────────────────────────────────
const ReadOnlyField = ({ label, value }) => (
    <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {label}
        </span>
        <span className="text-sm text-gray-900 font-medium">
            {value || <span className="text-gray-300 italic">—</span>}
        </span>
    </div>
);

// ── Validation schema ─────────────────────────────────────────────────────
const validationSchema = yup.object().shape({
    ciName:  yup.string().required('Please enter C.I. name'),
    loId:    yup.string().required('Please select a Loan Officer'),
    groupId: yup.string().required('Please select a Group'),
});

// ── Main component ────────────────────────────────────────────────────────
const AddUpdateClientPage = ({
    mode = 'add',
    client = {},
    clientId = null,
    ciCode = null,
    onBack,
    onSuccess,
}) => {
    const router      = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const transactionSettings = useSelector(state => state.transactionsSettings.data);
    const branchList  = useSelector(state => state.branch.list);
    const groupList   = useSelector(state => state.group.list);

    const formikRef   = useRef();
    const hiddenInput = useRef();

    const [loading, setLoading]             = useState(false);
    const [uploading, setUploading]         = useState(false);
    const [photo, setPhoto]                 = useState(client.profile || '');
    const [image, setImage]                 = useState('');
    const [duplicate, setDuplicate]         = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(client.group?.[0] || null);
    const [filteredGroupList, setFilteredGroupList] = useState([]);

    // CI state
    const [ciPreFill, setCiPreFill]               = useState(null);
    const [ciSearchLoading, setCiSearchLoading]   = useState(false);
    const [showEntryPanel, setShowEntryPanel]     = useState(true);

    const [lightboxUrl, setLightboxUrl] = useState(null);

    const [loList, setLoList] = useState([]);
    const [fetchedClient, setFetchedClient] = useState(null);
    const [clientFetching, setClientFetching] = useState(false);
    const isEdit = mode === 'edit';
    const [loLoading, setLoLoading] = useState(false);

    // Add useEffect to fetch LOs based on branch
    useEffect(() => {
        const fetchLOs = async () => {
            if (!currentUser) return;

            setLoLoading(true);
            try {
                // Branch manager uses their designated branch code
                // Admin/rep2 needs branch selected — for now load all from designated branch
                const branchCode = currentUser.designatedBranch;
                if (!branchCode && currentUser.role.rep > 2) return;

                const params = branchCode
                    ? new URLSearchParams({ branchCode })
                    : new URLSearchParams({});

                const res = await fetchWrapper.get(
                    getApiBaseUrl() + 'users/list?' + params
                );

                if (res.success) {
                    const users = res.users
                        .filter(u => u.role.rep === 4)
                        .map(u => ({
                            ...u,
                            name:  `${u.firstName} ${u.lastName}`,
                            label: `${u.firstName} ${u.lastName}`,
                            value: u._id,
                        }))
                        .sort((a, b) => a.loNo - b.loNo);

                    // If current user is LO, only show themselves
                    if (currentUser.role.rep === 4) {
                        setLoList([{
                            ...currentUser,
                            name:  `${currentUser.firstName} ${currentUser.lastName}`,
                            label: `${currentUser.firstName} ${currentUser.lastName}`,
                            value: currentUser._id,
                        }]);
                    } else {
                        setLoList(users);
                    }
                }
            } catch (e) {
                console.error('Failed to fetch LO list', e);
            } finally {
                setLoLoading(false);
            }
        };

        fetchLOs();
    }, [currentUser]);

    // ── Auto-load from URL ciCode param ──────────────────────────────────
    useEffect(() => {
        if (!ciCode) return;
        setCiSearchLoading(true);
        fetchWrapper
            .get(getApiBaseUrl() + `laf/promote/${encodeURIComponent(ciCode)}`)
            .then(res => {
                if (res.success) {
                    setCiPreFill(res);
                    setShowEntryPanel(false);
                    if (res.duplicateCandidates?.length > 0) setDuplicate(true);
                } else {
                    toast.error(res.message || 'CI code not found or not approved.');
                }
            })
            .finally(() => setCiSearchLoading(false));
    }, [ciCode]);

    useEffect(() => {
        if (mode !== 'edit' || !clientId) return;
        setClientFetching(true);
        fetchWrapper.get(getApiBaseUrl() + 'clients?' + new URLSearchParams({ clientId }))
            .then(res => {
                if (res.success && res.client) {
                    const c = Array.isArray(res.client) ? res.client[0] : res.client;
                    if (!c) return;
                    setFetchedClient(c);
                    if (c.profile) setPhoto(c.profile);
                }
            })
            .finally(() => setClientFetching(false));
    }, [mode, clientId]);

    useEffect(() => {
        if (!fetchedClient) return;
        setSelectedGroup({
            _id:           fetchedClient.groupId   || '',
            name:          fetchedClient.groupName || '',
            loanOfficerId: fetchedClient.loId      || '',
        });
    }, [fetchedClient]);

    // ── Initial form values ───────────────────────────────────────────────
    const initialValues = useMemo(() => {
        // In edit mode, use fetchedClient once loaded
        const c = fetchedClient || client;
        return {
            ciName:    c.ciName    || ciPreFill?.ciData?.investigatedBy || '',
            loId:      c.loId      || (currentUser.role.rep === 4 ? currentUser._id : ''),
            groupId:   c.groupId   || '',
            groupName: c.groupName || '',
            branchId:  c.branchId  || '',
            firstName:               c.firstName               || '',
            lastName:                c.lastName                || '',
            middleName:              c.middleName              || '',
            birthdate:               c.birthdate               || '',
            contactNumber:           c.contactNumber           || '',
            addressStreetNo:         c.addressStreetNo         || '',
            addressBarangayDistrict: c.addressBarangayDistrict || '',
            addressMunicipalityCity: c.addressMunicipalityCity || '',
            addressProvince:         c.addressProvince         || '',
            addressZipCode:          c.addressZipCode          || '',
            status:      c.status      || 'pending',
            duplicate:   c.duplicate   || false,
            delinquent:  c.delinquent === true || c.delinquent === 'Yes' || false,
            groupLeader: c.groupLeader || false,
            archived:    c.archived    || false,
            archivedBy:  c.archivedBy  || '',
        };
    }, [client, fetchedClient, currentUser, ciPreFill]);

    // ── Duplicate check (edit mode only) ──────────────────────────────────
    const hasDuplicates = useCallback(async (field, value) => {
        const form = formikRef.current;
        form.setFieldValue(field, value?.toUpperCase());
        const firstName = field === 'firstName' ? value : form.values.firstName;
        const lastName  = field === 'lastName'  ? value : form.values.lastName;
        if (firstName && lastName) {
            try {
                const res = await fetchWrapper.get(
                    getApiBaseUrl() + 'clients/search?' +
                    new URLSearchParams({
                        firstName: firstName.toUpperCase(),
                        lastName:  lastName.toUpperCase(),
                        mode: 'duplicate',
                    })
                );
                setDuplicate(res.success && res.clients.length > 0);
                if (res.success && res.clients.length > 0)
                    toast.warning('Similar client found. Verify before proceeding.');
            } catch (e) {
                console.error(e);
            }
        }
    }, []);

    // ── LO change → filter groups ─────────────────────────────────────────
    const handleChangeLO = async (field, value) => {
        formikRef.current?.setFieldValue(field, value);
        formikRef.current?.setFieldValue('groupId', ''); // reset group when LO changes

        if (!value) {
            setFilteredGroupList([]);
            return;
        }

        try {
            const lo = loList.find(u => u._id === value);
            const occurence = lo?.transactionType || lo?.occurence || 'daily';

            const branchId = currentUser.designatedBranchId
                || branchList?.[0]?._id
                || '';

            const params = new URLSearchParams({
                loId:      value,
                occurence: occurence,
                branchId:  branchId,
            });

            const res = await fetchWrapper.get(
                getApiBaseUrl() + 'groups/list-by-group-occurence?' + params
            );

            if (res.success) {
                const groups = (res.groups || []).map(g => ({
                    ...g,
                    label: g.name,
                    value: g._id,
                }));
                setFilteredGroupList(groups);
            } else {
                setFilteredGroupList([]);
            }
        } catch (e) {
            console.error('Failed to fetch groups:', e);
            setFilteredGroupList([]);
        }
    };

    // ── Photo upload (edit mode) ──────────────────────────────────────────
    const handleFileChange = useCallback(async (e) => {
        const file = e.target.files[0];
        const sizeMsg = checkFileSize(file?.size);
        if (sizeMsg) { toast.error(sizeMsg); return; }
        setPhoto(URL.createObjectURL(file));
        setImage(file);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('origin', 'clients');
        formData.append('uuid', client?._id || generateUUID());
        setUploading(true);
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setPhoto(data.fileKey);
        } catch {
            toast.error('Failed to upload photo.');
            setPhoto(client.profile || '');
        } finally {
            setUploading(false);
        }
    }, [client]);

    // ── Save ──────────────────────────────────────────────────────────────
    const handleSaveUpdate = useCallback(async (values, actions) => {
        // In add mode, must have CI pre-fill
        if (mode === 'add' && !ciPreFill) {
            toast.error('Please search and select a CI-approved application first.');
            return;
        }

        const cd = ciPreFill?.clientData;
        const age = cd?.birthdate ? calculateAge(cd.birthdate) : 0;
        const ageThreshold = transactionSettings?.clientAgeThreshold || 75;
        if (age > ageThreshold) {
            toast.error(`Client age is over ${ageThreshold} years old.`);
            return;
        }

        setLoading(true);
        try {
            let processedValues = {
                insertedBy:  currentUser._id,
                duplicate,
                ciName:      values.ciName?.toUpperCase(),
                groupLeader: values.groupLeader || false,
                archived:    values.archived    || false,
                archivedBy:  values.archivedBy  || '',
                delinquent:  values.delinquent || false,
            };

            if (mode === 'add') {
                // All personal data comes from CI pre-fill
                Object.assign(processedValues, {
                    firstName:               cd.firstName?.trim().toUpperCase(),
                    lastName:                cd.lastName?.trim().toUpperCase(),
                    middleName:              cd.middleName?.trim().toUpperCase() || '',
                    birthdate:               cd.birthdate
                        ? moment(cd.birthdate).format('YYYY-MM-DD') : null,
                    fullName: `${cd.firstName?.trim()} ${cd.middleName || ''} ${cd.lastName?.trim()}`.toUpperCase(),
                    contactNumber:           cd.contactNumber || '',
                    addressStreetNo:         cd.addressStreetNo         || '',
                    addressBarangayDistrict: cd.addressBarangayDistrict || '',
                    addressMunicipalityCity: cd.addressMunicipalityCity || '',
                    addressProvince:         cd.addressProvince         || '',
                    addressZipCode:          cd.addressZipCode          || '',
                    address: [
                        cd.addressStreetNo, cd.addressBarangayDistrict,
                        cd.addressMunicipalityCity, cd.addressProvince, cd.addressZipCode,
                    ].filter(Boolean).join(' '),
                    profile: ciPreFill?.clientData?.lafPhotoKey || null,
                    biometricCredentialId: cd.biometricCredentialId || null,
                    biometricPublicKey:    cd.biometricPublicKey    || null,
                    biometricCounter:      cd.biometricCounter      || 0,
                    biometricRegisteredAt: cd.biometricRegisteredAt || null,
                    biometricDeviceName:   cd.biometricDeviceName   || null,
                    status:     'pending',
                    delinquent: false,
                    groupId:    values.groupId,
                    loId:       values.loId,
                    groupName:  groupList.find(g => g._id === values.groupId)?.name || '',
                });
            } else {
                // Edit mode — use form values
                Object.assign(processedValues, {
                    _id:        fetchedClient?._id || clientId,
                    firstName:  values.firstName.trim().toUpperCase(),
                    lastName:   values.lastName.trim().toUpperCase(),
                    middleName: values.middleName?.trim().toUpperCase() || '',
                    birthdate:  values.birthdate
                        ? moment(values.birthdate).format('YYYY-MM-DD') : null,
                    fullName: `${values.firstName.trim()} ${values.middleName} ${values.lastName.trim()}`.toUpperCase(),
                    contactNumber:           values.contactNumber,
                    addressStreetNo:         values.addressStreetNo,
                    addressBarangayDistrict: values.addressBarangayDistrict,
                    addressMunicipalityCity: values.addressMunicipalityCity,
                    addressProvince:         values.addressProvince,
                    addressZipCode:          values.addressZipCode,
                    address: [
                        values.addressStreetNo, values.addressBarangayDistrict,
                        values.addressMunicipalityCity, values.addressProvince, values.addressZipCode,
                    ].filter(Boolean).join(' '),
                    file:      image,
                    groupName: selectedGroup?.name          || fetchedClient?.groupName || '',
                    groupId:   selectedGroup?._id           || fetchedClient?.groupId   || '',
                    loId:      selectedGroup?.loanOfficerId || fetchedClient?.loId      || '',
                    status:    values.status                || fetchedClient?.status    || 'pending',
                    delinquent: values.delinquent,
                });
            }

            // Branch assignment for non-admin
            if (currentUser.root !== true &&
                (currentUser.role.rep === 4 || currentUser.role.rep === 3)) {

                // Priority 1: find from branchList (has name)
                const branch = branchList?.find(
                    b => b._id === currentUser.designatedBranchId
                        || b.code === currentUser.designatedBranch
                );

                if (branch) {
                    processedValues.branchId   = branch._id;
                    processedValues.branchName = branch.name;
                } else {
                    // Priority 2: use currentUser directly — always available from login
                    // branchName won't be pretty but branchId is critical for queries
                    processedValues.branchId   = currentUser.designatedBranchId;
                    processedValues.branchName = currentUser.designatedBranch || '';
                }

                // Hard guard — never allow null branchId for non-admin
                if (!processedValues.branchId) {
                    toast.error('Unable to determine branch. Please refresh and try again.');
                    setLoading(false);
                    actions.setSubmitting(false);
                    return;
                }
            }

            const response = mode === 'add'
                ? await fetchWrapper.post(getApiBaseUrl() + 'clients/save/', processedValues)
                : await fetchWrapper.sendData(getApiBaseUrl() + 'clients/', processedValues);

            if (!response.success) {
                toast.error(response.message || 'Failed to save client.');
                return;
            }

            // Mark CI application as promoted
            const effectiveCiCode = ciCode || ciPreFill?.ciData?.ciReferenceCode;
            if (effectiveCiCode && response.client?._id) {
                await fetchWrapper.post(getApiBaseUrl() + 'laf/mark-promoted', {
                    ciReferenceCode: effectiveCiCode,
                    clientId: response.client._id,
                });
            }

            toast.success(mode === 'add'
                ? 'Client successfully added.'
                : 'Client successfully updated.'
            );
            onSuccess?.();
        } catch (err) {
            console.error(err);
            toast.error('An error occurred. Please try again.');
        } finally {
            setLoading(false);
            actions.setSubmitting(false);
        }
    }, [mode, client, image, duplicate, selectedGroup, branchList, groupList,
        currentUser, ciCode, ciPreFill, onSuccess]);

    const handleCIFound = useCallback((result) => {
        const code = result.ciData?.ciReferenceCode;
        
        // Update URL with ciCode — shallow so no full page reload
        if (code) {
            router.replace(
                { pathname: '/clients/add', query: { ciCode: code } },
                undefined,
                { shallow: true }
            );
        }

        setCiPreFill(result);
        setShowEntryPanel(false);
        if (result.duplicateCandidates?.length > 0) setDuplicate(true);
    }, [router]);

    useEffect(() => {
        if (!ciPreFill) return;
        const ciName = ciPreFill?.ciData?.investigatedBy || '';
        if (ciName && formikRef.current) {
            formikRef.current.setFieldValue('ciName', ciName);
        }
    }, [ciPreFill]);

    const cd = ciPreFill?.clientData;

    return (
        <div className="w-full min-h-screen bg-gray-50">
            {(ciSearchLoading || clientFetching) ? (
                <div className="flex items-center justify-center h-screen">
                    <Spinner />
                </div>
            ) : (
                <>
                    {/* ── Sticky top bar ────────────────────────────────────────── */}
                    <div className="sticky top-0 z-10 bg-white border-b border-gray-200
                        px-6 py-3 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={onBack}
                                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <ArrowLeftIcon className="w-5 h-5 text-gray-500" />
                            </button>
                            <div>
                                <h1 className="text-base font-semibold text-gray-900">
                                    {isEdit
                                        ? `Edit — ${fetchedClient?.firstName || ''} ${fetchedClient?.lastName || ''}`
                                        : 'Add New Client'
                                    }
                                </h1>
                                {ciPreFill && (
                                    <p className="text-xs text-blue-600 font-mono">
                                        {ciPreFill.ciData?.ciReferenceCode || ciCode}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Duplicate badge */}
                        {duplicate && (
                            <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs
                                font-semibold rounded-full border border-amber-300">
                                ⚠ Potential Duplicate
                            </span>
                        )}
                    </div>

                    <div className="px-6 py-6">
                        <Formik
                            enableReinitialize
                            innerRef={formikRef}
                            initialValues={initialValues}
                            validationSchema={validationSchema}
                            onSubmit={handleSaveUpdate}
                        >
                            {({ values, touched, errors, handleChange, handleSubmit,
                                setFieldValue, setFieldTouched, isSubmitting, isValidating }) => (
                                <form onSubmit={handleSubmit} autoComplete="off">

                                    {/* ── ADD MODE: CI-first layout ───────────────── */}
                                    {mode === 'add' && (
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                                            {/* Left column — CI lookup + applicant preview */}
                                            <div className="lg:col-span-5 space-y-5">

                                                {/* Entry panel */}
                                                {showEntryPanel && (
                                                    <ClientEntryPanel
                                                        onCIFound={handleCIFound}
                                                        onSkip={() => setShowEntryPanel(false)}
                                                    />
                                                )}

                                                {/* CI pre-fill preview card */}
                                                {ciPreFill && (
                                                    <>
                                                        {/* Identity chain photos — clickable */}
                                                        {(ciPreFill.photos?.lafPhotoUrl || ciPreFill.photos?.selfieUrl) && (
                                                            <>
                                                                {/* Lightbox */}
                                                                {lightboxUrl && (
                                                                    <div
                                                                        className="fixed inset-0 bg-black bg-opacity-90 z-[9999]
                                                                            flex items-center justify-center p-4"
                                                                        onClick={() => setLightboxUrl(null)}
                                                                    >
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setLightboxUrl(null)}
                                                                            className="absolute top-4 right-4 p-2 text-white bg-white
                                                                                bg-opacity-10 rounded-full hover:bg-opacity-20"
                                                                        >
                                                                            <svg className="w-6 h-6" fill="none" stroke="currentColor"
                                                                                viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round"
                                                                                    strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                            </svg>
                                                                        </button>
                                                                        <img
                                                                            src={lightboxUrl}
                                                                            alt="Full view"
                                                                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                                                            onClick={e => e.stopPropagation()}
                                                                        />
                                                                        <p className="absolute bottom-4 left-0 right-0 text-center
                                                                            text-white text-xs opacity-50">Tap outside to close</p>
                                                                    </div>
                                                                )}

                                                                <div className="flex gap-4 mt-3">
                                                                    {ciPreFill.photos.lafPhotoUrl && (
                                                                        <div className="text-center">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setLightboxUrl(ciPreFill.photos.lafPhotoUrl)}
                                                                                className="relative group block"
                                                                            >
                                                                                <img
                                                                                    src={ciPreFill.photos.lafPhotoUrl}
                                                                                    alt="LAF photo"
                                                                                    className="w-20 h-20 object-cover rounded-xl border
                                                                                        border-blue-200 shadow-sm
                                                                                        group-hover:border-blue-400 transition-colors"
                                                                                />
                                                                                <div className="absolute inset-0 bg-black bg-opacity-0
                                                                                    group-hover:bg-opacity-20 rounded-xl transition-all
                                                                                    flex items-center justify-center">
                                                                                    <svg className="w-5 h-5 text-white opacity-0
                                                                                        group-hover:opacity-100"
                                                                                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round"
                                                                                            strokeWidth={2}
                                                                                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                                                    </svg>
                                                                                </div>
                                                                            </button>
                                                                            <p className="text-xs text-blue-500 mt-1">Application photo</p>
                                                                        </div>
                                                                    )}
                                                                    {ciPreFill.photos.selfieUrl && (
                                                                        <div className="text-center">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setLightboxUrl(ciPreFill.photos.selfieUrl)}
                                                                                className="relative group block"
                                                                            >
                                                                                <img
                                                                                    src={ciPreFill.photos.selfieUrl}
                                                                                    alt="CI selfie"
                                                                                    className="w-20 h-20 object-cover rounded-xl border
                                                                                        border-blue-200 shadow-sm
                                                                                        group-hover:border-blue-400 transition-colors"
                                                                                />
                                                                                <div className="absolute inset-0 bg-black bg-opacity-0
                                                                                    group-hover:bg-opacity-20 rounded-xl transition-all
                                                                                    flex items-center justify-center">
                                                                                    <svg className="w-5 h-5 text-white opacity-0
                                                                                        group-hover:opacity-100"
                                                                                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round"
                                                                                            strokeWidth={2}
                                                                                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                                                    </svg>
                                                                                </div>
                                                                            </button>
                                                                            <p className="text-xs text-blue-500 mt-1">CI visit selfie</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}

                                                        {/* Applicant details (read-only) */}
                                                        <SectionCard
                                                            icon={UserIcon}
                                                            title="Applicant Details"
                                                            subtitle="From approved CI application — read only"
                                                        >
                                                            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                                                <ReadOnlyField label="Last Name"   value={cd?.lastName} />
                                                                <ReadOnlyField label="First Name"  value={cd?.firstName} />
                                                                <ReadOnlyField label="Middle Name" value={cd?.middleName} />
                                                                <ReadOnlyField label="Birthdate"   value={cd?.birthdate} />
                                                                <ReadOnlyField label="Contact"     value={cd?.contactNumber} />
                                                                <ReadOnlyField label="Loan Amount"
                                                                    value={cd?.loanAmount
                                                                        ? `₱${Number(cd.loanAmount).toLocaleString()}`
                                                                        : undefined}
                                                                />
                                                            </div>
                                                        </SectionCard>

                                                        {/* Address (read-only) */}
                                                        <SectionCard
                                                            icon={MapPinIcon}
                                                            title="Address"
                                                            subtitle="From approved CI application — read only"
                                                        >
                                                            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                                                <ReadOnlyField label="Street No."    value={cd?.addressStreetNo} />
                                                                <ReadOnlyField label="Barangay"      value={cd?.addressBarangayDistrict} />
                                                                <ReadOnlyField label="City/Municipality" value={cd?.addressMunicipalityCity} />
                                                                <ReadOnlyField label="Province"      value={cd?.addressProvince} />
                                                                <ReadOnlyField label="Zip Code"      value={cd?.addressZipCode} />
                                                            </div>
                                                        </SectionCard>

                                                        {/* Change CI button */}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setCiPreFill(null);
                                                                setShowEntryPanel(true);
                                                                setDuplicate(false);
                                                                // Clear ciCode from URL
                                                                router.replace(
                                                                    { pathname: '/clients/add' },
                                                                    undefined,
                                                                    { shallow: true }
                                                                );
                                                            }}
                                                            className="text-xs text-gray-400 hover:text-gray-600 underline"
                                                        >
                                                            ← Use a different CI code
                                                        </button>
                                                    </>
                                                )}

                                                {/* Empty state when no CI selected */}
                                                {!ciPreFill && !showEntryPanel && (
                                                    <div className="text-center py-16 bg-white rounded-xl
                                                        border border-dashed border-gray-300">
                                                        <ShieldCheckIcon className="w-12 h-12 mx-auto
                                                            text-gray-200 mb-3" />
                                                        <p className="text-sm text-gray-400">
                                                            No CI application selected
                                                        </p>
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowEntryPanel(true)}
                                                            className="mt-3 text-xs text-blue-500
                                                                hover:text-blue-700 underline"
                                                        >
                                                            Search for CI code
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right column — assignment + CI name + save */}
                                            <div className="lg:col-span-7 space-y-5">

                                                {/* Duplicate warning */}
                                                {duplicate && (
                                                    <div className="p-4 bg-amber-50 border border-amber-300
                                                        rounded-xl">
                                                        <p className="text-sm font-semibold text-amber-800">
                                                            ⚠ Similar client already exists
                                                        </p>
                                                        <p className="text-xs text-amber-700 mt-1">
                                                            Verify this is not a duplicate before saving.
                                                            You may still proceed if they are different people.
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Assignment */}
                                                <SectionCard
                                                    icon={UserIcon}
                                                    title="Assignment"
                                                    subtitle="Assign the client to a Loan Officer and Group"
                                                >
                                                    <div className="space-y-4">
                                                        {currentUser.role.rep !== 4 && (
                                                            <SelectDropdown
                                                                name="loId"
                                                                field="loId"
                                                                value={values.loId}
                                                                label={`Loan Officer (Required)${loLoading ? ' — Loading…' : ''}`}
                                                                options={loList}
                                                                onChange={(field, value) => handleChangeLO(field, value)}
                                                                onBlur={setFieldTouched}
                                                                placeholder={loLoading ? 'Loading...' : 'Select Loan Officer'}
                                                                errors={touched.loId && errors.loId ? errors.loId : undefined}
                                                            />
                                                        )}
                                                        <SelectDropdown
                                                            name="groupId"
                                                            field="groupId"
                                                            value={values.groupId}
                                                            label="Group (Required)"
                                                            options={currentUser.role.rep === 4
                                                                ? groupList : filteredGroupList}
                                                            onChange={setFieldValue}
                                                            onBlur={setFieldTouched}
                                                            placeholder="Select Group"
                                                            errors={touched.groupId && errors.groupId
                                                                ? errors.groupId : undefined}
                                                        />
                                                    </div>
                                                </SectionCard>

                                                {/* CI Name */}
                                                <SectionCard
                                                    icon={ShieldCheckIcon}
                                                    title="CI Information"
                                                    subtitle="Credit investigator name for this client"
                                                >
                                                    <InputText
                                                        name="ciName"
                                                        value={values.ciName}
                                                        onChange={handleChange}
                                                        label="CI Name (Required)"
                                                        placeholder={ciPreFill ? '' : 'Enter CI Name'}
                                                        setFieldValue={setFieldValue}
                                                        errors={touched.ciName && errors.ciName ? errors.ciName : undefined}
                                                        disabled={!!ciPreFill} 
                                                    />
                                                    {ciPreFill && values.ciName && (
                                                        <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                                                            <svg className="w-3 h-3 text-green-500" fill="currentColor"
                                                                viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000
                                                                    16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707
                                                                    9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                                    clipRule="evenodd" />
                                                            </svg>
                                                            Auto-filled from CI investigation record
                                                        </p>
                                                    )}
                                                </SectionCard>

                                                {mode === 'edit' && (
                                                    <SectionCard icon={ShieldCheckIcon} title="Biometric Verification">
                                                        <ClientBiometricSection
                                                            client={values}
                                                            onUpdated={() => {
                                                                toast.success('Client updated.');
                                                                // reload client data
                                                                router.replace(router.asPath);
                                                            }}
                                                        />
                                                    </SectionCard>
                                                )}

                                                {/* Save button */}
                                                <div className="flex justify-end gap-3 pt-2">
                                                    <ButtonOutline
                                                        label="Cancel"
                                                        onClick={onBack}
                                                        type="button"
                                                    />
                                                    <ButtonSolid
                                                        label={loading ? 'Saving…' : 'Save Client'}
                                                        type="submit"
                                                        disabled={loading || !ciPreFill}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── EDIT MODE: full editable form ───────────── */}
                                    {mode === 'edit' && (
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                                            {/* Left — photo */}
                                            <div className="lg:col-span-4 space-y-5">
                                                <SectionCard
                                                    icon={UserIcon}
                                                    title="Profile Photo"
                                                    subtitle="Upload a clear photo of the client"
                                                >
                                                    <div className="flex flex-col items-center gap-4">
                                                        <div className="w-40 h-40 relative bg-gray-100
                                                            rounded-2xl border-2 border-dashed border-gray-300
                                                            overflow-hidden hover:border-blue-400
                                                            transition-colors">
                                                            <PrivateImage
                                                                src={photo || null}
                                                                alt="Profile"
                                                                layout="fill"
                                                                objectFit="cover"
                                                                className="rounded-2xl"
                                                                fallback={placeholder}
                                                            />
                                                            <input
                                                                type="file"
                                                                ref={hiddenInput}
                                                                onChange={handleFileChange}
                                                                className="hidden"
                                                                accept="image/*"
                                                            />
                                                        </div>
                                                        <p className="text-xs text-gray-400 text-center">
                                                            Min 300×300px · JPG, PNG · Max 5MB
                                                        </p>
                                                        <div className="flex gap-2 w-full">
                                                            <ButtonSolid
                                                                label={uploading ? 'Uploading…' : 'Upload Photo'}
                                                                onClick={() => hiddenInput.current?.click()}
                                                                disabled={uploading}
                                                            />
                                                            <ButtonOutline
                                                                label="Remove"
                                                                onClick={() => { setPhoto(''); setImage(''); }}
                                                                disabled={uploading}
                                                            />
                                                        </div>
                                                    </div>
                                                </SectionCard>

                                                {/* Duplicate warning in edit mode */}
                                                {duplicate && (
                                                    <div className="p-4 bg-amber-50 border border-amber-300
                                                        rounded-xl">
                                                        <p className="text-sm font-semibold text-amber-800">
                                                            ⚠ Potential Duplicate Found
                                                        </p>
                                                        <p className="text-xs text-amber-700 mt-1">
                                                            A client with a similar name already exists.
                                                            Verify before proceeding.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right — all edit fields */}
                                            <div className="lg:col-span-8 space-y-5">
                                                <SectionCard
                                                    icon={UserIcon}
                                                    title="Personal Information"
                                                >
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                            <InputText
                                                                name="lastName"
                                                                value={values.lastName}
                                                                onChange={handleChange}
                                                                onBlur={(f, v) => hasDuplicates(f, v)}
                                                                label="Last Name (Required)"
                                                                placeholder="Last Name"
                                                                setFieldValue={setFieldValue}
                                                                errors={touched.lastName && errors.lastName
                                                                    ? errors.lastName : undefined}
                                                            />
                                                            <InputText
                                                                name="firstName"
                                                                value={values.firstName}
                                                                onChange={handleChange}
                                                                onBlur={(f, v) => hasDuplicates(f, v)}
                                                                label="First Name (Required)"
                                                                placeholder="First Name"
                                                                setFieldValue={setFieldValue}
                                                                errors={touched.firstName && errors.firstName
                                                                    ? errors.firstName : undefined}
                                                            />
                                                            <InputText
                                                                name="middleName"
                                                                value={values.middleName}
                                                                onChange={handleChange}
                                                                label="Middle Name (Required)"
                                                                placeholder="Middle Name or N/A"
                                                                setFieldValue={setFieldValue}
                                                                errors={touched.middleName && errors.middleName
                                                                    ? errors.middleName : undefined}
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <InputText
                                                                name="birthdate"
                                                                value={values.birthdate}
                                                                onChange={handleChange}
                                                                setFieldValue={setFieldValue}
                                                                placeholder="YYYY-MM-DD"
                                                                label="Birthdate"
                                                            />
                                                            <InputText
                                                                name="contactNumber"
                                                                value={values.contactNumber}
                                                                onChange={handleChange}
                                                                label="Contact Number"
                                                                placeholder="Contact Number"
                                                                setFieldValue={setFieldValue}
                                                            />
                                                        </div>
                                                    </div>
                                                </SectionCard>

                                                <SectionCard
                                                    icon={MapPinIcon}
                                                    title="Address Information"
                                                >
                                                    <div className="space-y-4">
                                                        <InputText
                                                            name="addressStreetNo"
                                                            value={values.addressStreetNo}
                                                            onChange={handleChange}
                                                            label="Street No."
                                                            placeholder="Street No."
                                                            setFieldValue={setFieldValue}
                                                        />
                                                        <InputText
                                                            name="addressBarangayDistrict"
                                                            value={values.addressBarangayDistrict}
                                                            onChange={handleChange}
                                                            label="Barangay / District"
                                                            placeholder="Barangay or District"
                                                            setFieldValue={setFieldValue}
                                                        />
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                            <InputText
                                                                name="addressMunicipalityCity"
                                                                value={values.addressMunicipalityCity}
                                                                onChange={handleChange}
                                                                label="City / Municipality"
                                                                placeholder="City"
                                                                setFieldValue={setFieldValue}
                                                            />
                                                            <InputText
                                                                name="addressProvince"
                                                                value={values.addressProvince}
                                                                onChange={handleChange}
                                                                label="Province"
                                                                placeholder="Province"
                                                                setFieldValue={setFieldValue}
                                                            />
                                                            <InputText
                                                                name="addressZipCode"
                                                                value={values.addressZipCode}
                                                                onChange={handleChange}
                                                                label="Zip Code"
                                                                placeholder="Zip Code"
                                                                setFieldValue={setFieldValue}
                                                            />
                                                        </div>
                                                    </div>
                                                </SectionCard>

                                                <SectionCard
                                                    icon={ShieldCheckIcon}
                                                    title="CI Information"
                                                >
                                                    <InputText
                                                        name="ciName"
                                                        value={values.ciName}
                                                        onChange={handleChange}
                                                        label="CI Name (Required)"
                                                        placeholder="Enter CI Name"
                                                        setFieldValue={setFieldValue}
                                                        disabled={true}
                                                        errors={touched.ciName && errors.ciName
                                                            ? errors.ciName : undefined}
                                                    />
                                                    {values.ciName && (
                                                        <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                                                            <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                            </svg>
                                                            Auto-filled from client record
                                                        </p>
                                                    )}
                                                </SectionCard>

                                                <SectionCard icon={UserIcon} title="Client Flags">
                                                    <div className="space-y-4">
                                                        {/* Delinquent */}
                                                        <div className="flex items-center justify-between py-2">
                                                            <div>
                                                                <p className="text-sm font-semibold text-gray-800">Delinquent</p>
                                                                <p className="text-xs text-gray-400 mt-0.5">Mark this client as delinquent</p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setFieldValue('delinquent', !values.delinquent)}
                                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                                                                    values.delinquent ? 'bg-red-500' : 'bg-gray-200'
                                                                }`}
                                                            >
                                                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                                                    values.delinquent ? 'translate-x-6' : 'translate-x-1'
                                                                }`} />
                                                            </button>
                                                        </div>
                                                        <div className="border-t border-gray-100" />
                                                        {/* Group Leader */}
                                                        <div className="flex items-center justify-between py-2">
                                                            <div>
                                                                <p className="text-sm font-semibold text-gray-800">Group Leader</p>
                                                                <p className="text-xs text-gray-400 mt-0.5">
                                                                    Designate as group leader
                                                                    {fetchedClient?.status !== 'pending' && currentUser.role.rep === 4 && (
                                                                        <span className="ml-1 text-amber-500">— locked for LO on active clients</span>
                                                                    )}
                                                                </p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setFieldValue('groupLeader', !values.groupLeader)}
                                                                disabled={fetchedClient?.status !== 'pending' && currentUser.role.rep === 4}
                                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                                                                    values.groupLeader ? 'bg-blue-500' : 'bg-gray-200'
                                                                }`}
                                                            >
                                                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                                                    values.groupLeader ? 'translate-x-6' : 'translate-x-1'
                                                                }`} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </SectionCard>

                                                <div className="flex justify-end gap-3 pt-2">
                                                    <ButtonOutline
                                                        label="Cancel"
                                                        onClick={onBack}
                                                        type="button"
                                                    />
                                                    <ButtonSolid
                                                        label={loading ? 'Saving…' : 'Update Client'}
                                                        type="submit"
                                                        disabled={loading || uploading}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </form>
                            )}
                        </Formik>
                    </div>
                </>
            )}
        </div>
    );
};

export default AddUpdateClientPage;