import React from "react";

function CheckBox({size, label, name, value, className="", onChange, disabled}) {
  const handleOnChange = (e) => {
    onChange(name, e.target.checked);
  }

  return (
    <div className="mt-1 cursor-pointer">
      <div className="flex items-center mr-4">
        <input name={name} type="checkbox" value={value} checked={value} onChange={handleOnChange} 
          className={`cursor-pointer ${size==='lg' ? 'w-6 h-6': 'w-w h-w'} rounded text-main ${disabled ? 'bg-gray-200 border-gray-200 ring-gray-20' : 'bg-gray-100 border-gray-300 ring-gray-10'}
            ${className}`} 
          disabled={disabled}
          />
        <label htmlFor="red-checkbox" className="ml-2 text-sm font-medium text-gray-500">{label}</label>
      </div>
  </div>
  );
}

export default CheckBox;
