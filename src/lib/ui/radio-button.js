import React from "react";

function RadioButton({ id, name, size, label, type, disabled, checked=false, className="", value, onChange }) {
  const handleChange = (e) => {
    onChange && onChange(e.target.value);
  }
  return (
    <div className="mt-2">
      {type === "check" ? (
        <div className="flex items-center mr-4">
          <input
            id={id}
            name={name}
            type="checkbox"
            value={value}
            onChange={(e) => handleChange(e)}
            className={`
              ${size === "lg" ? "w-6 h-6" : "w-w h-w"} rounded-full
              text-primary-1
              bg-gray-100
              border-gray-300
              ring-gray-10
              focus:ring-red-500
              dark:focus:ring-primary-1
              dark:ring-offset-gray-800
              focus:ring-2 dark:bg-white
              dark:border-gray-10 ${className}`}
              checked={checked}
          />
          <label htmlFor="red-checkbox" className="ml-2 text-sm font-medium text-gray-900">
            {label}
          </label>
        </div>
      ) : (
        <>
          <div className="flex items-center mr-4">
            <input
              // defaultChecked
              id={id}
              type="radio"
              value={value}
              onChange={(e) => handleChange(e)}
              name={name}
              checked={checked}
              className={`${size === "lg" ? "w-6 h-6" : "w-w h-w"}
                ${disabled ? "text-gray-10" : "text-primary-1"}
                ${disabled ? "text-gray-10" : "focus:ring-primary-1"}
                ${disabled ? "bg-gray-10" : "bg-gray-100"}
                ${disabled ? "bg-gray-10" : "dark:bg-white"}
                border-gray-300
                dark:focus:ring-primary-1
                dark:ring-offset-gray-10 focus:ring-2
                dark:border-gray-10`}
              disabled={disabled}
            />
            <label htmlFor="green-radio" className="ml-2 text-sm font-medium text-gray-900">
              {label}
            </label>
          </div>
        </>
      )}
    </div>
  );
}

export default RadioButton;
