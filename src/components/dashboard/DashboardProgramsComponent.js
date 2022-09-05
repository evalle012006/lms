import FilterOptions from "./FilterOptions";
import Image from 'next/image';
import Tag from "@/lib/ui/tag";
import Avatar from "@/lib/avatar";
import moment from "moment";

const DashboardProgramsComponent = ({ programs }) => {
    const imgpath = process.env.NEXT_PUBLIC_LOCAL_HOST !== 'local' && process.env.NEXT_PUBLIC_LOCAL_HOST;
    const label = 'Show';
    const columns = ['client', 'date added', 'collaborators', 'progress', 'status'];

    return programs && (
        <div className="bg-white rounded-lg p-6 mx-4 mb-4 border border-slate-300">
            <div className="flex justify-between items-baseline">
                <div className="alternate-gothic text-xl">Programs</div>
            </div>
            <div className="relative mt-8">
                <div className="flex flex-row overflow-x-auto ">
                    <table className="table-component divide-y-custom">
                        <thead className="border-b table-head table-row-group">
                            <tr>
                                {columns.map((item, key) => {
                                    return (<th scope="col"
                                        key={key}
                                        className="table-cell text-left uppercase text-gray-500 text-xs pb-3">{item}</th>)
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y-custom relative overflow-x-auto ">
                            {programs.map((item, index) => {
                                return (
                                    <tr key={index} className="overflow-x-auto border-b scroll-m-0 flex-wrap">
                                        <td className="pt-3 pb-4 px-2 relative">
                                            <div className="flex flex-row flex-wrap">
                                                <div className="flex flex-col justify-center">
                                                    <Avatar name={item.job.name}
                                                        src={""}
                                                        className="py-2 px-2 text-xs" />
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-base text-gray-800">555 Superfoods</div>
                                                    <div className="text-xs text-gray-400">Hillston Citrus</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{moment(item.dateAdded).format('D MMM YYYY')}</td>
                                        <td>
                                            <div className="flex flex-row">
                                                <div className="flex -space-x-3">
                                                    {item.collaborators.length > 0 && item.collaborators.map((item, index) => {
                                                        return item.profile ? (
                                                            <div key={index}>
                                                                <Image src={`${imgpath}/images/profiles/${item.profile}`} width="24" height="24" className="rounded-full" />
                                                            </div>
                                                        ) : <Avatar key={index} name={`${item.firstName} ${item.lastName}`} size="24" className="p-[1px] text-xs" />
                                                    })}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex flex-row justify-center w-full py-2">
                                                <div className="w-full bg-gray-200 h-2 rounded-full mt-2 mr-3">
                                                    <div className="bg-primary-1 h-2 rounded-full" style={{ width: '1%' }}></div>
                                                </div>
                                                <div className="w-36 align-middle">0%</div>
                                            </div>
                                        </td>
                                        <td>
                                            <Tag status={"inProgress"} label={"In Progress"} />
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
}

export default DashboardProgramsComponent;