import Layout from "@/components/Layout";
import DashboardPage from '@/components/dashboard/DashboardPage';

const Index = () => {
    return (
        <Layout header={false} noPad={true}>
            <DashboardPage />
        </Layout>
    );
}

export default Index;