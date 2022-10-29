import Head from 'next/head';
import { Toaster } from 'react-hot-toast';
import { RouteGuard } from '@/components/RouteGuard';
import { wrapper } from '@/redux/store';

import 'tailwindcss/tailwind.css';
import 'react-phone-number-input/style.css';
import '@/styles/globals.css';
import '@/styles/login.css';
import '@/styles/layout.css';
import '@/styles/common-forms.css';
import '@/styles/settings.css';
import '@/styles/table.css';
import '@/styles/avatar.css';

const ACLoanManagementApp = ({ Component, pageProps }) => {
    return (
        <>
            <Head>
                <title>AC Lending Management System</title>
                <link rel="icon" href="/images/favicon.ico" type="image/x-icon" />
                <link rel="shortcut icon" href="/images/favicon.ico" type="image/x-icon" />
            </Head>
            <RouteGuard>
                <Toaster position="top-right" reverseOrder={false} />
                <Component {...pageProps} />
            </RouteGuard>
        </>
    );
}

export default wrapper.withRedux(ACLoanManagementApp);
