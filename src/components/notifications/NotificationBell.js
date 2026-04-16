import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/router';
import { BellIcon, CheckIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { BellAlertIcon } from '@heroicons/react/24/solid';
import {
    fetchNotifications,
    fetchUnreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead
} from '@/redux/actions/notificationActions';
import NotificationItem from './NotificationItem';

const NotificationBell = () => {
    const dispatch = useDispatch();
    const router = useRouter();
    const dropdownRef = useRef(null);
    const hasFetchedInitial = useRef(false);
    
    const [isOpen, setIsOpen] = useState(false);

    // Check if notifications are enabled from SYSTEM settings (not transaction settings)
    const systemSettings = useSelector(state => state.systemSettings?.data);
    const isNotificationEnabled = systemSettings?.enableNotifications !== false;


    // Support both 'notification' (singular) and 'notifications' (plural) state keys
    const notificationState = useSelector(state => {
        // Debug: log state keys once
        if (!hasFetchedInitial.current) {
            // console.log('NotificationBell - Redux state keys:', Object.keys(state));
        }
        return state.notification || state.notifications || {
            notifications: [],
            unreadCount: 0,
            loading: false
        };
    });
    
    const { notifications = [], unreadCount = 0, loading = false } = notificationState;
    const currentUser = useSelector(state => state.user?.data);

    // Fetch unread count on mount - only once
    useEffect(() => {
        if (currentUser && !hasFetchedInitial.current && isNotificationEnabled) {
            hasFetchedInitial.current = true;
            dispatch(fetchUnreadCount());
        }
    }, [currentUser, dispatch, isNotificationEnabled]);

    // Poll for new notifications every 60 seconds (only if enabled)
    useEffect(() => {
        if (!currentUser || !isNotificationEnabled) return;

        const interval = setInterval(() => {
            dispatch(fetchUnreadCount());
        }, 60000);

        return () => clearInterval(interval);
    }, [currentUser, dispatch, isNotificationEnabled]);

    // Fetch notifications when dropdown opens
    useEffect(() => {
        if (isOpen && currentUser && isNotificationEnabled) {
            dispatch(fetchNotifications({ limit: 10, offset: 0 }));
        }
    }, [isOpen, currentUser, dispatch, isNotificationEnabled]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    const handleNotificationClick = useCallback(async (notification) => {
        // Mark as read
        if (!notification.is_read) {
            await dispatch(markNotificationAsRead(notification._id));
        }

        // Close dropdown
        setIsOpen(false);

        // Navigate based on notification type
        switch (notification.type) {
            case 'prospect_client_created':
            case 'group_leader_updated':
            case 'client_delinquent_marked':
                if (notification.client_id) {
                    router.push(`/clients/${notification.client_id}`);
                } else {
                    router.push('/notifications');
                }
                break;
            case 'loan_created':
            case 'reloan_created':
            case 'loan_offset':
            case 'loan_approved':
            case 'loan_rejected':
                if (notification.loan_id) {
                    router.push(`/loans/${notification.loan_id}`);
                } else {
                    router.push('/notifications');
                }
                break;
            case 'mcbu_withdrawal':
            case 'csf_withdrawal':
            case 'mcbu_withdrawal_approved':
            case 'mcbu_withdrawal_rejected':
                router.push('/transactions/mcbu-withdrawal');
                break;
            case 'denomination_created':
            case 'denomination_approved':
            case 'denomination_rejected':
                router.push('/transactions/denomination');
                break;
            case 'transfer_client':
            case 'transfer_client_approved':
            case 'transfer_client_rejected':
                router.push('/transactions/transfer-client');
                break;
            case 'fund_transfer_approved':
            case 'fund_transfer_rejected':
                router.push('/transactions/fund-transfer');
                break;
            case 'transaction_closed':
            case 'branch_transaction_approved':
                router.push('/transactions/cash-collection');
                break;
            case 'successive_delinquent_transaction':
            case 'delinquent_client_as_reloaner':
                if (notification.client_id) {
                    router.push(`/clients/${notification.client_id}`);
                } else {
                    router.push('/notifications');
                }
                break;
            default:
                router.push('/notifications');
        }
    }, [dispatch, router]);

    const handleMarkAllAsRead = async (e) => {
        e.stopPropagation();
        await dispatch(markAllNotificationsAsRead());
    };

    const handleSeeAll = () => {
        setIsOpen(false);
        router.push('/notifications');
    };

    // Ensure notifications is an array before slicing
    const notificationList = Array.isArray(notifications) ? notifications : [];
    const displayedNotifications = notificationList.slice(0, 10);

    // Don't render if notifications are disabled
    if (!isNotificationEnabled) {
        return null;
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={toggleDropdown}
                className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Notifications"
            >
                {unreadCount > 0 ? (
                    <BellAlertIcon className="h-6 w-6 text-blue-600" />
                ) : (
                    <BellIcon className="h-6 w-6" />
                )}
                
                {/* Badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform bg-red-500 rounded-full min-w-[20px]">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900">
                            Notifications
                            {unreadCount > 0 && (
                                <span className="ml-2 text-xs font-normal text-gray-500">
                                    ({unreadCount} unread)
                                </span>
                            )}
                        </h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllAsRead}
                                className="flex items-center text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                                <CheckIcon className="h-4 w-4 mr-1" />
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* Notification List */}
                    <div className="max-h-96 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            </div>
                        ) : displayedNotifications.length > 0 ? (
                            <div className="divide-y divide-gray-100">
                                {displayedNotifications.map((notification) => (
                                    <NotificationItem
                                        key={notification._id}
                                        notification={notification}
                                        onClick={() => handleNotificationClick(notification)}
                                        compact
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                                <BellIcon className="h-12 w-12 mb-2 text-gray-300" />
                                <p className="text-sm">No notifications yet</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {displayedNotifications.length > 0 && (
                        <div className="border-t border-gray-200">
                            <button
                                onClick={handleSeeAll}
                                className="flex items-center justify-center w-full px-4 py-3 text-sm text-blue-600 hover:bg-gray-50 font-medium transition-colors duration-200"
                            >
                                See all notifications
                                <ArrowRightIcon className="h-4 w-4 ml-1" />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationBell;