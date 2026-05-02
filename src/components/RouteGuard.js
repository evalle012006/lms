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
            const publicPrefixes = ['/apply/'];

            const isPublicPath = publicPaths.includes(path) ||
                publicPrefixes.some(prefix => path.startsWith(prefix));

            // Unwrap userService value shape:
            // After login  → { success, user: { _id, root, biometricCredentialId, ... } }
            // After reload  → plain user object from localStorage
            let rawUser = userService.userValue;
            const user = (rawUser && rawUser.hasOwnProperty('user'))
                ? rawUser.user
                : rawUser;

            // Prefer Redux for biometricCredentialId — biometric-setup.js
            // updates Redux via dispatch(setUser()) after registration
            const biometricCredentialId = userState?.biometricCredentialId
                || user?.biometricCredentialId;

            // Paths that bypass the biometric check
            const biometricBypassPaths = ['/biometric-setup', '/logout'];
            const bypassBiometric = biometricBypassPaths.includes(path) || isPublicPath;

            if (!user && !isPublicPath) {
                // Not authenticated
                setAuthorized(false);
                router.push({ pathname: '/login' });
            } else if (
                user &&
                !biometricCredentialId &&
                !user.root &&
                !bypassBiometric
            ) {
                // Authenticated but no biometric — force setup
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