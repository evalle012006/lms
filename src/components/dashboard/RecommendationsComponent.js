import { useEffect, useState } from 'react';
import DashboardGraphChart from "./DashboardGraphChart";
import FilterOptions from "./FilterOptions";
import moment from "moment";

const RecommendationsComponent = ({ testData }) => {
    const label = 'Show';
    const date = moment();
    const keys = { 0: 'daily', 1: 'weekly', 2: 'monthly' };
    const [chartData, setChartData] = useState(null);
    const [labels, setLabels] = useState([]);
    const [currentOption, setCurrentOption] = useState('daily');

    const dateNow = {
        daily: date.dayOfYear(),
        weekly: date.isoWeek(),
        monthly: date.month()
    }

    const handleChange = (key) => {
        setCurrentOption(keys[key]);
    }   

    useEffect(() => {
        let mounted = true;

        const setChartLabels = () => {
            const data = Array(6).fill().map((_, key) => {
                return dateNow[currentOption] - key;
            });

            const dataLabel = data.reverse().map(item => {
                if (currentOption == 'daily') {
                    return moment().dayOfYear(item).format("MMM D");
                }
                if (currentOption == 'weekly') {
                    const s = moment().isoWeek(item).startOf('week').format("M/D");
                    const e = moment().isoWeek(item).endOf('week').format("M/D"); 
                    return `${s} - ${e}`;
                }
                if (currentOption == 'monthly') {
                    return moment().month(item).format("MMM");
                }
            });

            setLabels(dataLabel);
        }

        mounted && setChartLabels();

        return () => {
            mounted = false;
        }
    }, [currentOption]);

    return (
        <div className="bg-white rounded-lg p-4 border w-2/3 border-slate-300">
            <div className="relative">
                <div className="flex justify-between items-baseline">
                    <div className="alternate-gothic text-xl">Recommendations</div>
                    <FilterOptions label={label} onChange={handleChange} />
                </div>
                <div className="text-center">
                    <div className="pt-4 flex items-center justify-center space-x-6 flex-wrap">
                        <div className="flex items-center justify-center space-x-2">
                            <span className="w-2 h-2 bg-primary-1 rounded-full"></span>
                            <span className="text-sm proxima-regular">Created</span>
                        </div>
                        <div className="flex items-center justify-center space-x-2">
                            <span className="w-2 h-2 bg-primary-2 rounded-full"></span>
                            <span className="text-sm proxima-regular">In Progress</span>
                        </div>
                        <div className="flex items-center justify-center space-x-2">
                            <span className="w-2 h-2 bg-primary-3 rounded-full"></span>
                            <span className="text-sm proxima-regular">Pending Approval</span>
                        </div>
                        <div className="flex items-center justify-center space-x-2">
                            <span className="w-2 h-2 bg-primary-4 rounded-full"></span>
                            <span className="text-sm proxima-regular">Approved</span>
                        </div>
                    </div>
                </div>
                <DashboardGraphChart labels={labels} />
            </div>
        </div>
    );
}

export default RecommendationsComponent;