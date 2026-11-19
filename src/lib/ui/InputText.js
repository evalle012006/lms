import React from 'react'
import { XCircleIcon, CalendarDaysIcon } from '@heroicons/react/24/solid';

const InputText = ({ name, value = '', label, placeholder, disabled, onChange, onBlur, onFocus, setFieldValue, errors, closeIcon = true, className = '', onPaste, filter=false, autofocus=false }) => {
    const handleClick = () => {
        setFieldValue(name, '');
    }

    return (
        <>
            <div className={`
                flex justify-between rounded-lg px-4 py-1 mb-2 border bg-white shadow-sm transition-all focus-within:border-main focus-within:ring-2 focus-within:ring-main/20 
                ${value ? ' border-main' : 'border-gray-300'}
                ${errors && ' border-red-400 focus-within:!border-red-400 focus-within:ring-red-200'}
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
                        type="text"
                        onPaste={onPaste}
                        onBlur={onBlur}
                        onFocus={onFocus}
                        className={`
                            p-2 pl-0 text-gray-500 font-medium  border-none focus:ring-0
                            ${value ? 'text-xs' : 'text-sm'} 
                            ${errors && 'text-red-400'}
                            ${className}
                        `}
                        placeholder={placeholder}
                        disabled={disabled}
                        onChange={onChange}
                    />
                </div>
                {closeIcon && (<div onClick={handleClick} className={`${(value == '' || disabled) && 'hide'} flex w-6 items-center justify-center`}>
                    {filter ? <CalendarDaysIcon className="cursor-pointer h-5" /> : <XCircleIcon className="cursor-pointer h-5" /> }
                </div>)}
            </div>
            {errors && <span className="text-red-400 text-xs font-medium">{errors}</span>}
        </>)
}

export default InputText;