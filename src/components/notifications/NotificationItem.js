// ============================================
// FILE: src/components/notifications/NotificationItem.js
// ============================================

import React from 'react';
import moment from 'moment-timezone';
import {
    UserPlusIcon,
    BanknotesIcon,
    ArrowPathIcon,
    ArrowsRightLeftIcon,
    CurrencyDollarIcon,
    UserGroupIcon,
    DocumentTextIcon,
    CheckCircleIcon,
    XCircleIcon,
    ArrowRightOnRectangleIcon,
    ClipboardDocumentCheckIcon,
    ExclamationTriangleIcon,
    BuildingOfficeIcon,
    LockClosedIcon,
    ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';

const TIMEZONE = 'Asia/Manila';

// Icon mapping based on notification type
const getNotificationIcon = (type) => {
    switch (type) {
        case 'prospect_client_created':
            return { icon: UserPlusIcon, color: 'bg-green-100 text-green-600' };
        case 'loan_created':
            return { icon: BanknotesIcon, color: 'bg-blue-100 text-blue-600' };
        case 'reloan_created':
            return { icon: ArrowPathIcon, color: 'bg-purple-100 text-purple-600' };
        case 'loan_approved':
            return { icon: CheckCircleIcon, color: 'bg-green-100 text-green-600' };
        case 'loan_rejected':
            return { icon: XCircleIcon, color: 'bg-red-100 text-red-600' };
        case 'loan_offset':
            return { icon: ArrowsRightLeftIcon, color: 'bg-orange-100 text-orange-600' };
        case 'mcbu_withdrawal':
            return { icon: CurrencyDollarIcon, color: 'bg-yellow-100 text-yellow-600' };
        case 'csf_withdrawal':
            return { icon: CurrencyDollarIcon, color: 'bg-amber-100 text-amber-600' };
        case 'mcbu_withdrawal_approved':
            return { icon: CheckCircleIcon, color: 'bg-green-100 text-green-600' };
        case 'mcbu_withdrawal_rejected':
            return { icon: XCircleIcon, color: 'bg-red-100 text-red-600' };
        case 'group_leader_updated':
            return { icon: UserGroupIcon, color: 'bg-indigo-100 text-indigo-600' };
        case 'client_delinquent_marked':
            return { icon: ExclamationTriangleIcon, color: 'bg-red-100 text-red-600' };
        case 'denomination_created':
            return { icon: DocumentTextIcon, color: 'bg-teal-100 text-teal-600' };
        case 'denomination_approved':
            return { icon: CheckCircleIcon, color: 'bg-green-100 text-green-600' };
        case 'denomination_rejected':
            return { icon: XCircleIcon, color: 'bg-red-100 text-red-600' };
        case 'transfer_client':
            return { icon: ArrowRightOnRectangleIcon, color: 'bg-cyan-100 text-cyan-600' };
        case 'transfer_client_approved':
            return { icon: CheckCircleIcon, color: 'bg-green-100 text-green-600' };
        case 'transfer_client_rejected':
            return { icon: XCircleIcon, color: 'bg-red-100 text-red-600' };
        case 'fund_transfer_approved':
            return { icon: ArrowTrendingUpIcon, color: 'bg-green-100 text-green-600' };
        case 'fund_transfer_rejected':
            return { icon: XCircleIcon, color: 'bg-red-100 text-red-600' };
        case 'cash_collection_saved':
            return { icon: ClipboardDocumentCheckIcon, color: 'bg-emerald-100 text-emerald-600' };
        case 'transaction_closed':
            return { icon: LockClosedIcon, color: 'bg-slate-100 text-slate-600' };
        case 'branch_transaction_approved':
            return { icon: BuildingOfficeIcon, color: 'bg-green-100 text-green-600' };
        default:
            return { icon: BanknotesIcon, color: 'bg-gray-100 text-gray-600' };
    }
};

// Format relative time
const formatTime = (dateString) => {
    if (!dateString) return 'Unknown';
    
    const date = moment.tz(dateString, TIMEZONE);
    const now = moment().tz(TIMEZONE);
    const diffMinutes = now.diff(date, 'minutes');
    const diffHours = now.diff(date, 'hours');
    const diffDays = now.diff(date, 'days');

    if (diffMinutes < 1) {
        return 'Just now';
    } else if (diffMinutes < 60) {
        return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
        return `${diffHours}h ago`;
    } else if (diffDays < 7) {
        return `${diffDays}d ago`;
    } else {
        return date.format('MMM D, YYYY');
    }
};

const NotificationItem = ({ 
    notification, 
    onClick, 
    compact = false,
    showFullDate = false 
}) => {
    // Guard against null/undefined notification
    if (!notification) {
        return null;
    }

    const { icon: Icon, color } = getNotificationIcon(notification.type);
    const timeDisplay = showFullDate 
        ? moment.tz(notification.date_added, TIMEZONE).format('MMM D, YYYY h:mm A')
        : formatTime(notification.date_added);

    if (compact) {
        return (
            <div
                onClick={onClick}
                className={`flex items-start px-4 py-3 cursor-pointer transition-colors duration-200 ${
                    notification.is_read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50 hover:bg-blue-100'
                }`}
            >
                {/* Icon */}
                <div className={`flex-shrink-0 p-2 rounded-full ${color}`}>
                    <Icon className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="ml-3 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium truncate ${
                            notification.is_read ? 'text-gray-700' : 'text-gray-900'
                        }`}>
                            {notification.title || 'Notification'}
                        </p>
                        {!notification.is_read && (
                            <span className="ml-2 flex-shrink-0 h-2 w-2 bg-blue-600 rounded-full"></span>
                        )}
                    </div>
                    <p className={`text-sm truncate ${
                        notification.is_read ? 'text-gray-500' : 'text-gray-600'
                    }`}>
                        {notification.message || 'No message'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        {timeDisplay}
                        {notification.created_by_name && (
                            <span className="ml-2">by {notification.created_by_name}</span>
                        )}
                    </p>
                </div>
            </div>
        );
    }

    // Full view for notifications page
    return (
        <div
            onClick={onClick}
            className={`flex items-start p-4 cursor-pointer transition-all duration-200 ${
                notification.is_read 
                    ? 'bg-white hover:bg-gray-50' 
                    : 'bg-blue-50 hover:bg-blue-100'
            }`}
        >
            {/* Icon */}
            <div className={`flex-shrink-0 p-3 rounded-full ${color}`}>
                <Icon className="h-6 w-6" />
            </div>

            {/* Content */}
            <div className="ml-4 flex-1">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <p className={`text-base font-semibold ${
                            notification.is_read ? 'text-gray-700' : 'text-gray-900'
                        }`}>
                            {notification.title || 'Notification'}
                        </p>
                        <p className={`text-sm mt-1 ${
                            notification.is_read ? 'text-gray-500' : 'text-gray-600'
                        }`}>
                            {notification.message || 'No message'}
                        </p>
                    </div>
                    {!notification.is_read && (
                        <span className="flex-shrink-0 ml-4 px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded-full">
                            New
                        </span>
                    )}
                </div>
                
                <div className="flex items-center mt-2 text-xs text-gray-400">
                    <span>{timeDisplay}</span>
                    {notification.created_by_name && (
                        <>
                            <span className="mx-2">•</span>
                            <span>by {notification.created_by_name}</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationItem;