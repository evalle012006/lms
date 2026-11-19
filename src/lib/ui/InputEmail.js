import React from 'react'
import { XCircleIcon } from '@heroicons/react/24/solid';

const InputEmail = ({ name, value='', label, placeholder, disabled, onChange, setFieldValue, errors, className = '', width }) => {
    const handleClick = () => {
        setFieldValue(name, '');
    }

    return (
        <>
        <div className={`
            flex justify-between border rounded-lg px-4 py-1 mb-2 bg-white shadow-sm transition-all focus-within:border-main focus-within:ring-2 focus-within:ring-main/20
            ${value ? ' border-main' : ' border-gray-300'}
            ${errors && ' border-red-400 focus-within:!border-red-400 focus-within:ring-red-200'}
            ${disabled && 'bg-gray-100 border-gray-300'}
        `} style={{ width: width }}>
                
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
                    type="email"
                    className={`focus:outline-none border-none focus:ring-0
                    p-1 pl-0 text-gray-500 font-medium 
                    ${value ? 'text-xs' : 'text-sm'} 
                    ${errors && 'text-red-400'}
                    ${disabled && 'bg-gray-100 border-gray-300'}
                    ${className}
                `}
                    placeholder={placeholder}
                    disabled={disabled}
                    onChange={onChange}
                />
            </div>
            <div onClick={handleClick} className={`${value == '' || disabled && 'hide'} flex w-6 items-center justify-center`}>
                <XCircleIcon className="cursor-pointer h-5" />
            </div>
        </div>
        {errors && <span className="text-red-400 text-xs font-medium">{errors}</span>}
    </>
    )
}

export default InputEmail;