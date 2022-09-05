import { useState, useEffect } from 'react';
import Image from 'next/image';
import logo from '/public/images/logo-transparent-small.png';
import { InputEmail, InputPassword, ButtonSolid } from '@/lib/form-helper';
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { useRouter } from 'next/router';
import Spinner from '@/components/Spinner';
import toast from 'react-hot-toast';

const ForgotPasswordPage = () => {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [action, setAction] = useState('default');
    const [email, setEmail] = useState('');
    const [showResetForm, setShowResetForm] = useState(false);
    const query = router.query;

    const title = {
        default: 'Reset your password',
        sent: 'Success!',
        success: 'Success!'
    };

    const content = {
        default: 'Enter your email below to reset your password. The request will be sent to your email.',
        sent: 'We\'ve sent an email to ' + email + ' with your password reset instructions.',
        success: 'Your password has been reset'
    };

    const handleResetReqeust = (values, actions) => {
        fetchWrapper.post('/api/reset-request', { email: values.email })
            .then(response => {
                const emailAddress = values.email.split('@');
                setEmail('xxx@' + emailAddress[1]);
                setAction('sent');
            });
    };

    const handleResetPassword = (values, actions) => {
        const updatedValues = {
            objectId: query.id,
            password: values.newPassword
        };

        fetchWrapper.post('/api/reset-password', updatedValues)
            .then(response => {
                if (response.error) {
                    toast.error('Something went wrong! ' + response.message)
                } else {
                    setShowResetForm(false);
                    setAction('success');
                }
            });
    };

    const handleLoginClick = () => {
        router.push('/login');
    };

    const initialValuesEmail = { email: '' };
    const initialValuesPassword = { newPassword: '', confirmPassword: '' };
    const validationSchemaEmail = yup.object().shape({ email: yup.string().required('Email is required') });
    const validationSchemaPassword = yup.object().shape({
        newPassword: yup.string()
            .required('New Password is required')
            .matches(
                /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/,
                "Must Contain at least 8 Characters, One Uppercase, One Lowercase, One Number and one special case Character"
            ),
        confirmPassword: yup.string()
            .required('Confirm you password')
            .oneOf([yup.ref('newPassword'), null], 'Passwords does not match'),
    });

    useEffect(() => {
        let mounted = true;

        mounted && setLoading(false);
        mounted && query.action && action !== 'success' && setShowResetForm(true);

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
                    {loading ? <div className="mt-8"><Spinner /></div> : (
                        <>
                            <div className="login-welcome">{title[action]}</div>
                            {!showResetForm && <div className="login-welcome-text">{content[action]}</div>}
                            {action === 'default' && !showResetForm && (<div className="mt-12">
                                <Formik onSubmit={handleResetReqeust} initialValues={initialValuesEmail} validationSchema={validationSchemaEmail}>
                                    {({ values, actions, touched, errors, handleChange, handleSubmit }) => (
                                        <form onSubmit={handleSubmit} autoComplete="off">
                                            <InputEmail
                                                name="email"
                                                value={values.email}
                                                label="Email"
                                                onChange={handleChange}
                                                placeholder="youremail@gmail.com"
                                                errors={touched.email && errors.email ? errors.email : undefined} />
                                            <div className="flex flex-row pt-8">
                                                <ButtonSolid className="font-bold" label="Reset Password" type="submit" />
                                            </div>
                                        </form>
                                    )}
                                </Formik>
                            </div>)}
                            {showResetForm && (<div className="mt-12">
                                <Formik onSubmit={handleResetPassword} initialValues={initialValuesPassword} validationSchema={validationSchemaPassword}>
                                    {({ values, actions, touched, errors, handleChange, handleSubmit }) => (
                                        <form onSubmit={handleSubmit} autoComplete="off">
                                            <div className="mt-12">
                                                <InputPassword
                                                    name="newPassword"
                                                    value={values.newPassword}
                                                    label="Enter New Password"
                                                    onChange={handleChange}
                                                    placeholder="password"
                                                    errors={touched.newPassword && errors.newPassword ? errors.newPassword : undefined} />
                                            </div>
                                            <div className="mt-12">
                                                <InputPassword
                                                    name="confirmPassword"
                                                    value={values.confirmPassword}
                                                    label="Confirm Password"
                                                    onChange={handleChange}
                                                    placeholder="password"
                                                    errors={touched.confirmPassword && errors.confirmPassword ? errors.confirmPassword : undefined} />
                                            </div>
                                            <div className="flex flex-row pt-8">
                                                <ButtonSolid className="font-bold" label="Reset Password" type="submit" />
                                            </div>
                                        </form>
                                    )}
                                </Formik>
                            </div>)}
                            {action === 'success' && (
                                <div className="flex flex-row mt-12" onClick={handleLoginClick}>
                                    <ButtonSolid className="font-bold" label="Login" type="button" />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ForgotPasswordPage;