import React, { useMemo } from 'react';
import { Formik } from 'formik';
import * as yup from 'yup';
import Select from 'react-select';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { toast } from 'react-toastify';
import InputText from '@/lib/ui/InputText';
import SelectDropdown from '@/lib/ui/select';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import ChildList from './ChildList';
import { multiStyles, DropdownIndicator } from '@/styles/select';
import { parseIds } from '@/lib/hierarchy-cascade';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const validationSchema = yup.object({
    name:     yup.string().required('Name is required'),
    regionId: yup.string().nullable().required('Region is required'),
});

const LabelledMultiSelect = ({ label, value, options, onChange, placeholder }) => {
    const hasValue = value && value.length > 0;
    return (
        <div className={`flex flex-col border rounded-md px-4 py-2 bg-white ${hasValue ? 'border-main' : 'border-slate-400'}`}>
            <label className={`font-proxima-bold text-xs font-bold mb-1 ${hasValue ? 'text-main' : 'text-gray-500'}`}>
                {label}
            </label>
            <Select
                options={options}
                value={value}
                isMulti
                styles={multiStyles}
                components={{ DropdownIndicator, IndicatorSeparator: () => null }}
                onChange={onChange}
                isSearchable
                placeholder={placeholder}
                closeMenuOnSelect={false}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                menuPosition="fixed"
            />
        </div>
    );
};

