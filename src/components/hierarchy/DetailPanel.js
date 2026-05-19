import React from 'react';
import DivisionForm from './DivisionForm';
import RegionForm from './RegionForm';
import AreaForm from './AreaForm';
import { PencilIcon } from '@heroicons/react/24/outline';

const DetailPanel = ({
    mode,
    entity,
    allBranches,
    allManagers,
    divisions,
    onEdit,
    onCancel,
    onSaved,
}) => {
    const { type, data } = entity;
    const entityLabel = { division: 'Division', region: 'Region', area: 'Area' }[type];
    const isView = mode === 'view';
    const isAdd  = mode === 'add';

    const commonProps = { mode, data, allBranches, allManagers, divisions, onSaved, onCancel };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
                <div>
                    <p className="text-xs font-semibold text-teal-600 uppercase tracking-wider mb-0.5">{entityLabel}</p>
                    <h2 className="text-lg font-semibold text-gray-800">
                        {isAdd ? `New ${entityLabel}` : data.name ?? '—'}
                    </h2>
                </div>
                {/* ── Edit: icon + text link, NOT a full button ── */}
                {isView && data._id && (
                    <button
                        onClick={onEdit}
                        className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-800 font-medium transition-colors"
                    >
                        <PencilIcon className="w-4 h-4" />
                        Edit
                    </button>
                )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
                {type === 'division' && <DivisionForm {...commonProps} />}
                {type === 'region'   && <RegionForm   {...commonProps} />}
                {type === 'area'     && <AreaForm      {...commonProps} />}
            </div>
        </div>
    );
};

export default DetailPanel;