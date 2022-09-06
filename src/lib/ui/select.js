/* eslint-disable no-unused-vars */
import React from "react";
import Select from 'react-select';
import { ChevronDownIcon } from '@heroicons/react/24/solid';

const styles = {
  control: (base) => ({
    ...base,
    border: 0,
    padding: 0,
    margin: 0,
    boxShadow: 'none',
    position: 'relative',
    minHeight: '20px',
    height: '30px'
  }),
  option: (base) => ({
    ...base,
    cursor: 'pointer'
  }),
  placeholder: (base) => ({
    ...base,
    padding: 0,
    fontSize: '14px',
    fontWeight: '500',
    fontFace: 'proxima-regular',
    color: 'rgb(107 114 128)',
    opacity: '.8'
  }),
  input: (base) => ({
    ...base,
    padding: 0,
    width: '100%',
    fontSize: '14px',
    fontWeight: '500',
    fontFace: 'proxima-regular',
    color: 'rgb(107 114 128)',
    opacity: '.8'
  }),
  singleValue: (base) => ({
    ...base,
    fontSize: '14px',
    fontWeight: '500',
    fontFace: 'proxima-regular',
    color: 'rgb(107 114 128)',
    opacity: '.8'
  }),
  valueContainer: (base) => ({
    ...base,
    padding: 0,
    alignItems: 'top'
  })
};

const DropdownIndicator = () => {
  return <ChevronDownIcon className="ml-2 w-8 h-4 cursor-pointer -mt-2" />
};

const SelectDropdown = ({
  name,
  value = '',
  label,
  field,
  placeholder,
  disabled,
  onChange,
  onBlur,
  errors,
  className = '',
  options = [],
  table = false,
  multi = false,
  isSearchable
}) => {
  const handleChange = (selected) => {
    if (table) {
      onChange(selected.value);
    } else {
      onChange(field, selected.value);
    }
  }

  const handleBlur = () => {
    if (field) {
      onBlur(field, true);
    }
  }

  return (
    <React.Fragment>
      {table ? (
        <>
          <Select options={options}
            value={value && options.filter(o => o.value === value)}
            placeholder={placeholder}
            styles={styles}
            isSearchable={isSearchable}
            components={{ DropdownIndicator, IndicatorSeparator: () => null }}
            onChange={(e) => handleChange(e)}
            onBlur={handleBlur} />
        </>
      ) : (
        <>
          <div className={`
                flex flex-col border rounded-md px-4 py-2 bg-white
                ${value ? 'border-green-600' : 'border-slate-400'}
                ${errors && 'border-red-400'}
            `}>
            <div className="flex justify-between">
              <label htmlFor={name}
                className={`
                          font-proxima-bold
                          text-xs font-bold 
                          ${value ? 'text-green-600' : 'text-gray-500'}
                          ${errors && 'text-red-400'}
                      `}>
                {label}
              </label>
            </div>
            <Select options={options}
              value={value && Array.isArray(options) && options.filter(o => o.value === value)}
              placeholder={placeholder}
              isMulti={multi}
              isDisabled={disabled}
              styles={styles}
              components={{ DropdownIndicator, IndicatorSeparator: () => null }}
              onChange={(e) => handleChange(e)}
              onBlur={handleBlur} />
          </div>
          {errors && <span className="text-red-400 text-xs font-medium">{errors}</span>}
        </>
      )}
    </React.Fragment>)
}

export default SelectDropdown;
