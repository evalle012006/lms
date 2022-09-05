const GraphChartDetail = ({ label }) => {
    return (
        <div className="w-32 flex flex-col justify-center items-center">
            <div className="flex flex-row mt-4 h-32 space-x-2">
                {/* <div className="flex flex-col-reverse">
                    <div className="align-bottom bg-primary-1 rounded-full" style={{ width: '8px', height: '100%' }}></div>
                </div>
                <div className="flex flex-col-reverse">
                    <div className="align-bottom bg-primary-2 rounded-full" style={{ width: '8px', height: '45%' }}></div>
                </div>
                <div className="flex flex-col-reverse">
                    <div className="align-bottom bg-primary-3 rounded-full" style={{ width: '8px', height: '80%' }}></div>
                </div>
                <div className="flex flex-col-reverse">
                    <div className="align-bottom bg-primary-4 rounded-full" style={{ width: '8px', height: '10%' }}></div>
                </div> */}
            </div>
            <div className="mt-2 text-center text-xs text-gray-400">{label}</div>
        </div>
    );
}

export default GraphChartDetail;