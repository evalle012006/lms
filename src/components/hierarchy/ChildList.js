import React from 'react';

/**
 * ChildList — read-only list of child entities shown inside the detail panel.
 * Used by DivisionForm (shows regions), RegionForm (shows areas), AreaForm (shows branches).
 */
const ChildList = ({ title, items = [] }) => {
    if (items.length === 0) return null;

    return (
        <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</p>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
                {items.map((item, i) => (
                    <div
                        key={i}
                        className={`flex items-center justify-between px-3 py-2.5 ${
                            i < items.length - 1 ? 'border-b border-gray-100' : ''
                        } bg-white`}
                    >
                        <span className="text-sm text-gray-700">{item.label}</span>
                        {item.sub && (
                            <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{item.sub}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ChildList;