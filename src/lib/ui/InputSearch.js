import React from "react";
import { XCircleIcon } from "@heroicons/react/24/solid";

function InputSearch({
  name,
  value = "",
  label,
  placeholder,
  disabled,
  onChange,
  setFieldValue,
  errors,
  className = "",
}) {
  const handleClick = () => {
    setFieldValue(name, "");
  };

  return (
    <>
      <div className={`flex justify-between rounded-md px-2 py-1 border mb-2 bg-white 
          ${value ? ' border-main' : 'border-slate-400'}
          ${errors && ' border-red-400'}
      `}>
        <div className="flex flex-col w-full">
          <label
            htmlFor={name}
            className={`text-xs font-bold 
                ${value ? "text-main" : "text-gray-500"}
                ${errors && "text-red-400"}
            `}>
            {label}
          </label>
          <label className={`relative text-gray-400 focus-within:${value ? "text-green-600" : "text-gray-500"}
                        ${errors && "text-red-400"} block`}>

            <svg xmlns="http://www.w3.org/2000/svg" 
                    className="pointer-events-none w-6 h-6 absolute top-1/2 transform -translate-y-1/2 left-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
              <input
                value={value}
                autoComplete="off"
                placeholder={placeholder}
                disabled={disabled}
                onChange={onChange}
                className={`
                  p-1 text-gray-500 font-medium border-none focus:ring-0
                  ${value ? "text-xs" : "text-sm"} 
                  ${errors && "text-red-400"}
                  ${className}
                  form-input
                  appearance-none w-full
                  block pl-14
                  focus:outline-none
              `}
              />
          </label>
        </div>
        <div onClick={handleClick} className={`${value == "" && "hide"} flex w-6 items-center justify-center`}>
          <XCircleIcon className="cursor-pointer h-5" />
        </div>
      </div>
      {errors && (
        <span className="text-red-400 text-xs font-medium">{errors}</span>
      )}
    </>
  );
}

export default InputSearch;
