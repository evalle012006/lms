import React, { useState, useEffect, useMemo, useRef } from "react";
import moment from 'moment';
import TableComponent, { StatusPill } from "@/lib/table";
import { TabPanel, useTabs } from "react-headless-tabs";
import { TabSelector } from "@/lib/ui/tabSelector";
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';

const ForeCastApplication = ({ 
  data = [], 
  handleShowClientInfoModal, 
  rowActionButtons,
  currentUser,
  setShowAddDrawer
}) => {
  const [selectedTab, setSelectedTab] = useState("");
  const [noOfLoans, setNoOfLoans] = useState(0);
  const [totalAmountRelease, setTotalAmountRelease] = useState(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  
  const tabsContainerRef = useRef(null);

  const columns = [
    { Header: "Group", accessor: 'groupName' },
    { Header: "Slot No.", accessor: 'slotNo' },
    { Header: "Client Name", accessor: 'fullName' },
    { Header: "Loan Cycle", accessor: 'loanCycle' },
    { Header: "Admission Date", accessor: 'admissionDate' },
    { Header: "MCBU", accessor: 'mcbuStr', filter: 'includes' },
    { Header: "Principal Loan", accessor: 'principalLoanStr' },
    { Header: "Target Loan Collection", accessor: 'activeLoanStr' },
    { Header: "Loan Release", accessor: 'loanReleaseStr' },
    { Header: "Loan Balance", accessor: 'loanBalanceStr' },
    { Header: "PN Number", accessor: 'pnNumber' },
    { Header: "Date of Release", accessor: 'dateOfRelease' },
    { Header: "Status", accessor: 'status', Cell: StatusPill }
  ];

  const uniqueDates = useMemo(() => {
    const dates = [...new Set(data.map(app => 
      moment(app.dateOfRelease).format('YYYY-MM-DD')
    ))].sort();
    return dates;
  }, [data]);

  useEffect(() => {
    if (uniqueDates.length > 0 && !selectedTab) {
      setSelectedTab(uniqueDates[0]);
    }
  }, [uniqueDates]);

  const filteredData = useMemo(() => {
    return data.filter(app => 
      moment(app.dateOfRelease).format('YYYY-MM-DD') === selectedTab
    );
  }, [data, selectedTab]);

  useEffect(() => {
    setNoOfLoans(filteredData.length);
    const total = filteredData.reduce((sum, item) => 
      sum + (parseFloat(item.principalLoan) || 0), 0
    );
    setTotalAmountRelease(total);
  }, [filteredData]);

  const checkForOverflow = () => {
    if (tabsContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsContainerRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth);
    }
  };

  useEffect(() => {
    const tabsContainer = tabsContainerRef.current;
    if (tabsContainer) {
      checkForOverflow();
      tabsContainer.addEventListener('scroll', checkForOverflow);
      window.addEventListener('resize', checkForOverflow);
    }

    return () => {
      if (tabsContainer) {
        tabsContainer.removeEventListener('scroll', checkForOverflow);
        window.removeEventListener('resize', checkForOverflow);
      }
    };
  }, []);

  const handleScroll = (direction) => {
    if (tabsContainerRef.current) {
      const scrollAmount = 200;
      const newScrollLeft = tabsContainerRef.current.scrollLeft + 
        (direction === 'left' ? -scrollAmount : scrollAmount);
      
      tabsContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
  };

  const formatPricePhp = (value) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(value);
  };

  const handleSelectTab = (date) => {
    setShowAddDrawer(false);
    setSelectedTab(date);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="relative flex items-center bg-white border-b border-gray-300">
        {/* Left Arrow */}
        {showLeftArrow && (
          <button 
            onClick={() => handleScroll('left')}
            className="absolute left-0 z-10 p-2 bg-white shadow-md rounded-r-lg hover:bg-gray-100 transition-colors duration-200"
          >
            <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
        )}

        {/* Tabs Container */}
        <nav 
          ref={tabsContainerRef}
          className="flex pl-10 pr-10 overflow-x-hidden scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {uniqueDates.map((date) => (
            <TabSelector
              key={date}
              isActive={selectedTab === date}
              onClick={() => handleSelectTab(date)}
              className="whitespace-nowrap"
            >
              {moment(date).format('MMM DD, YYYY')}
            </TabSelector>
          ))}
        </nav>

        {/* Right Arrow */}
        {showRightArrow && (
          <button 
            onClick={() => handleScroll('right')}
            className="absolute right-0 z-10 p-2 bg-white shadow-md rounded-l-lg hover:bg-gray-100 transition-colors duration-200"
          >
            <ChevronRightIcon className="w-5 h-5 text-gray-600" />
          </button>
        )}
      </div>

      <div className="flex-grow">
        {uniqueDates?.length > 0 ? (
            uniqueDates.map((date) => (
                <TabPanel key={date} hidden={selectedTab !== date}>
                  <TableComponent
                    columns={columns}
                    data={filteredData}
                    pageSize={50}
                    hasActionButtons={currentUser?.role?.rep > 2}
                    rowActionButtons={rowActionButtons}
                    showFilters={false}
                    multiSelect={false}
                    rowClick={handleShowClientInfoModal}
                  />
                </TabPanel>
              ))
        ) : (
            <TableComponent
                columns={columns}
                data={filteredData}
                pageSize={50}
                hasActionButtons={currentUser?.role?.rep > 2}
                rowActionButtons={rowActionButtons}
                showFilters={false}
                multiSelect={false}
                rowClick={handleShowClientInfoModal}
                />
        )}
        
      </div>

      <footer className="text-md font-bold text-center bg-white px-4 py-2 shadow-inner border-t-4 border-zinc-200">
        <div className="flex flex-row justify-center">
          <div className="flex flex-row">
            <span className="pr-6">No. of Loans: </span>
            <span className="pr-6">{noOfLoans}</span>
          </div>
          <div className="flex flex-row">
            <span className="pr-6">Total Amount Release: </span>
            <span className="pr-6">{formatPricePhp(totalAmountRelease)}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ForeCastApplication;