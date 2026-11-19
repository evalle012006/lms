import React, { useState } from 'react'
import { XCircleIcon } from '@heroicons/react/24/solid';
import { useEffect } from 'react';

const InputNumber = ({ name, value=0, label, placeholder, disabled, onChange, onBlur, setFieldValue, errors, className = '', filter = false }) => {
    const [inputValue, setInputValue] = useState('');

    const handleClick = () => {
        setInputValue(0);
    }

    useEffect(() => {
        const numberInputs = document.querySelectorAll('input[type="number"]');
        
        numberInputs.forEach(input => {
            input.addEventListener('wheel', function(e) {
              // Prevent the default scroll behavior
              e.preventDefault();
            });
          });
    }, [])

    return (
        <>
            <div className={`
                flex justify-between rounded-lg px-4 ${filter ? '' : 'py-1'} border mb-2 bg-white shadow-sm transition-all focus-within:border-main focus-within:ring-2 focus-within:ring-main/20
                ${value ? 'border border-main' : 'border-gray-300'}
                ${errors && 'border border-red-400 focus-within:!border-red-400 focus-within:ring-red-200'}
            `}>
                <div className="flex flex-col w-full">
                    <label htmlFor={name}
                        className={`
                        text-xs font-bold 
                        ${value ? 'text-main' : 'text-gray-500'}
                        ${errors && 'text-red-400'}
                    `}>
                        {label}
                    </label>
                    <input name={name}
                        value={value}
                        autoComplete="off"
                        type="number"
                        onWheel={(e) => e.target.blur()}
                        className={`
                            p-1 pl-0 text-gray-500 font-medium border-none focus:ring-0 text-sm
                            ${errors && 'text-red-400'}
                            ${className}
                        `}
                        min={0}
                        placeholder={placeholder}
                        disabled={disabled}
                        onChange={onChange}
                        onBlur={onBlur}
                    />
                </div>
                {/* <div onClick={handleClick} className={`${value == '' && 'hide'} flex w-6 items-center justify-center`}>
                    <XCircleIcon className="cursor-pointer h-5" />
                </div> */}
            </div>
            {errors && <span className="text-red-400 text-xs font-medium">{errors}</span>}
        </>
    )
}

export default InputNumber