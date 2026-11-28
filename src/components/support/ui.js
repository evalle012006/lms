// Small shared pieces for the support pages, so colours stay consistent (brand teal = primary-1/2).
import React from 'react';

const STATUS = {
    active: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    closed: 'bg-gray-200 text-gray-700',
    pending: 'bg-amber-100 text-amber-800',
};

export const StatusChip = ({ status }) => (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS[status] ?? 'bg-gray-100 text-gray-700'}`}>{status || '—'}</span>
);

export const Btn = ({ variant = 'primary', className = '', ...props }) => {
    const base = 'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-1/40';
    const styles = variant === 'secondary'
        ? 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
        : variant === 'outline'
        ? 'border border-primary-1 bg-white text-primary-2 hover:bg-primary-4/30'
        : 'bg-primary-1 text-white hover:bg-primary-2';
    return <button {...props} className={`${base} ${styles} ${className}`} />;
};

export const Chip = ({ children, tone = 'gray' }) => {
    const tones = { gray: 'bg-gray-100 text-gray-700', teal: 'bg-primary-4 text-primary-2', amber: 'bg-amber-100 text-amber-800' };
    return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium capitalize ${tones[tone]}`}>{children}</span>;
};

// A record id with a label and a copy button: support quotes these in tickets / looks them up in Hasura.
export const IdTag = ({ label, value }) => {
    const [done, setDone] = React.useState(false);
    const copy = async () => {
        try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1200); } catch (e) { /* clipboard blocked: ignore */ }
    };
    return (
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500" title="Internal record ID. Quote it in a ticket, or use it to look the record up in Hasura.">
            <span className="font-medium">{label}</span>
            <span className="font-mono">{value}</span>
            <button type="button" onClick={copy} className="text-primary-2 hover:underline">{done ? 'copied' : 'copy'}</button>
        </span>
    );
};
