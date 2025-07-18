import React, { useState } from 'react'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const InputPassword = ({ name, value='', label, placeholder, disabled, onChange, setFieldValue, errors, className = '' }) => {
    const [show, setShow] = useState(false);

    const handleClick = () => {
        setShow(!show);
    }

    return (
        <>
            <div className={`
                flex justify-between rounded-md px-4 py-1 border mb-2 bg-white
                ${value ? 'border border-main' : 'border-slate-400'}
                ${errors && 'border border-red-400'}
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
                        type={show ? 'text' : 'password'}
                        className={`
                        p-1 pl-0 text-gray-500 font-medium border-none focus:ring-0
                        ${value ? 'text-xs' : 'text-sm'} 
                        ${errors && 'text-red-400'}
                        ${className}
                    `}
                        placeholder={placeholder}
                        disabled={disabled}
                        onChange={onChange}
                    />
                </div>
                <div onClick={handleClick} className={`${!value && 'hide'} flex w-6 items-center justify-center`}>
                    <EyeIcon className={`cursor-pointer h-5 ${show && 'hide'}`} />
                    <EyeSlashIcon className={`cursor-pointer h-5 ${!show && 'hide'}`} />
                </div>
            </div>
            {errors && <span className="text-red-400 text-xs font-medium">{errors}</span>}
        </>
    )
}

export default InputPassword