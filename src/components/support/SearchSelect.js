// Searchable dropdown for the support editor (react-select). Type to filter; value is the option's `value` string.
import React from 'react';
import Select from 'react-select';

const teal = '#018D8A';
const styles = (changed) => ({
    control: (base, s) => ({
        ...base, minHeight: 42, borderRadius: 8, cursor: 'pointer',
        borderColor: s.isFocused ? teal : changed ? '#fbbf24' : '#d1d5db',
        backgroundColor: changed ? '#fffbeb' : '#fff',
        boxShadow: s.isFocused ? '0 0 0 2px rgba(1,141,138,0.25)' : 'none',
        '&:hover': { borderColor: s.isFocused ? teal : '#9ca3af' },
    }),
    option: (base, s) => ({ ...base, cursor: 'pointer', fontSize: 14, backgroundColor: s.isSelected ? teal : s.isFocused ? '#CCE8E8' : '#fff', color: s.isSelected ? '#fff' : '#111827' }),
    singleValue: (base) => ({ ...base, color: '#111827', fontSize: 14 }),
    input: (base) => ({ ...base, color: '#111827', fontSize: 14 }),
    placeholder: (base) => ({ ...base, fontSize: 14 }),
    indicatorSeparator: () => ({ display: 'none' }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
});

export default function SearchSelect({ value, options, onChange, changed = false, placeholder = 'Select…', isDisabled = false }) {
    const selected = options.find((o) => String(o.value) === String(value ?? '')) ?? null;
    return (
        <Select
            className="mt-1" classNamePrefix="support-select"
            options={options} value={selected} isDisabled={isDisabled}
            onChange={(o) => onChange(o ? o.value : '')}
            placeholder={placeholder} isSearchable noOptionsMessage={() => 'No match'}
            styles={styles(changed)}
            menuPortalTarget={typeof document !== 'undefined' ? document.body : null} menuPosition="fixed"
        />
    );
}
