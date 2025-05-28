
import { FUND_TRANSFER_FIELDS } from "@/lib/graph.fields";
import { findUserById } from "@/lib/graph.functions";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl, updateQl } from "@/lib/graph/graph.util";
import { apiHandler } from "@/services/api-handler";

export default apiHandler({
    post: approveFundTransfer,
});

const graph = new GraphProvider();
const FUND_TRANSFER_TYPE = createGraphType('fund_transfer', `
    ${FUND_TRANSFER_FIELDS}
`)('results');


async function approveFundTransfer(req, res) {
    const user = await findUserById(req.auth.sub);
    const { _id, status } = req.body;


    if(!['rejected', 'approved'].includes(status)) {
        res.status(500)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({
            message: 'Invalid status'
        }));
        return;
    }

    if(!['area_manager', 'finance'].includes(user.role.short_code)) {
        res.status(500)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({
            message: 'Unable to approved fund transfer. Only finance and area manager can approve'
        }));
        return;
    }

    const [data] = await graph.query(
        queryQl(FUND_TRANSFER_TYPE, {
            where: {
                _id: { _eq: _id ?? null },
                status: { _eq: 'pending' },
                deletedDate: { _is_null: true },
            }
        })
    ).then(res => res.data.results);

    if(!data) {
        res.status(500)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({
            message: 'Fund transfer not found.'
        }));
        return;
    }

    // finance role
    if (user.role.rep === 2 && user.role.short_code === 'finance') {
        if (!data.giverApprovalDate || !data.receiverApprovalDate) {
            res.status(500)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify({
                message: 'Fund transfer must be approved by area manager of giver and receiver.'
            }));
            return;
        }

        await graph.mutation(
            updateQl(FUND_TRANSFER_TYPE, {
                set: {
                    modifiedById: user._id,
                    modifiedDate: 'now()',
                    approvedRejectedDate: 'now()',
                    status
                },
                where: {
                    _id: { _eq: data._id }
                }
            })
        );
    }

    if (user.role.rep === 2 && user.role.short_code === 'area_manager') {
        const set = {};
        const allowedToApprove = data.receiverApprovalId === user._id || data.giverApprovalId === user._id;

        if(!allowedToApprove) {
            res.status(500)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify({
                message: 'User cannot approve the fund transfer'
            }));
            return;
        }

        if(status === 'reject') {
            set.status = 'status';
            set.approvedRejectedDate = 'now()';
        } else {
            if(data.receiverApprovalId === user._id) {
                set.receiverApprovalDate = 'now()';
            }
            if(data.giverApprovalId === user._id) {
                set.giverApprovalDate = 'now()';
            }
        }

        const [result] = await graph.mutation(
            updateQl(FUND_TRANSFER_TYPE, {
                set: {
                    ... set,
                    modifiedById: user._id,
                    modifiedDate: 'now()',
                },
                where: {
                    _id: { _eq: data._id }
                }
            })
        ).then(res => res.data.results.returning);

        res.send({
            success: true,
            data: result,
        });
    }
}

