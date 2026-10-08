// src/components/clients/statusPillStyles.js
// Extracted from lib/table.js's StatusPill color logic — same rules, reusable
// outside a react-table Cell context now that we're not using the table.
export function statusPillClass(status) {
    const s = (status || 'unknown').toLowerCase();
    if (s.startsWith('active') || s.startsWith('open'))       return 'bg-green-100 text-green-700';
    if (s.startsWith('pending'))                               return 'bg-amber-100 text-amber-700';
    if (s.startsWith('inactive'))                              return 'bg-gray-100 text-gray-500';
    if (s.startsWith('reject') || s.startsWith('close') || s.startsWith('offset')) return 'bg-red-100 text-red-700';
    if (s.startsWith('approved'))                              return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-500';
}