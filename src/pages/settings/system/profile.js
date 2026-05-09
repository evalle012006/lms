import { Formik } from 'formik';
import * as yup from 'yup';
import React, { useEffect, useRef, useState } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from "react-toastify";
import { setSystemSettings } from '@/redux/actions/systemActions';
import Spinner from '@/components/Spinner';
import { getApiBaseUrl } from '@/lib/constants';
import { 
  BuildingOfficeIcon, 
  MapPinIcon, 
  EnvelopeIcon, 
  PhoneIcon, 
  CodeBracketIcon,
  BuildingStorefrontIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  EyeIcon,
  EyeSlashIcon,
  BellIcon,
  CogIcon,
} from '@heroicons/react/24/outline';

const ModernInput = ({ 
  name, 
  value, 
  label, 
  placeholder, 
  icon: Icon, 
  type = "text",
  required = false,
  onChange,
  setFieldValue,
  errors,
  isPassword = false
}) => {
  const [showPassword, setShowPassword] = useState(false);
  
  return (
    <div className="group">
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Icon className={`h-5 w-5 transition-colors ${
            errors ? 'text-red-400' : 'text-gray-400 group-focus-within:text-blue-500'
          }`} />
        </div>
        <input
          type={isPassword ? (showPassword ? "text" : "password") : type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={isPassword ? "new-password" : "off"}
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          className={`w-full pl-12 ${isPassword ? 'pr-12' : 'pr-4'} py-3 border rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200 bg-white shadow-sm hover:shadow-md focus:shadow-lg ${
            errors 
              ? 'border-red-300 focus:ring-red-500' 
              : 'border-gray-200 focus:ring-blue-500'
          }`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-4 flex items-center"
          >
            {showPassword ? (
              <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            ) : (
              <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            )}
          </button>
        )}
      </div>
      {errors && <span className="text-red-400 text-xs font-medium mt-1 block">{errors}</span>}
    </div>
  );
};

