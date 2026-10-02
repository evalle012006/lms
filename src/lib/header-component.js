import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { 
  ArrowRightOnRectangleIcon,
  UserIcon,
  ChevronDownIcon,
  PencilSquareIcon,
  Cog6ToothIcon,
  LockClosedIcon,
  LockOpenIcon
} from '@heroicons/react/24/solid';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useSignedUrl } from 'hooks/useSignedUrl';
import { getApiBaseUrl } from '@/lib/constants';
import { fetchWrapper } from '@/lib/fetch-wrapper';

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

const BranchLockBadge = ({ user }) => {
  const [locked, setLocked] = React.useState(null);
  const router = useRouter();

  React.useEffect(() => {
    let mounted = true;
    const branchId = user?.designatedBranchId;
    if (!branchId) return;

    const fetchLockStatus = async () => {
      try {
        const res = await fetchWrapper.get(
          `${getApiBaseUrl()}branches?` + new URLSearchParams({ _id: branchId })
        );
        if (mounted && res?.branch) {
          setLocked(!!res.branch.lockTransaction);
        }
      } catch (_) {}
    };

    fetchLockStatus();
    // const interval = setInterval(fetchLockStatus, 30000);
    return () => { mounted = false; /* clearInterval(interval); */ };
  }, [user?.designatedBranchId]);

  if (locked === null) return null;

  return (
    <div
      title={locked ? 'Branch transactions are LOCKED' : 'Branch transactions are OPEN'}
      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${
        locked
          ? 'bg-red-50 border-red-300 text-red-700'
          : 'bg-green-50 border-green-300 text-green-700'
      }`}
    >
      {locked
        ? <LockClosedIcon className="h-3.5 w-3.5" />
        : <LockOpenIcon className="h-3.5 w-3.5" />
      }
      <span className="hidden sm:inline">{locked ? 'Locked' : 'Open'}</span>
    </div>
  );
};

const HeaderComponent = () => {
  const pageTitle = useSelector(state => state.global.title);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const profileButtonRef = useRef(null);
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
  <div className="sticky top-0 z-[100]">
    {/* MAIN HEADER — ALWAYS 72px */}
    <header className="relative z-30 flex h-[72px] items-center justify-between border-b border-[var(--border)] bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">

      {/* LEFT */}
      <div className="min-w-0 flex-1">
        <div className="text-sm text-[var(--muted)]">
          Lending Management System
        </div>

        <div className="truncate text-base font-semibold text-[var(--foreground)]">
          {pageTitle}
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-2 sm:gap-3">

        {/* Branch Lock Status */}
        {(userState?.role?.rep === 3 || userState?.role?.rep === 4) && (
          <BranchLockBadge user={userState} />
        )}

        {/* Notification */}
        <div className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-[var(--surface-secondary)]">
          <NotificationBell />
        </div>

        {/* Profile */}
        <div className="relative" ref={dropdownRef}>
          <div ref={profileButtonRef} className="flex cursor-pointer items-center rounded-xl px-2 py-1.5 transition hover:bg-[var(--surface-secondary)] sm:px-3" onClick={toggleDropdown}>
            <div className="mr-2 hidden text-right sm:block">
              <p className="text-sm font-medium text-gray-900">{fullName}</p>

              <div className="flex items-center">
                <span className="text-xs text-gray-500">{userState?.role?.label || 'User'}</span></div>
              </div>
            <Avatar name={fullName} src={profileUrl}/>
            <ChevronDownIcon className={`ml-1 h-4 w-4 text-gray-500 transition-transform ${ isDropdownOpen ? 'rotate-180' : ''}`}/>
          </div>
        </div>
      </div>
    </header>
    {isDropdownOpen && (
      <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="border-b border-gray-100 px-4 py-3">
        <p className="truncate text-sm font-semibold text-gray-900">{fullName}</p>
      </div>
    {(userState?.role?.rep === 1 || userState?.root) && (
      <button onClick={navigateToSettings} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100">
        <Cog6ToothIcon className="h-4 w-4 text-gray-500" />System Settings
      </button>
    )}
      <button onClick={handleLogout} className="flex w-full items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50">
        <ArrowRightOnRectangleIcon className="h-4 w-4 text-gray-500" />Logout
      </button>
      </div>
    )}
  </div>
);
};

export default HeaderComponent;