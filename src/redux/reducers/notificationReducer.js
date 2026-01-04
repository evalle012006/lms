import { NOTIFICATION_ACTIONS } from '../actions/notificationActions';

const initialState = {
    notifications: [],
    unreadCount: 0,
    total: 0,
    loading: false,
    error: null
};

const notificationReducer = (state = initialState, action) => {
    switch (action.type) {
        case NOTIFICATION_ACTIONS.SET_NOTIFICATIONS:
            return {
                ...state,
                notifications: action.payload || [],
                error: null
            };

        case NOTIFICATION_ACTIONS.APPEND_NOTIFICATIONS:
            return {
                ...state,
                notifications: [...state.notifications, ...(action.payload || [])],
                error: null
            };

        case NOTIFICATION_ACTIONS.ADD_NOTIFICATION:
            return {
                ...state,
                notifications: [action.payload, ...state.notifications],
                unreadCount: state.unreadCount + 1
            };

        case NOTIFICATION_ACTIONS.SET_UNREAD_COUNT:
            return {
                ...state,
                unreadCount: action.payload || 0
            };

        case NOTIFICATION_ACTIONS.SET_TOTAL:
            return {
                ...state,
                total: action.payload || 0
            };

        case NOTIFICATION_ACTIONS.MARK_AS_READ:
            return {
                ...state,
                notifications: state.notifications.map(notification =>
                    action.payload.includes(notification._id)
                        ? { ...notification, is_read: true }
                        : notification
                )
            };

        case NOTIFICATION_ACTIONS.MARK_ALL_AS_READ:
            return {
                ...state,
                notifications: state.notifications.map(notification => ({
                    ...notification,
                    is_read: true
                })),
                unreadCount: 0
            };

        case NOTIFICATION_ACTIONS.SET_LOADING:
            return {
                ...state,
                loading: action.payload
            };

        case NOTIFICATION_ACTIONS.SET_ERROR:
            return {
                ...state,
                error: action.payload
            };

        case NOTIFICATION_ACTIONS.CLEAR_NOTIFICATIONS:
            return initialState;

        default:
            return state;
    }
};

export default notificationReducer;