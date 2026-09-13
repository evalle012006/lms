import React, { useEffect } from "react";
import { XMarkIcon } from '@heroicons/react/24/outline';

const Modal = ({ 
  children, 
  show, 
  title, 
  onClose, 
  footer = false, 
  marginTop,
  width = "90vw",
  maxWidth = "1200px",
  height = "90vh",
  maxHeight = "800px",
  size = "default", // "sm", "md", "lg", "xl", "full"
  zIndex = 50,
}) => {

  // Size configurations
  // FIX: every size below used a flat pixel width with no viewport cap —
  // on any screen narrower than that (any phone, for most of these), the
  // modal overflowed horizontally instead of shrinking. CSS min() caps each
  // at the viewport width (minus room for the outer p-4 padding) while still
  // preferring the original px value on wider screens — same visual result
  // as before on desktop, actually responsive on mobile.
  const sizeConfigs = {
    sm: { width: "min(400px, calc(100vw - 2rem))", maxWidth: "min(400px, calc(100vw - 2rem))", height: "auto", maxHeight: "min(500px, calc(100vh - 2rem))" },
    md: { width: "min(600px, calc(100vw - 2rem))", maxWidth: "min(600px, calc(100vw - 2rem))", height: "auto", maxHeight: "min(600px, calc(100vh - 2rem))" },
    lg: { width: "min(800px, calc(100vw - 2rem))", maxWidth: "min(800px, calc(100vw - 2rem))", height: "auto", maxHeight: "min(700px, calc(100vh - 2rem))" },
    xl: { width: "min(1000px, calc(100vw - 2rem))", maxWidth: "min(1000px, calc(100vw - 2rem))", height: "auto", maxHeight: "min(800px, calc(100vh - 2rem))" },
    "2xl": { width: "min(1200px, calc(100vw - 2rem))", maxWidth: "min(1200px, calc(100vw - 2rem))", height: "auto", maxHeight: "min(900px, calc(100vh - 2rem))" },
    full: { width: "95vw", maxWidth: "95vw", height: "95vh", maxHeight: "95vh" },
    default: { width, maxWidth, height, maxHeight }
  };

  const config = sizeConfigs[size] || sizeConfigs.default;

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [show]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && show) {
        onClose();
      }
    };

    if (show) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [show, onClose]);

  if (!show) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"
        style={{ zIndex }}
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: zIndex }}>
        <div 
          className="relative bg-white rounded-lg shadow-2xl flex flex-col"
          style={{
            width: config.width,
            maxWidth: config.maxWidth,
            height: config.height,
            maxHeight: config.maxHeight,
            marginTop: marginTop || '0'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {(title || !footer) && (
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
              {title && (
                <h2 className="text-xl font-semibold text-gray-900 truncate pr-4">
                  {title}
                </h2>
              )}
              <button
                className="flex-shrink-0 p-1 ml-auto text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                onClick={onClose}
                type="button"
              >
                <span className="sr-only">Close</span>
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Body - Scrollable */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="p-4">
              {children}
            </div>
          </div>

          {/* Footer */}
          {footer && (
            <div className="flex items-center justify-end p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Modal;