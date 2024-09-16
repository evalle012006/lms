import { getApiBaseUrl } from "@/lib/constants";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { resetState } from "@/redux/actions/resetActions";
import { userService } from "@/services/user-service";
import { useDispatch } from "react-redux";

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

            localStorage.clear();
            dispatch(resetState());

            window.location.href = '/login';
        }
    }

    handleLogout();
}

export default LogoutPage;