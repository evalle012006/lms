import { useState, useRef } from 'react';
import { OWN_ROW_VARIABLES, ACCOUNT_REF_SUFFIXES, slugifyName } from './constants';
import { validateFormulaClient } from './formulaUtils';

// ── AccountRefPicker ──────────────────────────────────────────────────────────
const AccountRefPicker = ({ accountNames = [], currentAccountId, onInsert }) => {
    const [open, setOpen]             = useState(false);
    const [search, setSearch]         = useState('');
    const [selectedId, setSelectedId] = useState('');
    const [suffix, setSuffix]         = useState('debit');

    const referenceable = accountNames.filter(a => a._id !== currentAccountId);
    const filtered      = referenceable.filter(a =>
        a.account_name.toLowerCase().includes(search.toLowerCase())
    );
    const selectedAcct  = referenceable.find(a => a._id === selectedId);
    const preview       = selectedAcct ? `${slugifyName(selectedAcct.account_name)}_${suffix}` : null;

    const handleInsert = () => {
        if (!preview) return;
        onInsert(preview);
        setOpen(false);
        setSelectedId('');
        setSearch('');
        setSuffix('debit');
    };

    if (referenceable.length === 0) return null;

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen(p => !p)}
                className={`px-2 py-0.5 text-xs font-mono rounded border transition-colors ${
                    open
                        ? 'bg-violet-200 text-violet-800 border-violet-300'
                        : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200'
                }`}
                title="Insert a reference to another account's values"
            >
                + ref
            </button>

            {open && (
                <div className="absolute z-50 left-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-700">Insert account reference</p>

                    <input
                        type="text"
                        placeholder="Search account name..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setSelectedId(''); }}
                        autoFocus
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
                    />

                    <div className="max-h-28 overflow-y-auto border border-gray-200 rounded">
                        {filtered.length === 0 ? (
                            <p className="text-xs text-gray-400 p-2">No accounts found</p>
                        ) : (
                            filtered.map(a => (
                                <button
                                    key={a._id}
                                    type="button"
                                    onClick={() => setSelectedId(a._id)}
                                    className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${
                                        selectedId === a._id
                                            ? 'bg-violet-100 text-violet-800 font-medium'
                                            : 'hover:bg-gray-50 text-gray-700'
                                    }`}
                                >
                                    {a.account_name}
                                    {a.service_charge && (
                                        <span className="ml-1 text-amber-500">S.C.</span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    {selectedId && (
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Column to reference:</p>
                            <div className="grid grid-cols-2 gap-1">
                                {ACCOUNT_REF_SUFFIXES.map(s => {
                                    if (s.sc && !selectedAcct?.service_charge) return null;
                                    const active = suffix === s.suffix;
                                    return (
                                        <button
                                            key={s.suffix}
                                            type="button"
                                            onClick={() => setSuffix(s.suffix)}
                                            className={`px-2 py-1 text-xs rounded border text-left transition-colors ${
                                                active
                                                    ? s.sc
                                                        ? 'bg-amber-100 border-amber-400 text-amber-800'
                                                        : 'bg-violet-100 border-violet-400 text-violet-800'
                                                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                                            }`}
                                        >
                                            {s.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-gray-100 gap-2">
                        <code className="text-xs text-gray-400 truncate flex-1">{preview ?? '—'}</code>
                        <div className="flex gap-1 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleInsert}
                                disabled={!preview}
                                className="text-xs bg-violet-600 text-white px-2 py-1 rounded hover:bg-violet-700 disabled:opacity-40"
                            >
                                Insert
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── FormulaInput ──────────────────────────────────────────────────────────────
const FormulaInput = ({ label, value, onChange, placeholder, accountNames = [], currentAccountId }) => {
    const [error, setError] = useState(null);
    const inputRef          = useRef(null);

    const handleChange = (e) => {
        onChange(e.target.value);
        setError(validateFormulaClient(e.target.value));
    };

    const insertAt = (text) => {
        const input   = inputRef.current;
        const current = value || '';

        if (!input) {
            const next = current + text;
            onChange(next);
            setError(validateFormulaClient(next));
            return;
        }

        const start  = input.selectionStart ?? current.length;
        const end    = input.selectionEnd   ?? current.length;
        const prefix = start > 0 && current[start - 1] !== ' ' ? ' ' : '';
        const suf    = end < current.length && current[end] !== ' '   ? ' ' : '';
        const next   = current.slice(0, start) + prefix + text + suf + current.slice(end);

        onChange(next);
        setError(validateFormulaClient(next));
        setTimeout(() => {
            input.focus();
            const pos = start + prefix.length + text.length + suf.length;
            input.setSelectionRange(pos, pos);
        }, 0);
    };

    return (
        <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
            <div className="flex flex-wrap items-center gap-1 mb-1">
                {OWN_ROW_VARIABLES.map(v => (
                    <button
                        key={v.key}
                        type="button"
                        title={v.title}
                        onClick={() => insertAt(v.key)}
                        className="px-1.5 py-0.5 text-xs font-mono bg-blue-100 text-blue-700 rounded border border-blue-200 hover:bg-blue-200 transition-colors"
                    >
                        {v.key}
                    </button>
                ))}
                <AccountRefPicker
                    accountNames={accountNames}
                    currentAccountId={currentAccountId}
                    onInsert={insertAt}
                />
            </div>
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={handleChange}
                placeholder={placeholder || 'blank = 0'}
                className={`w-full px-3 py-1.5 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                    error ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
                }`}
            />
            {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
        </div>
    );
};

export default FormulaInput;