const FeatureEnablementCard = ({ values, setFieldValue, currentUser }) => (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        {/* Card Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-700 px-6 py-4">
            <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-white mr-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                <h2 className="text-xl font-semibold text-white">Feature Enablement</h2>
            </div>
            <p className="text-purple-100 text-sm mt-1">Enable or disable system features</p>
        </div>
        
        {/* Card Content */}
        <div className="p-6 space-y-6">
            {/* Notification System Toggle */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-start space-x-4">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-indigo-600">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <label className="text-base font-semibold text-gray-900">
                                Notification System
                            </label>
                            <p className="text-sm text-gray-500 mt-1">
                                Enable real-time notifications for important events like new clients, 
                                loan approvals, withdrawals, and more.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setFieldValue('enableNotifications', !values.enableNotifications)}
                        className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                            values.enableNotifications ? 'bg-indigo-600' : 'bg-gray-200'
                        }`}
                    >
                        <span
                            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                values.enableNotifications ? 'translate-x-7' : 'translate-x-0'
                            }`}
                        />
                    </button>
                </div>
                
                {/* What gets notified */}
                {values.enableNotifications && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-2">When enabled, users will be notified about:</p>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center text-sm text-gray-600">
                                <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                New prospect clients
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                                <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Loan approvals/rejections
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                                <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                MCBU/CSF withdrawals
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                                <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Denomination submissions
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                                <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Client transfers
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                                <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Fund transfers
                            </div>
                        </div>
                    </div>
                )}
                
                {!values.enableNotifications && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-start space-x-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 flex-shrink-0 mt-0.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                            </svg>
                            <div className="text-sm">
                                <p className="font-medium">Notifications are disabled</p>
                                <p className="text-amber-500">Users will not receive any in-app notifications. The notification bell and menu will be hidden.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Allow LO CI Toggle */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-start space-x-4">
                        <div className="p-2 bg-teal-100 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-teal-600">
                                <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <label className="text-base font-semibold text-gray-900">
                                Allow LO to Conduct CI Investigations
                            </label>
                            <p className="text-sm text-gray-500 mt-1">
                                When enabled, Loan Officers can access the CI Investigation page
                                and conduct field investigations. By default, only Branch Managers
                                and above are allowed.
                            </p>
                            {values.allowLoCI && (
                                <div className="mt-2 flex items-start gap-2 text-amber-600
                                    bg-amber-50 p-2 rounded-lg text-xs">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none"
                                        viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
                                        className="h-4 w-4 flex-shrink-0 mt-0.5">
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                                    </svg>
                                    <span>
                                        LOs will only see applications for their assigned branch.
                                        Ensure this is agreed upon with management before enabling.
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Root-only toggle */}
                    {currentUser?.root ? (
                        <button
                            type="button"
                            onClick={() => setFieldValue('allowLoCI', !values.allowLoCI)}
                            className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer
                                rounded-full border-2 border-transparent transition-colors duration-200
                                ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-600
                                focus:ring-offset-2 ${values.allowLoCI ? 'bg-teal-600' : 'bg-gray-200'}`}
                        >
                            <span className={`pointer-events-none inline-block h-6 w-6 transform
                                rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                                ${values.allowLoCI ? 'translate-x-7' : 'translate-x-0'}`} />
                        </button>
                    ) : (
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            values.allowLoCI
                                ? 'bg-teal-100 text-teal-700'
                                : 'bg-gray-100 text-gray-500'
                        }`}>
                            {values.allowLoCI ? 'Enabled' : 'Disabled'}
                        </span>
                    )}
                </div>
            </div>

            {/* Require Client Biometric Toggle */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-start space-x-4">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-purple-600">
                                <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <label className="text-base font-semibold text-gray-900">
                                Require Client Biometric Verification
                            </label>
                            <p className="text-sm text-gray-500 mt-1">
                                When enabled, clients must register their fingerprint or Face ID
                                during the loan application process, and verify at disbursement.
                                Disable for branches where client devices do not support biometrics.
                            </p>
                            {!values.requireClientBiometric && (
                                <div className="mt-2 flex items-start gap-2 p-2 bg-amber-50
                                    rounded-lg text-xs text-amber-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none"
                                        viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
                                        className="h-4 w-4 flex-shrink-0 mt-0.5">
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                                    </svg>
                                    <span>
                                        Biometric step will be hidden in LAF form and skipped
                                        during disbursement confirmation.
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    {currentUser?.root ? (
                        <button
                            type="button"
                            onClick={() => setFieldValue('requireClientBiometric', !values.requireClientBiometric)}
                            className={`ml-4 relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer
                                rounded-full border-2 border-transparent transition-colors duration-200
                                ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-600
                                focus:ring-offset-2 ${values.requireClientBiometric ? 'bg-purple-600' : 'bg-gray-200'}`}
                        >
                            <span className={`pointer-events-none inline-block h-6 w-6 transform
                                rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                                ${values.requireClientBiometric ? 'translate-x-7' : 'translate-x-0'}`} />
                        </button>
                    ) : (
                        <span className={`ml-4 flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${
                            values.requireClientBiometric
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-100 text-gray-500'
                        }`}>
                            {values.requireClientBiometric ? 'Required' : 'Optional'}
                        </span>
                    )}
                </div>
            </div>
            
            {/* Placeholder for future features */}
            <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300 opacity-60">
                <div className="flex items-center justify-between">
                    <div className="flex items-start space-x-4">
                        <div className="p-2 bg-gray-200 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-gray-400">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <label className="text-base font-semibold text-gray-400">
                                More Features Coming Soon
                            </label>
                            <p className="text-sm text-gray-400 mt-1">
                                Additional feature toggles will be added here in future updates.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const ProfileSettingsPage = (props) => {
    const currentUser = useSelector(state => state.user.data);
    // Use the correct Redux state path from the screenshot: systemSettings.data
    const state = useSelector(state => state.systemSettings?.data || {});
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);

    const initialValues = {
        companyName: state.companyName || '', 
        companyAddress: state.companyAddress || '', 
        companyEmail: state.companyEmail || '',
        companyPhoneNumber: state.companyPhoneNumber || '',
        branchCode: state.branchCode || '',
        branchName: state.branchName || '',
        branchAddress: state.branchAddress || '',
        branchPhoneNumber: state.branchPhoneNumber || '',
        superPwd: state.superPwd || '',
        enableNotifications: state.enableNotifications ?? false,
        allowLoCI: state.allowLoCI ?? false,
        requireClientBiometric:  state.requireClientBiometric  ?? true,
    }

    const validationSchema = yup.object().shape({
        // companyName: yup.string().required('Company name is required'),
        // companyEmail: yup.string().email('Invalid email format').required('Company email is required'),
        // companyPhoneNumber: yup.string().required('Company phone number is required'),
        // branchCode: yup.string().required('Branch code is required'),
        // branchName: yup.string().required('Branch name is required'),
        superPwd: yup.string()
    });

    const fetchSystemSettings = async () => {
        setLoading(true);
        try {
            const apiURL = `${getApiBaseUrl()}settings/system`;
            const response = await fetchWrapper.get(apiURL);
            
            if (response.success && response.system) {
                // The API returns data under 'system' key, not 'data'
                dispatch(setSystemSettings(response.system));
                console.log('Dispatched to Redux:', response.system); // Debug log
            } else if (response.error) {
                toast.error(response.message || 'Failed to load system settings');
            }
        } catch (error) {
            console.error('Error fetching system settings:', error);
            toast.error('Failed to load system settings');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (values, action) => {
        setLoading(true);
        try {
            const updatedValues = {...values, _id: state._id};
            const apiURL = `${getApiBaseUrl()}settings/system`;
            const response = await fetchWrapper.post(apiURL, updatedValues);

            if (response.success) {
                dispatch(setSystemSettings(response.system || { ...state, ...values }));
                setSaved(true);
                toast.success('System Profile updated successfully!');
                setTimeout(() => setSaved(false), 3000);
            } else {
                toast.error(response.message || 'Failed to update system profile');
            }
        } catch (error) {
            console.error('Update error:', error);
            toast.error('Failed to update system profile');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (currentUser.role && currentUser.role.rep > 2) {
            router.push('/');
            return;
        }
        
        console.log('Current Redux State:', state); // Debug log
        
        // Always fetch system settings since Redux state shows empty data
        fetchSystemSettings();
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Spinner />
                </div>
            ) : (
                <Formik 
                    initialValues={initialValues} 
                    validationSchema={validationSchema}
                    onSubmit={handleUpdate}
                    enableReinitialize={true}
                    //key={JSON.stringify(initialValues)} // Force re-render when data changes
                >
                    {({ values, errors, touched, handleChange, handleSubmit, setFieldValue }) => (
                        <form onSubmit={handleSubmit} autoComplete="off" autoCorrect="off" spellCheck="false">
                            {/* Header */}
                            <div className="bg-white border-b border-gray-200 shadow-sm">
                                <div className="max-w-7xl mx-auto px-6 py-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
                                            <p className="text-sm text-gray-600 mt-1">Configure your company and branch information</p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {saved && (
                                                <div className="flex items-center px-3 py-2 bg-green-100 text-green-800 rounded-lg">
                                                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                                                    <span className="text-sm font-medium">Settings saved!</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="max-w-7xl mx-auto px-6 py-8">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Company Information Card */}
                                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                                            <div className="flex items-center">
                                                <BuildingOfficeIcon className="h-6 w-6 text-white mr-3" />
                                                <h2 className="text-xl font-semibold text-white">Company Information</h2>
                                            </div>
                                        </div>
                                        
                                        <div className="p-6 space-y-6">
                                            <ModernInput
                                                name="companyName"
                                                value={values.companyName}
                                                label="Company Name"
                                                placeholder="Enter company name"
                                                icon={BuildingOfficeIcon}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.companyName && errors.companyName}
                                                required
                                            />
                                            
                                            <ModernInput
                                                name="companyAddress"
                                                value={values.companyAddress}
                                                label="Company Address"
                                                placeholder="Enter complete company address"
                                                icon={MapPinIcon}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.companyAddress && errors.companyAddress}
                                            />
                                            
                                            <ModernInput
                                                name="companyEmail"
                                                value={values.companyEmail}
                                                label="Company Email"
                                                placeholder="company@example.com"
                                                icon={EnvelopeIcon}
                                                type="email"
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.companyEmail && errors.companyEmail}
                                            />
                                            
                                            <ModernInput
                                                name="companyPhoneNumber"
                                                value={values.companyPhoneNumber}
                                                label="Company Phone Number"
                                                placeholder="+63 XXX XXXX XXXX"
                                                icon={PhoneIcon}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.companyPhoneNumber && errors.companyPhoneNumber}
                                            />
                                            
                                            <ModernInput
                                                name="superPwd"
                                                value={values.superPwd}
                                                label="Super Password"
                                                placeholder="Enter super password"
                                                icon={ShieldCheckIcon}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.superPwd && errors.superPwd}
                                                isPassword={true}
                                            />
                                        </div>
                                    </div>

                                    {/* Branch Information Card */}
                                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4">
                                            <div className="flex items-center">
                                                <BuildingStorefrontIcon className="h-6 w-6 text-white mr-3" />
                                                <h2 className="text-xl font-semibold text-white">Branch Information</h2>
                                            </div>
                                        </div>
                                        
                                        <div className="p-6 space-y-6">
                                            <ModernInput
                                                name="branchCode"
                                                value={values.branchCode}
                                                label="Branch Code"
                                                placeholder="Enter branch code"
                                                icon={CodeBracketIcon}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.branchCode && errors.branchCode}
                                            />
                                            
                                            <ModernInput
                                                name="branchName"
                                                value={values.branchName}
                                                label="Branch Name"
                                                placeholder="Enter branch name"
                                                icon={BuildingStorefrontIcon}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.branchName && errors.branchName}
                                            />
                                            
                                            <ModernInput
                                                name="branchAddress"
                                                value={values.branchAddress}
                                                label="Branch Address"
                                                placeholder="Enter complete branch address"
                                                icon={MapPinIcon}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.branchAddress && errors.branchAddress}
                                            />
                                            
                                            <ModernInput
                                                name="branchPhoneNumber"
                                                value={values.branchPhoneNumber}
                                                label="Branch Phone Number"
                                                placeholder="+63 XXX XXXX XXXX"
                                                icon={PhoneIcon}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.branchPhoneNumber && errors.branchPhoneNumber}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8">
                                    <FeatureEnablementCard values={values} setFieldValue={setFieldValue} currentUser={currentUser} />
                                </div>

                                {/* Action Buttons */}
                                <div className="mt-8 flex justify-end space-x-4">
                                    <button
                                        type="button"
                                        className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200"
                                    >
                                        Cancel
                                    </button>
                                    
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
                                    >
                                        {loading ? (
                                            <div className="flex items-center">
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Updating...
                                            </div>
                                        ) : (
                                            'Update Settings'
                                        )}
                                    </button>
                                </div>

                                {/* Info Banner */}
                                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4">
                                    <div className="flex items-start">
                                        <ExclamationTriangleIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                                        <div>
                                            <h3 className="text-sm font-semibold text-blue-900">Important Notice</h3>
                                            <p className="text-sm text-blue-700 mt-1">
                                                Changes to company and branch information will affect all system-generated documents and reports. 
                                                Please ensure all information is accurate before saving.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    )}
                </Formik>
            )}
        </div>
    );
}

export default ProfileSettingsPage;