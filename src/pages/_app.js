import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { RouteGuard } from '@/components/RouteGuard';
import { wrapper } from '@/redux/store';
import Script from 'next/script';
import { ToastContainer } from 'react-toastify';

import 'tailwindcss/tailwind.css';
import 'react-toastify/dist/ReactToastify.css';
import 'react-phone-number-input/style.css';
import '@/styles/globals.css';
import '@/styles/login.css';
import '@/styles/layout.css';
import '@/styles/common-forms.css';
import '@/styles/settings.css';
import '@/styles/table.css';
import '@/styles/avatar.css';
import '@/styles/print.css';
import '@/styles/modal.css';

// Query strings can carry names, birthdates, IDs and signed URLs; send GA the path only
const gaPath = (u) => {
    try {
        const x = new URL(u, window.location.origin);
        return x.origin + x.pathname;
    } catch {
        return undefined;
    }
};

const ACLoanManagementApp = ({ Component, pageProps }) => {
    const router = useRouter();
    const lastPath = useRef(null);

    // GA page_view on client-side route changes (query string stripped)
    useEffect(() => {
        lastPath.current = gaPath(window.location.href);
        const onRoute = (url) => {
            const loc = gaPath(url);
            window.gtag?.('event', 'page_view', {
                page_location: loc,
                page_referrer: lastPath.current,
            });
            lastPath.current = loc;
        };
        router.events.on('routeChangeComplete', onRoute);
        return () => router.events.off('routeChangeComplete', onRoute);
    }, [router.events]);

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
                                gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', { send_page_view: false });
                                gtag('event', 'page_view', {
                                    page_location: location.origin + location.pathname,
                                    page_referrer: document.referrer
                                        ? new URL(document.referrer).origin + new URL(document.referrer).pathname
                                        : undefined,
                                });
                            `,
                    }}
            />
            <RouteGuard>
                <Component {...pageProps} />
                <ToastContainer
                  position="top-center"
                  autoClose={5000}
                  hideProgressBar={false}
                  newestOnTop={false}
                  closeOnClick
                  rtl={false}
                  pauseOnFocusLoss={false}
                  draggable={false}
                  pauseOnHover
                  theme="light" />
            </RouteGuard>
        </>
    );
}

export default wrapper.withRedux(ACLoanManagementApp);