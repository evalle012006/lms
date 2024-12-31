const Spinner = () => {
    return (
        // <div className="flex justify-center items-center m-auto">
        //     <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        // </div>
        // <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        //     <div className="flex flex-col items-center justify-center">
        //         <div className="relative h-20 w-20 mb-3">
        //             <div className="absolute inset-0 animate-spin">
        //             <div className="absolute h-3 w-3 bg-blue-500 rounded-full top-0 left-1/2 -translate-x-1/2" />
        //             <div className="absolute h-3 w-3 bg-blue-500 rounded-full right-0 top-1/2 -translate-y-1/2" />
        //             <div className="absolute h-3 w-3 bg-blue-500 rounded-full bottom-0 left-1/2 -translate-x-1/2" />
        //             <div className="absolute h-3 w-3 bg-blue-500 rounded-full left-0 top-1/2 -translate-y-1/2" />
        //             </div>
        //         </div>
        //         <p className="text-gray-600 text-sm">Processing, please wait...</p>
        //     </div>
        // </div>

        <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center">
                <div className="relative h-20 w-20 mb-3">
                    <div className="absolute inset-0 animate-spin">
                    <div className="absolute h-3 w-3 bg-blue-500 rounded-full top-0 left-1/2 -translate-x-1/2" />
                    <div className="absolute h-3 w-3 bg-blue-500 rounded-full right-0 top-1/2 -translate-y-1/2" />
                    <div className="absolute h-3 w-3 bg-blue-500 rounded-full bottom-0 left-1/2 -translate-x-1/2" />
                    <div className="absolute h-3 w-3 bg-blue-500 rounded-full left-0 top-1/2 -translate-y-1/2" />
                    </div>
                </div>
                <p className="text-gray-600 text-sm">Processing, please wait...</p>
            </div>
        </div>
    );
}

export default Spinner;