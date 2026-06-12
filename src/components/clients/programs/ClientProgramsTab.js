// src/components/clients/programs/ClientProgramsTab.js
// "Programs" tab inside ClientDetailPage.
// Displays all programs (scholarship etc.) for a client.
// Only group leaders can add programs; any authenticated user can view/edit.
// When a client is no longer a group leader, existing records remain (status=inactive)
// but the Add button is hidden.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import moment from 'moment';
import { toast } from 'react-toastify';
import {
    GraduationCap, Plus, Pencil, Paperclip, Trash2,
    Upload, FileText, ExternalLink, Loader2, AlertTriangle, Lock
} from 'lucide-react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import ScholarshipFormDrawer from './ScholarshipFormDrawer';
import { useSignedUrl } from 'hooks/useSignedUrl';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calcAge(birthdate) {
    if (!birthdate) return '-';
    return `${moment().diff(moment(birthdate), 'years')} years old`;
}

const PROGRAM_LABEL = { scholarship: 'Scholarship' };

// ─── Single attachment row ────────────────────────────────────────────────────
function AttachmentRow({ attachment, onDelete }) {
    const { signedUrl } = useSignedUrl(attachment.file_key);
    const [deleting, setDeleting] = useState(false);

    async function handleDelete() {
        if (!confirm(`Remove attachment "${attachment.file_name}"?`)) return;
        setDeleting(true);
        try {
            const res = await fetchWrapper.post(
                getApiBaseUrl() + 'clients/programs/attachments/delete',
                { _id: attachment._id }
            );
            if (!res.success) { toast.error(res.message); return; }
            toast.success('Attachment removed.');
            onDelete(attachment._id);
        } catch {
            toast.error('Failed to remove attachment.');
        } finally {
            setDeleting(false);
        }
    }

    return (
        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 border border-gray-100 text-sm">
            <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="truncate text-gray-700">{attachment.file_name}</span>
            </div>
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                {signedUrl && (
                    <a
                        href={signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-gray-200 text-gray-500"
                        title="View file"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </a>
                )}
                <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 disabled:opacity-50"
                    title="Remove attachment"
                >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
}

// ─── Scholar picture ──────────────────────────────────────────────────────────
function ScholarPicture({ pictureKey }) {
    const { signedUrl, loading } = useSignedUrl(pictureKey);
    if (!pictureKey) return (
        <div className="w-16 h-20 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-400">
            <GraduationCap className="w-7 h-7" />
        </div>
    );
    if (loading) return <div className="w-16 h-20 bg-gray-100 rounded border border-gray-200 animate-pulse" />;
    if (!signedUrl) return null;
    return (
        <img
            src={signedUrl}
            alt="Scholar"
            className="w-16 h-20 object-cover rounded border border-gray-200"
        />
    );
}

// ─── Single program card ──────────────────────────────────────────────────────
function ProgramCard({ program, onEdit, onAttachmentAdded, onAttachmentDeleted }) {
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [attachments, setAttachments] = useState(program.client_program_attachments ?? []);

    const isInactive = program.status === 'inactive';

    async function handleAttachFile(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            // 1. Upload to DO Spaces
            const formData = new FormData();
            formData.append('file', file);
            formData.append('origin', 'client-program-attachments');
            formData.append('uuid', program._id);

            const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
            const uploadData = await uploadRes.json();
            if (!uploadData.fileKey) throw new Error('Upload failed.');

            // 2. Save metadata
            const saveRes = await fetchWrapper.post(
                getApiBaseUrl() + 'clients/programs/attachments/save',
                {
                    program_id: program._id,
                    file_name: file.name,
                    file_key: uploadData.fileKey,
                    file_type: file.type,
                }
            );
            if (!saveRes.success) throw new Error(saveRes.message);

            const newAttachment = saveRes.attachment;
            setAttachments(prev => [...prev, newAttachment]);
            onAttachmentAdded?.(program._id, newAttachment);
            toast.success('Attachment uploaded.');
        } catch (err) {
            toast.error(err.message || 'Failed to attach file.');
        } finally {
            setUploading(false);
            // Reset input so same file can be re-selected if needed
            e.target.value = '';
        }
    }

    function handleAttachmentDeleted(attachmentId) {
        setAttachments(prev => prev.filter(a => a._id !== attachmentId));
        onAttachmentDeleted?.(program._id, attachmentId);
    }

    return (
        <div className={`bg-white rounded-lg border ${isInactive ? 'border-gray-200 opacity-75' : 'border-gray-200'}`}>
            {/* Card header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-primary-1" />
                    <span className="font-semibold text-gray-900 text-sm">
                        {PROGRAM_LABEL[program.program_type] ?? program.program_type}
                    </span>
                    {isInactive && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
                            <Lock className="w-3 h-3" />
                            Inactive
                        </span>
                    )}
                </div>
                <button
                    onClick={() => onEdit(program)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-1 px-2 py-1 rounded hover:bg-gray-50"
                >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                </button>
            </div>

            {/* Card body */}
            <div className="p-4 flex gap-4">
                {/* Picture */}
                <div className="flex-shrink-0">
                    <ScholarPicture pictureKey={program.picture_key} />
                </div>

                {/* Details grid */}
                <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-3 text-sm min-w-0">
                    <div>
                        <p className="text-xs text-gray-400 uppercase font-medium">Name of Scholar</p>
                        <p className="text-gray-900 font-medium">{program.scholar_name}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase font-medium">Sex</p>
                        <p className="text-gray-900">{program.sex}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase font-medium">Birthdate</p>
                        <p className="text-gray-900">
                            {program.birthdate ? moment(program.birthdate).format('MMMM DD, YYYY') : '-'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase font-medium">Age</p>
                        <p className="text-gray-900">{calcAge(program.birthdate)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase font-medium">Year Level</p>
                        <p className="text-gray-900">{program.year_level}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase font-medium">Course / Strand</p>
                        <p className="text-gray-900">{program.course}</p>
                    </div>
                    <div className="col-span-2">
                        <p className="text-xs text-gray-400 uppercase font-medium">School</p>
                        <p className="text-gray-900">{program.school_name}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase font-medium">Grant Date</p>
                        <p className="text-gray-900">
                            {program.grant_date ? moment(program.grant_date).format('MMMM DD, YYYY') : '-'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Attachments section */}
            <div className="px-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase">
                        Requirements / Attachments ({attachments.length})
                    </span>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-1 text-xs text-primary-1 hover:underline disabled:opacity-50"
                    >
                        {uploading
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
                            : <><Paperclip className="w-3.5 h-3.5" /> Attach file</>
                        }
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,application/pdf,.doc,.docx"
                        className="hidden"
                        onChange={handleAttachFile}
                    />
                </div>
                {attachments.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No attachments yet.</p>
                ) : (
                    <div className="space-y-1.5">
                        {attachments.map(a => (
                            <AttachmentRow
                                key={a._id}
                                attachment={a}
                                onDelete={handleAttachmentDeleted}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main tab component ───────────────────────────────────────────────────────
export default function ClientProgramsTab({ client }) {
    const [programs, setPrograms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingProgram, setEditingProgram] = useState(null);
    const hasFetchedRef = useRef(false);

    const isGroupLeader = !!client?.groupLeader;

    // ── Fetch programs ────────────────────────────────────────────────────
    const fetchPrograms = useCallback(async () => {
        if (!client?._id) return;
        setLoading(true);
        try {
            const res = await fetchWrapper.get(
                getApiBaseUrl() + `clients/programs/list?clientId=${client._id}`
            );
            setPrograms(res.programs ?? []);
        } catch {
            toast.error('Failed to load programs.');
        } finally {
            setLoading(false);
        }
    }, [client?._id]);

    useEffect(() => {
        if (hasFetchedRef.current) return;
        hasFetchedRef.current = true;
        fetchPrograms();
    }, [fetchPrograms]);

    // ── Drawer handlers ───────────────────────────────────────────────────
    function handleAdd() {
        setEditingProgram(null);
        setDrawerOpen(true);
    }

    function handleEdit(program) {
        setEditingProgram(program);
        setDrawerOpen(true);
    }

    function handleSaved(program) {
        setPrograms(prev => {
            const idx = prev.findIndex(p => p._id === program._id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], ...program };
                return next;
            }
            return [program, ...prev];
        });
    }

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div>
            {/* Tab header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-base font-semibold text-gray-900">Programs</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Company programs availed by this client</p>
                </div>
                {/* Only show Add if the client is currently a group leader */}
                {isGroupLeader ? (
                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-1 text-white text-sm font-medium hover:bg-primary-1/90"
                    >
                        <Plus className="w-4 h-4" />
                        Add Program
                    </button>
                ) : (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        Client is not a group leader — new programs cannot be added
                    </div>
                )}
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
            ) : programs.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    <GraduationCap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-500">No programs on record</p>
                    {isGroupLeader && (
                        <p className="text-xs text-gray-400 mt-1">
                            Click "Add Program" to record a scholarship or other benefit.
                        </p>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {programs.map(p => (
                        <ProgramCard
                            key={p._id}
                            program={p}
                            onEdit={handleEdit}
                        />
                    ))}
                </div>
            )}

            {/* Drawer */}
            <ScholarshipFormDrawer
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                clientId={client?._id}
                program={editingProgram}
                onSaved={handleSaved}
            />
        </div>
    );
}