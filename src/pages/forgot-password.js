import { useState, useEffect } from 'react';
import Image from 'next/image';
import logo from '/public/images/logo.png';
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { useRouter } from 'next/router';
import { toast } from "react-toastify";
import { getApiBaseUrl } from '@/lib/constants';

const ForgotPasswordPage = () => {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [action, setAction] = useState('default');
    const [email, setEmail] = useState('');
    const [showResetForm, setShowResetForm] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const query = router.query;

    const title = {
        default: 'Reset your password',
        sent: 'Check your email',
        success: 'Password reset successful!'
    };

    const subtitle = {
        default: 'Enter your email address and we\'ll send you instructions to reset your password.',
        sent: `We've sent password reset instructions to ${email}`,
        success: 'Your password has been successfully reset. You can now sign in with your new password.'
    };

    useEffect(() => {
        if (query.action === 'reset' && query.id) {
            setShowResetForm(true);
            setAction('default');
        }
        setLoading(false);
    }, [query]);

    const handleResetRequest = (values, actions) => {
        const apiUrl = getApiBaseUrl() + 'reset-request';
        fetchWrapper.post(apiUrl, { email: values.email })
            .then(response => {
                const emailAddress = values.email.split('@');
                setEmail('xxx@' + emailAddress[1]);
                setAction('sent');
                actions.setSubmitting(false);
            })
            .catch(error => {
                toast.error('Failed to send reset email. Please try again.');
                actions.setSubmitting(false);
            });
    };

    const handleResetPassword = (values, actions) => {
        const updatedValues = {
            objectId: query.id,
            password: values.newPassword
        };

        const apiUrl = getApiBaseUrl() + 'reset-password';
        fetchWrapper.post(apiUrl, updatedValues)
            .then(response => {
                if (response.error) {
                    toast.error('Something went wrong! ' + response.message);
                    actions.setSubmitting(false);
                } else {
                    setShowResetForm(false);
                    setAction('success');
                    actions.setSubmitting(false);
                }
            })
            .catch(error => {
                toast.error('Failed to reset password. Please try again.');
                actions.setSubmitting(false);
            });
    };

    const handleLoginClick = () => {
        router.push('/login');
    };

    const initialValuesEmail = { email: '' };
    const initialValuesPassword = { newPassword: '', confirmPassword: '' };
    
    const validationSchemaEmail = yup.object().shape({ 
        email: yup.string().email('Invalid email address').required('Email is required') 
    });
    
    const validationSchemaPassword = yup.object().shape({
        newPassword: yup.string()
            .required('New Password is required')
            .min(8, 'Password must be at least 8 characters')
            .matches(
                /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&_\-+=(){}[\]|\\:;"'<>,.?/~`])[A-Za-z\d@$!%*#?&_\-+=(){}[\]|\\:;"'<>,.?/~`]/,
                'Password must contain at least one letter, one number, and one special character'
            ),
        confirmPassword: yup.string()
            .required('Please confirm your password')
            .oneOf([yup.ref('newPassword'), null], 'Passwords must match')
    });

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-main"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo and Header */}
                <div className="text-center mb-8 animate-fade-in">
                    <div className="flex justify-center mb-6">
                        <div className="relative w-24 h-24 bg-white rounded-2xl shadow-lg p-4 transform hover:scale-105 transition-transform duration-300">
                            <Image 
                                src={logo} 
                                alt="Logo" 
                                layout="fill"
                                objectFit="contain"
                                className="p-3"
                            />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2 proxima-bold">
                        {title[action]}
                    </h1>
                    <p className="text-gray-600 proxima-regular">
                        {subtitle[action]}
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 animate-slide-up">
                    {/* Email Form */}
                    {action === 'default' && !showResetForm && (
                        <Formik 
                            onSubmit={handleResetRequest} 
                            initialValues={initialValuesEmail} 
                            validationSchema={validationSchemaEmail}
                        >
                            {({ values, touched, errors, handleChange, handleSubmit, isSubmitting }) => (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2 proxima-bold">
                                            Email Address
                                        </label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={values.email}
                                            onChange={handleChange}
                                            placeholder="you@example.com"
                                            className={`w-full px-4 py-3 rounded-lg border ${
                                                touched.email && errors.email 
                                                    ? 'border-red-500 focus:ring-red-500' 
                                                    : 'border-gray-300 focus:ring-main focus:border-main'
                                            } focus:ring-2 focus:outline-none transition-all duration-200 proxima-regular`}
                                        />
                                        {touched.email && errors.email && (
                                            <p className="mt-2 text-sm text-red-600 flex items-center">
                                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                                {errors.email}
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full bg-main hover:bg-opacity-90 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center proxima-bold shadow-lg hover:shadow-xl"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Sending...
                                            </>
                                        ) : (
                                            'Send Reset Link'
                                        )}
                                    </button>
                                </form>
                            )}
                        </Formik>
                    )}

                    {/* Reset Password Form */}
                    {showResetForm && (
                        <Formik 
                            onSubmit={handleResetPassword} 
                            initialValues={initialValuesPassword} 
                            validationSchema={validationSchemaPassword}
                        >
                            {({ values, touched, errors, handleChange, handleSubmit, isSubmitting }) => (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2 proxima-bold">
                                            New Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showNewPassword ? "text" : "password"}
                                                name="newPassword"
                                                value={values.newPassword}
                                                onChange={handleChange}
                                                placeholder="Enter new password"
                                                className={`w-full px-4 py-3 pr-12 rounded-lg border ${
                                                    touched.newPassword && errors.newPassword 
                                                        ? 'border-red-500 focus:ring-red-500' 
                                                        : 'border-gray-300 focus:ring-main focus:border-main'
                                                } focus:ring-2 focus:outline-none transition-all duration-200 proxima-regular`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none transition-colors duration-200"
                                            >
                                                {showNewPassword ? (
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                        {touched.newPassword && errors.newPassword && (
                                            <p className="mt-2 text-sm text-red-600 flex items-start">
                                                <svg className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                                <span>{errors.newPassword}</span>
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2 proxima-bold">
                                            Confirm Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showConfirmPassword ? "text" : "password"}
                                                name="confirmPassword"
                                                value={values.confirmPassword}
                                                onChange={handleChange}
                                                placeholder="Confirm new password"
                                                className={`w-full px-4 py-3 pr-12 rounded-lg border ${
                                                    touched.confirmPassword && errors.confirmPassword 
                                                        ? 'border-red-500 focus:ring-red-500' 
                                                        : 'border-gray-300 focus:ring-main focus:border-main'
                                                } focus:ring-2 focus:outline-none transition-all duration-200 proxima-regular`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none transition-colors duration-200"
                                            >
                                                {showConfirmPassword ? (
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                        {touched.confirmPassword && errors.confirmPassword && (
                                            <p className="mt-2 text-sm text-red-600 flex items-center">
                                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                                {errors.confirmPassword}
                                            </p>
                                        )}
                                    </div>

                                    {/* Password Requirements */}
                                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                        <p className="text-xs font-semibold text-gray-700 mb-2">Password must contain:</p>
                                        <ul className="space-y-1 text-xs text-gray-600">
                                            <li className="flex items-center">
                                                <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                                At least 8 characters
                                            </li>
                                            <li className="flex items-center">
                                                <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                                One letter, one number, one special character
                                            </li>
                                        </ul>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full bg-main hover:bg-opacity-90 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center proxima-bold shadow-lg hover:shadow-xl"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Resetting...
                                            </>
                                        ) : (
                                            'Reset Password'
                                        )}
                                    </button>
                                </form>
                            )}
                        </Formik>
                    )}

                    {/* Success Message */}
                    {action === 'sent' && (
                        <div className="text-center space-y-6">
                            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center animate-bounce-in">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76"></path>
                                </svg>
                            </div>
                            <p className="text-sm text-gray-600 proxima-regular">
                                Didn't receive the email? Check your spam folder or{' '}
                                <button 
                                    onClick={() => setAction('default')}
                                    className="text-main font-semibold hover:underline"
                                >
                                    try again
                                </button>
                            </p>
                        </div>
                    )}

                    {/* Password Reset Success */}
                    {action === 'success' && (
                        <div className="text-center space-y-6">
                            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center animate-bounce-in">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                            </div>
                            <button
                                onClick={handleLoginClick}
                                className="w-full bg-main hover:bg-opacity-90 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] proxima-bold shadow-lg hover:shadow-xl"
                            >
                                Continue to Login
                            </button>
                        </div>
                    )}

                    {/* Back to Login Link */}
                    {action !== 'success' && (
                        <div className="mt-6 text-center">
                            <button
                                onClick={handleLoginClick}
                                className="text-sm text-gray-600 hover:text-main transition-colors duration-200 flex items-center justify-center mx-auto proxima-regular group"
                            >
                                <svg className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                </svg>
                                Back to Login
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-8 text-center">
                    <p className="text-sm text-gray-500 proxima-regular">
                        Need help?{' '}
                        <a href="#" className="text-main hover:underline font-semibold">
                            Contact Support
                        </a>
                    </p>
                </div>
            </div>

            <style jsx>{`
                @keyframes fade-in {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes slide-up {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes bounce-in {
                    0% {
                        opacity: 0;
                        transform: scale(0.3);
                    }
                    50% {
                        transform: scale(1.05);
                    }
                    70% {
                        transform: scale(0.9);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1);
                    }
                }

                .animate-fade-in {
                    animation: fade-in 0.6s ease-out;
                }

                .animate-slide-up {
                    animation: slide-up 0.6s ease-out;
                }

                .animate-bounce-in {
                    animation: bounce-in 0.6s ease-out;
                }
            `}</style>
        </div>
    );
}

export default ForgotPasswordPage;