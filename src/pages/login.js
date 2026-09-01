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
import BiometricLoginButton from '@/components/auth/BiometricLoginButton';

const LoginPage = () => {
    const router = useRouter();
    const dispatch = useDispatch();
    
    // Configuration for enabling autofill from environment variables
    const AUTOFILL_TRIGGER_KEYWORDS = process.env.NEXT_PUBLIC_AUTOFILL_KEYWORDS 
        ? process.env.NEXT_PUBLIC_AUTOFILL_KEYWORDS.split(',').map(k => k.trim().toLowerCase())
        : ['admin'];
    const AUTOFILL_PARTIAL_MATCH = process.env.NEXT_PUBLIC_AUTOFILL_PARTIAL_MATCH === 'true';
    
    // Form state
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [focusedField, setFocusedField] = useState('');
    
    // Password handling state
    const [actualPassword, setActualPassword] = useState('');
    const [isAutofillEnabled, setIsAutofillEnabled] = useState(false);
    const [formKey, setFormKey] = useState(0); // Force form re-render
    const [preserveFocus, setPreserveFocus] = useState(false);
    
    // Refs for inputs
    const emailRef = useRef(null);
    const passwordRef = useRef(null);
    const formRef = useRef(null);
    const maskedPasswordRef = useRef(null);
    const debounceTimeoutRef = useRef(null);
    
    // Check if autofill should be enabled based on email content
    const checkAutofillTrigger = (email) => {
        if (!email || !AUTOFILL_TRIGGER_KEYWORDS.length) return false;
        
        const emailLower = email.toLowerCase();
        
        return AUTOFILL_TRIGGER_KEYWORDS.some(keyword => {
            return AUTOFILL_PARTIAL_MATCH 
                ? emailLower.includes(keyword)
                : emailLower === keyword;
        });
    };
    
    // Force browser to recognize the form as a login form
    const triggerBrowserRecognition = () => {
        if (!isAutofillEnabled || !formRef.current) return;
        
        setTimeout(() => {
            // Only trigger recognition if email field is not currently focused
            const emailIsFocused = document.activeElement === emailRef.current;
            
            if (emailRef.current && passwordRef.current && !emailIsFocused) {
                // Focus and blur to trigger browser recognition
                emailRef.current.focus();
                emailRef.current.blur();
                
                setTimeout(() => {
                    passwordRef.current.focus();
                    passwordRef.current.blur();
                    
                    // Dispatch input events to trigger autofill
                    const inputEvent = new Event('input', { bubbles: true });
                    emailRef.current.dispatchEvent(inputEvent);
                    passwordRef.current.dispatchEvent(inputEvent);
                }, 50);
            } else if (passwordRef.current) {
                // If email is focused, only trigger password field recognition
                passwordRef.current.focus();
                passwordRef.current.blur();
                
                const inputEvent = new Event('input', { bubbles: true });
                passwordRef.current.dispatchEvent(inputEvent);
            }
        }, 100);
    };
    
    // Initialize or reinitialize password field based on autofill state
    const initializePasswordField = (enableAutofill = false) => {
        if (!passwordRef.current) return;
        
        // Clean up existing masked input
        if (maskedPasswordRef.current) {
            try {
                maskedPasswordRef.current.destroy();
                maskedPasswordRef.current = null;
            } catch (error) {
                console.warn('Failed to destroy existing masked password:', error);
            }
        }
        
        if (enableAutofill) {
            // Configure for browser autofill compatibility
            passwordRef.current.type = 'password';
            passwordRef.current.name = 'password';
            passwordRef.current.id = 'password';
            passwordRef.current.autocomplete = 'current-password';
            passwordRef.current.removeAttribute('readonly');
            
            // Add simple change handler for autofill mode
            const handleAutofillPasswordChange = (e) => {
                const value = e.target.value;
                setFormData(prev => ({ ...prev, password: value }));
                setActualPassword(value);
                
                if (errors.password) {
                    setErrors(prev => ({ ...prev, password: '' }));
                }
            };
            
            passwordRef.current.addEventListener('input', handleAutofillPasswordChange);
            passwordRef.current.addEventListener('change', handleAutofillPasswordChange);
            
            // Trigger browser recognition
            triggerBrowserRecognition();
            
        } else {
            // Configure for masked input (disable autofill)
            passwordRef.current.type = 'text';
            passwordRef.current.name = `password_${Date.now()}`;
            passwordRef.current.id = `password_${Date.now()}`;
            passwordRef.current.autocomplete = 'new-password';
            passwordRef.current.setAttribute('readonly', true);
            
            // Remove readonly after a short delay to prevent autofill
            setTimeout(() => {
                if (passwordRef.current && !isAutofillEnabled) {
                    passwordRef.current.removeAttribute('readonly');
                }
            }, 100);
            
            try {
                maskedPasswordRef.current = applyMaskedInput(passwordRef.current, {
                    character: '•'
                });
                
                const handleMaskedPasswordInput = (e) => {
                    setActualPassword(e.target.value);
                    if (errors.password) {
                        setErrors(prev => ({ ...prev, password: '' }));
                    }
                };
                
                passwordRef.current.addEventListener('input', handleMaskedPasswordInput);
                
            } catch (error) {
                console.warn('Failed to initialize masked password:', error);
                // Fallback to regular password handling
                const handleFallbackPasswordChange = (e) => {
                    const value = e.target.value;
                    setFormData(prev => ({ ...prev, password: value }));
                    setActualPassword(value);
                    
                    if (errors.password) {
                        setErrors(prev => ({ ...prev, password: '' }));
                    }
                };
                
                passwordRef.current.addEventListener('input', handleFallbackPasswordChange);
            }
        }
    };
    
    // Handle autofill state changes
    useEffect(() => {
        // Check if email field is currently focused
        const emailIsFocused = document.activeElement === emailRef.current;
        
        if (emailIsFocused) {
            setPreserveFocus(true);
        }
        
        // Force form re-render when autofill state changes
        setFormKey(prev => prev + 1);
        
        // Clear password when switching modes
        setFormData(prev => ({ ...prev, password: '' }));
        setActualPassword('');
        
        // Initialize password field after state change
        setTimeout(() => {
            initializePasswordField(isAutofillEnabled);
            
            // Restore focus to email field if it was focused before and user hasn't moved focus elsewhere
            if (emailIsFocused && emailRef.current && document.activeElement !== passwordRef.current) {
                emailRef.current.focus();
                // Position cursor at the end of the text (only for text inputs)
                try {
                    const length = emailRef.current.value.length;
                    emailRef.current.setSelectionRange(length, length);
                } catch (error) {
                    // Email inputs don't support setSelectionRange, ignore error
                    console.debug('setSelectionRange not supported on this input type');
                }
            }
            setPreserveFocus(false);
        }, 50);
        
    }, [isAutofillEnabled]);
    
    // Initialize password field on component mount and formKey changes
    useEffect(() => {
        const timer = setTimeout(() => {
            initializePasswordField(isAutofillEnabled);
            
            // Restore focus if it was preserved
            if (preserveFocus && emailRef.current) {
                emailRef.current.focus();
                // Position cursor at the end of the text (only for text inputs)
                try {
                    const length = emailRef.current.value.length;
                    emailRef.current.setSelectionRange(length, length);
                } catch (error) {
                    // Email inputs don't support setSelectionRange, ignore error
                    console.debug('setSelectionRange not supported on this input type');
                }
                setPreserveFocus(false);
            }
        }, 100);
        
        return () => {
            clearTimeout(timer);
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
            if (maskedPasswordRef.current) {
                try {
                    maskedPasswordRef.current.destroy();
                } catch (error) {
                    console.warn('Failed to destroy masked password on cleanup:', error);
                }
            }
        };
    }, [formKey, preserveFocus]);
    
    // Get password value with multiple fallback mechanisms
    const getPasswordValue = () => {
        let password = '';
        
        if (isAutofillEnabled) {
            // For autofill mode, get directly from input or form data
            password = passwordRef.current?.value || formData.password || actualPassword;
        } else {
            // For masked mode, try masked library first
            try {
                if (maskedPasswordRef.current && typeof maskedPasswordRef.current.getOriginalValue === 'function') {
                    password = maskedPasswordRef.current.getOriginalValue();
                }
            } catch (error) {
                console.warn('Failed to get password from masked library:', error);
            }
            
            // Fallback mechanisms
            if (!password) {
                password = actualPassword || passwordRef.current?.value || formData.password;
            }
        }
        
        return password || '';
    };
    
    // Toggle password visibility
    const togglePasswordVisibility = () => {
        if (isAutofillEnabled) {
            // Simple toggle for autofill mode
            passwordRef.current.type = showPassword ? 'password' : 'text';
        } else {
            // Complex toggle for masked mode
            try {
                if (maskedPasswordRef.current) {
                    if (showPassword) {
                        maskedPasswordRef.current.addEvent(); // Enable masking
                    } else {
                        maskedPasswordRef.current.destroy(); // Disable masking temporarily
                        setTimeout(() => {
                            if (passwordRef.current && !isAutofillEnabled) {
                                maskedPasswordRef.current = applyMaskedInput(passwordRef.current, {
                                    character: '•'
                                });
                            }
                        }, 100);
                    }
                }
            } catch (error) {
                console.warn('Failed to toggle password visibility:', error);
            }
        }
        setShowPassword(!showPassword);
    };
    
    // Validation with robust password checking
    const validateForm = () => {
        const newErrors = {};
        
        // Email validation
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }
        
        // Password validation
        const password = getPasswordValue();
        
        if (!password || !password.trim()) {
            newErrors.password = 'Password is required';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    
    // Handle email input changes with autofill trigger check
    const handleEmailChange = (e) => {
        const emailValue = e.target.value;
        
        setFormData(prev => ({
            ...prev,
            email: emailValue
        }));
        
        // Check if autofill should be enabled/disabled
        const shouldEnableAutofill = checkAutofillTrigger(emailValue);
        
        // Only change state if it's actually different to prevent unnecessary re-renders
        if (shouldEnableAutofill !== isAutofillEnabled) {
            // Clear any existing timeout
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
            
            // Use setTimeout to debounce state changes during rapid typing
            debounceTimeoutRef.current = setTimeout(() => {
                // Double-check the current email value to ensure it still matches
                const currentEmail = emailRef.current?.value || emailValue;
                const currentShouldEnable = checkAutofillTrigger(currentEmail);
                
                if (currentShouldEnable !== isAutofillEnabled) {
                    setIsAutofillEnabled(currentShouldEnable);
                }
                debounceTimeoutRef.current = null;
            }, 150); // Small delay to debounce rapid typing
        }
        
        if (errors.email) {
            setErrors(prev => ({ ...prev, email: '' }));
        }
    };
    
    // Handle password change (backup mechanism)
    const handlePasswordChange = (e) => {
        const value = e.target.value;
        setFormData(prev => ({
            ...prev,
            password: value
        }));
        setActualPassword(value);
        
        if (errors.password) {
            setErrors(prev => ({ ...prev, password: '' }));
        }
    };
    
    // Handle password field focus for autofill
    const handlePasswordFocus = () => {
        setFocusedField('password');
        
        if (isAutofillEnabled) {
            // Additional trigger for browser autofill
            setTimeout(() => {
                if (passwordRef.current) {
                    passwordRef.current.click();
                }
            }, 10);
        }
    };

    const handleLoginSuccess = (user) => {
        dispatch(setUser(user));
        userService.loginDirect(user);
 
        if (user?.mustChangePassword) {
            router.push('/change-password');
            return;
        }
 
        const hasBiometric = !!user?.biometricCredentialId;
        const isRoot = user?.root === true;
        if (!hasBiometric && !isRoot) {
            router.push('/biometric-setup');
        } else {
            const redirectTo = router.query.redirect;
            router.push(redirectTo && redirectTo !== '/' ? redirectTo : '/');
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
            const password = getPasswordValue();
            
            // Additional check before submission
            if (!password) {
                toast.error('Password cannot be empty');
                setIsSubmitting(false);
                return;
            }
                
            const response = await userService.login(email, password);
            
            if (response.error) {
                if (response.locked) {
                    toast.error(response.message, { autoClose: 8000, icon: '🔒' });
                } else {
                    toast.error(`Error during Authentication. ${response.message}`);
                }
            }
            
            if (response.success) {
                handleLoginSuccess(response.user);
            }
        } catch (error) {
            console.error('Login error:', error);
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
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-2 sm:p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-60 h-60 sm:w-80 sm:h-80 bg-purple-100 rounded-full opacity-20 blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-72 h-72 sm:w-96 sm:h-96 bg-blue-100 rounded-full opacity-20 blur-3xl"></div>
            </div>
            
            <div className="relative w-full max-w-sm sm:max-w-md">
                
                {/* Main login card */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 overflow-hidden mx-2 sm:mx-0">
                    {/* Header section with branding */}
                    <div className="text-center pt-6 sm:pt-12 pb-4 sm:pb-8 px-4 sm:px-8">
                        {/* Logo */}
                        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6">
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
                        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-1 sm:mb-2">
                            AmberCashPh
                        </h1>
                        
                        {/* Tagline */}
                        <p className="text-gray-600 font-medium mb-4 sm:mb-8 text-sm sm:text-base">
                            Your helping hands
                        </p>
                        
                        {/* Welcome message */}
                        <div className="space-y-1">
                            <h2 className="text-xl sm:text-2xl font-semibold text-gray-800">Welcome back</h2>
                            <p className="text-gray-500 text-sm sm:text-base">Sign in to your account to continue</p>
                        </div>
                    </div>
                    
                    {/* Form section */}
                    <div className="px-4 sm:px-8 pb-4 sm:pb-8">
                        <form 
                            ref={formRef}
                            key={formKey}
                            onSubmit={handleSubmit} 
                            autoComplete={isAutofillEnabled ? "on" : "off"} 
                            method="post"
                            action="/login"
                            noValidate
                        >
                            <div className="space-y-4 sm:space-y-6">
                                {/* Email field */}
                                <div className="space-y-1 sm:space-y-2">
                                    <label htmlFor={isAutofillEnabled ? "username" : `email_${formKey}`} className="text-sm font-medium text-gray-700 block">
                                        Email Address
                                    </label>
                                    <div className="relative">
                                        <div className={`absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none transition-colors duration-200 ${
                                            focusedField === 'email' ? 'text-purple-500' : 'text-gray-400'
                                        }`}>
                                            <UserIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </div>
                                        <input
                                            ref={emailRef}
                                            id={isAutofillEnabled ? "username" : `email_${formKey}`}
                                            name={isAutofillEnabled ? "username" : `email_${formKey}`}
                                            type="email"
                                            autoComplete={isAutofillEnabled ? "username email" : "new-password"}
                                            autoCorrect="off"
                                            autoCapitalize="off"
                                            spellCheck="false"
                                            value={formData.email}
                                            onChange={handleEmailChange}
                                            onFocus={() => setFocusedField('email')}
                                            onBlur={() => setFocusedField('')}
                                            className={`w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-4 rounded-lg sm:rounded-xl border-2 transition-all duration-200 bg-gray-50/50 focus:bg-white focus:outline-none text-sm sm:text-base ${
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
                                        <p className="text-red-500 text-xs sm:text-sm mt-1 flex items-center">
                                            <span className="mr-1">⚠</span>
                                            {errors.email}
                                        </p>
                                    )}
                                </div>
                                
                                {/* Password field */}
                                <div className="space-y-1 sm:space-y-2">
                                    <label htmlFor={isAutofillEnabled ? "password" : `password_${formKey}`} className="text-sm font-medium text-gray-700 block">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <div className={`absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none transition-colors duration-200 ${
                                            focusedField === 'password' ? 'text-purple-500' : 'text-gray-400'
                                        }`}>
                                            <LockClosedIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </div>
                                        <input
                                            ref={passwordRef}
                                            id={isAutofillEnabled ? "password" : `password_${formKey}`}
                                            name={isAutofillEnabled ? "password" : `password_${formKey}`}
                                            type={isAutofillEnabled ? "password" : "text"}
                                            autoComplete={isAutofillEnabled ? "current-password" : "new-password"}
                                            autoCorrect="off"
                                            autoCapitalize="off"
                                            spellCheck="false"
                                            value={isAutofillEnabled ? formData.password : undefined}
                                            onChange={handlePasswordChange}
                                            onFocus={handlePasswordFocus}
                                            onBlur={() => setFocusedField('')}
                                            className={`w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 rounded-lg sm:rounded-xl border-2 transition-all duration-200 bg-gray-50/50 focus:bg-white focus:outline-none text-sm sm:text-base ${
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
                                            className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors duration-200"
                                        >
                                            {showPassword ? (
                                                <EyeSlashIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                            ) : (
                                                <EyeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                            )}
                                        </button>
                                    </div>
                                    {errors.password && (
                                        <p className="text-red-500 text-xs sm:text-sm mt-1 flex items-center">
                                            <span className="mr-1">⚠</span>
                                            {errors.password}
                                        </p>
                                    )}
                                </div>
                                
                                {/* Login button */}
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`w-full py-3 sm:py-4 rounded-lg sm:rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center space-x-2 mt-6 sm:mt-8 text-sm sm:text-base ${
                                        isSubmitting
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0'
                                    }`}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Signing In...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Sign In</span>
                                            <ArrowRightIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </>
                                    )}
                                </button>

                                <BiometricLoginButton
                                    email={formData.email}
                                    onSuccess={handleLoginSuccess}
                                    onFallback={() => {
                                        // Focus password field — directs user to system password input
                                        setTimeout(() => {
                                            passwordRef.current?.focus();
                                        }, 300); // small delay so toast appears first
                                    }}
                                />
                            </div>
                        </form>
                    </div>
                </div>
                
                {/* Social Media Links */}
                <div className="text-center mt-4 sm:mt-6 px-2">
                    <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">Follow us on social media</p>
                    <div className="flex justify-center space-x-3 sm:space-x-4">
                        {/* Facebook */}
                        <a
                            href="https://www.facebook.com/ambercash.ph.2025"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-110 hover:shadow-lg"
                        >
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                            </svg>
                        </a>
                        
                        {/* TikTok */}
                        <a
                            href="https://tiktok.com/@ambercashph"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 sm:w-10 sm:h-10 bg-black hover:bg-gray-800 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-110 hover:shadow-lg"
                        >
                            <svg className="w-4 h-4 sm:w-5 sm:w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                            </svg>
                        </a>
                    </div>
                </div>
                
                {/* Footer */}
                <div className="text-center mt-4 sm:mt-8 text-xs sm:text-sm text-gray-500 px-2">
                    <p>
                        © 2022-{new Date().getFullYear()} AmberCashPh. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;