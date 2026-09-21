// src/components/clients/ClientQuickEditModal.js
// Restricted edit surface for Active/Offset clients — ONLY duplicate and
// groupLeader are editable in the UI. branchId/groupId/loId/status must
// go through their proper reassignment/transfer flows, never through this
// shortcut. The save itself still sends the FULL record via
// saveClientPartial — see that file for why: the previous version sent
// only { _id, duplicate, groupLeader } on the assumption the backend
// merges partial updates, and that assumption was wrong.
import React, { useState } from 'react';
import Modal from '@/lib/ui/Modal';
import { toast } from 'react-toastify';
import { saveClientPartial } from '@/lib/clients/save-client-partial';

export default function ClientQuickEditModal({ client, show, onClose, onSaved }) {
    const [duplicate, setDuplicate] = useState(!!client?.duplicate);
    const [groupLeader, setGroupLeader] = useState(!!client?.groupLeader);
    const [saving, setSaving] = useState(false);

    if (!client) return null;

    const handleSave = async () => {
        setSaving(true);
        const res = await saveClientPartial(client._id, { duplicate, groupLeader });
        setSaving(false);

        if (res.success) {
            toast.success('Client updated.');
            onSaved?.(client._id, { duplicate, groupLeader });
            onClose();
        } else {
            toast.error(res.message || 'Failed to update client.');
        }
    };

    return (
        <Modal show={show} onClose={onClose} title="Edit Client" size="sm">
            <div className="space-y-4">
                <p className="text-sm text-gray-500">
                    {client.fullName || `${client.lastName}, ${client.firstName}`}
                </p>
                <ToggleRow label="Duplicate" description="Flag this client as a duplicate record"
                    checked={duplicate} onChange={setDuplicate} />
                <ToggleRow label="Group Leader" description="Designate this client as their group's leader"
                    checked={groupLeader} onChange={setGroupLeader} />
                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                        Cancel
                    </button>
                    <button type="button" onClick={handleSave} disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

function ToggleRow({ label, description, checked, onChange }) {
    return (
        <div className="flex items-center justify-between py-1">
            <div>
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-400">{description}</p>
            </div>
            <button type="button" onClick={() => onChange(!checked)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-teal-600' : 'bg-gray-200'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </div>
    );
}