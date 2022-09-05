
import React from "react";
import CreatableSelect from 'react-select/creatable';
import { ChevronDownIcon } from '@heroicons/react/solid';

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
      fontSize: '14px',
      fontWeight: '500',
      fontFace: 'proxima-regular',
      color: 'rgb(107 114 128)',
      opacity: '.8'
  }),
  input: (base) => ({
      ...base,
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

const CreatableSelectDropdown = ({ name, value = '', label, field, newField, placeholder, disabled, onChange, onBlur, errors, className = '', options = [], multi = false }) => {

  const handleChange = (selected) => {
    if (selected) {
      onChange(field, selected.value);
    } else {
      onChange(field, selected);
    }

    if (selected && selected.__isNew__) {
      onChange(newField, selected.value);
    } else {
      onChange(newField, null);
    }
  }

  return (
      <React.Fragment>
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
            <CreatableSelect
                isClearable={true}
                onChange={handleChange}
                options={options}
                placeholder={placeholder}
                isMulti={multi}
                styles={styles}
                value={
                  value ?
                  (typeof value === 'object' ? value : { label: value, value: value }) : value
                }
                components={{ DropdownIndicator, IndicatorSeparator: () => null }} />
        </div>
        {errors && <span className="text-red-400 text-xs font-medium">{errors}</span>}
      </React.Fragment>)
}

export default CreatableSelectDropdown;
