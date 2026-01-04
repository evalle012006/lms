// ============================================
// FILE: src/pages/notifications/index.js
// ============================================

import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import NotificationItem from '@/components/notifications/NotificationItem';
import {
    fetchNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead
} from '@/redux/actions/notificationActions';
import { setCurrentPageTitle } from '@/redux/actions/globalActions';
import {
    BellIcon,
    FunnelIcon,
    CheckIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';

const ITEMS_PER_PAGE = 20;

// Filter options
const FILTER_OPTIONS = [
    { value: 'all', label: 'All Notifications' },
    { value: 'unread', label: 'Unread Only' },
    { value: 'prospect_client_created', label: 'New Clients' },
    { value: 'loan_created', label: 'New Loans' },
    { value: 'reloan_created', label: 'Reloans' },
    { value: 'loan_rejected', label: 'Rejected Loans' },
    { value: 'loan_offset', label: 'Offsets' },
    { value: 'mcbu_withdrawal', label: 'MCBU Withdrawals' },
    { value: 'csf_withdrawal', label: 'CSF Withdrawals' },
    { value: 'group_leader_updated', label: 'Group Leader Updates' },
    { value: 'client_delinquent_marked', label: 'Delinquent Status' },
    { value: 'denomination_created', label: 'Denominations Submitted' },
    { value: 'denomination_approved', label: 'Denominations Approved' },
    { value: 'denomination_rejected', label: 'Denominations Rejected' },
    { value: 'transfer_client_approved', label: 'Transfers Approved' },
    { value: 'transfer_client_rejected', label: 'Transfers Rejected' },
    { value: 'fund_transfer_approved', label: 'Fund Transfers Approved' },
    { value: 'fund_transfer_rejected', label: 'Fund Transfers Rejected' },
    { value: 'transaction_closed', label: 'LO Transactions Closed' },
    { value: 'branch_transaction_approved', label: 'Branch Approved' }
];

const NotificationsPage = () => {
    const dispatch = useDispatch();
    const router = useRouter();
    const hasFetched = useRef(false);

    // Check if notifications are enabled from SYSTEM settings (not transaction settings)
    const systemSettings = useSelector(state => state.systemSettings?.data);
    const isNotificationEnabled = systemSettings?.enableNotifications !== false;

    // Support both 'notification' (singular) and 'notifications' (plural) state keys
    const notificationState = useSelector(state => {
        // Debug: log entire state to see what keys exist
        if (!hasFetched.current) {
            console.log('Redux state keys:', Object.keys(state));
        }
        return state.notification || state.notifications || {
            notifications: [],
            unreadCount: 0,
            total: 0,
            loading: false,
            error: null
        };
    });

    const { 
        notifications = [], 
        unreadCount = 0, 
        total = 0, 
        loading = false, 
        error = null 
    } = notificationState;

    const currentUser = useSelector(state => state.user?.data);

    const [filter, setFilter] = useState('all');
    const [offset, setOffset] = useState(ITEMS_PER_PAGE);
    const [hasMore, setHasMore] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Set page title - only once
    useEffect(() => {
        dispatch(setCurrentPageTitle('Notification Center'));
    }, [dispatch]);

    // Initial fetch - only once when user is available
    useEffect(() => {
        if (currentUser && !hasFetched.current && isNotificationEnabled) {
            console.log('NotificationsPage: Initial fetch triggered');
            hasFetched.current = true;
            dispatch(fetchNotifications({
                limit: ITEMS_PER_PAGE,
                offset: 0,
                unreadOnly: false,
                append: false
            }));
        }
    }, [currentUser, dispatch, isNotificationEnabled]);

    // Re-fetch when filter changes
    useEffect(() => {
        if (currentUser && hasFetched.current && isNotificationEnabled) {
            console.log('NotificationsPage: Filter changed to:', filter);
            dispatch(fetchNotifications({
                limit: ITEMS_PER_PAGE,
                offset: 0,
                unreadOnly: filter === 'unread',
                append: false
            }));
            setOffset(ITEMS_PER_PAGE);
        }
    }, [filter, isNotificationEnabled]); // Only depend on filter, not currentUser or dispatch

    // Check if there are more items to load
    useEffect(() => {
        const notificationList = Array.isArray(notifications) ? notifications : [];
        setHasMore(notificationList.length < total);
    }, [notifications, total]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await dispatch(fetchNotifications({
            limit: ITEMS_PER_PAGE,
            offset: 0,
            unreadOnly: filter === 'unread',
            append: false
        }));
        setOffset(ITEMS_PER_PAGE);
        setIsRefreshing(false);
    };

    const handleLoadMore = async () => {
        if (!loading && hasMore) {
            console.log('Loading more notifications, offset:', offset);
            await dispatch(fetchNotifications({
                limit: ITEMS_PER_PAGE,
                offset: offset,
                unreadOnly: filter === 'unread',
                append: true
            }));
            setOffset(prev => prev + ITEMS_PER_PAGE);
        }
    };

    const handleFilterChange = (e) => {
        setFilter(e.target.value);
        setOffset(ITEMS_PER_PAGE);
    };

    const handleMarkAllAsRead = async () => {
        await dispatch(markAllNotificationsAsRead());
    };

    const handleNotificationClick = async (notification) => {
        // Mark as read
        if (!notification.is_read) {
            await dispatch(markNotificationAsRead(notification._id));
        }

        // Navigate based on notification type
        switch (notification.type) {
            case 'prospect_client_created':
            case 'group_leader_updated':
            case 'client_delinquent_marked':
                if (notification.client_id) {
                    router.push(`/clients/${notification.client_id}`);
                }
                break;
            case 'loan_created':
            case 'reloan_created':
            case 'loan_offset':
            case 'loan_approved':
            case 'loan_rejected':
                if (notification.loan_id) {
                    router.push(`/loans/${notification.loan_id}`);
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
            default:
                break;
        }
    };

    // Ensure notifications is an array
    const notificationList = Array.isArray(notifications) ? notifications : [];
    
    // Filter notifications by type if needed
    const filteredNotifications = filter !== 'all' && filter !== 'unread'
        ? notificationList.filter(n => n.type === filter)
        : notificationList;

    return (
        <Layout>
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                                <BellIcon className="h-7 w-7 mr-3 text-blue-600" />
                                Notification Center
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                {unreadCount > 0 
                                    ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                                    : 'All caught up!'
                                }
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Refresh Button */}
                            <button
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                            >
                                <ArrowPathIcon className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>

                            {/* Mark All Read Button */}
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllAsRead}
                                    className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                                >
                                    <CheckIcon className="h-4 w-4 mr-1" />
                                    Mark all as read
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filter */}
                    <div className="mt-4 flex items-center gap-2">
                        <FunnelIcon className="h-5 w-5 text-gray-400" />
                        <select
                            value={filter}
                            onChange={handleFilterChange}
                            className="block w-full sm:w-64 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            {FILTER_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Notifications List */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {loading && !isRefreshing && notificationList.length === 0 ? (
                        <div className="flex items-center justify-center py-16">
                            <Spinner />
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-16 text-red-500">
                            <p className="text-sm">{error}</p>
                            <button
                                onClick={handleRefresh}
                                className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                            <BellIcon className="h-16 w-16 mb-4 text-gray-300" />
                            <p className="text-lg font-medium">No notifications</p>
                            <p className="text-sm mt-1">
                                {filter !== 'all' 
                                    ? 'Try adjusting your filter'
                                    : "You're all caught up!"
                                }
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="divide-y divide-gray-100">
                                {filteredNotifications.map((notification) => (
                                    <NotificationItem
                                        key={notification._id}
                                        notification={notification}
                                        onClick={() => handleNotificationClick(notification)}
                                        showFullDate
                                    />
                                ))}
                            </div>

                            {/* Load More Button */}
                            {hasMore && filter === 'all' && (
                                <div className="p-4 border-t border-gray-100">
                                    <button
                                        onClick={handleLoadMore}
                                        disabled={loading}
                                        className="w-full py-3 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors duration-200 disabled:opacity-50"
                                    >
                                        {loading ? (
                                            <span className="flex items-center justify-center">
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                                Loading...
                                            </span>
                                        ) : (
                                            `Load more (${total - notificationList.length} remaining)`
                                        )}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Summary Stats */}
                {notificationList.length > 0 && (
                    <div className="mt-4 text-center text-sm text-gray-500">
                        Showing {filteredNotifications.length} of {total} notification{total !== 1 ? 's' : ''}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default NotificationsPage;