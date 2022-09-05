import FilterOptions from "./FilterOptions";
import { useSelector, useDispatch } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { useEffect, useState } from "react";
import moment from 'moment';

const TestsBoxComponent = ({ testCounts, setTestCounts }) => {
    const date = moment();
    const label = 'Show';
    const keys = { 0: 'daily', 1: 'weekly', 2: 'monthly' };
    const [currentKey, setCurrentKey] = useState('daily');
    const [soilCount, setSoilCount] = useState(0);
    const [leafCount, setLeafCount] = useState(0);
    const [prevSoilCount, setPrevSoilCount] = useState(0);
    const [prevLeafCount, setPrevLeafCount] = useState(0);

    const dateNow = {
        daily: date.dayOfYear(),
        weekly: date.isoWeek(),
        monthly: date.month() + 1
    }

    const text = {
        daily: 'the last day',
        weekly: 'last week',
        monthly: 'last month'
    }

    const calculateDifference = (curr, prev) => {
        if (curr - prev === 0) return 0;
        let percent = 0;
        if (curr > prev) {
            percent = (curr - prev) / curr * 100;
        } else {
            percent = (prev - curr) / prev * 100;
        }
        return percent;
    }

    const handleChange = async (key) => {
        const apiURL = `${process.env.NEXT_PUBLIC_API_URL}jobs/filters?`;
        const params = { filter: keys[key] };
        const response = await fetchWrapper.get(apiURL + new URLSearchParams(params));
        response.success && setTestCounts(response.counts);
        setCurrentKey(keys[key]);

        const currentFilter = dateNow[currentKey];
        const soilData = testCounts?.soil?.find(t => t._id === currentFilter);
        const leafData = testCounts?.leaf?.find(t => t._id === currentFilter);
        const prevSoilData = testCounts?.soil?.find(t => t._id === currentFilter - 1);
        const prevLeafData = testCounts?.leaf?.find(t => t._id === currentFilter - 1);
        setSoilCount(soilData ? soilData.count : 0);
        setLeafCount(leafData ? leafData.count : 0);
        setPrevSoilCount(prevSoilData ? prevSoilData.count : 0);
        setPrevLeafCount(prevLeafData ? prevLeafData.count : 0);
    }

    useEffect(() => {
        let mounted = true;

        const setTestsData = () => {
            const currentFilter = dateNow[currentKey];
            const soilData = testCounts?.soil?.find(t => t._id === currentFilter);
            const leafData = testCounts?.leaf?.find(t => t._id === currentFilter);
            const prevSoilData = testCounts?.soil?.find(t => t._id === currentFilter - 1);
            const prevLeafData = testCounts?.leaf?.find(t => t._id === currentFilter - 1);
            setSoilCount(soilData ? soilData.count : 0);
            setLeafCount(leafData ? leafData.count : 0);
            setPrevSoilCount(prevSoilData ? prevSoilData.count : 0);
            setPrevLeafCount(prevLeafData ? prevLeafData.count : 0);
        }

        mounted && setTestsData();

        return () => {
            mounted = false;
        }
    }, [testCounts])

    return testCounts && (
        <div className="bg-white rounded-lg p-4 border w-1/3 border-slate-300">
            <div className="flex justify-between items-baseline">
                <div className="alternate-gothic text-xl">Tests</div>
                <FilterOptions label={label} onChange={handleChange} />
            </div>
            <div className="rounded-lg p-4 border border-slate-300 mt-6 flex h-20 justify-between">
                <div className="flex flex-col">
                    <div className="proxima-nova font-bold text-sm">Soil Test</div>
                    <div className="text-xs">{`${calculateDifference(soilCount, prevSoilCount)}% ${soilCount - prevSoilCount >= 0 ? 'more' : 'less'} than ${text[currentKey]}`}</div>
                </div>
                <div className="text-4xl alternate-gothic">{soilCount} Active</div>
            </div>
            <div className="rounded-lg p-4 border border-slate-300 mt-6 flex h-20 justify-between">
                <div className="flex flex-col">
                    <div className="proxima-nova font-bold text-sm">Leaf Test</div>
                    <div className="text-xs">{`${calculateDifference(leafCount, prevLeafCount)}% ${leafCount - prevLeafCount >= 0 ? 'more' : 'less'} than ${text[currentKey]}`}</div>
                </div>
                <div className="text-4xl alternate-gothic">{leafCount} Active</div>
            </div>
        </div>
    );
}

export default TestsBoxComponent;