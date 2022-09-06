import { useEffect } from "react";
import { useSelector } from "react-redux";
import NavComponent from "./Nav";

const Layout = ({ children, bgwhite = false, header = true, noPad = false, actionButtons = [] }) => {
    const state = useSelector(state => state.global);
    const pageTitle = state.title;

    return (
        <div className="flex bg-white">
            <NavComponent />
            <div className={`ml-[18rem] flex flex-col bg-neutral-200 duration-300 w-screen overflow-x-auto h-screen`}>
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