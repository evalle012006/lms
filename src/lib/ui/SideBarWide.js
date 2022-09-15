import React from 'react';
import { XIcon } from '@heroicons/react/outline';

const SideBarWide = ({ title = '', children, showSidebar = false, setShowSidebar, onClose, hasCloseButton = true, position = 'right' }) => {

    const handleClose = () => {
        setShowSidebar(false);
        onClose && onClose();
    }

    const placementShow = position === 'right' ? 'right-0-custom' : 'left-0-custom';
    const placementHide = position === 'right' ? '-right-0-wide' : '-left-0-wide';

    return (
        <React.Fragment>
            <div className={`sidebar-container bg-white ${showSidebar ? placementShow : placementHide}`}>
                <div className="sidebar-sub-container" style={{ width: '80vw' }}>
                    <div className="sidebar-header">
                        <div className='sidebar-title'>{ title }</div>
                        {hasCloseButton && (
                            <button onClick={handleClose}>
                                <XIcon className="h-6 w-6" />
                            </button>
                        )}
                    </div>
                    <div className='mt-2 h-full'>
                        { children }
                    </div>
                </div>
            </div>
        </React.Fragment>
    )
}

export default SideBarWide;