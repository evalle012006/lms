import { useRef, useState, useEffect } from 'react';
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/solid';

const FilterOptions = ({ label, onChange }) => {
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
        onChange(key);
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
        <div className="flex text-xs align-baseline cursor-pointer relative" onClick={handleSelect}>
            <span className="text-gray-600 mr-3">{label}: </span>
            <span className="font-bold text-green-10">{selectedOption}</span>
            <ChevronDownIcon width={12} height={20} className="ml-1 fill-green-10 stroke-green-10" />
            {showOptions && <div className="absolute right-0 mt-6 px-4 bg-white w-60 border border-slate-300 rounded-lg" ref={container}>
                <ul>
                    {filterOptions.map((item, key) => {
                        return (
                            <li key={key} data={key} className={`text-base py-4 ${key !== filterOptions.length && 'border-b'} flex justify-between`}
                                onClick={handleOptionSelect}>
                                {item}
                                <span hidden={selectedIndex !== key}>
                                    <CheckIcon width={24} height={24} className="fill-green-10" />
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </div>}
        </div>
    );
}

export default FilterOptions;