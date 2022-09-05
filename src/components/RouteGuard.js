import { useRef, useState, useEffect } from 'react';
import { userService } from '@/services/user-service';
import { useRouter } from 'next/router';
import { useSelector, useDispatch } from 'react-redux';
import { setUser } from '@/redux/actions/userActions';

export { RouteGuard };

function RouteGuard({ children }) {
    const dispatch = useDispatch();
    const userState = useSelector(state => state.user.data);
    const mounted = useRef(false);
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);
    const { redirect } = router.query;

    useEffect(() => {
        mounted.current = true;
        function authCheck(url) {
            const publicPaths = process.env.NEXT_PUBLIC_PATHS.split(',');
            const path = url.split('?')[0];
            const user = userService.userValue;

            if (!user && !publicPaths.includes(path)) {
                setAuthorized(false);
                router.push({
                    pathname: '/login',
                    query: { returnUrl: router.asPath }
                });
            } else {
                setAuthorized(true);
            }
        }

        function setUserState() {
            if (userService.userValue) {
                const userData = Object.keys(userState).length > 0 ? userState : userService.userValue;
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
        }
    }, [userState]);


    return (authorized && children);
}
