import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import { ArrowLeftCircleIcon } from '@heroicons/react/24/solid';
import React from "react";

const DetailsHeaderGroupMain = ({ page }) => {
    const router = useRouter();
    const branch = useSelector(state => state.branch.data);
    const selectedLO = useSelector(state => state.user.selectedLO);

    const statusClass = {
        'available': "text-green-700 bg-green-100",
        'full': "text-red-400 bg-red-100",
        'open': "text-green-700 bg-green-100",
        'close': "text-red-400 bg-red-100"
    }

    const handleBack = () => {
        router.back();
    }

    return (
        <div className="bg-white px-7 py-2 fixed w-screen z-10">
            {page === 'users' && (
                <React.Fragment>
                    {branch && (
                        <div className="py-2 proxima-regular">
                            <div className="flex flex-row alternate-gothic text-2xl">
                                <span><ArrowLeftCircleIcon className="w-5 h-5 mr-6 cursor-pointer" title="Back" onClick={handleBack} /></span>
                                <span>{branch.name}</span>
                            </div>
                            <div className="flex justify-between w-11/12">
                                <div className="flex flex-row justify-items-start space-x-5 py-4" style={{ height: '40px' }}>
                                    <div className="space-x-2 flex items-center">
                                        <span className="text-gray-400 text-sm">Code:</span>
                                        <span className="text-sm">{branch.code}</span>
                                    </div>
                                    <div className="space-x-2 flex items-center ">
                                        <span className="text-gray-400 text-sm">Phone Number:</span >
                                        <span className="text-sm">{branch.phoneNumber}</span>
                                    </div>
                                    <div className="space-x-2 flex items-center ">
                                        <span className="text-gray-400 text-sm">Address:</span >
                                        <span className="text-sm">{branch.address}</span>
                                    </div>
                                    <div className="space-x-2 flex items-center ">
                                        <span className="text-gray-400 text-sm">Email:</span >
                                        <span className="text-sm">{branch.email}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </React.Fragment>
            )}
            {page === 'groups' && (
                <React.Fragment>
                    {selectedLO && (
                        <div className="py-2 proxima-regular">
                            <div className="flex flex-row alternate-gothic text-2xl">
                                <span><ArrowLeftCircleIcon className="w-5 h-5 mr-6 cursor-pointer" title="Back" onClick={handleBack} /></span>
                                <span>{`${selectedLO.lastName}, ${selectedLO.firstName}`}</span>
                            </div>
                            <div className="flex justify-between w-11/12">
                                <div className="flex flex-row justify-items-start space-x-5 py-4" style={{ height: '40px' }}>
                                    <div className="space-x-2 flex items-center">
                                        <span className="text-gray-400 text-sm">Email:</span>
                                        <span className="text-sm">{selectedLO.email}</span>
                                    </div>
                                    <div className="space-x-2 flex items-center ">
                                        <span className="text-gray-400 text-sm">Phone Number:</span >
                                        <span className="text-sm">{selectedLO.number}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </React.Fragment>
            )}
        </div>
    );
}

export default DetailsHeaderGroupMain;