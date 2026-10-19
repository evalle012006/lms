import { findUserById } from '@/lib/graph.functions';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'apollo-boost';

const graph = new GraphProvider();

export default apiHandler({
    get: getPaymentCollectionChart
});

async function getPaymentCollectionChart(req, res) {
    try {
        const user = await findUserById(req.auth.sub);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const {
            startDate,
            endDate,
            divisionId,
            regionId,
            areaId,
            branchId,
            loId
        } = req.query;

        const datePattern = /^\d{4}-\d{2}-\d{2}$/;

        if (
            !startDate ||
            !endDate ||
            !datePattern.test(startDate) ||
            !datePattern.test(endDate)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Valid startDate and endDate are required.'
            });
        }

        if (startDate > endDate) {
            return res.status(400).json({
                success: false,
                message: 'startDate cannot be later than endDate.'
            });
        }

        const normalize = (value) => {
            if (!value || value === 'all') return null;
            return String(value);
        };

        const userBranchId =
            user.branchId ||
            user.designatedBranchId ||
            null;

        const effectiveDivisionId =
            normalize(user.divisionId) || normalize(divisionId);

        const effectiveRegionId =
            normalize(user.regionId) || normalize(regionId);

        const effectiveAreaId =
            normalize(user.areaId) || normalize(areaId);

        const effectiveBranchId =
            normalize(userBranchId) || normalize(branchId);

        const effectiveLoId =
            Number(user.role?.rep) === 4
                ? String(user._id)
                : normalize(loId);

        const result = await graph.apollo.query({
            query: gql`
                query GetPaymentCollectionChart(
                    $args: get_payment_collection_chart_arguments!
                ) {
                    get_payment_collection_chart(args: $args) {
                        reportDate
                        newMember
                        totalReloaner
                        mcbuWithdrawals
                        csfWithdrawals
                        mcbuReturnPerson
                        mcbuCsfReturnAmount
                        mcbuInterest
                        fullyPaymentPerson
                        fullyPaymentAmount
                    }
                }
            `,
            variables: {
                args: {
                    startDate,
                    endDate,
                    divisionId: effectiveDivisionId,
                    regionId: effectiveRegionId,
                    areaId: effectiveAreaId,
                    branchId: effectiveBranchId,
                    loId: effectiveLoId
                }
            },
            fetchPolicy: 'network-only'
        });

        const rows =
            result?.data?.get_payment_collection_chart || [];

        return res.status(200).json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error(
            'Payment Collection Chart API Error:',
            error
        );

        return res.status(500).json({
            success: false,
            message: error.message,
            data: []
        });
    }
}