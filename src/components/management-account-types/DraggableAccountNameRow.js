import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Bars3Icon, PencilIcon, TrashIcon } from '@heroicons/react/24/solid';
import { ItemTypes, ACCOUNT_GROUP_OPTIONS } from './constants';

const DraggableAccountNameRow = ({ account, index, moveItem, onEdit, onDelete, onDragEnd }) => {
    const ref = useRef(null);

    const [{ handlerId }, drop] = useDrop({
        accept: ItemTypes.ACCOUNT_NAME,
        collect: monitor => ({ handlerId: monitor.getHandlerId() }),
        hover(item, monitor) {
            if (!ref.current) return;
            const dragIndex  = item.index;
            const hoverIndex = index;
            if (dragIndex === hoverIndex) return;
            const rect    = ref.current.getBoundingClientRect();
            const midY    = (rect.bottom - rect.top) / 2;
            const clientY = monitor.getClientOffset().y - rect.top;
            if (dragIndex < hoverIndex && clientY < midY) return;
            if (dragIndex > hoverIndex && clientY > midY) return;
            moveItem(dragIndex, hoverIndex);
            item.index = hoverIndex;
        },
    });

    const [{ isDragging }, drag] = useDrag({
        type: ItemTypes.ACCOUNT_NAME,
        item: () => ({ id: account._id, index, originalIndex: index }),
        collect: monitor => ({ isDragging: monitor.isDragging() }),
        end: (item, monitor) => {
            if (monitor.didDrop() || item.index !== item.originalIndex) onDragEnd();
        },
    });

    drag(drop(ref));

    const accountGroups = Array.isArray(account.account_groups) ? account.account_groups :
                          (account.account_group ? [account.account_group] : []);

    const hasFormulas = account.prev_balance_formula || account.debit_formula
        || account.credit_formula || account.balance_formula;

    return (
        <tr
            ref={ref}
            data-handler-id={handlerId}
            className="hover:bg-gray-50 cursor-move"
            style={{ opacity: isDragging ? 0.4 : 1 }}
        >
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                <div className="flex items-center">
                    <Bars3Icon className="h-5 w-5 text-gray-400 mr-3" />
                    <div className="flex flex-col">
                        <span>{account.account_name}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {account.service_charge && (
                                <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">S.C.</span>
                            )}
                            {hasFormulas && !account.service_charge && (
                                <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">computed</span>
                            )}
                            {hasFormulas && account.service_charge && (
                                <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">formula</span>
                            )}
                            {accountGroups.map(g => (
                                <span key={g} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                    {ACCOUNT_GROUP_OPTIONS.find(o => o.value === g)?.label ?? g}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 text-sm text-gray-600">{account.description || '-'}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {account.inserted_by_user
                    ? `${account.inserted_by_user.firstName} ${account.inserted_by_user.lastName}`.trim()
                    : '-'}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-center">
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={e => { e.stopPropagation(); onEdit(account); }}
                        className="text-teal-600 hover:text-teal-900 transition-colors"
                        title="Edit"
                    >
                        <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                        onClick={e => { e.stopPropagation(); onDelete(account); }}
                        className="text-red-600 hover:text-red-900 transition-colors"
                        title="Delete"
                    >
                        <TrashIcon className="h-5 w-5" />
                    </button>
                </div>
            </td>
        </tr>
    );
};

export default DraggableAccountNameRow;