import React from 'react'
import { XCircleIcon } from '@heroicons/react/24/solid';

const InputEmail = ({ name, value='', label, placeholder, disabled, onChange, setFieldValue, errors, className = '', width }) => {
    const handleClick = () => {
        setFieldValue(name, '');
    }

    return (
        <>
        <div className={`
            flex justify-between border rounded-md px-4 py-1 mb-2 bg-white
            ${value ? ' border-main' : ' border-slate-400'}
            ${errors && ' border-red-400'}
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
                    ${className}
                `}
                    placeholder={placeholder}
                    disabled={disabled}
                    onChange={onChange}
                />
            </div>
            <div onClick={handleClick} className={`${value == '' && 'hide'} flex w-6 items-center justify-center`}>
                <XCircleIcon className="cursor-pointer h-5" />
            </div>
        </div>
        {errors && <span className="text-red-400 text-xs font-medium">{errors}</span>}
    </>
    )
}

export default InputEmail;