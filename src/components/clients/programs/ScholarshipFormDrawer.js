// src/components/clients/programs/ScholarshipFormDrawer.js
// Add / Edit drawer for scholarship program records.
// Props:
//   isOpen       {bool}
//   onClose      {fn}
//   clientId     {string}
//   program      {object|null}  — null = add mode, object = edit mode
//   onSaved      {fn(program)}  — called after successful save

import React, { useState, useEffect, useRef } from 'react';
import moment from 'moment';
import { toast } from 'react-toastify';
import { X, Upload, Loader2, Trash2 } from 'lucide-react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { useSignedUrl } from 'hooks/useSignedUrl';

// ─── Tiny field wrapper ───────────────────────────────────────────────────────
const Field = ({ label, required, children }) => (
    <div>
        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        {children}
    </div>
);

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-1 focus:border-transparent';

// ─── Age helper (derived, never stored) ──────────────────────────────────────
function calcAge(birthdate) {
    if (!birthdate) return '';
    return moment().diff(moment(birthdate), 'years');
}

// ─── Picture preview with signed URL ─────────────────────────────────────────
function PicturePreview({ pictureKey, localPreview }) {
    const { signedUrl } = useSignedUrl(localPreview ? null : pictureKey);
    const src = localPreview || signedUrl;
    if (!src) return null;
    return (
        <img
            src={src}
            alt="Scholar"
            className="w-24 h-32 object-cover rounded border border-gray-200 mt-2"
        />
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ScholarshipFormDrawer({ isOpen, onClose, clientId, program, onSaved }) {
    const isEdit = !!program?._id;
    const pictureInputRef = useRef(null);

    const EMPTY = {
        scholar_name: '',
        birthdate: '',
        sex: '',
        year_level: '',
        school_name: '',
        course: '',
        grant_date: '',
    };

    const [form, setForm] = useState(EMPTY);
    const [pictureKey, setPictureKey] = useState(null);
    const [localPreview, setLocalPreview] = useState(null);
    const [pendingPictureFile, setPendingPictureFile] = useState(null);
    const [saving, setSaving] = useState(false);

    // Populate form in edit mode
    useEffect(() => {
        if (!isOpen) return;
        if (isEdit) {
            setForm({
                scholar_name: program.scholar_name || '',
                birthdate: program.birthdate || '',
                sex: program.sex || '',
                year_level: program.year_level || '',
                school_name: program.school_name || '',
                course: program.course || '',
                grant_date: program.grant_date || '',
            });
            setPictureKey(program.picture_key || null);
            setLocalPreview(null);
            setPendingPictureFile(null);
        } else {
            setForm(EMPTY);
            setPictureKey(null);
            setLocalPreview(null);
            setPendingPictureFile(null);
        }
    }, [isOpen, program]);

    if (!isOpen) return null;

    const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

    // ── Picture selection ─────────────────────────────────────────────────
    function handlePictureChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingPictureFile(file);
        setLocalPreview(URL.createObjectURL(file));
    }

    // ── Upload picture to DO Spaces via existing /api/upload ─────────────
    async function uploadPicture(programId) {
        if (!pendingPictureFile) return pictureKey; // no change

        const formData = new FormData();
        formData.append('file', pendingPictureFile);
        formData.append('origin', 'client-programs');
        formData.append('uuid', programId);

        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!data.fileKey) throw new Error('Picture upload failed.');
        return data.fileKey;
    }

    // ── Save ──────────────────────────────────────────────────────────────
    async function handleSave() {
        const required = ['scholar_name', 'birthdate', 'sex', 'year_level', 'school_name', 'course', 'grant_date'];
        const missing = required.filter(f => !form[f]?.trim());
        if (missing.length) {
            toast.error('Please fill in all required fields.');
            return;
        }

        setSaving(true);
        try {
            // 1. Save program record first (to get _id for upload path)
            const saveRes = await fetchWrapper.post(
                getApiBaseUrl() + 'clients/programs/save',
                {
                    ...(isEdit ? { _id: program._id } : {}),
                    client_id: clientId,
                    program_type: 'scholarship',
                    ...form,
                }
            );

            if (!saveRes.success) {
                toast.error(saveRes.message || 'Failed to save scholarship.');
                setSaving(false);
                return;
            }

            const savedProgramId = saveRes.program._id;

            // 2. Upload picture if a new one was selected
            let finalPictureKey = pictureKey;
            if (pendingPictureFile) {
                finalPictureKey = await uploadPicture(savedProgramId);

                // 3. Patch the picture_key back onto the record
                await fetchWrapper.post(
                    getApiBaseUrl() + 'clients/programs/save',
                    { _id: savedProgramId, picture_key: finalPictureKey }
                );
            }

            toast.success(isEdit ? 'Scholarship updated.' : 'Scholarship added.');
            onSaved({ ...saveRes.program, picture_key: finalPictureKey });
            onClose();
        } catch (err) {
            console.error(err);
            toast.error('An error occurred. Please try again.');
        } finally {
            setSaving(false);
        }
    }

    const age = calcAge(form.birthdate);

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

            {/* Drawer */}
            <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-xl z-50 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {isEdit ? 'Edit Scholarship' : 'Add Scholarship'}
                    </h2>
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

                    {/* Scholar name */}
                    <Field label="Name of Scholar" required>
                        <input
                            className={inputCls}
                            value={form.scholar_name}
                            onChange={set('scholar_name')}
                            placeholder="Full name of scholar"
                        />
                    </Field>

                    {/* Birthdate + Age (read-only derived) */}
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Birthdate" required>
                            <input
                                type="date"
                                className={inputCls}
                                value={form.birthdate}
                                onChange={set('birthdate')}
                            />
                        </Field>
                        <Field label="Age">
                            <input
                                className={`${inputCls} bg-gray-50 text-gray-500`}
                                value={age !== '' ? `${age} years old` : ''}
                                readOnly
                                placeholder="Auto-computed"
                            />
                        </Field>
                    </div>

                    {/* Gender */}
                    <Field label="Gender" required>
                        <select className={inputCls} value={form.sex} onChange={set('sex')}>
                            <option value="">Select gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </select>
                    </Field>

                    {/* Year Level */}
                    <Field label="Year Level" required>
                        <input
                            className={inputCls}
                            value={form.year_level}
                            onChange={set('year_level')}
                            placeholder="e.g. 1st Year, Grade 10"
                        />
                    </Field>

                    {/* School */}
                    <Field label="Name of School" required>
                        <input
                            className={inputCls}
                            value={form.school_name}
                            onChange={set('school_name')}
                            placeholder="School / University name"
                        />
                    </Field>

                    {/* Course */}
                    <Field label="Course / Strand" required>
                        <input
                            className={inputCls}
                            value={form.course}
                            onChange={set('course')}
                            placeholder="e.g. BSBA, Senior High – STEM"
                        />
                    </Field>

                    {/* Grant Date */}
                    <Field label="Date of Scholarship Grant" required>
                        <input
                            type="date"
                            className={inputCls}
                            value={form.grant_date}
                            onChange={set('grant_date')}
                        />
                    </Field>

                    {/* Picture 3x4 */}
                    <Field label="Picture (3×4)">
                        <div className="flex items-start gap-4">
                            <div>
                                <button
                                    type="button"
                                    onClick={() => pictureInputRef.current?.click()}
                                    className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-primary-1 hover:text-primary-1 transition-colors"
                                >
                                    <Upload className="w-4 h-4" />
                                    {pictureKey || localPreview ? 'Replace picture' : 'Upload picture'}
                                </button>
                                <p className="text-xs text-gray-400 mt-1">JPG or PNG, 3×4 portrait</p>
                            </div>
                            <PicturePreview pictureKey={pictureKey} localPreview={localPreview} />
                        </div>
                        <input
                            ref={pictureInputRef}
                            type="file"
                            accept="image/jpeg,image/png"
                            className="hidden"
                            onChange={handlePictureChange}
                        />
                    </Field>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg bg-primary-1 text-white text-sm font-medium hover:bg-primary-1/90 disabled:opacity-60 flex items-center gap-2"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Scholarship'}
                    </button>
                </div>
            </div>
        </>
    );
}