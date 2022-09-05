import React from "react";

function CheckBox({id, size, label, value, className="", onChange, disabled}) {
  return (
    <div className="mt-2">
    <div className="flex items-center mr-4">
      <input id={id} type="checkbox" onChange={()=> {
        onChange(!value); 
      }} className={`
        ${size==='lg' ? 'w-6 h-6': 'w-w h-w'} rounded
        text-primary-1
        bg-gray-100
        border-gray-300
        ring-gray-10
        focus:ring-red-500
        dark:focus:ring-primary-1
        dark:ring-offset-gray-800
        focus:ring-2 dark:bg-white
        dark:border-gray-10
        ${className}`} 
        disabled={disabled}
        />
      <label htmlFor="red-checkbox" className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">{label}</label>
    </div>
  </div>
  );
}

export default CheckBox;
