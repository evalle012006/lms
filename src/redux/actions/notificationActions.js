// ============================================
// FILE: src/redux/actions/notificationActions.js
// ============================================

import { fetchWrapper } from '@/lib/fetch-wrapper';

// Action Types
export const NOTIFICATION_ACTIONS = {
    SET_NOTIFICATIONS: 'SET_NOTIFICATIONS',
    ADD_NOTIFICATION: 'ADD_NOTIFICATION',
    SET_UNREAD_COUNT: 'SET_UNREAD_COUNT',
    MARK_AS_READ: 'MARK_AS_READ',
    MARK_ALL_AS_READ: 'MARK_ALL_AS_READ',
    SET_LOADING: 'SET_NOTIFICATIONS_LOADING',
    SET_ERROR: 'SET_NOTIFICATIONS_ERROR',
    CLEAR_NOTIFICATIONS: 'CLEAR_NOTIFICATIONS',
    SET_TOTAL: 'SET_NOTIFICATIONS_TOTAL',
    APPEND_NOTIFICATIONS: 'APPEND_NOTIFICATIONS'
};

// Action Creators
export const setNotifications = (notifications) => {
    console.log('Action: SET_NOTIFICATIONS', notifications);
    return {
        type: NOTIFICATION_ACTIONS.SET_NOTIFICATIONS,
        payload: notifications
    };
};

export const appendNotifications = (notifications) => {
    console.log('Action: APPEND_NOTIFICATIONS', notifications);
    return {
        type: NOTIFICATION_ACTIONS.APPEND_NOTIFICATIONS,
        payload: notifications
    };
};

export const addNotification = (notification) => ({
    type: NOTIFICATION_ACTIONS.ADD_NOTIFICATION,
    payload: notification
});

export const setUnreadCount = (count) => {
    console.log('Action: SET_UNREAD_COUNT', count);
    return {
        type: NOTIFICATION_ACTIONS.SET_UNREAD_COUNT,
        payload: count
    };
};

export const setNotificationsLoading = (loading) => ({
    type: NOTIFICATION_ACTIONS.SET_LOADING,
    payload: loading
});

export const setNotificationsError = (error) => ({
    type: NOTIFICATION_ACTIONS.SET_ERROR,
    payload: error
});

export const setNotificationsTotal = (total) => {
    console.log('Action: SET_TOTAL', total);
    return {
        type: NOTIFICATION_ACTIONS.SET_TOTAL,
        payload: total
    };
};

export const clearNotifications = () => ({
    type: NOTIFICATION_ACTIONS.CLEAR_NOTIFICATIONS
});

// Thunk Actions

/**
 * Fetch notifications based on user role
 */
export const fetchNotifications = ({
    limit = 10,
    offset = 0,
    unreadOnly = false,
    append = false
}) => async (dispatch, getState) => {
    try {
        dispatch(setNotificationsLoading(true));
        dispatch(setNotificationsError(null));

        const { user } = getState();
        const currentUser = user?.data;

        // console.log('fetchNotifications: currentUser', currentUser);

        if (!currentUser) {
            console.log('fetchNotifications: No current user, aborting');
            dispatch(setNotificationsLoading(false));
            return;
        }

        const queryParams = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
            unreadOnly: unreadOnly.toString(),
            userRole: JSON.stringify(currentUser.role),
            userId: currentUser._id,
            branchId: currentUser.designatedBranchId || '',
            areaId: currentUser.areaId || '',
            regionId: currentUser.regionId || '',
            divisionId: currentUser.divisionId || ''
        });

        // console.log('fetchNotifications: Making API call with params', queryParams.toString());

        const response = await fetchWrapper.get(`/api/v2/notifications/list?${queryParams}`);

        console.log('fetchNotifications: API Response', response);

        if (response.success) {
            // console.log('fetchNotifications: Success! Dispatching actions...');
            // console.log('  - notifications:', response.notifications);
            // console.log('  - unreadCount:', response.unreadCount);
            // console.log('  - total:', response.total);
            
            if (append) {
                dispatch(appendNotifications(response.notifications || []));
            } else {
                dispatch(setNotifications(response.notifications || []));
            }
            dispatch(setUnreadCount(response.unreadCount || 0));
            dispatch(setNotificationsTotal(response.total || 0));
            
            // console.log('fetchNotifications: Actions dispatched');
        } else {
            // console.log('fetchNotifications: API returned success=false', response.message);
            dispatch(setNotificationsError(response.message || 'Failed to fetch notifications'));
        }

    } catch (error) {
        console.error('fetchNotifications: Error', error);
        dispatch(setNotificationsError('Failed to fetch notifications'));
    } finally {
        dispatch(setNotificationsLoading(false));
    }
};

/**
 * Fetch unread count only (for badge)
 */
export const fetchUnreadCount = () => async (dispatch, getState) => {
    try {
        const { user } = getState();
        const currentUser = user?.data;

        if (!currentUser) {
            // console.log('fetchUnreadCount: No current user');
            return;
        }

        const queryParams = new URLSearchParams({
            limit: '1',
            offset: '0',
            unreadOnly: 'true',
            userRole: JSON.stringify(currentUser.role),
            userId: currentUser._id,
            branchId: currentUser.designatedBranchId || '',
            areaId: currentUser.areaId || '',
            regionId: currentUser.regionId || '',
            divisionId: currentUser.divisionId || ''
        });

        // console.log('fetchUnreadCount: Making API call');

        const response = await fetchWrapper.get(`/api/v2/notifications/list?${queryParams}`);

        // console.log('fetchUnreadCount: Response', response);

        if (response.success) {
            dispatch(setUnreadCount(response.unreadCount || 0));
        }

    } catch (error) {
        console.error('fetchUnreadCount: Error', error);
    }
};

/**
 * Mark notification(s) as read
 */
export const markNotificationAsRead = (notificationIds) => async (dispatch, getState) => {
    try {
        const { user } = getState();
        const currentUser = user?.data;

        if (!currentUser) return;

        const response = await fetchWrapper.post('/api/v2/notifications/mark-read', {
            notificationIds,
            userId: currentUser._id
        });

        if (response.success) {
            // Update local state
            dispatch({
                type: NOTIFICATION_ACTIONS.MARK_AS_READ,
                payload: Array.isArray(notificationIds) ? notificationIds : [notificationIds]
            });
            
            // Refresh unread count
            dispatch(fetchUnreadCount());
        }

        return response;

    } catch (error) {
        console.error('Error marking notification as read:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = () => async (dispatch, getState) => {
    try {
        const { user } = getState();
        const currentUser = user?.data;

        if (!currentUser) return;

        const response = await fetchWrapper.post('/api/v2/notifications/mark-read', {
            markAll: true,
            userId: currentUser._id,
            userRole: currentUser.role,
            branchId: currentUser.designatedBranchId || '',
            areaId: currentUser.areaId || '',
            regionId: currentUser.regionId || '',
            divisionId: currentUser.divisionId || ''
        });

        if (response.success) {
            dispatch({
                type: NOTIFICATION_ACTIONS.MARK_ALL_AS_READ
            });
            dispatch(setUnreadCount(0));
        }

        return response;

    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        return { success: false, error: error.message };
    }
};