// src/components/laf/TempLAFModal.js
// Updated Phase 2 — includes all new fields in the loanData/client objects
// shown on the CI Investigation page when "View LAF" is clicked.

import React from 'react';
import LAFModal from '@/components/transactions/loan-application/LAFModal';

/**
 * Wraps LAFModal for temporaryLoanApplication data.
 * LAFModal uses a plain <img> for the profile photo,
 * so we must pass a pre-signed URL (lafPhotoUrl), not the storage key.
 */
const TempLAFModal = ({ isOpen, onClose, application }) => {
    if (!isOpen || !application) return null;

    const photoUrl = application.lafPhotoUrl
        || application.lafPhotoKey
        || '';

    const loanData = {
        // ── Identifiers ──────────────────────────────────────────────────
        _id:             application._id,
        pnNumber:        application.ciReferenceCode,
        ciReferenceCode: application.ciReferenceCode,

        // ── Loan fields ───────────────────────────────────────────────────
        principalLoan:  Number(application.loanAmount) || 0,
        loanPurpose:    application.loanPurpose || '',
        loanCycle:      1,
        dateOfRelease:  null,
        dateAdded:      application.dateAdded || application.submittedAt,
        loanTerms:      60,
        occurence:      'daily',
        amountRelease:  Number(application.loanAmount) || 0,

        // ── Guarantor ─────────────────────────────────────────────────────
        guarantorFirstName:  application.guarantorFirstName  || '',
        guarantorLastName:   application.guarantorLastName   || '',
        guarantorMiddleName: '',
        guarantorRelation:   application.guarantorRelationship  || '',
        guarantorContactNo:  application.guarantorContactNumber || '',
        guarantorAddress:    application.address || '',

        // ── CI name ───────────────────────────────────────────────────────
        ciName: application.ciName || '',

        // ── Photo ─────────────────────────────────────────────────────────
        profile: photoUrl,

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
            profile:  photoUrl,
            ciName:   application.ciName || '',
            yearsOfStay: '',
            business:    '',

            // ── Phase 2: Address extras ───────────────────────────────────
            landmark:            application.landmark           || '',
            distanceFromBranch:  application.distanceFromBranch || '',

            // ── Phase 2: Government ID ────────────────────────────────────
            governmentIdType:    application.governmentIdType   || '',
            governmentIdNumber:  application.governmentIdNumber  || '',

            // ── Phase 2: Client type ──────────────────────────────────────
            clientType:          application.clientType         || 'prospect',

            // ── Biometric ─────────────────────────────────────────────────
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

        // ── Group / LO ───────────────────────────────────────────────────
        group: { name: application.groupName || '' },
        groupName:      application.groupName || '',
        loId:           application.loId      || '',

        // ── Submission info ───────────────────────────────────────────────
        isOffline:      application.isOffline      || false,
        submittedAt:    application.submittedAt    || null,
        loanOfficerName: '',
        loanOfficer: { firstName: '', lastName: '', loNo: '' },
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