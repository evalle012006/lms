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

const validationSchema = yup.object({
    name: yup.string().required('Name is required'),
});

// ── Reusable labelled multi-select matching the app's existing style ──────────
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

const DivisionForm = ({ mode, data, allManagers, divisions, onSaved, onCancel }) => {
    const isView = mode === 'view';
    const isAdd  = mode === 'add';

    // deputy_director options
    const managerOptions = useMemo(() =>
        allManagers
            .filter(u => u.shortCode === 'deputy_director')
            .map(u => ({ value: u._id, label: `${u.lastName}, ${u.firstName}` })),
        [allManagers]
    );

    // All regions for linking
    const allRegionOptions = useMemo(() =>
        divisions.flatMap(d => (d.regions ?? []).map(r => ({
            value: r._id,
            label: r.name,
        }))),
        [divisions]
    );

    const initialManagerIds = parseIds(data.managerIds);
    const initialRegionIds  = parseIds(data.regionIds);

    // Full option objects for react-select multi value
    const initialManagerValues = useMemo(() =>
        managerOptions.filter(o => initialManagerIds.includes(o.value)),
        [managerOptions, initialManagerIds]
    );
    const initialRegionValues = useMemo(() =>
        allRegionOptions.filter(o => initialRegionIds.includes(o.value)),
        [allRegionOptions, initialRegionIds]
    );

    const initialValues = {
        name:       data.name ?? '',
        managerIds: initialManagerValues,   // array of option objects
        regionIds:  initialRegionValues,    // array of option objects
    };

    const handleSubmit = async (values, { setSubmitting }) => {
        try {
            const endpoint = isAdd
                ? getApiBaseUrl() + 'hierarchy/division/save'
                : getApiBaseUrl() + 'hierarchy/division/update';

            const payload = {
                name:       values.name,
                managerIds: (values.managerIds ?? []).map(o => o.value),
                regionIds:  (values.regionIds  ?? []).map(o => o.value),
                ...(!isAdd && { _id: data._id }),
            };

            const res = await fetchWrapper.post(endpoint, payload);
            if (res.success) {
                toast.success(`Division ${isAdd ? 'created' : 'updated'} successfully.`);
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
        const thisDiv  = divisions.find(d => d._id === data._id);

        return (
            <div className="space-y-6">
                <InfoRow label="Name" value={data.name} />
                <InfoRow
                    label="Deputy Director(s)"
                    value={managers.length
                        ? managers.map(u => `${u.lastName}, ${u.firstName}`).join(' · ')
                        : '—'}
                />
                <InfoRow label="Linked Regions" value={thisDiv?.regions?.length ?? 0} />
                {thisDiv?.regions?.length > 0 && (
                    <ChildList
                        title="Regions"
                        items={thisDiv.regions.map(r => ({
                            label: r.name,
                            sub:   `${r.areas?.length ?? 0} areas`
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
            {({ values, errors, touched, handleChange, handleSubmit, setFieldValue, isSubmitting, isValidating }) => (
                <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
                    <InputText
                        name="name"
                        value={values.name}
                        onChange={handleChange}
                        label="Division Name"
                        placeholder="e.g. Division I"
                        setFieldValue={setFieldValue}
                        errors={touched.name && errors.name ? errors.name : undefined}
                    />

                    {/* Deputy Directors — multi, use raw Select */}
                    <LabelledMultiSelect
                        label="Deputy Director(s)"
                        value={values.managerIds}
                        options={managerOptions}
                        onChange={(selected) => setFieldValue('managerIds', selected ?? [])}
                        placeholder="Select managers..."
                    />

                    {/* Link Regions — multi */}
                    <div>
                        <LabelledMultiSelect
                            label="Link Regions"
                            value={values.regionIds}
                            options={allRegionOptions}
                            onChange={(selected) => setFieldValue('regionIds', selected ?? [])}
                            placeholder="Select regions to link..."
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Linking a region cascades divisionId down to areas, branches, and users.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <ButtonOutline label="Cancel" type="button" onClick={onCancel} />
                        <ButtonSolid label={isAdd ? 'Create Division' : 'Save Changes'} type="submit" isSubmitting={isValidating && isSubmitting} />
                    </div>
                </form>
            )}
        </Formik>
    );
};

const InfoRow = ({ label, value }) => (
    <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-sm text-gray-800">{value}</p>
    </div>
);

export default DivisionForm;