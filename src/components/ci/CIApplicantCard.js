// src/components/ci/CIApplicantCard.js
// Displays applicant information in the CI Investigation detail panel.
//
// Layout — grouped by section:
//   Personal Info: Full Name, Birthdate, Civil Status, Contact, Yrs. of Stay, Business, Daily Income
//   Address: Full address, Landmark, Distance
//   Loan Details: Amount, Purpose, Submitted
//   Guarantor: Name, Relationship, Contact
//   Government ID: Type (uppercase), Number
//   Identity Verification: Face ID or Biometric (whichever is registered)
//   Loan History (existing clients only)

import React from 'react';
import moment from 'moment';

const Row = ({ label, value }) => {
    if (!value && value !== 0) return null;
    return (
        <div className="flex justify-between gap-4 text-xs border-b border-gray-50 pb-2 last:border-0">
            <span className="text-gray-500 flex-shrink-0 w-32">{label}</span>
            <span className="text-gray-900 font-medium text-right">{value}</span>
        </div>
    );
};

const SectionHeader = ({ title }) => (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-4 mb-2 first:mt-0">
        {title}
    </p>
);

const StatusBadge = ({ status }) => {
    const map = {
        pending:            { label: 'Pending CI',         cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
        ci_approved:        { label: 'CI Approved',        cls: 'bg-green-100 text-green-700 border border-green-200' },
        ci_declined:        { label: 'CI Declined',        cls: 'bg-red-100 text-red-700 border border-red-200' },
        promoted:           { label: 'Promoted',           cls: 'bg-blue-100 text-blue-700 border border-blue-200' },
        pending_validation: { label: 'Pending Review',     cls: 'bg-orange-100 text-orange-700 border border-orange-200' },
    };
    const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-500 border border-gray-200' };
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>
            {s.label}
        </span>
    );
};

