// src/pages/laf/[ciCode].js
// LAF detail page — requires login.
// Opened when BM or LO scans the client's QR code.
// Shows full application details + CI investigation status.

import React, { useEffect, useState } from 'react';
import { useRouter }  from 'next/router';
import { useSelector } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { useSignedUrl } from 'hooks/useSignedUrl';
import Spinner from '@/components/Spinner';
import moment from 'moment';
import { CheckCircle, XCircle, Clock, User, MapPin, Phone, CreditCard, Shield } from 'lucide-react';

const StatusBadge = ({ status }) => {
    const cfg = {
        pending:  { icon: Clock,       color: 'bg-amber-100 text-amber-700',  label: 'Pending CI' },
        approved: { icon: CheckCircle, color: 'bg-green-100 text-green-700',  label: 'CI Approved' },
        declined: { icon: XCircle,     color: 'bg-red-100 text-red-700',      label: 'CI Declined' },
        promoted: { icon: CheckCircle, color: 'bg-blue-100 text-blue-700',    label: 'Promoted to Client' },
    }[status] || { icon: Clock, color: 'bg-gray-100 text-gray-700', label: status };

    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
            <Icon className="w-3.5 h-3.5" />
            {cfg.label}
        </span>
    );
};

const InfoRow = ({ label, value }) => (
    value ? (
        <div className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0">
            <span className="text-xs text-gray-400 flex-shrink-0 w-32">{label}</span>
            <span className="text-xs font-medium text-gray-800 text-right">{value}</span>
        </div>
    ) : null
);

const SectionCard = ({ icon: Icon, title, iconColor = 'text-blue-600', children }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4">
            <Icon className={`w-4 h-4 ${iconColor}`} />
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        {children}
    </div>
);

