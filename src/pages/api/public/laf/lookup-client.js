// src/pages/api/public/laf/lookup-client.js
// GET ?groupId=xxx&lastName=xxx&slotNo=xxx
// No auth — public API used during LAF flow for reloan/pending client lookup.
// Returns minimal client data for pre-fill — never exposes sensitive fields.

import { GraphProvider }             from '@/lib/graph/graph.provider';
import { createGraphType, queryQl }  from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const LOAN_TYPE = createGraphType('loans', `
    _id slotNo groupId clientId status loanCycle
    client {
        _id firstName lastName middleName birthdate contactNumber
        addressStreetNo addressBarangayDistrict addressMunicipalityCity
        addressProvince addressZipCode ciName
        guarantorFirstName guarantorLastName guarantorRelationship guarantorContactNumber
    }
`)('loans');

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const { groupId, lastName, slotNo } = req.query;

    if (!groupId || !lastName || !slotNo) {
        return res.status(200).json({
            success: false,
            message: 'groupId, lastName and slotNo are required.',
        });
    }

    try {
        // Find the loan for this group + slot
        const loans = await graph.query(
            queryQl(LOAN_TYPE, {
                where: {
                    groupId: { _eq: groupId },
                    slotNo:  { _eq: parseInt(slotNo) },
                    status:  { _in: ['pending', 'active'] },
                },
                limit: 1,
            })
        ).then(r => r.data?.loans ?? []);

        if (loans.length === 0) {
            return res.status(200).json({
                success: false,
                message: 'No active member found at that slot number. Please check your details.',
            });
        }

        const loan   = loans[0];
        const client = loan.client;

        if (!client) {
            return res.status(200).json({
                success: false,
                message: 'Client record not found. Please contact your Loan Officer.',
            });
        }

        // Case-insensitive last name match
        if (client.lastName?.toLowerCase().trim() !== lastName.toLowerCase().trim()) {
            return res.status(200).json({
                success: false,
                message: 'Last name does not match our records. Please check your spelling.',
            });
        }

        // Return minimal safe data for pre-fill
        return res.status(200).json({
            success: true,
            client: {
                _id:                    client._id,
                firstName:              client.firstName,
                lastName:               client.lastName,
                middleName:             client.middleName,
                birthdate:              client.birthdate,
                contactNumber:          client.contactNumber,
                addressStreetNo:        client.addressStreetNo,
                addressBarangayDistrict: client.addressBarangayDistrict,
                addressMunicipalityCity: client.addressMunicipalityCity,
                addressProvince:        client.addressProvince,
                addressZipCode:         client.addressZipCode,
                ciName:                 client.ciName,
                guarantorFirstName:     client.guarantorFirstName,
                guarantorLastName:      client.guarantorLastName,
                guarantorRelationship:  client.guarantorRelationship,
                guarantorContactNumber: client.guarantorContactNumber,
                slotNo:                 loan.slotNo,
                loanId:                 loan._id,
                loanCycle:              loan.loanCycle,
                loanStatus:             loan.status,
            },
        });
    } catch (err) {
        return res.status(200).json({ success: false, message: err.message || 'Server error.' });
    }
}