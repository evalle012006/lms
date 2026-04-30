import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import PublicLAFForm from '@/components/laf/PublicLAFForm';
import Head from 'next/head';


const graph = new GraphProvider();
const BRANCH_TYPE = createGraphType('branches', `
    _id code name address qrToken
`)('branches');

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

    return {
        props: {
            branchId:   branch._id,
            branchName: branch.name,
            branchCode: branch.code,
            qrToken,
        },
    };
}

export default function ApplyPage({ branchId, branchName, branchCode, qrToken }) {
    return (
        <>
            <Head>
                <title>Loan Application — {branchName}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex" />
            </Head>
            {/* No Layout wrapper — standalone public page */}
            <PublicLAFForm
                branchId={branchId}
                branchName={branchName}
                branchCode={branchCode}
                qrToken={qrToken}
            />
        </>
    );
}