import { useRef, useState, useEffect } from 'react';
import { userService } from '@/services/user-service';
import { useRouter } from 'next/router';
import { useSelector, useDispatch } from 'react-redux';
import { setUser } from '@/redux/actions/userActions';

export { RouteGuard };

function RouteGuard({ children }) {
    const dispatch  = useDispatch();
    const userState = useSelector(state => state.user.data);
    const mounted   = useRef(false);
    const router    = useRouter();
    const [authorized, setAuthorized] = useState(false);
    const { redirect } = router.query;

    useEffect(() => {
        mounted.current = true;

        function authCheck(url) {
            const publicPaths    = process.env.NEXT_PUBLIC_PATHS.split(',');
            const path           = url.split('?')[0];
            const publicPrefixes = ['/apply/', '/biometric-verify/'];

            const isPublicPath = publicPaths.includes(path) ||
                publicPrefixes.some(prefix => path.startsWith(prefix));

            // Unwrap userService value shape:
            // After login  → { success, user: { _id, root, biometricCredentialId, ... } }
            // After reload  → plain user object from localStorage
            let rawUser = userService.userValue;
            const user = (rawUser && rawUser.hasOwnProperty('user'))
                ? rawUser.user
                : rawUser;

            // FIX: read biometricCredentialId directly from localStorage as source of truth.
            // userService.userValue shape is inconsistent after reload (login wraps in
            // { success, user } but update() merges flat) causing biometricCredentialId
            // to be lost on window.location.reload(). localStorage always has the latest value.
            const getStoredBiometric = () => {
                try {
                    const raw = localStorage.getItem('acuser');
                    if (!raw) return null;
                    const parsed = JSON.parse(raw);
                    // Handle both flat { biometricCredentialId } and nested { user: { biometricCredentialId } }
                    return parsed?.biometricCredentialId
                        || parsed?.user?.biometricCredentialId
                        || null;
                } catch { return null; }
            };

            const biometricCredentialId = userState?.biometricCredentialId
                || user?.biometricCredentialId
                || getStoredBiometric();

            // NEW: same localStorage-fallback pattern as biometric, for the same
            // reason — userService.userValue's shape isn't reliable across a
            // reload, so localStorage is the source of truth here too.
            const getStoredMustChangePassword = () => {
                try {
                    const raw = localStorage.getItem('acuser');
                    if (!raw) return false;
                    const parsed = JSON.parse(raw);
                    return !!(parsed?.mustChangePassword || parsed?.user?.mustChangePassword);
                } catch { return false; }
            };

            const mustChangePassword = !!(
                userState?.mustChangePassword
                || user?.mustChangePassword
                || getStoredMustChangePassword()
            );

            // Paths that bypass the biometric check.
            // FIX: '/change-password' must be included here too, not just in
            // its own bypass list below. Without this, landing on
            // /change-password with no biometric registered would immediately
            // fail THIS check (biometricBypassPaths didn't cover it) and
            // redirect to /biometric-setup — which would then fail the
            // mustChangePassword check (since /biometric-setup isn't in that
            // bypass list) and redirect right back to /change-password. The
            // two pages fought over the redirect and biometric-setup was
            // consistently winning the race, which is why it was the only
            // one ever visible.
            const biometricBypassPaths = ['/biometric-setup', '/change-password', '/logout'];
            const bypassBiometric = biometricBypassPaths.includes(path) || isPublicPath;

            // NEW: paths that bypass the forced password-change check — mirrors
            // biometricBypassPaths above. Must include the change-password page
            // itself, or every check while sitting on that page would immediately
            // redirect back to itself (setAuthorized(false) + router.replace to
            // the same path, on every routeChangeComplete) and the page could
            // never actually render for the user to complete it.
            const mustChangePasswordBypassPaths = ['/change-password', '/logout'];
            const bypassMustChangePassword = mustChangePasswordBypassPaths.includes(path) || isPublicPath;

            if (!user && !isPublicPath) {
                setAuthorized(false);
                // FIX: router.asPath returns template '/laf/[ciCode]' before hydration.
                // window.location.pathname always has the real resolved path.
                const redirectPath = typeof window !== 'undefined'
                    ? window.location.pathname + window.location.search
                    : router.asPath;
                router.push({
                    pathname: '/login',
                    query: { redirect: redirectPath },
                });
            } else if (
                user &&
                mustChangePassword &&
                !user.root &&
                !bypassMustChangePassword
            ) {
                // NEW: forced password change takes priority over the biometric
                // check below — see login.js's handleLoginSuccess for the same
                // ordering decision at the point of login. A user shouldn't be
                // asked to register a fingerprint tied to a temp password
                // they're about to be required to replace.
                setAuthorized(false);
                router.replace('/change-password');
            } else if (
                user &&
                !biometricCredentialId &&
                !user.root &&
                !user.biometricSkipped &&
                !bypassBiometric
            ) {
                // Authenticated but no biometric and not skipped — force setup
                setAuthorized(false);
                router.replace('/biometric-setup');
            } else {
                setAuthorized(true);
            }
        }

        function setUserState() {
            if (userService.userValue) {
                const userData = Object.keys(userState).length > 0
                    ? userState
                    : userService.userValue;
                dispatch(setUser(userData));
            }
        }

        mounted.current && authCheck(router.asPath);
        mounted.current && setUserState();

        const hideContent = () => setAuthorized(false);
        router.events.on('routeChangeStart', hideContent);
        router.events.on('routeChangeComplete', authCheck);

        return () => {
            router.events.off('routeChangeStart', hideContent);
            router.events.off('routeChangeComplete', authCheck);
            mounted.current = false;
        };
    }, [userState]);

    return (authorized && children);
}