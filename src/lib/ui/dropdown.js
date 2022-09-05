import React from 'react'

function Dropdown({ label = "", icon, dropdownIcon = true, disabled, items, onChange }) {
  
  function handleClick(value){
    onChange && onChange(value);
  }

  return (
    <>
        <div className="dropdown inline-block relative">
          <button className={`
            ${disabled ? 'bg-white' : 'bg-teal-10'}
            ${disabled ? 'border-gray-13' : 'border-primary-1'} 
            p-2 border-2
            focus:outline-none 
            font-semibold
            rounded-full text-sm px-4 py-2.5 text-center
            inline-flex items-center
            dark:focus:${disabled ? '' : 'ring-primary-3'}`}>
            {icon && <i className='mr-2'>{ icon }</i>}
            <span className={`${disabled ? 'text-gray-12' : 'text-primary-1'} mr-2`}>
              { label }
            </span>
            {dropdownIcon && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke={`${disabled ? '#636161' : '#018D8A'}`} strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>}
          </button>

          <ul className={`${disabled ? '' : 'dropdown-menu'}  absolute hidden text-gray-700 pt-1 z-10`}>
            {
              items && items.map((e, idx) =>
                <li key={idx} className="">
                  <button onClick={handleClick.bind(this, e.value)} className="w-full rounded-t bg-teal-10 hover:bg-gray-13 py-2 px-4 block whitespace-no-wrap">
                    {e.label}
                  </button>
                </li>)
            }
          </ul>
        </div>
    </>
  );
}

export default Dropdown;