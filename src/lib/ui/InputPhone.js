import React, { useState } from 'react'
import PhoneInput from 'react-phone-number-input';
import { XCircleIcon } from '@heroicons/react/24/solid';

function InputPhone({ name, value, label, placeholder, disabled, errors, setFieldValue, onChange, className = '' }) {
    
    const [inputValue, setInputValue] = useState();

    const handleClick = () => {
        setFieldValue(name, "");
    }

    // const handleClick = () => {
    //     setFieldValue(name, '');
    // }

    return (
    <>
            <div className={`
                flex flex-col rounded-md px-2 py-1 border mb-2 bg-white
                ${value ? 'border border-main' : 'border-slate-400'}
                ${errors && 'border border-red-400'}
                `}>
                <div className="flex justify-between">
                    <label htmlFor={name}
                        className={`
                        text-xs font-bold 
                        ${value ? 'text-main' : 'text-gray-500'}
                        ${errors && 'text-red-400'}
                    `}>
                        {label}
                    </label>
                    <div onClick={handleClick} className={`${!value && 'hide'}`}>
                        <XCircleIcon className="cursor-pointer h-5" />
                    </div>
                </div>
                <PhoneInput 
                    style={{border:'none'}}
                    name={name}
                    // autoComplete="off"
                    className={`
                    p-1 focus:outline-none border-none without-ring
                        text-gray-500 font-medium
                        ${value ? 'text-xs' : 'text-sm'} 
                        ${errors && 'text-red-400'}
                        ${className}
                    `}
                    placeholder={placeholder}
                    value={value}
                    defaultCountry="AU"
                    international
                    disabled={disabled}
                    onChange={onChange} 
                />
            </div>
            {errors && <span className="text-red-400 text-xs font-medium">{errors}</span>}
        </>
  )
}

export default InputPhone