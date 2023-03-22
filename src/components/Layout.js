import { useEffect } from "react";
import { useSelector, useDispatch } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { setCurrentDate } from '@/redux/actions/systemActions';
import NavComponent from "./Nav";

const Layout = ({ children, bgwhite = false, header = true, noPad = false, actionButtons = [], hScroll = true }) => {
    const state = useSelector(state => state.global);
    const pageTitle = state.title;
    const dispatch = useDispatch();

    const getCurrentDate = async () => {
        const apiURL = `${process.env.NEXT_PUBLIC_API_URL}settings/current-date`;
        const response = await fetchWrapper.get(apiURL);
        if (response.success) {
            dispatch(setCurrentDate(response.currentDate));
        }
    }

    useEffect(() => {
        getCurrentDate();
    }, []);

    return (
        <div className="flex bg-white">
            <NavComponent />
            <div className={`ml-[16rem] flex flex-col bg-neutral-200 duration-300 w-screen h-screen ${hScroll ? 'overflow-x-auto' : 'overflow-hidden'}`}>
                {header && (
                    <div className="bg-white p-6 gap-6 h-20">
                        <div className="flex flex-row justify-between">
                            <div className="page-title">
                                {pageTitle}
                            </div>
                            <div className="flex flex-row">
                                {actionButtons && actionButtons.map((btn, idx) => {
                                    return (
                                        <div key={idx} className="mr-2">
                                            {btn}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
                <div className={`${bgwhite && 'bg-white'}`}>
                    {children}
                </div>
            </div>
        </div>
    );
}

export default Layout;