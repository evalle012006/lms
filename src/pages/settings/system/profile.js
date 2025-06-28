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
  EyeSlashIcon
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
        superPwd: state.superPwd || ''
    }

    const validationSchema = yup.object().shape({
        companyName: yup.string().required('Company name is required'),
        companyEmail: yup.string().email('Invalid email format').required('Company email is required'),
        companyPhoneNumber: yup.string().required('Company phone number is required'),
        branchCode: yup.string().required('Branch code is required'),
        branchName: yup.string().required('Branch name is required'),
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
                // Update Redux with the new values
                dispatch(setSystemSettings({...values}));
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

    useEffect(() => {
        let mounted = true;
        setLoading(false);

        return () => {
            mounted = false;
        };
    }, [state]);

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
                    key={JSON.stringify(initialValues)} // Force re-render when data changes
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
                                                required
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
                                                required
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
                                                required
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
                                                required
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