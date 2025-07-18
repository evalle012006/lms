import React, { useState, useEffect, useRef } from 'react'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const InputPassword = ({ name, value='', label, placeholder, disabled, onChange, setFieldValue, errors, className = '' }) => {
    const [show, setShow] = useState(false);
    const [isReadonly, setIsReadonly] = useState(true);
    const [inputKey, setInputKey] = useState(Date.now());
    const inputRef = useRef(null);

    // Generate dynamic name to prevent browser recognition
    const dynamicName = `${name}_${inputKey}`;

    const handleClick = () => {
        setShow(!show);
    }

    const handleFocus = (e) => {
        setIsReadonly(false);
        // Small delay to ensure readonly is removed before browser tries to autofill
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
            }
        }, 50);
    }

    const handleBlur = (e) => {
        // Only set readonly back if there's no value to prevent interference with user input
        if (!value) {
            setIsReadonly(true);
        }
    }

    // Reset input key periodically to break any browser caching
    useEffect(() => {
        const timer = setTimeout(() => {
            setInputKey(Date.now());
        }, 30000); // Reset every 30 seconds

        return () => clearTimeout(timer);
    }, [inputKey]);

    // Clear readonly when component receives value (for controlled inputs)
    useEffect(() => {
        if (value && isReadonly) {
            setIsReadonly(false);
        }
    }, [value]);

    return (
        <>
            {/* Fake hidden inputs to confuse browser autofill */}
            <div style={{ display: 'none' }}>
                <input type="text" name="fake-username" tabIndex="-1" />
                <input type="password" name="fake-password" tabIndex="-1" />
            </div>
            
            <div className={`
                flex justify-between rounded-md px-4 py-1 border mb-2 bg-white
                ${value ? 'border border-main' : 'border-slate-400'}
                ${errors && 'border border-red-400'}
            `}>
                <div className="flex flex-col w-full">
                    <label htmlFor={dynamicName}
                        className={`
                        text-xs font-bold 
                        ${value ? 'text-main' : 'text-gray-500'}
                        ${errors && 'text-red-400'}
                    `}>
                        {label}
                    </label>
                    <input 
                        ref={inputRef}
                        key={inputKey}
                        name={dynamicName}
                        value={value}
                        readOnly={isReadonly}
                        autoComplete="new-password"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
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
                        onFocus={handleFocus}
                        onBlur={handleBlur}
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