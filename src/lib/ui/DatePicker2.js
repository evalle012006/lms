import moment from 'node_modules/moment/moment';
import React, { useState } from 'react';
import { useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

const DatePicker2 = ({
  value = null,
  minDate = null,
  maxDate = null,
  onChange = () => {}
}) => {
  const [selectedDate, setSelectedDate] = useState();
  // Filter out weekends
  const isWeekday = (date) => {
    const day = date.getDay();
    return day !== 0 && day !== 6;
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    // Format date as YYYY-MM-DD and pass to parent
    if (date) {
      const formattedDate = moment(date).format("YYYY-MM-DD");
      onChange(formattedDate);
    } else {
      onChange(null);
    }
  };

  const CalendarIcon = () => (
    <svg 
      className="absolute right-8 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
      />
    </svg>
  );

  useEffect(() => {
    if (value) {
      setSelectedDate(value);
    }
  }, [value]);

  return (
    <div className="relative w-full">
      <DatePicker
        selected={selectedDate}
        onChange={handleDateChange}
        filterDate={isWeekday}
        minDate={minDate ? new Date(minDate) : null}
        maxDate={maxDate ? new Date(maxDate) : null}
        dateFormat="yyyy-MM-dd"
        placeholderText="Select a date"
        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-16"
        isClearable
        showPopperArrow={false}
        customInput={
          <input
            type="text"
            placeholder="Select a date"
          />
        }
      />
      <CalendarIcon />
    </div>
  );
};

export default DatePicker2;