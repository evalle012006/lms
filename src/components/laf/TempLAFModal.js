// src/components/laf/TempLAFModal.js
// FIX 1: Pass slotNo and approved loan amount when ldfApproved=true
// FIX 2: All available fields from temporaryLoanApplications pre-filled
// FIX 3: client photo object-cover fix passed via loanData

import React       from 'react';
import moment      from 'moment';
import LAFModal    from '@/components/transactions/loan-application/LAFModal';

const TempLAFModal = ({ isOpen, onClose, application }) => {
    if (!isOpen || !application) return null;

    const photoUrl = application.lafPhotoUrl
        || application.lafPhotoKey
        || '';

    // Age derived from birthdate
    const age = application.birthdate
        ? moment().diff(moment(application.birthdate), 'years')
        : '';

    // When ldfApproved: pick up slot and approved amount from linked loan
    // application.loan is populated by TemporaryLoanApplicationsTab when printing
    const loan        = application.loan    || null;
    const slotNo      = loan?.slotNo        || application.slotNo        || '';
    const pnNumber    = loan?.pnNumber      || application.ciReferenceCode;
    const loanCycle   = loan?.loanCycle     || 1;
    const ldfApproved = loan?.ldfApproved   || application.ldfApproved   || false;
    const dateOfRelease = loan?.dateOfRelease || application.dateOfRelease || null;
    const principalLoan = Number(loan?.principalLoan || application.loanAmount) || 0;
    const amountRelease = Number(loan?.amountRelease  || application.loanAmount) || 0;

    // LO name — from application or loan
    const loName = application.loName
        || loan?.loanOfficerName
        || '';

    const loanData = {
        // ── Identifiers ────────────────────────────────────────────────
        _id:             application._id,
        pnNumber,
        ciReferenceCode: application.ciReferenceCode,

        // ── Loan fields ───────────────────────────────────────────────
        principalLoan,
        amountRelease,
        loanPurpose:    application.loanPurpose || '',
        loanCycle,
        dateOfRelease,
        dateAdded:      application.dateAdded || application.submittedAt,
        loanTerms:      loan?.loanTerms || 60,
        occurence:      loan?.occurence || 'daily',
        // FIX 1: slot from linked loan (when ldfApproved)
        slotNo,
        ldfApproved,
        // FIX: link to previous loan for reloan print
        prevLoanId:                loan?.prevLoanId                || application.existingLoanId || null,
        prevLoanFullPaymentAmount: loan?.prevLoanFullPaymentAmount || null,

        // ── Guarantor ─────────────────────────────────────────────────
        guarantorFirstName:    application.guarantorFirstName    || '',
        guarantorLastName:     application.guarantorLastName     || '',
        guarantorMiddleName:   application.guarantorMiddleName   || '',
        guarantorRelation:     application.guarantorRelationship || '',
        guarantorContactNo:    application.guarantorContactNumber || '',
        guarantorAddress:      application.guarantorAddress || application.address || '',
        // FIX: extended guarantor fields — captured in PublicLAFForm Loan step
        guarantorBirthDate:    application.guarantorBirthDate    || '',
        guarantorAge:          application.guarantorBirthDate
                                   ? String(moment().diff(moment(application.guarantorBirthDate), 'years'))
                                   : '',
        guarantorCivilStatus:  application.guarantorCivilStatus  || '',
        guarantorWorkBusiness: application.guarantorBusiness     || '',
        guarantorDailyIncome:  application.guarantorDailyIncome  || '',

        // ── CI name ───────────────────────────────────────────────────
        ciName: application.ciName || application.picUserName || '',

        // ── Photo ─────────────────────────────────────────────────────
        profile: photoUrl,

        // ── Client object ─────────────────────────────────────────────
        client: {
            _id:          application._id,
            firstName:    application.firstName  || '',
            lastName:     application.lastName   || '',
            middleName:   application.middleName || '',
            fullName:     `${application.firstName || ''} ${application.middleName || ''} ${application.lastName || ''}`.trim(),
            birthdate:    application.birthdate  || '',
            age,
            civilStatus:             application.civilStatus             || '',
            business:                application.business                || '',
            yearsOfStay:             application.yearsOfStay             || '',
            dailyIncome:             application.dailyIncome             || '',
            contactNumber:           application.contactNumber           || '',
            address:                 application.address                 || '',
            addressStreetNo:         application.addressStreetNo         || '',
            addressBarangayDistrict: application.addressBarangayDistrict || '',
            addressMunicipalityCity: application.addressMunicipalityCity || '',
            addressProvince:         application.addressProvince         || '',
            addressZipCode:          application.addressZipCode          || '',
            landmark:                application.landmark                || '',
            distanceFromBranch:      application.distanceFromBranch      || '',
            governmentIdType:        application.governmentIdType        || '',
            governmentIdNumber:      application.governmentIdNumber      || '',
            // FIX 3: profile for client photo display
            profile:                 photoUrl,
            ciName:                  application.ciName || '',
            clientType:              application.clientType || 'prospect',
            biometricCredentialId:   application.biometricCredentialId || null,
            biometricDeviceName:     application.biometricDeviceName   || null,
            biometricRegisteredAt:   application.biometricRegisteredAt || null,
        },

        // ── Branch ────────────────────────────────────────────────────
        branch: [{
            _id:  application.branchId   || '',
            name: application.branchName || '',
            code: application.branchCode || '',
        }],

        // ── Group / LO ───────────────────────────────────────────────
        // FIX: groupName now comes from the API enrichment in applications/list.js
        // which batch-fetches groups by groupId and adds groupName to the response.
        // Previously groupName was always '' because temporaryLoanApplications
        // doesn't store a groupName column — it only has groupId.
        group:          { name: application.groupName || '' },
        groupName:      application.groupName || '',
        loId:           application.loId      || '',
        loanOfficerName: loName,
        loanOfficer: {
            firstName: loName ? loName.split(' ')[0] : '',
            lastName:  loName ? loName.split(' ').slice(1).join(' ') : '',
            loNo:      '',
        },

        // ── Submission info ───────────────────────────────────────────
        isOffline:        application.isOffline   || false,
        submittedAt:      application.submittedAt || null,
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