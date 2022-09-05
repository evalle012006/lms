import React from 'react'

const InputTextIcon = ({ name, value = '', label, placeholder, disabled, onChange, className = '', icons = []}) => {
    return (
        <>
            <div className={`flex justify-between items-center rounded-md px-4 py-1 mb-2 border bg-white border-slate-400`}>
                <div className="flex flex-col w-full">
                    <label htmlFor={name} className={`text-xs font-bold text-gray-500`}>
                        {label}
                    </label>
                    <input name={name}
                        value={value}
                        autoComplete="off"
                        type="text"
                        className={`p-2 pl-0 text-gray-500 font-medium  border-none focus:ring-0 text-sm ${className}`}
                        placeholder={placeholder}
                        disabled={disabled}
                        onChange={onChange}
                    />
                </div>
                {icons.map((icon, index) => {
                    return (
                        <div key={index} className="mr-2">
                            { icon }
                        </div>
                    )
                })}
            </div>
        </>)
}

export default InputTextIcon;