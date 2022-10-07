import Breadcrumbs from "@/components/Breadcrumbs";
import { useDispatch, useSelector } from 'react-redux';
import { UppercaseFirstLetter } from "@/lib/utils";
import ButtonSolid from "@/lib/ui/ButtonSolid";

const DetailsHeader = ({ page, handleSaveUpdate }) => {
    const group = useSelector(state => state.group.data);

    const statusClass = {
        'available': "text-green-700 bg-green-100",
        'full': "text-red-400 bg-red-100"
    }

    return (
        <div className="bg-white px-7 py-2 fixed w-screen z-10">
            <div className="flex flex-row justify-between w-11/12">
                <Breadcrumbs />
            </div>
            {group && (
                <div className="py-2 proxima-regular">
                    <div className="alternate-gothic text-2xl">
                        {group.name}
                    </div>
                    <div className="flex justify-between w-11/12">
                        <div className="flex flex-row justify-items-start space-x-5 py-4" style={{ height: '40px' }}>
                            <div className="space-x-2 flex items-center">
                                <span className="text-gray-400 text-sm">Branch Name:</span>
                                <span className="text-sm">{group.branchName}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Day:</span >
                                <span className="text-sm">{UppercaseFirstLetter(group.day)}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Day No.:</span >
                                <span className="text-sm">{group.dayNo}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Time:</span >
                                <span className="text-sm">{group.time}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Group No.:</span >
                                <span className="text-sm">{group.groupNo}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Loan Officer:</span >
                                <span className="text-sm">{group.loanOfficerName}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">No. of Clients:</span >
                                <span className="text-sm">{group.noOfClients}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Status:</span >
                                <span className={`text-sm status-pill ${statusClass[group.status]}`}>{UppercaseFirstLetter(group.status)}</span>
                            </div>
                            {page === 'transaction' && (
                                <div className="space-x-2 flex items-center ">
                                    <ButtonSolid label="Submit Collection" onClick={handleSaveUpdate} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DetailsHeader;