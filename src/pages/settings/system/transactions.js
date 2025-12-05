import { Formik } from 'formik';
import * as yup from 'yup';
import React, { useEffect, useRef, useState } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from "react-toastify";
import { setTransactionSettings } from "@/redux/actions/transactionsActions";
import Spinner from '@/components/Spinner';
import { getApiBaseUrl } from '@/lib/constants';
import { 
  ClockIcon, 
  CurrencyDollarIcon, 
  CalendarDaysIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CalculatorIcon,
  ReceiptPercentIcon,
  DocumentCurrencyDollarIcon,
  TrophyIcon,
  ChartBarIcon,
  HeartIcon
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
  errors
}) => (
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
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200 bg-white shadow-sm hover:shadow-md focus:shadow-lg ${
          errors 
            ? 'border-red-300 focus:ring-red-500' 
            : 'border-gray-200 focus:ring-blue-500'
        }`}
      />
    </div>
    {errors && <span className="text-red-400 text-xs font-medium mt-1 block">{errors}</span>}
  </div>
);

const ModernToggle = ({ name, value, label, description, onChange, setFieldValue }) => (
  <div className="flex items-start space-x-4">
    <div className="flex-1">
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label}
      </label>
      {description && (
        <p className="text-sm text-gray-500 mb-2">{description}</p>
      )}
    </div>
    <button
      type="button"
      onClick={() => setFieldValue(name, !value)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        value ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          value ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

const TransactionsSettingsPage = (props) => {
    const currentUser = useSelector(state => state.user.data);
    
    // Use the correct Redux state path from the screenshot: transactionsSettings.data
    const transactionState = useSelector(state => state.transactionsSettings?.data || {});
    
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);

    // Function to fetch transaction settings from API
    const fetchTransactionSettings = async () => {
        try {
            const apiURL = `${getApiBaseUrl()}settings/transactions`;
            const response = await fetchWrapper.get(apiURL);
            
            if (response.success && response.transactions) {
                dispatch(setTransactionSettings(response.transactions));
            } else {
                console.log('No transaction data received from API');
            }
        } catch (error) {
            console.error('Error fetching transaction settings:', error);
        }
    };

    const initialValues = {
        // Loan Limits
        loanDailyLimit: transactionState.loanDailyLimit || '',
        loanWeeklyLimit: transactionState.loanWeeklyLimit || '',
        
        // Rate Settings
        serviceChargeRate: transactionState.serviceChargeRate || '',
        mcbuRate: transactionState.mcbuRate || '',
        lrfRate: transactionState.lrfRate || '',
        mcbuInterestRate: transactionState.mcbuInterestRate || '',  // ADD THIS
        
        // MCBU/CSF Settings
        minDailyMcbuCollection: transactionState.minDailyMcbuCollection || '',
        minWeeklyMcbuCollection: transactionState.minWeeklyMcbuCollection || '',
        minCsfCollection: transactionState.minCsfCollection || '',
        mcbuCsfMCBUForNM: transactionState.mcbuCsfMCBUForNM || '',
        mcbuCsfMinimumBalance: transactionState.mcbuCsfMinimumBalance || '',
        
        // Transaction Rules
        allowWeekendTransaction: transactionState.allowWeekendTransaction || false, 
        startTransactionTime: transactionState.startTransactionTime || '',
        
        // Fee Settings
        admissionFee: transactionState.admissionFee || '',
        cbhbFee: transactionState.cbhbFee || '',
        otherPassbookFee: transactionState.otherPassbookFee || '',
        otherPictureFee: transactionState.otherPictureFee || '',
        addHospitalization: transactionState.addHospitalization || ''
    }

    const validationSchema = yup.object().shape({
        // Loan Limits
        loanDailyLimit: yup.number().positive('Must be a positive number').required('Daily limit is required'),
        loanWeeklyLimit: yup.number().positive('Must be a positive number').required('Weekly limit is required'),
        
        // Rate Settings
        serviceChargeRate: yup.number().min(0, 'Cannot be negative').max(100, 'Cannot exceed 100%').required('Service charge rate is required'),
        mcbuRate: yup.number().min(0, 'Cannot be negative').max(100, 'Cannot exceed 100%').required('MCBU rate is required'),
        lrfRate: yup.number().min(0, 'Cannot be negative').max(100, 'Cannot exceed 100%').required('LRF rate is required'),
        mcbuInterestRate: yup.number().min(0, 'Cannot be negative').required('MCBU Interest Rate is required'),  // ADD THIS
        
        // MCBU/CSF Settings
        minDailyMcbuCollection: yup.number().min(0, 'Cannot be negative').required('Minimum daily MCBU collection is required'),
        minWeeklyMcbuCollection: yup.number().min(0, 'Cannot be negative').required('Minimum weekly MCBU collection is required'),
        minCsfCollection: yup.number().min(0, 'Cannot be negative').required('Minimum CSF collection is required'),
        mcbuCsfMCBUForNM: yup.number().min(0, 'Cannot be negative').required('MCBU for New Members is required'),
        mcbuCsfMinimumBalance: yup.number().min(0, 'Cannot be negative').required('Minimum balance is required'),
        
        // Transaction Rules
        startTransactionTime: yup.string().required('Start transaction time is required'),
        
        // Fee Settings
        admissionFee: yup.number().min(0, 'Cannot be negative').required('Admission fee is required'),
        cbhbFee: yup.number().min(0, 'Cannot be negative').required('CBHB fee is required'),
        otherPassbookFee: yup.number().min(0, 'Cannot be negative').required('Passbook fee is required'),
        otherPictureFee: yup.number().min(0, 'Cannot be negative').required('Picture fee is required'),
        addHospitalization: yup.number().min(0, 'Cannot be negative').required('Hospitalization fee is required')
    });

    const handleUpdate = async (values, action) => {
        setLoading(true);
        try {
            let updatedValues = {...transactionState};
            Object.keys(values).forEach(key => {
                updatedValues[key] = values[key];
            });

            const apiURL = `${getApiBaseUrl()}settings/transactions`;
            const response = await fetchWrapper.post(apiURL, updatedValues);

            if (response.success) {
                // Show success immediately
                setSaved(true);
                toast.success('Transaction Settings updated successfully!');
                setTimeout(() => setSaved(false), 3000);
                
                // Refresh data from API to ensure Redux state is updated
                console.log('Refreshing transaction data from API...');
                await fetchTransactionSettings();
                
            } else {
                toast.error(response.message || 'Failed to update transaction settings');
            }
        } catch (error) {
            console.error('Update error:', error);
            toast.error('Failed to update transaction settings');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if ((currentUser.role && currentUser.role.rep > 2)) {
            router.push('/');
            return;
        }
        
        // If transaction state is empty, try to fetch it
        if (!transactionState || Object.keys(transactionState).length === 0) {
            fetchTransactionSettings();
        }
    }, []);

    useEffect(() => {
        let mounted = true;
        setLoading(false);

        return () => {
            mounted = false;
        };
    }, [transactionState]);

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
                                            <h1 className="text-2xl font-bold text-gray-900">Transaction Settings</h1>
                                            <p className="text-sm text-gray-600 mt-1">Configure transaction limits, rates, fees, and operational rules</p>
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
                                    {/* Loan Limits Card */}
                                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
                                            <div className="flex items-center">
                                                <CurrencyDollarIcon className="h-6 w-6 text-white mr-3" />
                                                <h2 className="text-xl font-semibold text-white">Loan Limits</h2>
                                            </div>
                                        </div>
                                        
                                        <div className="p-6 space-y-6">
                                            <ModernInput
                                                name="loanDailyLimit"
                                                value={values.loanDailyLimit}
                                                label="Daily Loan Limit"
                                                placeholder="Enter daily limit amount"
                                                icon={CurrencyDollarIcon}
                                                type="number"
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.loanDailyLimit && errors.loanDailyLimit}
                                                onWheel={(e) => e.target.blur()}
                                                required
                                            />
                                            
                                            <ModernInput
                                                name="loanWeeklyLimit"
                                                value={values.loanWeeklyLimit}
                                                label="Weekly Loan Limit"
                                                placeholder="Enter weekly limit amount"
                                                icon={BanknotesIcon}
                                                type="number"
                                                onWheel={(e) => e.target.blur()}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.loanWeeklyLimit && errors.loanWeeklyLimit}
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Rate Settings Card */}
                                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                                            <div className="flex items-center">
                                                <CalculatorIcon className="h-6 w-6 text-white mr-3" />
                                                <h2 className="text-xl font-semibold text-white">Rate Settings (%)</h2>
                                            </div>
                                        </div>
                                        
                                        <div className="p-6 space-y-6">
                                            <ModernInput
                                                name="serviceChargeRate"
                                                value={values.serviceChargeRate}
                                                label="Service Charge Rate (%)"
                                                placeholder="Enter service charge rate percentage"
                                                icon={ReceiptPercentIcon}
                                                type="number"
                                                onWheel={(e) => e.target.blur()}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.serviceChargeRate && errors.serviceChargeRate}
                                                required
                                            />
                                            
                                            <ModernInput
                                                name="mcbuRate"
                                                value={values.mcbuRate}
                                                label="MCBU Rate (%)"
                                                placeholder="Enter MCBU rate percentage"
                                                icon={CalculatorIcon}
                                                type="number"
                                                onWheel={(e) => e.target.blur()}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.mcbuRate && errors.mcbuRate}
                                                required
                                            />
                                            
                                            <ModernInput
                                                name="lrfRate"
                                                value={values.lrfRate}
                                                label="LRF Rate (%)"
                                                placeholder="Enter LRF rate percentage"
                                                icon={DocumentCurrencyDollarIcon}
                                                type="number"
                                                onWheel={(e) => e.target.blur()}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.lrfRate && errors.lrfRate}
                                                required
                                            />

                                            <ModernInput
                                                name="mcbuInterestRate"
                                                value={values.mcbuInterestRate}
                                                label="MCBU Interest Rate (Decimal)"
                                                placeholder="e.g., 0.00083"
                                                icon={CalculatorIcon}
                                                type="number"
                                                step="0.00001"  // Allow 5 decimal places
                                                onWheel={(e) => e.target.blur()}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.mcbuInterestRate && errors.mcbuInterestRate}
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Transaction Rules Card */}
                                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4">
                                            <div className="flex items-center">
                                                <ClockIcon className="h-6 w-6 text-white mr-3" />
                                                <h2 className="text-xl font-semibold text-white">Transaction Rules</h2>
                                            </div>
                                        </div>
                                        
                                        <div className="p-6 space-y-6">
                                            <ModernInput
                                                name="startTransactionTime"
                                                value={values.startTransactionTime}
                                                label="Start Transaction Time"
                                                placeholder="e.g., 09:00 AM"
                                                icon={ClockIcon}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.startTransactionTime && errors.startTransactionTime}
                                                required
                                            />
                                            
                                            <div className="p-4 bg-gray-50 rounded-xl">
                                                <ModernToggle
                                                    name="allowWeekendTransaction"
                                                    value={values.allowWeekendTransaction}
                                                    label="Allow Weekend Transactions"
                                                    description="Enable transactions during weekends (Saturday & Sunday)"
                                                    onChange={handleChange}
                                                    setFieldValue={setFieldValue}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* MCBU/CSF Settings Card - Full Width */}
                                <div className="mt-8 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                    <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
                                        <div className="flex items-center">
                                            <ChartBarIcon className="h-6 w-6 text-white mr-3" />
                                            <h2 className="text-xl font-semibold text-white">MCBU/CSF Settings</h2>
                                        </div>
                                    </div>
                                    
                                    <div className="p-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            <ModernInput
                                                name="minDailyMcbuCollection"
                                                value={values.minDailyMcbuCollection}
                                                label="Minimum Daily MCBU Collection"
                                                placeholder="Enter minimum daily MCBU collection"
                                                icon={CurrencyDollarIcon}
                                                type="number"
                                                onWheel={(e) => e.target.blur()}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.minDailyMcbuCollection && errors.minDailyMcbuCollection}
                                                required
                                            />
                                            
                                            <ModernInput
                                                name="minWeeklyMcbuCollection"
                                                value={values.minWeeklyMcbuCollection}
                                                label="Minimum Weekly MCBU Collection"
                                                placeholder="Enter minimum weekly MCBU collection"
                                                icon={BanknotesIcon}
                                                type="number"
                                                onWheel={(e) => e.target.blur()}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.minWeeklyMcbuCollection && errors.minWeeklyMcbuCollection}
                                                required
                                            />
                                            
                                            <ModernInput
                                                name="minCsfCollection"
                                                value={values.minCsfCollection}
                                                label="Minimum CSF Collection"
                                                placeholder="Enter minimum CSF collection"
                                                icon={TrophyIcon}
                                                type="number"
                                                onWheel={(e) => e.target.blur()}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.minCsfCollection && errors.minCsfCollection}
                                                required
                                            />
                                            
                                            <ModernInput
                                                name="mcbuCsfMCBUForNM"
                                                value={values.mcbuCsfMCBUForNM}
                                                label="Minimum MCBU for New Members Group Leader"
                                                placeholder="Enter MCBU amount for new members"
                                                icon={CurrencyDollarIcon}
                                                type="number"
                                                onWheel={(e) => e.target.blur()}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.mcbuCsfMCBUForNM && errors.mcbuCsfMCBUForNM}
                                                required
                                            />
                                            
                                            <ModernInput
                                                name="mcbuCsfMinimumBalance"
                                                value={values.mcbuCsfMinimumBalance}
                                                label="Minimum MCBU Balance FOR Group Leader"
                                                placeholder="Enter minimum balance required"
                                                icon={BanknotesIcon}
                                                type="number"
                                                onWheel={(e) => e.target.blur()}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.mcbuCsfMinimumBalance && errors.mcbuCsfMinimumBalance}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Fee Settings Card - Full Width */}
                                <div className="mt-8 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                    <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-4">
                                        <div className="flex items-center">
                                            <DocumentCurrencyDollarIcon className="h-6 w-6 text-white mr-3" />
                                            <h2 className="text-xl font-semibold text-white">Fee Settings</h2>
                                        </div>
                                    </div>
                                    
                                    <div className="p-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                                            <ModernInput
                                                name="admissionFee"
                                                value={values.admissionFee}
                                                label="Admission Fee"
                                                placeholder="Enter admission fee"
                                                icon={CurrencyDollarIcon}
                                                type="number"
                                                onWheel={(e) => e.target.blur()}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.admissionFee && errors.admissionFee}
                                                required
                                            />
                                            
                                            <ModernInput
                                                name="cbhbFee"
                                                value={values.cbhbFee}
                                                label="CBHB Fee"
                                                placeholder="Enter CBHB fee"
                                                icon={DocumentCurrencyDollarIcon}
                                                type="number"
                                                onWheel={(e) => e.target.blur()}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.cbhbFee && errors.cbhbFee}
                                                required
                                            />
                                            
                                            <ModernInput
                                                name="otherPassbookFee"
                                                value={values.otherPassbookFee}
                                                label="Passbook Fee"
                                                placeholder="Enter passbook fee"
                                                icon={CurrencyDollarIcon}
                                                type="number"
                                                onWheel={(e) => e.target.blur()}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.otherPassbookFee && errors.otherPassbookFee}
                                                required
                                            />
                                            
                                            <ModernInput
                                                name="otherPictureFee"
                                                value={values.otherPictureFee}
                                                label="Picture Fee"
                                                placeholder="Enter picture fee"
                                                icon={CurrencyDollarIcon}
                                                type="number"
                                                onWheel={(e) => e.target.blur()}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.otherPictureFee && errors.otherPictureFee}
                                                required
                                            />
                                            
                                            <ModernInput
                                                name="addHospitalization"
                                                value={values.addHospitalization}
                                                label="Hospitalization Fee"
                                                placeholder="Enter hospitalization fee"
                                                icon={HeartIcon}
                                                type="number"
                                                onWheel={(e) => e.target.blur()}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                errors={touched.addHospitalization && errors.addHospitalization}
                                                required
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
                                        Reset
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
                                <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <div className="flex items-start">
                                        <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
                                        <div>
                                            <h3 className="text-sm font-semibold text-amber-900">Important Notice</h3>
                                            <p className="text-sm text-amber-700 mt-1">
                                                Changes to transaction limits, rates, fees, and rules will affect all users immediately. 
                                                Please ensure all settings are properly configured before saving.
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

export default TransactionsSettingsPage;