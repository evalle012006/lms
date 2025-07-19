import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import logo from '/public/images/logo.png';
import { useRouter } from 'next/router';
import { userService } from '@/services/user-service';
import { toast } from "react-toastify";
import { useDispatch } from 'react-redux';
import { setUser } from '@/redux/actions/userActions';
import { applyMaskedInput } from '@krozamdev/masked-password';
import { EyeIcon, EyeSlashIcon, UserIcon, LockClosedIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

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
    const [focusedField, setFocusedField] = useState('');
    
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
                // Reinitialize after showing password
                setTimeout(() => {
                    if (passwordRef.current) {
                        maskedPasswordRef.current = applyMaskedInput(passwordRef.current, {
                            character: '•'
                        });
                    }
                }, 100);
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
            newErrors.email = 'Please enter a valid email address';
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

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSubmit(e);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-100 rounded-full opacity-20 blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-100 rounded-full opacity-20 blur-3xl"></div>
            </div>
            
            <div className="relative w-full max-w-md">
                {/* Main login card */}
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
                    {/* Header section with branding */}
                    <div className="text-center pt-12 pb-8 px-8">
                        {/* Logo - AmberCash actual logo */}
                        <div className="w-20 h-20 mx-auto mb-6">
                            <Image 
                                src={logo} 
                                alt="AmberCash PH Micro Lending Corp." 
                                width={80} 
                                height={80} 
                                className="w-full h-full object-contain"
                                priority
                            />
                        </div>
                        
                        {/* Company name */}
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
                            AmberCashPh
                        </h1>
                        
                        {/* Tagline */}
                        <p className="text-gray-600 font-medium mb-8">
                            Your helping hands
                        </p>
                        
                        {/* Welcome message */}
                        <div className="space-y-1">
                            <h2 className="text-2xl font-semibold text-gray-800">Welcome back</h2>
                            <p className="text-gray-500">Sign in to your account to continue</p>
                        </div>
                    </div>
                    
                    {/* Form section */}
                    <div className="px-8 pb-8">
                        <form onSubmit={handleSubmit} autoComplete="off" noValidate>
                            <div className="space-y-6">
                                {/* Email field */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 block">
                                        Email Address
                                    </label>
                                    <div className="relative">
                                        <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200 ${
                                            focusedField === 'email' ? 'text-purple-500' : 'text-gray-400'
                                        }`}>
                                            <UserIcon className="h-5 w-5" />
                                        </div>
                                        <input
                                            ref={emailRef}
                                            id="email-field"
                                            name={`email_${Date.now()}`}
                                            type="text"
                                            autoComplete="new-password"
                                            autoCorrect="off"
                                            autoCapitalize="off"
                                            spellCheck="false"
                                            value={formData.email}
                                            onChange={handleEmailChange}
                                            onFocus={() => setFocusedField('email')}
                                            onBlur={() => setFocusedField('')}
                                            className={`w-full pl-12 pr-4 py-4 rounded-xl border-2 transition-all duration-200 bg-gray-50/50 focus:bg-white focus:outline-none ${
                                                errors.email 
                                                    ? 'border-red-300 focus:border-red-500' 
                                                    : focusedField === 'email'
                                                        ? 'border-purple-400 focus:border-purple-500'
                                                        : 'border-gray-200 focus:border-purple-400'
                                            }`}
                                            placeholder="Enter your email"
                                        />
                                    </div>
                                    {errors.email && (
                                        <p className="text-red-500 text-sm mt-1 flex items-center">
                                            <span className="mr-1">⚠</span>
                                            {errors.email}
                                        </p>
                                    )}
                                </div>
                                
                                {/* Password field - Uses masked-password library */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 block">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200 ${
                                            focusedField === 'password' ? 'text-purple-500' : 'text-gray-400'
                                        }`}>
                                            <LockClosedIcon className="h-5 w-5" />
                                        </div>
                                        <input
                                            ref={passwordRef}
                                            id="password-field"
                                            name={`password_${Date.now()}`}
                                            type="text" // Always text type to avoid password detection
                                            autoComplete="new-password"
                                            autoCorrect="off"
                                            autoCapitalize="off"
                                            spellCheck="false"
                                            onFocus={() => setFocusedField('password')}
                                            onBlur={() => setFocusedField('')}
                                            className={`w-full pl-12 pr-12 py-4 rounded-xl border-2 transition-all duration-200 bg-gray-50/50 focus:bg-white focus:outline-none ${
                                                errors.password 
                                                    ? 'border-red-300 focus:border-red-500' 
                                                    : focusedField === 'password'
                                                        ? 'border-purple-400 focus:border-purple-500'
                                                        : 'border-gray-200 focus:border-purple-400'
                                            }`}
                                            placeholder="Enter your password"
                                        />
                                        <button
                                            type="button"
                                            onClick={togglePasswordVisibility}
                                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors duration-200"
                                        >
                                            {showPassword ? (
                                                <EyeSlashIcon className="h-5 w-5" />
                                            ) : (
                                                <EyeIcon className="h-5 w-5" />
                                            )}
                                        </button>
                                    </div>
                                    {errors.password && (
                                        <p className="text-red-500 text-sm mt-1 flex items-center">
                                            <span className="mr-1">⚠</span>
                                            {errors.password}
                                        </p>
                                    )}
                                </div>
                                
                                {/* Login button */}
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`w-full py-4 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center space-x-2 mt-8 ${
                                        isSubmitting
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0'
                                    }`}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Signing In...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Sign In</span>
                                            <ArrowRightIcon className="h-5 w-5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                
                {/* Social Media Links */}
                <div className="text-center mt-6">
                    <p className="text-sm text-gray-600 mb-4">Follow us on social media</p>
                    <div className="flex justify-center space-x-4">
                        {/* Facebook */}
                        <a
                            href="https://www.facebook.com/ambercash.ph.2025"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-110 hover:shadow-lg"
                        >
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                            </svg>
                        </a>
                        
                        {/* TikTok */}
                        <a
                            href="https://tiktok.com/@ambercashph"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-10 h-10 bg-black hover:bg-gray-800 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-110 hover:shadow-lg"
                        >
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                            </svg>
                        </a>
                    </div>
                </div>
                
                {/* Footer */}
                <div className="text-center mt-8 text-sm text-gray-500">
                    <p>
                        © 2022-2025 AmberCashPh. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;