const CIApplicantCard = ({ application, loanHistory }) => {
    if (!application) return null;

    // ID Type should always display uppercase
    const idTypeDisplay = application.governmentIdType
        ? application.governmentIdType.toUpperCase()
        : null;

    // Identity verification: face liveness takes priority over legacy biometric
    const hasFaceID    = !!(application.faceTemplate || application.faceEnrolledAt);
    const hasBiometric = !!(application.biometricCredentialId);

    const identityStatus = hasFaceID
        ? `Face ID registered${application.faceEnrolledAt
            ? ` · ${moment(application.faceEnrolledAt).format('MMM D, YYYY')}`
            : ''}`
        : hasBiometric
            ? `Biometric registered${application.biometricRegisteredAt
                ? ` · ${moment(application.biometricRegisteredAt).format('MMM D, YYYY')}`
                : ''}${application.biometricDeviceName ? ` · ${application.biometricDeviceName}` : ''}`
            : 'Not yet registered — will be captured at disbursement';

    const identityColor = (hasFaceID || hasBiometric) ? 'text-green-700' : 'text-amber-600';

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Applicant Information</h3>
                <StatusBadge status={application.status} />
            </div>

            <div className="space-y-1.5">

                {/* ── Application ──────────────────────────────────────── */}
                <SectionHeader title="Application" />
                <Row label="CI Reference"  value={application.ciReferenceCode} />
                <Row label="Branch"        value={application.branchCode
                    ? `${application.branchCode} — ${application.branchName}`
                    : application.branchName} />
                <Row label="Client Type"   value={
                    application.clientType
                        ? application.clientType.charAt(0).toUpperCase() + application.clientType.slice(1)
                        : 'Prospect'
                } />
                <Row label="Submitted"     value={application.submittedAt
                    ? moment(application.submittedAt).format('MMM DD, YYYY h:mm A')
                    : null} />

                {/* Group + Slot — for existing clients (reloan/pending/balik) */}
                {application.groupName && (
                    <Row label="Group" value={application.groupName} />
                )}
                {loanHistory?.[0]?.slotNo && (
                    <Row label="Slot No." value={loanHistory[0].slotNo} />
                )}

                {/* ── Personal Information ──────────────────────────────── */}
                <SectionHeader title="Personal Information" />
                <Row label="Full Name"     value={`${application.lastName}, ${application.firstName} ${application.middleName || ''}`.trim()} />
                <Row label="Birthdate"     value={application.birthdate} />
                <Row label="Civil Status"  value={application.civilStatus} />
                <Row label="Contact"       value={application.contactNumber} />
                <Row label="Yrs. of Stay"  value={application.yearsOfStay} />
                <Row label="Business"      value={application.business} />
                <Row label="Daily Income"  value={application.dailyIncome
                    ? `₱${application.dailyIncome}`
                    : null} />

                {/* ── Address ──────────────────────────────────────────── */}
                <SectionHeader title="Address" />
                <Row label="Address"       value={application.address} />
                {application.landmark           && <Row label="Landmark"   value={application.landmark} />}
                {application.distanceFromBranch && <Row label="Distance"   value={application.distanceFromBranch} />}

                {/* ── Loan Details ──────────────────────────────────────── */}
                <SectionHeader title="Loan Details" />
                <Row label="Loan Amount"   value={application.loanAmount
                    ? `₱${Number(application.loanAmount).toLocaleString()}`
                    : null} />
                <Row label="Loan Purpose"  value={application.loanPurpose} />

                {/* ── Guarantor ─────────────────────────────────────────── */}
                <SectionHeader title="Guarantor" />
                <Row label="Name"          value={
                    [application.guarantorFirstName, application.guarantorLastName]
                        .filter(Boolean).join(' ') || null
                } />
                <Row label="Relationship"  value={application.guarantorRelationship} />
                <Row label="Contact"       value={application.guarantorContactNumber} />

                {/* ── Government ID ─────────────────────────────────────── */}
                {(application.governmentIdType || application.governmentIdNumber) && (<>
                    <SectionHeader title="Government ID" />
                    <Row label="ID Type"   value={idTypeDisplay} />
                    <Row label="ID Number" value={application.governmentIdNumber} />
                </>)}

                {/* ── Identity Verification ─────────────────────────────── */}
                <SectionHeader title="Identity Verification" />
                <div className="flex justify-between gap-4 text-xs pb-2">
                    <span className="text-gray-500 flex-shrink-0 w-32">
                        {hasFaceID ? 'Face ID' : 'Biometric'}
                    </span>
                    <span className={`font-medium text-right ${identityColor}`}>
                        {identityStatus}
                    </span>
                </div>
            </div>

            {/* ── Member-reported changes ───────────────────────────────── */}
            {application.clientChanges &&
             Object.entries(application.clientChanges).some(([, v]) => v?.trim()) && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-300 rounded-xl">
                    <p className="text-xs font-semibold text-amber-800 mb-2">
                        ✎ Member reported changes — verify during visit
                    </p>
                    {[
                        ['Contact',  application.clientChanges.contactNumber],
                        ['Street',   application.clientChanges.addressStreetNo],
                        ['Barangay', application.clientChanges.addressBarangayDistrict],
                        ['City',     application.clientChanges.addressMunicipalityCity],
                        ['Province', application.clientChanges.addressProvince],
                    ].filter(([, v]) => v?.trim()).map(([label, value]) => (
                        <div key={label} className="flex justify-between text-xs py-1
                            border-b border-amber-100 last:border-0">
                            <span className="text-amber-700 flex-shrink-0 w-20">{label}</span>
                            <span className="font-semibold text-amber-900 text-right">{value}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Loan History (existing clients only) ──────────────────── */}
            {loanHistory && loanHistory.length > 0 && (
                <div className="mt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Loan History ({loanHistory.length})
                    </p>
                    <div className="space-y-2">
                        {loanHistory.map((loan, i) => {
                            const missed   = loan.missedPayments || 0;
                            const isDelinq = loan.delinquent    || false;
                            return (
                                <div key={loan._id}
                                    className={`p-2.5 rounded-xl border text-xs ${
                                        isDelinq  ? 'bg-red-50 border-red-300' :
                                        missed > 0 ? 'bg-amber-50 border-amber-200' :
                                                     'bg-gray-50 border-gray-200'
                                    }`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-semibold text-gray-800">
                                            Cycle {loan.loanCycle}
                                            {i === 0 && (
                                                <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100
                                                    text-blue-700 rounded-full text-xs">
                                                    latest
                                                </span>
                                            )}
                                        </span>
                                        <span className={`font-semibold ${
                                            isDelinq  ? 'text-red-700'   :
                                            missed > 0 ? 'text-amber-700' :
                                                         'text-green-700'
                                        }`}>
                                            {isDelinq ? 'Delinquent' : missed > 0 ? `${missed} missed` : 'Good'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-gray-500">
                                        <span>₱{Number(loan.principalLoan || 0).toLocaleString()}</span>
                                        <span>{loan.status}</span>
                                    </div>
                                    <div className="mt-1.5 pt-1.5 border-t border-gray-100
                                        grid grid-cols-2 gap-x-2 gap-y-0.5 text-gray-400">
                                        {loan.loanTerms && (
                                            <>
                                                <span>Terms</span>
                                                <span className="text-right font-medium text-gray-600">
                                                    {loan.loanTerms} days
                                                </span>
                                            </>
                                        )}
                                        {loan.occurence && (
                                            <>
                                                <span>Occurrence</span>
                                                <span className="text-right font-medium text-gray-600 capitalize">
                                                    {loan.occurence}
                                                </span>
                                            </>
                                        )}
                                        {loan.pnNumber && (
                                            <>
                                                <span>PN No.</span>
                                                <span className="text-right font-medium text-gray-600">
                                                    {loan.pnNumber}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CIApplicantCard;