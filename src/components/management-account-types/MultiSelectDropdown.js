import { useState, useEffect, useRef } from 'react';
import { ChevronDownIcon, XMarkIcon } from '@heroicons/react/24/solid';

const MultiSelectDropdown = ({ options, selectedValues, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref                 = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggle = (value) => {
        const next = selectedValues.includes(value)
            ? selectedValues.filter(v => v !== value)
            : [...selectedValues, value];
        onChange(next);
    };

    const removeTag = (e, value) => {
        e.stopPropagation();
        onChange(selectedValues.filter(v => v !== value));
    };

    const labels = selectedValues.map(v => options.find(o => o.value === v)?.label ?? v);

    return (
        <div className="relative" ref={ref}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="w-full min-h-[38px] px-3 py-1.5 border border-gray-300 rounded-md cursor-pointer bg-white hover:border-gray-400 flex items-center justify-between gap-2"
            >
                <div className="flex flex-wrap gap-1 flex-1">
                    {selectedValues.length === 0 ? (
                        <span className="text-gray-400 text-sm">{placeholder || 'Select...'}</span>
                    ) : (
                        labels.map((label, idx) => (
                            <span
                                key={selectedValues[idx]}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs"
                            >
                                {label}
                                <XMarkIcon
                                    className="h-3 w-3 cursor-pointer hover:text-teal-900"
                                    onClick={e => removeTag(e, selectedValues[idx])}
                                />
                            </span>
                        ))
                    )}
                </div>
                <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-52 overflow-auto">
                    {options.map(opt => (
                        <label
                            key={opt.value}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        >
                            <input
                                type="checkbox"
                                checked={selectedValues.includes(opt.value)}
                                onChange={() => toggle(opt.value)}
                                className="rounded text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-sm text-gray-700">{opt.label}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MultiSelectDropdown;