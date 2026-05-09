import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import PublicLAFForm from '@/components/laf/PublicLAFForm';
import Head from 'next/head';

const graph = new GraphProvider();

const BRANCH_TYPE = createGraphType('branches', `
    _id code name address qrToken
`)('branches');

const SETTINGS_TYPE = createGraphType('settings', `
    requireClientBiometric
`)('settings');

export async function getServerSideProps({ params }) {
    const { qrToken } = params;

    const [branch] = await graph.query(
        queryQl(BRANCH_TYPE, {
            where: { qrToken: { _eq: qrToken } },
        })
    ).then(r => r.data?.branches ?? []);

    if (!branch) {
        return { notFound: true };
    }

    // Read requireClientBiometric from settings — default true if not set
    const [settings] = await graph.query(
        queryQl(SETTINGS_TYPE, { limit: 1 })
    ).then(r => r.data?.settings ?? []);

    const requireClientBiometric = settings?.requireClientBiometric ?? true;

    return {
        props: {
            branchId:               branch._id,
            branchName:             branch.name,
            branchCode:             branch.code,
            qrToken,
            requireClientBiometric,
        },
    };
}

export default function ApplyPage({
    branchId, branchName, branchCode, qrToken, requireClientBiometric,
}) {
    return (
        <>
            <Head>
                <title>Loan Application — {branchName}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex" />
            </Head>
            <PublicLAFForm
                branchId={branchId}
                branchName={branchName}
                branchCode={branchCode}
                qrToken={qrToken}
                requireClientBiometric={requireClientBiometric}
            />
        </>
    );
}