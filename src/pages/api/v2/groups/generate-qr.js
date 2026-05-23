// src/pages/api/v2/groups/generate-qr.js
// POST { groupId }
// Generates a weekly QR token for a group.
// Only the LO assigned to the group or rep <= 3 can generate.
// No status restriction — allows any group status (full groups
// may still accept prospects or reloaners).

import { apiHandler }                          from '@/services/api-handler';
import { GraphProvider }                       from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl }  from '@/lib/graph/graph.util';
import { GROUP_FIELDS }                        from '@/lib/graph.fields';
import { findUserById }                        from '@/lib/graph.functions';
import { generateUUID }                        from '@/lib/utils';
import { logAudit }                            from '@/lib/audit';
import moment                                  from 'moment';

const graph = new GraphProvider();

const GROUP_TYPE = createGraphType('groups', `
    ${GROUP_FIELDS}
    branch { _id name code }
`)('groups');

export default apiHandler({ post: generateGroupQR });

async function generateGroupQR(req, res) {
    const { groupId } = req.body;
    if (!groupId) {
        return res.status(200).json({ success: false, message: 'groupId required.' });
    }

    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) {
        return res.status(200).json({ success: false, message: 'User not found.' });
    }

    // Only BM/above or the assigned LO of the group can generate
    // rep: 1=admin, 2=area+, 3=BM, 4=LO — all are allowed (rep <= 4)
    if (currentUser.role.rep > 4) {
        return res.status(200).json({
            success: false,
            message: 'Insufficient permissions to generate QR codes.',
        });
    }

    // Fetch group with branch info
    const [group] = await graph.query(
        queryQl(GROUP_TYPE, { where: { _id: { _eq: groupId } } })
    ).then(r => r.data?.groups ?? []);

    if (!group) {
        return res.status(200).json({ success: false, message: 'Group not found.' });
    }

    // LO can only generate for their own group
    if (currentUser.role.rep === 4 && group.loanOfficerId !== currentUser._id) {
        return res.status(200).json({
            success: false,
            message: 'You can only generate QR codes for your own group.',
        });
    }

    const now         = moment();
    const qrToken     = generateUUID();
    const qrExpiresAt = now.clone().add(7, 'days').toISOString();

    await graph.mutation(
        updateQl(GROUP_TYPE, {
            where: { _id: { _eq: groupId } },
            set: {
                qrToken,
                qrGeneratedAt: now.toISOString(),
                qrExpiresAt,
                qrGeneratedBy: currentUser._id,
            },
        })
    );

    // Audit log
    await logAudit(req, {
        action:      'GROUP_QR_GENERATED',
        category:    'QR',
        severity:    'INFO',
        entityType:  'group',
        entityId:    groupId,
        description: `QR generated for group "${group.name}" by ${currentUser.firstName} ${currentUser.lastName}`,
        afterData: {
            qrToken,
            qrExpiresAt,
            groupName:   group.name,
            branchName:  group.branch?.name,
            loName:      `${currentUser.firstName} ${currentUser.lastName}`,
        },
        branchId:   group.branchId,
        branchName: group.branch?.name,
    });

    return res.status(200).json({
        success: true,
        qr: {
            qrToken,
            qrExpiresAt,
            groupId:     group._id,
            groupName:   group.name,
            branchId:    group.branchId,
            branchName:  group.branch?.name,
            loId:        group.loanOfficerId,
            loName:      group.loanOfficerName,
            url:         `${process.env.NEXT_PUBLIC_WEBAUTHN_ORIGIN}/apply/${qrToken}`,
        },
        message: 'QR code generated successfully. Valid for 7 days.',
    });
}