import React from 'react';
import LAFModal from '@/components/transactions/loan-application/LAFModal';

/**
 * Wraps LAFModal for temporaryLoanApplication data.
 * Key difference: LAFModal uses a plain <img> for the profile photo,
 * so we must pass a pre-signed URL (lafPhotoUrl), not the storage key.
 */
const TempLAFModal = ({ isOpen, onClose, application }) => {
    if (!isOpen || !application) return null;

    // LAFModal reads: client.profile OR loanData.profile for the photo
    // It uses a plain <img src={profilePicture}> — needs a real URL, not a key
    const photoUrl = application.lafPhotoUrl  // pre-signed URL from CI endpoint
        || application.lafPhotoKey            // fallback: key (won't display but won't break)
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

        // ── Photo — passed at top level so LAFModal can find it ───────────
        // LAFModal: const profilePicture = client.profile || loanData.profile
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
            // ── Photo: use pre-signed URL here too ────────────────────────
            profile:  photoUrl,
            ciName:   application.ciName || '',
            yearsOfStay: '',
            business:    '',
        },

        // ── Branch ────────────────────────────────────────────────────────
        branch: [{
            _id:  application.branchId   || '',
            name: application.branchName || '',
            code: application.branchCode || '',
        }],

        // ── Group (not assigned yet) ──────────────────────────────────────
        group: { name: '' },
        groupName: '',

        // ── Loan Officer (not assigned yet) ───────────────────────────────
        loanOfficer: {
            firstName: '',
            lastName:  '',
            loNo:      '',
        },

        // ── Other fields ──────────────────────────────────────────────────
        prevLoanId:      null,
        passbookNo:      '',
        admissionDate:   '',
        loanOfficerName: '',
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