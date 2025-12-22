/**
 * SaveProgressModal - A modern, reusable progress modal component
 * 
 * Usage:
 * import SaveProgressModal from '@/components/common/SaveProgressModal';
 * 
 * <SaveProgressModal
 *   isOpen={isSaving}
 *   title="Saving Transaction"
 *   message="Processing payment collections..."
 *   progress={75}
 *   currentStep={3}
 *   totalSteps={4}
 *   steps={['Validating', 'Processing', 'Updating', 'Verifying']}
 *   retryCount={1}
 *   maxRetries={3}
 *   variant="spinner" // or "progress" or "steps"
 * />
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

const SaveProgressModal = ({
    isOpen = false,
    title = 'Saving...',
    message = 'Please wait while we process your request.',
    progress = null, // 0-100 for progress bar
    currentStep = null,
    totalSteps = null,
    steps = [], // Array of step names
    retryCount = 0,
    maxRetries = 3,
    variant = 'spinner', // 'spinner' | 'progress' | 'steps'
    status = 'loading', // 'loading' | 'success' | 'error'
    onCancel = null, // Optional cancel handler
    allowClose = false,
    estimatedTime = null, // Optional: "About 10 seconds"
    subMessage = null, // Optional secondary message
}) => {
    const [dots, setDots] = useState('');
    const [elapsedTime, setElapsedTime] = useState(0);

    // Animated dots for loading state
    useEffect(() => {
        if (!isOpen || status !== 'loading') return;
        
        const interval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '' : prev + '.');
        }, 500);
        
        return () => clearInterval(interval);
    }, [isOpen, status]);

    // Elapsed time counter
    useEffect(() => {
        if (!isOpen || status !== 'loading') {
            setElapsedTime(0);
            return;
        }
        
        const interval = setInterval(() => {
            setElapsedTime(prev => prev + 1);
        }, 1000);
        
        return () => clearInterval(interval);
    }, [isOpen, status]);

    const formatTime = (seconds) => {
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={allowClose ? onCancel : undefined}
            />
            
            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                    {/* Gradient Top Border */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                    
                    {/* Content */}
                    <div className="p-8">
                        {/* Icon/Spinner Section */}
                        <div className="flex justify-center mb-6">
                            {status === 'loading' && (
                                <div className="relative">
                                    {/* Outer ring */}
                                    <div className="w-20 h-20 rounded-full border-4 border-gray-100" />
                                    
                                    {/* Spinning gradient ring */}
                                    <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-transparent border-t-blue-500 border-r-indigo-500 animate-spin" />
                                    
                                    {/* Center icon or percentage */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        {progress !== null ? (
                                            <span className="text-xl font-bold text-gray-700">
                                                {Math.round(progress)}%
                                            </span>
                                        ) : (
                                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {status === 'success' && (
                                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center animate-scale-in">
                                    <CheckCircle className="w-10 h-10 text-green-500" />
                                </div>
                            )}
                            
                            {status === 'error' && (
                                <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center animate-scale-in">
                                    <AlertCircle className="w-10 h-10 text-red-500" />
                                </div>
                            )}
                        </div>
                        
                        {/* Title */}
                        <h3 className="text-xl font-semibold text-center text-gray-900 mb-2">
                            {title}{status === 'loading' && dots}
                        </h3>
                        
                        {/* Message */}
                        <p className="text-center text-gray-600 mb-6">
                            {message}
                        </p>
                        
                        {/* Sub Message */}
                        {subMessage && (
                            <p className="text-center text-sm text-gray-500 mb-4">
                                {subMessage}
                            </p>
                        )}
                        
                        {/* Progress Bar Variant */}
                        {variant === 'progress' && progress !== null && (
                            <div className="mb-6">
                                <div className="flex justify-between text-sm text-gray-600 mb-2">
                                    <span>Progress</span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500 ease-out"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                        
                        {/* Steps Variant */}
                        {variant === 'steps' && steps.length > 0 && (
                            <div className="mb-6">
                                <div className="space-y-3">
                                    {steps.map((step, index) => {
                                        const stepNum = index + 1;
                                        const isComplete = currentStep > stepNum;
                                        const isCurrent = currentStep === stepNum;
                                        const isPending = currentStep < stepNum;
                                        
                                        return (
                                            <div 
                                                key={index}
                                                className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                                                    isCurrent 
                                                        ? 'bg-blue-50 border border-blue-200' 
                                                        : isComplete 
                                                        ? 'bg-green-50' 
                                                        : 'bg-gray-50'
                                                }`}
                                            >
                                                {/* Step indicator */}
                                                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                                    isComplete 
                                                        ? 'bg-green-500' 
                                                        : isCurrent 
                                                        ? 'bg-blue-500' 
                                                        : 'bg-gray-300'
                                                }`}>
                                                    {isComplete ? (
                                                        <CheckCircle className="w-5 h-5 text-white" />
                                                    ) : isCurrent ? (
                                                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                                                    ) : (
                                                        <span className="text-sm font-medium text-white">
                                                            {stepNum}
                                                        </span>
                                                    )}
                                                </div>
                                                
                                                {/* Step name */}
                                                <span className={`font-medium ${
                                                    isCurrent 
                                                        ? 'text-blue-700' 
                                                        : isComplete 
                                                        ? 'text-green-700' 
                                                        : 'text-gray-500'
                                                }`}>
                                                    {step}
                                                </span>
                                                
                                                {/* Current step indicator */}
                                                {isCurrent && (
                                                    <div className="ml-auto">
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                                            In Progress
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        
                        {/* Retry Indicator */}
                        {retryCount > 0 && status === 'loading' && (
                            <div className="flex items-center justify-center gap-2 mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                <RefreshCw className="w-4 h-4 text-amber-600 animate-spin" />
                                <span className="text-sm font-medium text-amber-700">
                                    Retry attempt {retryCount} of {maxRetries}
                                </span>
                            </div>
                        )}
                        
                        {/* Time Info */}
                        <div className="flex justify-center gap-6 text-sm text-gray-500">
                            {status === 'loading' && (
                                <span>Elapsed: {formatTime(elapsedTime)}</span>
                            )}
                            {estimatedTime && status === 'loading' && (
                                <span>Est: {estimatedTime}</span>
                            )}
                        </div>
                        
                        {/* Cancel Button (optional) */}
                        {allowClose && onCancel && status === 'loading' && (
                            <div className="mt-6 flex justify-center">
                                <button
                                    onClick={onCancel}
                                    className="px-6 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Custom Animation Styles */}
            <style jsx>{`
                @keyframes scale-in {
                    0% {
                        transform: scale(0);
                        opacity: 0;
                    }
                    100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
                .animate-scale-in {
                    animation: scale-in 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default SaveProgressModal;


/**
 * useSaveProgress Hook - For easier state management
 * 
 * Usage:
 * const { 
 *   isOpen, 
 *   progress, 
 *   showProgress, 
 *   updateProgress, 
 *   hideProgress,
 *   setSuccess,
 *   setError 
 * } = useSaveProgress();
 */
export const useSaveProgress = (initialState = {}) => {
    const [state, setState] = useState({
        isOpen: false,
        title: 'Saving...',
        message: 'Please wait...',
        progress: null,
        currentStep: null,
        totalSteps: null,
        steps: [],
        retryCount: 0,
        maxRetries: 3,
        variant: 'spinner',
        status: 'loading',
        subMessage: null,
        ...initialState
    });

    const showProgress = (options = {}) => {
        setState(prev => ({
            ...prev,
            isOpen: true,
            status: 'loading',
            progress: null,
            currentStep: null,
            retryCount: 0,
            ...options
        }));
    };

    const updateProgress = (options = {}) => {
        setState(prev => ({
            ...prev,
            ...options
        }));
    };

    const hideProgress = (delay = 0) => {
        if (delay > 0) {
            setTimeout(() => {
                setState(prev => ({ ...prev, isOpen: false }));
            }, delay);
        } else {
            setState(prev => ({ ...prev, isOpen: false }));
        }
    };

    const setSuccess = (message = 'Completed successfully!', autoHideDelay = 1500) => {
        setState(prev => ({
            ...prev,
            status: 'success',
            message,
            title: 'Success!'
        }));
        if (autoHideDelay > 0) {
            hideProgress(autoHideDelay);
        }
    };

    const setError = (message = 'An error occurred', autoHideDelay = 0) => {
        setState(prev => ({
            ...prev,
            status: 'error',
            message,
            title: 'Error'
        }));
        if (autoHideDelay > 0) {
            hideProgress(autoHideDelay);
        }
    };

    const setRetry = (retryCount) => {
        setState(prev => ({
            ...prev,
            retryCount
        }));
    };

    return {
        ...state,
        showProgress,
        updateProgress,
        hideProgress,
        setSuccess,
        setError,
        setRetry,
        // Expose the full state for the modal
        modalProps: state
    };
};