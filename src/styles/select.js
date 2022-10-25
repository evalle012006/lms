import { ChevronDownIcon } from '@heroicons/react/24/solid';
import chroma from 'chroma-js';

export const styles = {
    control: (base, state) => ({
        ...base,
        border: state.isFocused ? 0 : 0,
        // This line disable the blue border
        boxShadow: state.isFocused ? 0 : 0,
        '&:hover': {
            border: state.isFocused ? 0 : 0
        },
        padding: 0,
        margin: 0,
        // boxShadow: 'none',
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
        opacity: '.8',
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

export const borderStyles = {
    control: (base, state) => ({
        ...base,
        borderRadius: '9999px',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '4px 8px',
        gap: '8px',
        border: '1px solid #E9E8E8',
        boxShadow: state.isFocused ? 0 : 0,
        position: 'relative',
        minHeight: '20px',
        height: '30px',
        width: '230px'
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
        opacity: '.8',
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

export const multiStyles = {
    control: (base) => ({
        ...base,
        border: 0,
        padding: 0,
        margin: 0,
        boxShadow: 'none',
        position: 'relative',
        minHeight: '20px'

    }),
    option: (provided, state) => ({
        ...provided,
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
        paddingLeft: '6px',
        fontSize: '14px',
        fontWeight: '500',
        fontFace: 'proxima-regular',
        color: 'rgb(107 114 128)',
        opacity: '.8'
    }),
    valueContainer: (base) => ({
        ...base,
        padding: 0,
        paddingLeft: '8px',
        alignItems: 'top'
    }),
    multiValue: (styles, { data }) => {
        const color = chroma('#2b99c5');
        return {
            ...styles,
            backgroundColor: color.alpha(0.1).css(),
        };
    },
    multiValueLabel: (styles, { data }) => ({
        ...styles,
        color: '#2b99c5',
    }),
    multiValueRemove: (styles, { data }) => ({
        ...styles,
        color: '#2b99c5',
        ':hover': {
            backgroundColor: '#2b99c5',
            color: 'white',
        },
    }),
};

export const DropdownIndicator = () => {
    return <ChevronDownIcon className="ml-2 w-8 h-4 cursor-pointer" />
};