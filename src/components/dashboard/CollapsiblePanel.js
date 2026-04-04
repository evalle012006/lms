import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const CollapsiblePanel = ({ title, subtitle, children, defaultOpen = true }) => {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div>
                    <h3 className="text-sm font-bold text-gray-800">{title}</h3>
                    {subtitle && (
                        <p className="text-xs text-gray-400 font-semibold mt-0.5">{subtitle}</p>
                    )}
                </div>
                <button
                    onClick={() => setOpen(!open)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-transform duration-200"
                    style={{ transform: open ? 'none' : 'rotate(180deg)' }}
                >
                    <ChevronDown size={14} />
                </button>
            </div>
            <div
                className="overflow-hidden transition-all duration-300"
                style={{ maxHeight: open ? '2000px' : '0', opacity: open ? 1 : 0 }}
            >
                <div className="p-3">{children}</div>
            </div>
        </div>
    );
};

export default CollapsiblePanel;