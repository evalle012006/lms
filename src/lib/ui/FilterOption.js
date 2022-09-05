import React, {useState, useEffect, useRef} from 'react';

function FilterOption() {

    const container = useRef(null);
    const [selectedOption, setSelectedOption] = useState('Daily');
    const [showOptions, setShowOptions] = useState(false);

    const filterOptions = ['Daily', 'Weekly', 'Monthly'];
    const selectedIndex = filterOptions.findIndex(i => i === selectedOption);

    const handleSelect = () => {
        setShowOptions(!showOptions);
    };

    const handleOptionSelect = (e) => {
        e.stopPropagation();
        const key = e.target.getAttribute('data');
        setSelectedOption(filterOptions[key]);
        setShowOptions(false);
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (container.current && !container.current.contains(e.target)) {
                setShowOptions(false);
            }
        };

        document.addEventListener('click', handleClickOutside, true);

        return () => {
            document.removeEventListener('click', handleClickOutside, true);
        }
    }, []);

  return (
        <div className="flex flex-row text-xs align-baseline flex-nowrap cursor-pointer relative" onClick={handleSelect}>
            <span className="text-gray-600 mr-3">{label}: </span>
            <span className="font-bold text-green-10">{selectedOption}</span>
            <svg xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3 fill-green-10 stroke-green-10"
                fill="none" viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2} style={{ marginTop: '3px', marginLeft: '8px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <div className="absolute right-0 mt-6 px-4 bg-white w-60 border border-slate-300 rounded-lg" hidden={!showOptions} ref={container}>
                <ul>
                    {filterOptions.map((item, key) => {
                        return (
                            <li key={key} data={key} className={`text-base py-4 ${key !== filterOptions.length && 'border-b'} flex justify-between`}
                                onClick={handleOptionSelect}>
                                {item}
                                <span hidden={selectedIndex !== key}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 stroke-green-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}

export default FilterOption