import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { 
  ArrowRightOnRectangleIcon,
  UserIcon,
  ChevronDownIcon,
  PencilSquareIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/solid';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useSignedUrl } from 'hooks/useSignedUrl';

const Avatar = ({ name, src, className }) => {
  // Only pass src to Image if it's a valid absolute URL
  const isValidSrc = src && (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/'));

  if (isValidSrc) {
    return (
      <div className={`h-10 w-10 rounded-full overflow-hidden ${className}`}>
        <Image
          src={src}
          alt={name}
          width={40}
          height={40}
          className="object-cover w-full h-full"
        />
      </div>
    );
  }

  // Fallback to initials
  const initials = name
    ?.split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase() ?? '?';

  return (
    <div className={`h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-medium ${className}`}>
      {initials}
    </div>
  );
};

const HeaderComponent = () => {
  const pageTitle = useSelector(state => state.global.title);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const router = useRouter();
  const userState = useSelector(state => state.user.data);
  const { signedUrl: profileUrl } = useSignedUrl(userState?.profile);
  
  const fullName = `${userState?.firstName || ''} ${userState?.lastName || ''}`.trim();

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleLogout = () => {
    window.location.href = '/logout';
  };

  const navigateToProfile = () => {
    router.push(`/settings/users/${userState._id}`);
    setIsDropdownOpen(false);
  };

  const navigateToSettings = () => {
    router.push('/settings/system');
    setIsDropdownOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="flex justify-between items-center bg-white px-6 py-3 border-b border-gray-200">
      <div className="page-title text-xl font-medium">
        {pageTitle}
      </div>
      
      <div className="flex items-center gap-4">
        {/* Notification Bell - NEW */}
        <NotificationBell />

        {/* User Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <div 
            className="flex items-center cursor-pointer"
            onClick={toggleDropdown}
          >
            <div className="flex flex-col items-end mr-3">
              <p className="text-xs text-gray-500">{userState?.email}</p>
              <div className="flex items-center">
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                  {userState?.role?.label || 'User'}
                </span>
              </div>
            </div>
            
            <Avatar 
              name={fullName}
              src={profileUrl} 
            />
            <ChevronDownIcon className="w-4 h-4 ml-1 text-gray-600" />
          </div>
          
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg py-1 z-50">
              {/* User info for mobile view */}
              <div className="px-4 py-3 text-sm text-gray-700 border-b border-gray-200 md:hidden">
                <p className="font-medium text-gray-900">{fullName}</p>
              </div>
              
              {(userState?.role?.rep === 1 || userState?.root) && (
                <button 
                  onClick={navigateToSettings}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Cog6ToothIcon className="w-4 h-4 mr-2" />
                  System Settings
                </button>
              )}
              
              <button 
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4 mr-2" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HeaderComponent;