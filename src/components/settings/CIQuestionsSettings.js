// src/components/settings/CIQuestionsSettings.js
// System Settings — CI Questions section.
// Admin adds/edits/reorders/deletes questions that appear in the CI Investigation form.
// Each question has: text, answerType (text | yesno), required flag.
// Saved to settings.ciQuestions (jsonb array) via existing /api/v2/settings/system endpoint.

import React, { useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { setSystemSettings } from '@/redux/actions/systemActions';
import { toast } from 'react-toastify';
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { generateUUID } from '@/lib/utils';

// ── Single question row ────────────────────────────────────────────────────
const QuestionRow = ({ question, index, total, onChange, onDelete, onMoveUp, onMoveDown }) => (
    <div className="flex items-start gap-3 p-4 bg-white border border-gray-200
        rounded-xl hover:border-gray-300 transition-colors">

        {/* Reorder controls */}
        <div className="flex flex-col gap-1 flex-shrink-0 mt-1">
            <button type="button" onClick={onMoveUp} disabled={index === 0}
                className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20
                    disabled:cursor-not-allowed transition-colors">
                <ChevronUp className="w-4 h-4" />
            </button>
            <GripVertical className="w-4 h-4 text-gray-300" />
            <button type="button" onClick={onMoveDown} disabled={index === total - 1}
                className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20
                    disabled:cursor-not-allowed transition-colors">
                <ChevronDown className="w-4 h-4" />
            </button>
        </div>

        {/* Question number */}
        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold
            flex items-center justify-center flex-shrink-0 mt-1">
            {index + 1}
        </div>

        {/* Fields */}
        <div className="flex-1 space-y-2">
            <input
                type="text"
                value={question.question}
                onChange={e => onChange({ ...question, question: e.target.value })}
                placeholder="Enter question text..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
            />
            <div className="flex items-center gap-4 flex-wrap">
                {/* Answer type */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-medium">Answer type:</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                            type="radio"
                            name={`answerType_${question.id}`}
                            value="text"
                            checked={question.answerType === 'text'}
                            onChange={() => onChange({ ...question, answerType: 'text' })}
                            className="w-3.5 h-3.5 text-blue-600"
                        />
                        <span className="text-xs text-gray-700">Text</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                            type="radio"
                            name={`answerType_${question.id}`}
                            value="yesno"
                            checked={question.answerType === 'yesno'}
                            onChange={() => onChange({ ...question, answerType: 'yesno' })}
                            className="w-3.5 h-3.5 text-blue-600"
                        />
                        <span className="text-xs text-gray-700">Yes / No</span>
                    </label>
                </div>

                {/* Required toggle */}
                <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={question.required}
                        onChange={e => onChange({ ...question, required: e.target.checked })}
                        className="w-3.5 h-3.5 rounded text-blue-600"
                    />
                    <span className="text-xs text-gray-700">Required</span>
                </label>
            </div>
        </div>

        {/* Delete */}
        <button type="button" onClick={onDelete}
            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50
                rounded-lg transition-colors flex-shrink-0 mt-1"
            title="Remove question">
            <Trash2 className="w-4 h-4" />
        </button>
    </div>
);

// ── Main component ────────────────────────────────────────────────────────
const CIQuestionsSettings = () => {
    const dispatch   = useDispatch();
    const settings   = useSelector(s => s.systemSettings.data);
    const [saving,   setSaving]   = useState(false);

    // Local draft of questions — initialized from Redux settings
    const [questions, setQuestions] = useState(
        () => Array.isArray(settings?.ciQuestions) ? settings.ciQuestions : []
    );
    const [dirty, setDirty] = useState(false);

    const update = useCallback((updater) => {
        setQuestions(prev => {
            const next = updater(prev);
            setDirty(true);
            return next;
        });
    }, []);

    const handleAdd = () => {
        update(prev => [...prev, {
            id:         generateUUID(),
            question:   '',
            answerType: 'text',
            required:   false,
        }]);
    };

    const handleChange = (index, updated) => {
        update(prev => prev.map((q, i) => i === index ? updated : q));
    };

    const handleDelete = (index) => {
        update(prev => prev.filter((_, i) => i !== index));
    };

    const handleMoveUp = (index) => {
        if (index === 0) return;
        update(prev => {
            const next = [...prev];
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
            return next;
        });
    };

    const handleMoveDown = (index) => {
        update(prev => {
            if (index === prev.length - 1) return prev;
            const next = [...prev];
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
            return next;
        });
    };

    const handleSave = async () => {
        // Validate — no empty questions
        const hasEmpty = questions.some(q => !q.question.trim());
        if (hasEmpty) {
            toast.error('Please fill in all question texts before saving.');
            return;
        }

        setSaving(true);
        try {
            const res = await fetchWrapper.post(
                getApiBaseUrl() + 'settings/system',
                { _id: settings._id, ciQuestions: questions }
            );
            if (!res.success) throw new Error(res.message || 'Save failed.');
            dispatch(setSystemSettings({ ...settings, ciQuestions: questions }));
            setDirty(false);
            toast.success('CI Questions saved successfully.');
        } catch (err) {
            toast.error(err.message || 'Failed to save CI Questions.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                    <h2 className="text-base font-semibold text-gray-900">CI Investigation Questions</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        These questions appear on the CI Investigation form. Investigators must
                        answer required questions before saving.
                    </p>
                </div>
                {dirty && (
                    <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                        Unsaved changes
                    </span>
                )}
            </div>

            {/* Question list */}
            <div className="px-6 py-5 space-y-3">
                {questions.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 border-2 border-dashed
                        border-gray-200 rounded-xl">
                        <p className="text-sm">No CI questions configured yet.</p>
                        <p className="text-xs mt-1">
                            Add questions below — they will appear in the CI Investigation form.
                        </p>
                    </div>
                ) : (
                    questions.map((q, i) => (
                        <QuestionRow
                            key={q.id}
                            question={q}
                            index={i}
                            total={questions.length}
                            onChange={(updated) => handleChange(i, updated)}
                            onDelete={() => handleDelete(i)}
                            onMoveUp={() => handleMoveUp(i)}
                            onMoveDown={() => handleMoveDown(i)}
                        />
                    ))
                )}

                {/* Add question button */}
                <button
                    type="button"
                    onClick={handleAdd}
                    className="w-full py-2.5 border-2 border-dashed border-blue-200
                        text-blue-600 text-sm font-medium rounded-xl
                        hover:border-blue-400 hover:bg-blue-50 transition-colors
                        flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add Question
                </button>
            </div>

            {/* Footer — save */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex
                items-center justify-between">
                <p className="text-xs text-gray-400">
                    {questions.length} question{questions.length !== 1 ? 's' : ''} configured
                </p>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !dirty}
                    className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold
                        rounded-xl hover:bg-blue-700 disabled:opacity-50
                        disabled:cursor-not-allowed transition-colors flex items-center gap-2">
                    {saving && (
                        <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10"
                                stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor"
                                d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                    )}
                    {saving ? 'Saving…' : 'Save Questions'}
                </button>
            </div>
        </div>
    );
};

export default CIQuestionsSettings;