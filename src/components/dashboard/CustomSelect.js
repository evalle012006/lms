import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const CustomSelect = ({ value, onChange, options, placeholder, className = '', icon: Icon }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find((opt) => opt.value === value);

    return (
        <div className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-left shadow-sm hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        {Icon && <Icon className="w-4 h-4 text-gray-500" />}
                        <span className="text-sm font-medium text-gray-700">
                            {selectedOption ? selectedOption.label : placeholder}
                        </span>
                    </div>
                    <ChevronDown
                        className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                </div>
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {options.map((option, index) => (
                        <button
                            key={index}
                            type="button"
                            onClick={() => { onChange(option.value); setIsOpen(false); }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:bg-blue-50"
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CustomSelect;