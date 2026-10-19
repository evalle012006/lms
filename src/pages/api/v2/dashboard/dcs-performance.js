import { findUserById } from '@/lib/graph.functions';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'apollo-boost';

const graph = new GraphProvider();

export default apiHandler({
    get: getDcsPerformance
});

async function getDcsPerformance(req, res) {
    try {
        const user = await findUserById(req.auth.sub);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const {
            date,
            divisionId,
            regionId,
            areaId,
            branchId,
            loId
        } = req.query;

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                success: false,
                message: 'A valid date (YYYY-MM-DD) is required'
            });
        }

        const normalize = (value) => {
            if (!value || value === 'all') {
                return null;
            }

            return String(value);
        };

        const userBranchId =
            user.branchId ||
            user.designatedBranchId ||
            null;

        // The logged-in user's scope takes priority.
        const effectiveDivisionId =
            normalize(user.divisionId) ||
            normalize(divisionId);

        const effectiveRegionId =
            normalize(user.regionId) ||
            normalize(regionId);

        const effectiveAreaId =
            normalize(user.areaId) ||
            normalize(areaId);

        const effectiveBranchId =
            normalize(userBranchId) ||
            normalize(branchId);

        const effectiveLoId =
            Number(user.role?.rep) === 4
                ? String(user._id)
                : normalize(loId);

        const result = await graph.apollo.query({
            query: gql`
                query GetDcsPerformance(
                    $args: get_dcs_performance_report_arguments!
                ) {
                    get_dcs_performance_report(args: $args) {
                        category
                        activeClients
                        mcbu
                        csf
                        totalLoanRelease
                        totalLoanBalance
                        activeBorrowers
                        pastDuePerson
                        pastDueMcbu
                        pastDueLoanRelease
                        pastDueLoanBalance
                        pastDueNetRisk
                        noOfExcuses
                        excusesMcbu
                        excusesLoanRelease
                        excusesLoanBalance
                        netLoanBalance
                    }
                }
            `,
            variables: {
                args: {
                    reportDate: date,
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
            result?.data?.get_dcs_performance_report || [];

        return res.status(200).json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error('DCS Performance API Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message,
            data: []
        });
    }
}