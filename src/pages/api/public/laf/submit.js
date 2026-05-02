// src/pages/api/public/laf/submit.js
import { publicApiHandler } from '@/services/public-api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS } from '@/lib/graph.fields';
import { generateUUID } from '@/lib/utils';
import moment from 'moment';
import crypto from 'crypto';

const graph = new GraphProvider();

const BRANCH_TYPE = createGraphType('branches', `
    _id code name qrToken
`)('branches');

const TEMP_TYPE = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');

export default publicApiHandler({ post: submitLAF });

async function submitLAF(req, res) {
    const {
        branchId, qrToken,
        firstName, lastName, middleName, birthdate, contactNumber,
        addressStreetNo, addressBarangayDistrict, addressMunicipalityCity,
        addressProvince, addressZipCode,
        loanAmount, loanPurpose,
        guarantorFirstName, guarantorLastName,
        guarantorRelationship, guarantorContactNumber,
        lafPhotoKey,
    } = req.body;

    // Basic presence check
    if (!branchId || !qrToken) {
        return res.status(200).json({
            success: false,
            message: 'Missing branchId or qrToken.',
        });
    }

    // ── Step 1: Find branch by ID only first ──────────────────────────────
    const [branch] = await graph.query(
        queryQl(BRANCH_TYPE, {
            where: { _id: { _eq: branchId } }
        })
    ).then(r => r.data?.branches ?? []);

    if (!branch) {
        return res.status(200).json({
            success: false,
            message: 'Branch not found.',
        });
    }

    // ── Step 2: Validate the qrToken matches ──────────────────────────────
    if (branch.qrToken !== qrToken) {
        return res.status(200).json({
            success: false,
            message: 'QR code is invalid or has been regenerated. Please scan the latest QR code.',
        });
    }

    if (!lafPhotoKey) {
        return res.status(200).json({
            success: false,
            message: 'A client photo is required to submit the application.',
        });
    }

    // ── Generate CI reference code ────────────────────────────────────────
    const dateStr = moment().format('YYYYMMDD');
    const suffix  = crypto.randomBytes(3).toString('hex').toUpperCase();
    const ciReferenceCode = `CI-${branch.code}-${dateStr}-${suffix}`;

    // ── Insert into temporaryLoanApplications ─────────────────────────────
    const [application] = await graph.mutation(
        insertQl(TEMP_TYPE, {
            objects: [{
                _id: generateUUID(),
                ciReferenceCode,
                branchId: branch._id,
                firstName:  firstName?.trim().toUpperCase(),
                lastName:   lastName?.trim().toUpperCase(),
                middleName: middleName?.trim().toUpperCase() || '',
                birthdate,
                contactNumber,
                addressStreetNo,
                addressBarangayDistrict,
                addressMunicipalityCity,
                addressProvince,
                addressZipCode,
                address: [
                    addressStreetNo, addressBarangayDistrict,
                    addressMunicipalityCity, addressProvince, addressZipCode,
                ].filter(Boolean).join(', '),
                loanAmount:             loanAmount ? parseFloat(loanAmount) : null,
                loanPurpose,
                guarantorFirstName:     guarantorFirstName?.trim().toUpperCase(),
                guarantorLastName:      guarantorLastName?.trim().toUpperCase(),
                guarantorRelationship,
                guarantorContactNumber,
                lafPhotoKey,
                status:      'pending',
                dateAdded:   moment().format('YYYY-MM-DD'),
                submittedAt: new Date().toISOString(),
                expiresAt:   moment().add(30, 'days').toISOString(),
            }]
        })
    ).then(r => r.data?.temporaryLoanApplications?.returning ?? []);

    if (!application) {
        return res.status(200).json({
            success: false,
            message: 'Failed to save application. Please try again.',
        });
    }

    res.status(200).json({
        success: true,
        ciReferenceCode,
        message: 'Application submitted successfully.',
    });
}