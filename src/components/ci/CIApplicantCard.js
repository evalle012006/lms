// src/components/ci/CIApplicantCard.js
import React from 'react';
import moment from 'moment';

const StatusBadge = ({ status }) => {
    const map = {
        pending:     { label: 'Pending CI',  cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
        ci_approved: { label: 'CI Approved', cls: 'bg-green-100 text-green-700 border border-green-200' },
        ci_declined: { label: 'CI Declined', cls: 'bg-red-100 text-red-700 border border-red-200' },
        promoted:    { label: 'Promoted',    cls: 'bg-blue-100 text-blue-700 border border-blue-200' },
        pending_validation: { label: 'Pending Review', cls: 'bg-orange-100 text-orange-700 border border-orange-200' },
    };
    const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-500 border border-gray-200' };
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>
            {s.label}
        </span>
    );
};

const CIApplicantCard = ({ application, loanHistory }) => {
    const rows = [
        ['CI Reference',  application.ciReferenceCode],
        ['Branch',        `${application.branchCode} — ${application.branchName}`],
        ['Full Name',     `${application.lastName}, ${application.firstName} ${application.middleName || ''}`],
        ['Birthdate',     application.birthdate],
        // FIX: new personal info fields from LAF
        ['Civil Status',  application.civilStatus || null],
        ['Yrs. of Stay',  application.yearsOfStay || null],
        ['Business',      application.business    || null],
        ['Daily Income',  application.dailyIncome ? `₱${application.dailyIncome}` : null],
        ['Contact',       application.contactNumber],
        ['Address',       application.address],
        ['Loan Purpose',  application.loanPurpose],
        ['Submitted',     moment(application.submittedAt).format('MMM DD, YYYY h:mm A')],
        ['Guarantor',     `${application.guarantorFirstName || ''} ${application.guarantorLastName || ''}`],
        ['Relationship',  application.guarantorRelationship],
        ['Guar. Contact', application.guarantorContactNumber],
    ];

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Applicant Information</h3>
                <StatusBadge status={application.status} />
            </div>
            <div className="space-y-2">
                {rows.filter(([, value]) => value != null && value !== '').map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 text-xs
                        border-b border-gray-50 pb-2 last:border-0">
                        <span className="text-gray-500 flex-shrink-0 w-28">{label}</span>
                        <span className="text-gray-900 font-medium text-right">{value || '—'}</span>
                    </div>
                ))}
            </div>

            {/* Member-reported changes */}
            {application.clientChanges &&
             Object.entries(application.clientChanges).some(([, v]) => v?.trim()) && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-300 rounded-xl">
                    <p className="text-xs font-semibold text-amber-800 mb-2">
                        ✎ Member reported changes — verify during visit
                    </p>
                    {[
                        ['Last Name',  application.clientChanges.lastName],
                        ['Mid. Name',  application.clientChanges.middleName],
                        ['Contact',    application.clientChanges.contactNumber],
                        ['Street',     application.clientChanges.addressStreetNo],
                        ['Barangay',   application.clientChanges.addressBarangayDistrict],
                        ['City',       application.clientChanges.addressMunicipalityCity],
                        ['Province',   application.clientChanges.addressProvince],
                    ].filter(([, v]) => v?.trim()).map(([label, value]) => (
                        <div key={label} className="flex justify-between text-xs py-1
                            border-b border-amber-100 last:border-0">
                            <span className="text-amber-700 flex-shrink-0 w-20">{label}</span>
                            <span className="font-semibold text-amber-900 text-right">{value}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Loan history */}
            {loanHistory && loanHistory.length > 0 && (
                <div className="mt-4">
                    <p className="text-xs font-semibold text-gray-700 mb-2">
                        Loan History ({loanHistory.length})
                    </p>
                    <div className="space-y-2">
                        {loanHistory.map((loan, i) => {
                            const missed   = loan.missedPayments || 0;
                            const isDelinq = loan.delinquent    || false;
                            return (
                                <div key={loan._id}
                                    className={`p-2.5 rounded-xl border text-xs ${
                                        isDelinq   ? 'bg-red-50 border-red-300'    :
                                        missed > 0 ? 'bg-amber-50 border-amber-200' :
                                                     'bg-gray-50 border-gray-200'
                                    }`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-semibold text-gray-800">
                                            Cycle {loan.loanCycle}
                                            {i === 0 && (
                                                <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100
                                                    text-blue-700 rounded-full text-xs">latest</span>
                                            )}
                                        </span>
                                        <span className={`font-semibold ${
                                            isDelinq   ? 'text-red-700'   :
                                            missed > 0 ? 'text-amber-700' : 'text-green-700'
                                        }`}>
                                            {isDelinq    ? '⛔ Delinquent'       :
                                             missed > 0  ? `⚠ ${missed} missed` : '✓ Good standing'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-gray-500 mt-0.5">
                                        <span className="text-gray-400">Released</span>
                                        <span className="text-right font-medium text-gray-700">
                                            ₱{Number(loan.amountRelease || 0).toLocaleString()}
                                        </span>
                                        <span className="text-gray-400">Balance</span>
                                        <span className={`text-right font-medium ${
                                            loan.loanBalance > 0 ? 'text-red-600' : 'text-green-600'
                                        }`}>
                                            ₱{Number(loan.loanBalance || 0).toLocaleString()}
                                        </span>
                                        <span className="text-gray-400">Payments</span>
                                        <span className="text-right font-medium text-gray-700">
                                            {loan.noOfPayments ?? '—'}
                                            {loan.totalPayments ? ` / ${loan.totalPayments}` : ''}
                                        </span>
                                        <span className="text-gray-400">Status</span>
                                        <span className="text-right capitalize text-gray-700">
                                            {loan.status}
                                        </span>
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