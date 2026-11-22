// src/components/settings/duplicate-clients/HierarchyFilters.js
// Cascading Division > Region > Area > Branch selects (shared by the Duplicate Clients list and statistics pages).
// Choosing a higher level narrows the lower lists and clears any lower selection that no longer fits.

import React, { useMemo } from 'react';

export const HIERARCHY_KEYS = ['divisionId', 'regionId', 'areaId', 'branchId'];

const sel = 'border border-gray-200 rounded-lg text-sm px-3 py-2 bg-white w-full';

const Field = ({ value, onChange, placeholder, options }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={sel}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
    </select>
);

/**
 * @param hierarchy { divisions, regions, areas, branches }  from the API
 * @param value     { divisionId, regionId, areaId, branchId } ('' = all)
 * @param onChange  (nextValue) => void  — receives the whole updated value
 */
const HierarchyFilters = ({ hierarchy, value, onChange }) => {
    const h = hierarchy ?? { divisions: [], regions: [], areas: [], branches: [] };
    const { divisionId = '', regionId = '', areaId = '', branchId = '' } = value;

    const regions = useMemo(() => h.regions.filter(r => !divisionId || r.divisionId === divisionId), [h.regions, divisionId]);
    const areas = useMemo(() => h.areas.filter(a => (!divisionId || a.divisionId === divisionId) && (!regionId || a.regionId === regionId)), [h.areas, divisionId, regionId]);
    const branches = useMemo(() => h.branches.filter(b =>
        (!divisionId || b.divisionId === divisionId) && (!regionId || b.regionId === regionId) && (!areaId || b.areaId === areaId)), [h.branches, divisionId, regionId, areaId]);

    return (
        <>
            <Field value={divisionId} placeholder="All divisions" options={h.divisions}
                onChange={(v) => onChange({ divisionId: v, regionId: '', areaId: '', branchId: '' })} />
            <Field value={regionId} placeholder="All regions" options={regions}
                onChange={(v) => onChange({ divisionId, regionId: v, areaId: '', branchId: '' })} />
            <Field value={areaId} placeholder="All areas" options={areas}
                onChange={(v) => onChange({ divisionId, regionId, areaId: v, branchId: '' })} />
            <Field value={branchId} placeholder="All branches" options={branches}
                onChange={(v) => onChange({ divisionId, regionId, areaId, branchId: v })} />
        </>
    );
};

export default HierarchyFilters;
