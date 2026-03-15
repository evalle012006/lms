import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Bars3Icon, PencilIcon, TrashIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import { ItemTypes, ACCOUNT_GROUP_OPTIONS, DISPLAY_GROUP_OPTIONS } from './constants';

const DraggableAccountType = ({ type, index, moveItem, isSelected, onClick, onEdit, onDelete, onDragEnd }) => {
    const ref = useRef(null);

    const [{ handlerId }, drop] = useDrop({
        accept: ItemTypes.ACCOUNT_TYPE,
        collect: monitor => ({ handlerId: monitor.getHandlerId() }),
        hover(item, monitor) {
            if (!ref.current) return;
            const dragIndex  = item.index;
            const hoverIndex = index;
            if (dragIndex === hoverIndex) return;
            const rect      = ref.current.getBoundingClientRect();
            const midY      = (rect.bottom - rect.top) / 2;
            const clientY   = monitor.getClientOffset().y - rect.top;
            if (dragIndex < hoverIndex && clientY < midY) return;
            if (dragIndex > hoverIndex && clientY > midY) return;
            moveItem(dragIndex, hoverIndex);
            item.index = hoverIndex;
        },
    });

    const [{ isDragging }, drag] = useDrag({
        type: ItemTypes.ACCOUNT_TYPE,
        item: () => ({ id: type._id, index, originalIndex: index }),
        collect: monitor => ({ isDragging: monitor.isDragging() }),
        end: (item, monitor) => {
            if (monitor.didDrop() || item.index !== item.originalIndex) onDragEnd();
        },
    });

    drag(drop(ref));

    const accountGroups = Array.isArray(type.account_groups) ? type.account_groups :
                          (type.account_group ? [type.account_group] : []);
    const displayGroups = Array.isArray(type.display_groups) ? type.display_groups :
                          (type.display_group ? [type.display_group] : []);

    return (
        <div
            ref={ref}
            data-handler-id={handlerId}
            onClick={onClick}
            style={{ opacity: isDragging ? 0.4 : 1 }}
            className={`p-4 rounded-lg border cursor-move transition-all ${
                isSelected
                    ? 'bg-teal-50 border-teal-500 shadow-sm'
                    : 'bg-white border-gray-200 hover:border-teal-300'
            }`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center flex-1 min-w-0">
                    <Bars3Icon className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900">{type.type_name}</h3>
                        {type.description && (
                            <p className="text-sm text-gray-500 mt-0.5">{type.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <p className="text-xs text-gray-400">Code: {type.type_code}</p>
                            {accountGroups.map(g => (
                                <span key={g} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                    {ACCOUNT_GROUP_OPTIONS.find(o => o.value === g)?.label ?? g}
                                </span>
                            ))}
                            {displayGroups.map(g => (
                                <span key={g} className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                                    {DISPLAY_GROUP_OPTIONS.find(o => o.value === g)?.label ?? g}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                    <button
                        onClick={e => { e.stopPropagation(); onEdit(type); }}
                        className="text-teal-600 hover:text-teal-900 transition-colors"
                        title="Edit"
                    >
                        <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                        onClick={e => { e.stopPropagation(); onDelete(type); }}
                        className="text-red-600 hover:text-red-900 transition-colors"
                        title="Delete"
                    >
                        <TrashIcon className="h-4 w-4" />
                    </button>
                    <ChevronRightIcon className={`h-5 w-5 transition-colors ${isSelected ? 'text-teal-600' : 'text-gray-400'}`} />
                </div>
            </div>
        </div>
    );
};

export default DraggableAccountType;