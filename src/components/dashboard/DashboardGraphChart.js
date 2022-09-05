import GraphChartDetail from '@/components/dashboard/GraphChartDetail';

const DashboardGraphChart = ({ labels }) => {
    return (
        <div className="flex mt-6">
            <div className="flex flex-col w-10 text-gray-400 text-xs proxima-regular">
                <div className="h-8 flex flex-col justify-center">
                    <span>200</span>
                </div>
                <div className="h-8 flex flex-col justify-center">
                    <span>150</span>
                </div>
                <div className="h-8 flex flex-col justify-center">
                    <span>100</span>
                </div>
                <div className="h-8 flex flex-col justify-center">
                    <span>50</span>
                </div>
                <div className="h-8 flex flex-col justify-center">
                    <span>0</span>
                </div>
            </div>
            <div className="chart-background bg-top bg-repeat-x w-full">
                <div className="flex flex-column ml-4">
                    {labels.length > 0 && labels.map((item, index) => {
                        return <GraphChartDetail key={index} label={item} />
                    })}
                </div>
            </div>
        </div>
    );
}

export default DashboardGraphChart;