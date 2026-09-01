// src/components/laf/TempLAFModal.js
// Updated — all guarantor extended fields wired to loanData for LAFModal rendering.
// Also wires loanRelease/amountRelease for Previous Loan cell per clientType.
// FIX: occurence/weeklyScheduleType now read from application (populated by
// ci/[refCode].js group enrichment) instead of hardcoded 'daily' — required
// for LAFModal's isAccelerated branch to fire correctly for accelerated
// weekly prospects going through the CI investigation LAF print/download.

import React from 'react';
import moment from 'moment';
import LAFModal from '@/components/transactions/loan-application/LAFModal';

const TempLAFModal = ({ isOpen, onClose, application }) => {
    if (!isOpen || !application) return null;

    const photoUrl = application.lafPhotoUrl
        || application.lafPhotoKey
        || '';

    // Previous Loan amount — depends on clientType:
    //   reloan  → amountRelease (the amount released on the active loan)
    //   pending → loanRelease   (the full payment amount to close the completed loan)
    //   prospect/balik/unknown → null (show N/A)
    const prevLoanFullPaymentAmount =
        application.clientType === 'reloan'
            ? (application.amountRelease || null)
            : application.clientType === 'pending'
                ? (application.loanRelease || null)
                : null;

    const loanData = {
        // ── Identifiers ──────────────────────────────────────────────────
        _id:             application._id,
        pnNumber:        application.ciReferenceCode,
        ciReferenceCode: application.ciReferenceCode,

        // ── Loan fields ───────────────────────────────────────────────────
        principalLoan:  Number(application.loanAmount) || 0,
        loanPurpose:    application.loanPurpose || '',
        loanCycle:      (application.loan?.loanCycle || 0) + 1,
        dateOfRelease:  null,
        dateAdded:      application.dateAdded || application.submittedAt,
        loanTerms:      60,
        // FIX: read actual group schedule instead of hardcoding 'daily' —
        // ci/[refCode].js now enriches application with these from the group record
        occurence:           application.occurence          || 'daily',
        weeklyScheduleType:  application.weeklyScheduleType  || null,
        amountRelease:  Number(application.loanAmount) || 0,

        // ── Previous loan — used by LAFModal for the Previous Loan cell ───
        prevLoanId:                application.existingLoanId || null,
        prevLoanFullPaymentAmount: prevLoanFullPaymentAmount,

        // ── Guarantor ─────────────────────────────────────────────────────
        guarantorFirstName:    application.guarantorFirstName   || '',
        guarantorLastName:     application.guarantorLastName    || '',
        guarantorMiddleName:   '',
        guarantorRelation:     application.guarantorRelationship  || '',
        guarantorContactNo:    application.guarantorContactNumber || '',
        guarantorAddress:      application.address || '',
        // FIX: guarantor extended fields — were missing, causing blank cells in LAF print
        guarantorBirthDate:    application.guarantorBirthDate    || '',
        guarantorCivilStatus:  application.guarantorCivilStatus  || '',
        // Note: application stores as 'guarantorBusiness' but LAFModal reads 'guarantorWorkBusiness'
        guarantorWorkBusiness: application.guarantorBusiness     || '',
        guarantorDailyIncome:  application.guarantorDailyIncome  || '',
        // Compute age from birthdate if available
        guarantorAge: application.guarantorBirthDate
            ? String(moment().diff(moment(application.guarantorBirthDate), 'years'))
            : '',

        // ── CI name ───────────────────────────────────────────────────────
        ciName: application.ciName || '',

        // ── Photo (pre-signed URL passed from the CI page) ────────────────
        profile: photoUrl,

        // ── Group / branch ────────────────────────────────────────────────
        groupName:   application.groupName  || '',
        loanOfficerName: '',
        loanOfficer: { firstName: '', lastName: '', loNo: '' },

        // ── Nested client object ──────────────────────────────────────────
        client: {
            _id:                     application._id,
            firstName:               application.firstName  || '',
            lastName:                application.lastName   || '',
            middleName:              application.middleName || '',
            fullName:                `${application.firstName || ''} ${application.middleName || ''} ${application.lastName || ''}`.trim(),
            birthdate:               application.birthdate  || '',
            contactNumber:           application.contactNumber || '',
            address:                 application.address    || '',
            addressStreetNo:         application.addressStreetNo         || '',
            addressBarangayDistrict: application.addressBarangayDistrict || '',
            addressMunicipalityCity: application.addressMunicipalityCity || '',
            addressProvince:         application.addressProvince         || '',
            addressZipCode:          application.addressZipCode          || '',
            profile: photoUrl,
            ciName:  application.ciName || '',
            // FIX: personal info fields — displayed in Borrower's Information table
            civilStatus:  application.civilStatus  || '',
            yearsOfStay:  application.yearsOfStay  || '',
            business:     application.business     || '',
            dailyIncome:  application.dailyIncome  || '',
            // Address extras
            landmark:           application.landmark           || '',
            distanceFromBranch: application.distanceFromBranch || '',
            // Government ID
            governmentIdType:   application.governmentIdType   || '',
            governmentIdNumber: application.governmentIdNumber  || '',
            // Client type
            clientType: application.clientType || 'prospect',
            // Biometric
            biometricCredentialId: application.biometricCredentialId || null,
            biometricDeviceName:   application.biometricDeviceName   || null,
            biometricRegisteredAt: application.biometricRegisteredAt || null,
        },

        // ── Branch ────────────────────────────────────────────────────────
        branch: [{
            _id:  application.branchId   || '',
            name: application.branchName || '',
            code: application.branchCode || '',
        }],

        // ── Group ─────────────────────────────────────────────────────────
        group: { name: application.groupName || '' },
        groupName:   application.groupName || '',
        loId:        application.loId      || '',

        // ── Submission info ───────────────────────────────────────────────
        isOffline:       application.isOffline   || false,
        submittedAt:     application.submittedAt || null,
        insertedDateTime: application.submittedAt || null,
    };

    return (
        <LAFModal
            isOpen={isOpen}
            onClose={onClose}
            loanData={loanData}
        />
    );
};

export default TempLAFModal;