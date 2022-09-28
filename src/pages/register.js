
import * as yup from 'yup';
import Image from 'next/image';
import logo from '/public/images/logo.png';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import toast from 'react-hot-toast';
import { useRouter } from 'next/router';
import UserRegistration from '@/components/registration/UserRegistration';
import { useState, useEffect } from 'react';
import Spinner from '@/components/Spinner';
import { userService } from '@/services/user-service';
import { useSelector } from 'react-redux';

const RegistrationPage = () => {
    const [errors, setErrors] = useState('');
    const [showLogin, setShowLogin] = useState(false);
    const [loadin, setLoading] = useState(false);
    const [initialValues, setInitialValues] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: ''
    });
    const global = useSelector(state => state.global);
    const router = useRouter();
    const { action, email, objectId } = router.query;
    const actions = ['activate'];
    let type = action ? action : 'default';

    // // set default action
    // if (typeof action === "undefined") {
    //     action = 'default';
    // } else {
    //     // redirect if already active or if no user is available
    //     if (!userService.userValue) {
    //         // if (action !== 'registerSuccess') {
    //         //     router.push('/login');
    //         // }
    //     } else {
    //         if (userService.userValue.status === 'active') {
    //             router.push('/');
    //         }
    //     }
    // }

    const validationSchema = yup.object().shape({
        firstName: yup.string().required('First Name is required'),
        lastName: yup.string().required('Last Name is required'),
        email: yup.string().required('Email is required'),
        password: yup.string()
            .required('Password is required')
            .matches(
                /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/,
                "Must Contain at least 8 Characters, One Uppercase, One Lowercase, One Number and one special case Character"
            ),
    });

    const handleRegistration = async (values, actions) => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'register/';

        const apiResponse = await fetchWrapper.post(apiUrl, values);
        if (apiResponse.error) {
            toast.error(apiResponse.message);
            setErrors(apiResponse.message);
        } else {
            router.push({
                pathname: '/register',
                query: {
                    action: 'registerSuccess',
                    email: apiResponse.email,
                    objectId: apiResponse.user.insertedId
                }
            });
        }
    }

    const component = <UserRegistration
        handleRegistration={handleRegistration}
        initialValues={initialValues}
        validationSchema={validationSchema}
        errorFields={errors} />;

    const TextComponent = () => {
        const handleClick = () => {
            router.push('/login');
        };

        return (
            <div className="text-sm mt-8 flex link-color cursor-pointer" onClick={handleClick}>
                <span className="font-bold">Return to login </span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
            </div>
        );
    }

    const greetingText = {
        default: 'Hi There!',
        registerSuccess: 'Check your mail',
        invalid: 'Invalid Action',
        activate: 'Congratulations',
        inactive: 'Almost There!'
    };

    const pageText = {
        default: 'Create an account to start building superb, fully customised soil & plant nutrient programs to help food producers realise their dreams and to put more nutrient dense food into the world.',
        registerSuccess: 'We\'ve sent a message to ' + email + ' with a link to activate your account.',
        invalid: 'Sorry, we\'ve seem to find this page access a bit odd. Please try again or click the link below to login',
        activate: 'You have now successfully activated your account, please click on the link below to login',
        inactive: 'To activate your account, please check your email and click on the link to activate your account'
    };

    useEffect(() => {
        let mounted = true;

        if (mounted && action == 'registerSuccess') {
            setLoading(true);
            fetchWrapper.get('/api/users?id=' + objectId)
                .then(response => {
                    if (response.users.length > 0) {
                        const user = response.users[0];

                        if (user.email !== email || user.status != 'verification') {
                            router.push({
                                pathname: '/register',
                                query: {
                                    action: 'invalid'
                                }
                            });
                        } else {
                            setLoading(false);
                        }
                    }
                });
        }

        if (mounted && action == 'activate') {
            setLoading(true);

            fetchWrapper.post('/api/activate', { email: email })
                .then(response => {
                    if (response) {
                        const localUser = userService.userValue;
                        localUser && localStorage.setItem('acuser', JSON.stringify({ ...localUser, status: 'active' }));
                        setLoading(false);
                    }
                });
        }

        if (action && actions.includes(action)) {
            setShowLogin(true);
        }

        return () => {
            mounted = false;
        };
    }, [action]);

    return (
        <div className="login-container">
            <div className="login-left">
                <div className="login-left-content"></div>
            </div>
            <div className="login-right">
                <div className="login-right-content">
                    <Image src={logo} />
                    {global.loading ? <div className="mt-8"><Spinner /></div> : (
                        <>
                            <div className="login-welcome">{greetingText[type]}</div>
                            <div className="login-welcome-text">{pageText[type]}</div>
                            {type == 'default' && component}
                            {showLogin && <TextComponent />}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default RegistrationPage;