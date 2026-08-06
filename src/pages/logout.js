import { getApiBaseUrl } from "@/lib/constants";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { resetState } from "@/redux/actions/resetActions";
import { userService } from "@/services/user-service";
import { useDispatch } from "react-redux";

// Keys that must survive logout — offline field work data
const PRESERVE_KEYS = [
    'ci_field_cache',
    'ci_investigation_drafts',
];

const LogoutPage = () => {
    const dispatch = useDispatch();

    const handleLogout = async () => {
        let user = userService.userValue;
        if (user && user.hasOwnProperty('user')) {
            user = user.user;
        }

        const url = `${getApiBaseUrl()}authenticate?`;
        const params = { user: user._id };
        const response = await fetchWrapper.get(url + new URLSearchParams(params));

        if (response && response.success && response.query.acknowledged) {

            // Preserve CI offline data before clearing localStorage
            // Investigators may have unsaved drafts or cached apps from field work
            const preserved = {};
            PRESERVE_KEYS.forEach(key => {
                const val = localStorage.getItem(key);
                if (val) preserved[key] = val;
            });

            // Clear everything
            localStorage.clear();

            // Restore preserved keys
            Object.entries(preserved).forEach(([key, val]) => {
                localStorage.setItem(key, val);
            });

            dispatch(resetState());
            window.location.href = '/login';
        }
    };

    handleLogout();
};

export default LogoutPage;