const LAFDetailPage = () => {
    const router      = useRouter();
    const { ciCode }  = router.query;
    const currentUser = useSelector(s => s.user.data);

    const [data,    setData]    = useState(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);

    const { signedUrl: photoUrl } = useSignedUrl(data?.clientData?.lafPhotoKey || null);

    useEffect(() => {
        if (!ciCode || !currentUser) return;
        setLoading(true);
        fetchWrapper.get(
            getApiBaseUrl() + `laf/detail?ciCode=${encodeURIComponent(ciCode)}`
        ).then(res => {
            if (res.success) setData(res);
            else setError(res.message || 'Application not found.');
        }).catch(() => setError('Failed to load application.'))
          .finally(() => setLoading(false));
    }, [ciCode, currentUser]);

    if (loading) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <Spinner />
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
                <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <h2 className="text-base font-semibold text-gray-900 mb-1">Not Found</h2>
                <p className="text-sm text-gray-500">{error}</p>
                <button type="button" onClick={() => router.push('/transactions/ci-investigation')}
                    className="mt-4 w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700">
                    Go to CI Investigation
                </button>
            </div>
        </div>
    );

    if (!data) return null;

    const { clientData, ciData, loanData, photos } = data;
    const cd = clientData || {};
    const ci = ciData     || {};

    return (
        <div className="min-h-screen bg-gray-50 py-6 px-4">
            <div className="max-w-lg mx-auto space-y-4">

                {/* Header */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-start gap-4">
                        {/* Profile photo */}
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                            {photoUrl ? (
                                <img src={photoUrl} alt="Client" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <User className="w-8 h-8 text-gray-300" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-base font-bold text-gray-900 truncate">
                                {cd.lastName}, {cd.firstName} {cd.middleName || ''}
                            </h1>
                            <p className="text-xs text-gray-500 mt-0.5 font-mono">{ciCode}</p>
                            <div className="mt-2">
                                <StatusBadge status={ci.decision || 'pending'} />
                            </div>
                        </div>
                    </div>
                    {ci.investigatedAt && (
                        <p className="text-xs text-gray-400 mt-3">
                            CI conducted by <strong>{ci.investigatedBy}</strong> on{' '}
                            {moment(ci.investigatedAt).format('MMM D, YYYY')}
                        </p>
                    )}
                </div>

                {/* Personal Info */}
                <SectionCard icon={User} title="Personal Information">
                    <InfoRow label="Full Name"     value={`${cd.lastName}, ${cd.firstName} ${cd.middleName || ''}`} />
                    <InfoRow label="Birthdate"     value={cd.birthdate ? moment(cd.birthdate).format('MMMM D, YYYY') : null} />
                    <InfoRow label="Contact"       value={cd.contactNumber} />
                    <InfoRow label="Client Type"   value={cd.clientType ? cd.clientType.charAt(0).toUpperCase() + cd.clientType.slice(1) : null} />
                </SectionCard>

                {/* Address */}
                <SectionCard icon={MapPin} title="Address" iconColor="text-green-600">
                    <InfoRow label="Street"        value={cd.addressStreetNo} />
                    <InfoRow label="Barangay"      value={cd.addressBarangayDistrict} />
                    <InfoRow label="City/Mun."     value={cd.addressMunicipalityCity} />
                    <InfoRow label="Province"      value={cd.addressProvince} />
                    <InfoRow label="ZIP"           value={cd.addressZipCode} />
                    <InfoRow label="Landmark"      value={cd.landmark} />
                    <InfoRow label="Distance"      value={cd.distanceFromBranch} />
                </SectionCard>

                {/* Loan details */}
                <SectionCard icon={CreditCard} title="Loan Details" iconColor="text-purple-600">
                    <InfoRow label="Amount"        value={cd.loanAmount ? `₱${Number(cd.loanAmount).toLocaleString()}` : null} />
                    <InfoRow label="Purpose"       value={cd.loanPurpose} />
                    <InfoRow label="Guarantor"     value={cd.guarantorFirstName ? `${cd.guarantorFirstName} ${cd.guarantorLastName}` : null} />
                    <InfoRow label="Relationship"  value={cd.guarantorRelationship} />
                    <InfoRow label="G. Contact"    value={cd.guarantorContactNumber} />
                </SectionCard>

                {/* Government ID */}
                {(cd.governmentIdType || cd.governmentIdNumber) && (
                    <SectionCard icon={Shield} title="Government ID" iconColor="text-teal-600">
                        <InfoRow label="ID Type"   value={cd.governmentIdType} />
                        <InfoRow label="ID Number" value={cd.governmentIdNumber} />
                        {cd.governmentIdPhotoKey && (
                            <div className="mt-3">
                                <p className="text-xs text-gray-400 mb-1.5">ID Photo</p>
                                <IDPhoto photoKey={cd.governmentIdPhotoKey} />
                            </div>
                        )}
                    </SectionCard>
                )}

                {/* Biometric status */}
                <SectionCard icon={Shield} title="Biometric" iconColor="text-indigo-600">
                    {cd.biometricCredentialId ? (
                        <div className="flex items-center gap-2 text-green-700">
                            <CheckCircle className="w-4 h-4" />
                            <p className="text-xs font-medium">
                                Registered on {cd.biometricRegisteredAt
                                    ? moment(cd.biometricRegisteredAt).format('MMM D, YYYY')
                                    : '—'}
                                {cd.biometricDeviceName ? ` · ${cd.biometricDeviceName}` : ''}
                            </p>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-amber-600">
                            <Clock className="w-4 h-4" />
                            <p className="text-xs font-medium">Not yet registered — will be captured at disbursement</p>
                        </div>
                    )}
                </SectionCard>

                {/* Actions for staff */}
                {currentUser?.role?.rep <= 3 && (
                    <button type="button"
                        onClick={() => router.push(`/transactions/ci-investigation?ciCode=${ciCode}`)}
                        className="w-full py-3 bg-blue-600 text-white text-sm font-semibold
                            rounded-xl hover:bg-blue-700 transition-colors">
                        Open in CI Investigation
                    </button>
                )}
            </div>
        </div>
    );
};

// Sub-component for ID photo with signed URL
const IDPhoto = ({ photoKey }) => {
    const { signedUrl } = useSignedUrl(photoKey);
    if (!signedUrl) return <div className="w-full h-24 bg-gray-100 rounded-lg animate-pulse" />;
    return (
        <img src={signedUrl} alt="Government ID"
            className="w-full max-h-40 object-contain rounded-lg border border-gray-200" />
    );
};

export default LAFDetailPage;