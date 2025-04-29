import React, { useState } from 'react';

const WarningIconWithTooltip = ({ amount = 0, message = '' }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    
    return (
      <div className="relative inline-block">
        <div 
          className="flex items-center justify-center bg-amber-100 rounded-lg px-2 py-1 cursor-pointer"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <div className="flex items-center">
            {/* Warning triangle SVG */}
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="text-amber-600"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            
            {/* Number 100 beside the icon */}
            <span className="ml-2 text-red-500 text-sm font-bold">
              { amount }
            </span>
          </div>
        </div>
        
        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute z-10 w-64 bg-gray-800 text-white text-sm rounded-md shadow-lg p-2 -mt-1 transform -translate-x-1/2 left-1/2">
            <div className="relative">
              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-gray-800 rotate-45"></div>
              <p className="z-20 relative">{ message }</p>
            </div>
          </div>
        )}
      </div>
    );
  };

export default WarningIconWithTooltip;