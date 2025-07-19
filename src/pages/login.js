import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import logo from '/public/images/logo.png';
import { useRouter } from 'next/router';
import { userService } from '@/services/user-service';
import { toast } from "react-toastify";
import { useDispatch } from 'react-redux';
import { setUser } from '@/redux/actions/userActions';
import { applyMaskedInput } from '@krozamdev/masked-password';

const LoginPage = () => {
    const router = useRouter();
    const dispatch = useDispatch();
    
    // Form state
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    
    // Refs for inputs
    const emailRef = useRef(null);
    const passwordRef = useRef(null);
    const maskedPasswordRef = useRef(null);
    
    // Initialize masked password input
    useEffect(() => {
        if (passwordRef.current && !maskedPasswordRef.current) {
            maskedPasswordRef.current = applyMaskedInput(passwordRef.current, {
                character: '•' // Use bullet character for masking
            });
        }
        
        return () => {
            if (maskedPasswordRef.current) {
                maskedPasswordRef.current.destroy();
            }
        };
    }, []);
    
    // Toggle password visibility
    const togglePasswordVisibility = () => {
        if (maskedPasswordRef.current) {
            if (showPassword) {
                maskedPasswordRef.current.addEvent(); // Enable masking
            } else {
                maskedPasswordRef.current.destroy(); // Disable masking temporarily
            }
            setShowPassword(!showPassword);
        }
    };
    
    // Validation
    const validateForm = () => {
        const newErrors = {};
        
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Email is invalid';
        }
        
        // Get the real password value
        const actualPassword = maskedPasswordRef.current 
            ? maskedPasswordRef.current.getOriginalValue() 
            : formData.password;
            
        if (!actualPassword.trim()) {
            newErrors.password = 'Password is required';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    
    // Handle input changes
    const handleEmailChange = (e) => {
        setFormData(prev => ({
            ...prev,
            email: e.target.value
        }));
        
        if (errors.email) {
            setErrors(prev => ({ ...prev, email: '' }));
        }
    };
    
    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
        setIsSubmitting(true);
        
        try {
            const email = formData.email;
            const password = maskedPasswordRef.current 
                ? maskedPasswordRef.current.getOriginalValue() 
                : formData.password;
                
            const response = await userService.login(email, password);
            
            if (response.error) {
                toast.error(`Error during Authentication. ${response.message}`);
            }
            
            if (response.success) {
                dispatch(setUser(response.user));
                router.push('/');
            }
        } catch (error) {
            toast.error('An unexpected error occurred during login.');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleForgotPassword = () => {
        router.push('/forgot-password');
    };

    return (
        <div className="bg-no-repeat bg-cover bg-center relative login-page-bg">
            <div className="absolute bg-gradient-to-b from-gray-500 to-gray-400 opacity-60 inset-0 z-0"></div>
            <div className="flex flex-row min-h-screen sm:flex sm:flex-row mx-0 justify-center">
                <div className="flex-col flex self-center p-10 sm:max-w-5xl max-w-3xl xl:max-w-xl z-10">
                    <div className="self-start hidden lg:flex flex-col text-white">
                        <h1 className="mb-3 font-bold text-5xl">Lending Management System</h1>
                        <p className="pr-3">Lorem ipsum is placeholder text commonly used in the graphic, print,
                            and publishing industries for previewing layouts and visual mockups</p>
                    </div>
                </div>
                <div className="flex justify-center self-center z-10">
                    {/* Updated container width - made significantly wider */}
                    <div className="p-12 bg-white mx-auto rounded-2xl w-full max-w-md sm:max-w-lg lg:max-w-xl xl:max-w-2xl min-w-[400px]">
                        <div className="mb-4">
                            <h3 className="font-semibold text-2xl text-gray-800">Sign In</h3>
                            <p className="text-gray-500">Please sign in to your account.</p>
                        </div>
                        <div className="space-y-5">
                            <form onSubmit={handleSubmit} autoComplete="off" noValidate>
                                {/* Email Field */}
                                <div className="mt-12">
                                    <div className={`
                                        flex justify-between rounded-md px-4 py-3 border mb-2 bg-white
                                        ${formData.email ? 'border border-main' : 'border-slate-400'}
                                        ${errors.email && 'border border-red-400'}
                                    `}>
                                        <div className="flex flex-col w-full">
                                            <label htmlFor="email-field"
                                                className={`
                                                text-xs font-bold 
                                                ${formData.email ? 'text-main' : 'text-gray-500'}
                                                ${errors.email && 'text-red-400'}
                                            `}>
                                                Email
                                            </label>
                                            <input 
                                                ref={emailRef}
                                                id="email-field"
                                                name={`email_${Date.now()}`}
                                                type="text"
                                                autoComplete="new-password"
                                                autoCorrect="off"
                                                autoCapitalize="off"
                                                spellCheck="false"
                                                className={`
                                                    p-1 pl-0 text-gray-700 font-medium border-none focus:ring-0 focus:outline-none
                                                    ${formData.email ? 'text-sm' : 'text-sm'} 
                                                    ${errors.email && 'text-red-400'}
                                                `}
                                                placeholder="Enter your email"
                                                value={formData.email}
                                                onChange={handleEmailChange}
                                            />
                                        </div>
                                    </div>
                                    {errors.email && <span className="text-red-400 text-xs font-medium">{errors.email}</span>}
                                </div>

                                {/* Password Field - Uses masked-password library */}
                                <div className="mt-6">
                                    <div className={`
                                        flex justify-between rounded-md px-4 py-3 border mb-2 bg-white
                                        border-slate-400
                                        ${errors.password && 'border border-red-400'}
                                    `}>
                                        <div className="flex flex-col w-full">
                                            <label htmlFor="password-field"
                                                className={`
                                                text-xs font-bold text-gray-500
                                                ${errors.password && 'text-red-400'}
                                            `}>
                                                Password
                                            </label>
                                            <input 
                                                ref={passwordRef}
                                                id="password-field"
                                                name={`password_${Date.now()}`}
                                                type="text" // Always text type to avoid password detection
                                                autoComplete="new-password"
                                                autoCorrect="off"
                                                autoCapitalize="off"
                                                spellCheck="false"
                                                className={`
                                                    p-1 pl-0 text-gray-700 font-medium border-none focus:ring-0 focus:outline-none text-sm
                                                    ${errors.password && 'text-red-400'}
                                                `}
                                                placeholder="Enter your password"
                                            />
                                        </div>
                                        <div 
                                            onClick={togglePasswordVisibility} 
                                            className="flex w-6 items-center justify-center cursor-pointer"
                                        >
                                            {showPassword ? (
                                                <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464m1.414 1.414L8.464 8.464m6.729 6.729a3 3 0 01-4.243-4.243m4.243 4.243L12 12m6.464 6.464L19.071 19.071" />
                                                </svg>
                                            ) : (
                                                <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                        </div>
                                    </div>
                                    {errors.password && <span className="text-red-400 text-xs font-medium">{errors.password}</span>}
                                </div>

                                <div className="flex flex-row-reverse pt-5 px-2">
                                    <button 
                                        className="text-blue-500 hover:text-blue-600 text-sm font-medium" 
                                        type="button" 
                                        onClick={handleForgotPassword}
                                    >
                                        Forgot Password?
                                    </button>
                                </div>
                                
                                <div className="flex flex-row pt-8">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className={`
                                            w-full py-3 px-4 rounded-md font-semibold text-white transition-colors
                                            ${isSubmitting 
                                                ? 'bg-blue-400 cursor-not-allowed' 
                                                : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'
                                            }
                                        `}
                                    >
                                        {isSubmitting ? 'Signing In...' : 'Login'}
                                    </button>
                                </div>
                            </form>
                        </div>
                        <div className="pt-5 text-center text-gray-400 text-xs">
                            <span>
                                Copyright © 2022-2025
                                <a href="#" rel="" target="_blank" title="Ajimon" className="text-green-500 hover:text-green-600"> xdonie11</a>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;