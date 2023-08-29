import Head from 'next/head';
import { Toaster } from 'react-hot-toast';
import { RouteGuard } from '@/components/RouteGuard';
import { wrapper } from '@/redux/store';
import Script from 'next/script';

import 'tailwindcss/tailwind.css';
import 'react-phone-number-input/style.css';
import '@/styles/globals.css';
import '@/styles/login.css';
import '@/styles/layout.css';
import '@/styles/common-forms.css';
import '@/styles/settings.css';
import '@/styles/table.css';
import '@/styles/avatar.css';
import '@/styles/print.css';

const ACLoanManagementApp = ({ Component, pageProps }) => {
    return (
        <>
            <Head>
                <title>AC Lending Management System</title>
                <link rel="icon" href="/images/favicon.ico" type="image/x-icon" />
                <link rel="shortcut icon" href="/images/favicon.ico" type="image/x-icon" />
            </Head>
            <Script strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}/>
            <Script id='google-analytics' strategy="afterInteractive" 
                    dangerouslySetInnerHTML={{
                        __html: `window.dataLayer = window.dataLayer || [];
                                function gtag(){dataLayer.push(arguments);}
                                gtag('js', new Date());
                                gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', {
                                    page_path: window.location.pathname,
                                });
                            `,
                    }}
            />
            <RouteGuard>
                <Toaster position="top-center" reverseOrder={false} hideProgressBar={false} closeOnClick />
                <Component {...pageProps} />
            </RouteGuard>
        </>
    );
}

export default wrapper.withRedux(ACLoanManagementApp);