const AreaForm = ({ mode, data, allBranches, allManagers, divisions, onSaved, onCancel }) => {
    const isView = mode === 'view';
    const isAdd  = mode === 'add';

    // Region options for single SelectDropdown — needs raw ID as value
    const regionOptions = useMemo(() =>
        divisions.flatMap(d =>
            (d.regions ?? []).map(r => ({
                value:      r._id,
                label:      r.name,
                divisionId: d._id,
            }))
        ),
        [divisions]
    );

    // area_admin options for multi
    const managerOptions = useMemo(() =>
        allManagers
            .filter(u => u.shortCode === 'area_admin')
            .map(u => ({ value: u._id, label: `${u.lastName}, ${u.firstName}` })),
        [allManagers]
    );

    // Build area name lookup for warnings
    const areaNameMap = useMemo(() => {
        const map = {};
        divisions.forEach(d =>
            (d.regions ?? []).forEach(r =>
                (r.areas ?? []).forEach(a => { map[a._id] = a.name; })
            )
        );
        return map;
    }, [divisions]);

    // Branch options with ownership annotation
    const branchOptions = useMemo(() =>
        allBranches.map(b => {
            const isInThisArea  = b.areaId === data._id;
            const isInOtherArea = !!b.areaId && b.areaId !== data._id;
            const owningAreaName = isInOtherArea ? (areaNameMap[b.areaId] ?? 'another area') : null;
            return {
                value:           b._id,
                label:           isInOtherArea
                    ? `${b.code} — ${b.name} ⚠ (${owningAreaName})`
                    : `${b.code} — ${b.name}`,
                isInOtherArea,
                owningAreaName,
                rawLabel:        `${b.code} — ${b.name}`,
            };
        }),
        [allBranches, data._id, areaNameMap]
    );

    const initialManagerIds = parseIds(data.managerIds);
    const initialBranchIds  = parseIds(data.branchIds);

    // Multi selects: full option objects
    const initialManagerValues = useMemo(() =>
        managerOptions.filter(o => initialManagerIds.includes(o.value)),
        [managerOptions, initialManagerIds]
    );
    const initialBranchValues = useMemo(() =>
        branchOptions.filter(o => initialBranchIds.includes(o.value)),
        [branchOptions, initialBranchIds]
    );

    const initialValues = {
        name:       data.name       ?? '',
        // Single SelectDropdown: raw ID string
        regionId:   data.regionId   ?? '',
        divisionId: data.divisionId ?? '',
        // Multi: option objects
        managerIds: initialManagerValues,
        branchIds:  initialBranchValues,
    };

    // When region changes, auto-derive divisionId from the option
    const handleRegionChange = (field, value, setFieldValue) => {
        // value is the raw ID string from SelectDropdown
        setFieldValue('regionId', value);
        const opt = regionOptions.find(o => o.value === value);
        if (opt?.divisionId) setFieldValue('divisionId', opt.divisionId);
    };

    const handleSubmit = async (values, { setSubmitting }) => {
        try {
            const endpoint = isAdd
                ? getApiBaseUrl() + 'hierarchy/area/save'
                : getApiBaseUrl() + 'hierarchy/area/update';

            const payload = {
                name:       values.name,
                regionId:   values.regionId   || null,
                divisionId: values.divisionId || null,
                managerIds: (values.managerIds ?? []).map(o => o.value),
                branchIds:  (values.branchIds  ?? []).map(o => o.value),
                ...(!isAdd && { _id: data._id }),
            };

            const res = await fetchWrapper.post(endpoint, payload);
            if (res.success) {
                toast.success(`Area ${isAdd ? 'created' : 'updated'} successfully.`);
                onSaved();
            } else {
                toast.error(res.message ?? 'Save failed.');
            }
        } catch {
            toast.error('An error occurred.');
        } finally {
            setSubmitting(false);
        }
    };

    // ── View mode ─────────────────────────────────────────────────────────────
    if (isView) {
        const managers = allManagers.filter(u => initialManagerIds.includes(u._id));
        const region   = regionOptions.find(o => o.value === data.regionId);
        const division = divisions.find(d => d._id === data.divisionId);
        // Prefer data.branches (already embedded from API) for display
        const branches = data.branches?.length
            ? data.branches
            : allBranches.filter(b => initialBranchIds.includes(b._id));

        return (
            <div className="space-y-6">
                <InfoRow label="Name"       value={data.name} />
                <InfoRow label="Region"     value={region?.label  ?? '—'} />
                <InfoRow label="Division"   value={division?.name ?? '—'} />
                <InfoRow
                    label="Area Admin(s)"
                    value={managers.length
                        ? managers.map(u => `${u.lastName}, ${u.firstName}`).join(' · ')
                        : '—'}
                />
                <InfoRow label="Branches" value={branches.length} />
                {branches.length > 0 && (
                    <ChildList
                        title="Branches"
                        items={branches.map(b => ({
                            label: `${b.code} — ${b.name}`,
                            sub:   b.address ?? ''
                        }))}
                    />
                )}
            </div>
        );
    }

    // ── Add / Edit ─────────────────────────────────────────────────────────────
    return (
        <Formik
            initialValues={initialValues}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
            enableReinitialize
        >
            {({ values, errors, touched, handleChange, handleSubmit, setFieldValue, isSubmitting, isValidating }) => {
                // Warn about branches already in another area
                const warnings = (values.branchIds ?? []).filter(o => o.isInOtherArea);

                return (
                    <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">

                        {/* Region — single, SelectDropdown with raw ID */}
                        <SelectDropdown
                            name="regionId"
                            field="regionId"
                            value={values.regionId}
                            label="Region"
                            options={regionOptions}
                            onChange={(field, value) => handleRegionChange(field, value, setFieldValue)}
                            placeholder="Select region..."
                            errors={touched.regionId && errors.regionId ? errors.regionId : undefined}
                        />

                        <InputText
                            name="name"
                            value={values.name}
                            onChange={handleChange}
                            label="Area Name"
                            placeholder="e.g. Pasig Area"
                            setFieldValue={setFieldValue}
                            errors={touched.name && errors.name ? errors.name : undefined}
                        />

                        {/* Area Admins — multi */}
                        <LabelledMultiSelect
                            label="Area Admin(s)"
                            value={values.managerIds}
                            options={managerOptions}
                            onChange={(selected) => setFieldValue('managerIds', selected ?? [])}
                            placeholder="Select managers..."
                        />

                        {/* Link Branches — multi */}
                        <div>
                            <LabelledMultiSelect
                                label="Link Branches"
                                value={values.branchIds}
                                options={branchOptions}
                                onChange={(selected) => setFieldValue('branchIds', selected ?? [])}
                                placeholder="Select branches to link..."
                            />

                            {warnings.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {warnings.map(b => (
                                        <div key={b.value} className="flex items-start gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                                            <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                            <span>
                                                <strong>{b.rawLabel.split('—')[0].trim()}</strong> is currently in <strong>{b.owningAreaName}</strong>. Saving will move it here and cascade updates to its users.
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <p className="text-xs text-gray-400 mt-1">
                                Linking a branch stamps this area's regionId + divisionId on the branch and all users under it.
                            </p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <ButtonOutline label="Cancel" type="button" onClick={onCancel} />
                            <ButtonSolid label={isAdd ? 'Create Area' : 'Save Changes'} type="submit" isSubmitting={isValidating && isSubmitting} />
                        </div>
                    </form>
                );
            }}
        </Formik>
    );
};

const InfoRow = ({ label, value }) => (
    <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-sm text-gray-800">{value}</p>
    </div>
);

export default AreaForm;