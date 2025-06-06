import { useEffect, useRef } from "react";

const DatePicker = ({ name, value, onChange, maxDate, height = "h-10", className = "" }) => {
    const inputRef = useRef();

    useEffect(() => {
        if (maxDate) {
            inputRef.current.max = maxDate;
        }
    }, [maxDate]);

    return (
        <div className={`relative ${height}`}>
            <div className="flex absolute inset-y-0 left-0 items-center pl-3 pointer-events-none">
                <svg aria-hidden="true" className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100 2H6z" clipRule="evenodd"></path>
                </svg>
            </div>
            <input 
                type="date" 
                ref={inputRef}
                name={name} 
                defaultValue={value}
                onChange={onChange}
                className={`bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-400 block w-full h-full pl-10 pr-4 transition-all duration-200 ${className}`}
                placeholder="Select date" 
            />
        </div>
    );
};

export default DatePicker;