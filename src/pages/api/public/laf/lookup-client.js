// src/pages/api/public/laf/lookup-client.js
// GET ?groupId=xxx&lastName=xxx&slotNo=xxx
// No auth — public API used during LAF flow for reloan/pending client lookup.
// Queries clients table (with nested loans) to find existing member.

import { GraphProvider }            from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

// Query clients with their active/pending loan for this group
const CLIENT_TYPE = createGraphType('client', `
    _id firstName lastName middleName birthdate contactNumber
    addressStreetNo addressBarangayDistrict addressMunicipalityCity
    addressProvince addressZipCode ciName
    guarantorFirstName guarantorLastName guarantorRelationship guarantorContactNumber
    loans (
        where: { status: { _in: ["pending", "active"] } }
        order_by: [{ loanCycle: desc }]
        limit: 1
    ) {
        _id slotNo status loanCycle groupId
    }
`)('clients');

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
        const clients = await graph.query(
            queryQl(CLIENT_TYPE, {
                where: {
                    // Match last name case-insensitively
                    lastName: { _ilike: lastName.trim() },
                    // Must have an active/pending loan in this group at this slot
                    groupId:  { _eq: groupId },
                    status:   { _in: ['active', 'pending'] },
                    loans: {
                        groupId: { _eq: groupId },
                        slotNo:  { _eq: parseInt(slotNo) },
                        status:  { _in: ['pending', 'active'] },
                    },
                },
                limit: 5, // get a few in case of multiple matches
            })
        ).then(r => r.data?.clients ?? []);

        if (clients.length === 0) {
            return res.status(200).json({
                success: false,
                message: 'No active member found with that last name and slot number. Please check your details.',
            });
        }

        // Find the client whose loan matches the exact slot
        const matchedClient = clients.find(c =>
            c.loans?.some(l => l.slotNo === parseInt(slotNo) && l.groupId === groupId)
        ) || clients[0];

        const matchedLoan = matchedClient.loans?.find(
            l => l.slotNo === parseInt(slotNo) && l.groupId === groupId
        ) || matchedClient.loans?.[0];

        // Return minimal safe data for pre-fill — never expose sensitive fields
        return res.status(200).json({
            success: true,
            client: {
                _id:                     matchedClient._id,
                firstName:               matchedClient.firstName,
                lastName:                matchedClient.lastName,
                middleName:              matchedClient.middleName,
                birthdate:               matchedClient.birthdate,
                contactNumber:           matchedClient.contactNumber,
                addressStreetNo:         matchedClient.addressStreetNo,
                addressBarangayDistrict: matchedClient.addressBarangayDistrict,
                addressMunicipalityCity: matchedClient.addressMunicipalityCity,
                addressProvince:         matchedClient.addressProvince,
                addressZipCode:          matchedClient.addressZipCode,
                ciName:                  matchedClient.ciName,
                guarantorFirstName:      matchedClient.guarantorFirstName,
                guarantorLastName:       matchedClient.guarantorLastName,
                guarantorRelationship:   matchedClient.guarantorRelationship,
                guarantorContactNumber:  matchedClient.guarantorContactNumber,
                slotNo:                  matchedLoan?.slotNo,
                loanId:                  matchedLoan?._id,
                loanCycle:               matchedLoan?.loanCycle,
                loanStatus:              matchedLoan?.status,
            },
        });

    } catch (err) {
        console.error('[lookup-client]', err);
        return res.status(200).json({
            success: false,
            message: err.message || 'Server error.',
        });
    }
}