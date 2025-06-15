import React from "react";

function CheckBox({size, label, name, value, className="", onChange, disabled}) {
  const checkboxId = `checkbox-${name}`;
  
  const handleClick = (e) => {
    if (!disabled) {
      onChange(name, !value);
    }
  }

  return (
    <div className="mt-1 cursor-pointer">
      <div className="flex items-center mr-4" onClick={handleClick}>
        <input 
          id={checkboxId}
          name={name} 
          type="checkbox" 
          value={value} 
          checked={value} 
          className={`cursor-pointer ${size==='lg' ? 'w-6 h-6': 'w-4 h-4'} rounded text-main ${disabled ? 'bg-gray-200 border-gray-200 ring-gray-20' : 'bg-gray-100 border-gray-300 ring-gray-10'}
            ${className}`} 
          disabled={disabled}
          readOnly
        />
        <label 
          className="ml-2 text-sm font-medium text-gray-500 cursor-pointer"
        >
          {label}
        </label>
      </div>
    </div>
  );
}

export default CheckBox;