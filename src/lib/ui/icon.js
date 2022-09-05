import React from 'react'

function IconOnly({icon, type, additionalClasses, disabled}) {

  let classType = type ==='secondary' ? 'bg-teal-10 text-primary-1' : 'bg-primary-1 text-white';

  if(disabled){
    classType = type==='secondary'? 'bg-white border-2 text-gray-10' : 'bg-gray-10 text-gray-12'
  }
    return(
        <div className={ `${classType} ${additionalClasses} text-white inline-block p-3 rounded-lg`}>
          {icon}
        </div>
      );
}

export default IconOnly