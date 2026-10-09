import React, { useState, useEffect, useRef, useMemo } from "react";
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import InputText from "@/lib/ui/InputText";
import InputNumber from "@/lib/ui/InputNumber";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import SideBar from "@/lib/ui/SideBar";
import Spinner from "../Spinner";
import SelectDropdown from "@/lib/ui/select";
import RadioButton from "@/lib/ui/radio-button";
import CheckBox from "@/lib/ui/checkbox";
import { getApiBaseUrl } from "@/lib/constants";
import { setUserList } from "@/redux/actions/userActions";

const DAYS = [
    { label: 'All Week', value: 'all', dayNo: 0 },
    { label: 'Monday', value: 'monday', dayNo: 1 },
    { label: 'Tuesday', value: 'tuesday', dayNo: 2 },
    { label: 'Wednesday', value: 'wednesday', dayNo: 3 },
    { label: 'Thursday', value: 'thursday', dayNo: 4 },
    { label: 'Friday', value: 'friday', dayNo: 5 }
];

// Weekly groups must pick a specific day; "All Week" is reserved for daily groups
const WEEKLY_DAYS = DAYS.filter(d => d.value !== 'all');

const GROUP_NUMBER_OPTIONS = Array.from({ length: 15 }, (_, i) => ({ label: i + 1, value: i + 1 }));

const AddUpdateGroup = ({ mode = 'add', group = {}, showSidebar, setShowSidebar, onClose, onCsfChanged }) => {
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const userList = useSelector(state => state.user.list);
    const formikRef = useRef();
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    // Daily is the default, so day defaults to "All Week" (dayNo 0)
    const [day, setDay] = useState('all');
    const [dayNo, setDayNo] = useState(0);
    const [occurence, setOccurence] = useState('daily');
    const [branchId, setBranchId] = useState();
    const [csfEnabled, setCsfEnabled] = useState(true);
    const [csfSaving, setCsfSaving] = useState(false);

    // Only shown when editing, and only to roles that may use the endpoint (server re-checks).
    const canToggleCsf = mode === 'edit' && currentUser.role.rep <= 3;
    const branchCsfOff = branchList.find(b => b._id === group.branchId)?.csfEnabled === false;

    // Derived, not stored: always reflects the current userList + selected branch.
    // NOTE: assumes users carry `designatedBranchId`. Verify against your users/list payload.
    const branchOfficers = useMemo(() => {
        if (!currentUser.root) return userList;   // non-root: list is already branch-scoped
        if (!branchId) return [];                 // root: must pick a branch first
        return userList.filter(u => u.designatedBranchId === branchId);
    }, [userList, branchId, currentUser.root]);

    const initialValues = {
        name: group.name,
        branchId: group.branchId,
        day: group.day,
        dayNo: group.dayNo,
        time: group.time,
        capacity: group.capacity,
        groupNo: group.groupNo,
        occurence: group.occurence,
        loanOfficerId: group.loanOfficerId,
        loanOfficerName: group.loanOfficerName,
        availableSlots: group.availableSlots
    };

    const validationSchema = yup.object().shape({
        name: yup
            .string()
            .required('Please enter name'),
        time: yup
            .string()
            .required('Please enter time'),
        groupNo: yup
            .string()
            .required('Please select a group number'),
        capacity: yup
            .number()
            .typeError('Capacity must be a number')
            .integer('Capacity must be a whole number')
            .min(
                Math.max(group.noOfClients || 0, 1),
                group.noOfClients
                    ? `Capacity cannot be less than current clients (${group.noOfClients})`
                    : 'Capacity must be greater than 0'
            )
            .required('Please enter capacity'),
    });

    // Fetch the LO list once on mount if the store is empty.
    // Root: fetch all LOs (filtered client-side by branch). BM: scoped to own branch.
    useEffect(() => {
        if (userList.length > 0) return;
        let cancelled = false;

        const load = async () => {
            const params = { loOnly: true };
            if (currentUser.role.rep === 3) {
                params.branchId = currentUser.designatedBranchId;
            }

            try {
                const response = await fetchWrapper.get(getApiBaseUrl() + 'users/list?' + new URLSearchParams(params));
                if (cancelled) return;

                if (response.success) {
                    const list = (response.users || [])
                        .map(u => {
                            const name = `${u.firstName} ${u.lastName}`;
                            return { ...u, name, label: name, value: u._id };
                        })
                        .sort((a, b) => a.loNo - b.loNo);
                    dispatch(setUserList(list));
                } else {
                    toast.error('Error retrieving user list.');
                }
            } catch (error) {
                if (!cancelled) {
                    console.error(error);
                    toast.error('Error retrieving user list.');
                }
            }
        };

        load();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleBranchChange = (selected) => {
        setBranchId(selected);
        // Clear the LO so a stale officer from the previous branch can't be submitted
        formikRef.current?.setFieldValue('loanOfficerId', '');
    };

    const resetLocalState = () => {
        setDay('all');
        setDayNo(0);
        setOccurence('daily');
    };

    // Switching occurrence resets the day so a weekly pick can't leak into a daily group
    const handleOccurenceChange = (type) => {
        setOccurence(type);
        if (type === 'daily') {
            setDay('all');
            setDayNo(0);
            formikRef.current?.setFieldValue('day', 'all');
        } else {
            setDay('');
            setDayNo('');
            formikRef.current?.setFieldValue('day', '');
        }
    };

    const handleSaveUpdate = (rawValues, action) => {
        // Work on a copy instead of mutating Formik's values object
        const values = { ...rawValues };

        if (occurence === 'daily') {
            values.day = 'all';
            values.dayNo = 0;
        } else {
            if (!day || day === 'all') {
                toast.error('Please select a day for weekly groups.');
                action.setSubmitting(false);
                return;
            }
            values.day = day;
            values.dayNo = dayNo;
        }
        values.capacity = parseInt(values.capacity, 10);
        values.occurence = occurence;
        values.noOfClients = group.noOfClients;

        if (!currentUser.root) {
            // Non-root users can only act on their own branch.
            values.branchId = currentUser.designatedBranchId;
            values.branchName = currentUser.designatedBranch;

            if (currentUser.role.rep === 4) {
                // LO: locked into being their own loan officer
                values.loanOfficerId = currentUser._id;
                values.loanOfficerName = `${currentUser.firstName} ${currentUser.lastName}`;
            } else if (mode === 'edit') {
                // BM editing: LO dropdown is disabled, preserve what the group already has
                values.loanOfficerId = group.loanOfficerId;
                values.loanOfficerName = group.loanOfficerName;
            } else {
                // BM adding: must use the LO they picked in the dropdown
                const officer = branchOfficers.find(u => u._id === values.loanOfficerId);
                if (!officer) {
                    toast.error('Please select a loan officer.');
                    action.setSubmitting(false);
                    return;
                }
                values.loanOfficerName = officer.label;
            }
        } else {
            // Root: branch/LO dropdowns drive branchId / branchOfficers
            const branch = branchList.find(b => b._id === branchId);
            if (!branch) {
                toast.error('Selected branch could not be found. Please reselect the branch and try again.');
                action.setSubmitting(false);
                return;
            }
            values.branchId = branch._id;
            values.branchName = branch.name;

            const officer = branchOfficers.find(u => u._id === values.loanOfficerId);
            if (!officer) {
                toast.error('Selected loan officer could not be found. Please reselect and try again.');
                action.setSubmitting(false);
                return;
            }
            values.loanOfficerName = officer.label;
        }

        setLoading(true);

        if (mode === 'add') {
            const apiUrl = getApiBaseUrl() + 'groups/save/';

            values.availableSlots = Array.from({ length: values.capacity }, (_, i) => i + 1);
            values.status = 'available';
            values.noOfClients = 0;

            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    if (response.error || !response.success) {
                        setLoading(false);
                        toast.error(response.message || 'Failed to add group.');
                        return;
                    }
                    setLoading(false);
                    setShowSidebar(false);
                    toast.success('Group successfully added.');
                    action.setSubmitting(false);
                    action.resetForm();
                    resetLocalState();
                    onClose();
                })
                .catch(error => {
                    console.error(error);
                    setLoading(false);
                    action.setSubmitting(false);
                    toast.error('Failed to add group.');
                });
        } else if (mode === 'edit') {
            const apiUrl = getApiBaseUrl() + 'groups';
            values._id = group._id;

            const oldCapacity = group.capacity;
            if (values.capacity > oldCapacity) {
                // Append new slot numbers above the old capacity, never touch occupied ones
                const newSlots = [];
                for (let i = oldCapacity + 1; i <= values.capacity; i++) newSlots.push(i);
                values.availableSlots = [...(group.availableSlots || []), ...newSlots].sort((a, b) => a - b);
            } else {
                // Capacity unchanged or decreased: leave availableSlots as-is.
                // Capacity < noOfClients is blocked by the yup schema.
                values.availableSlots = group.availableSlots;
            }
            values.status = values.noOfClients >= values.capacity ? 'full' : 'available';

            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    if (response.error) {
                        setLoading(false);
                        toast.error(response.message || 'Failed to update group.');
                        return;
                    }
                    setLoading(false);
                    setShowSidebar(false);
                    toast.success('Group successfully updated.');
                    action.setSubmitting(false);
                    action.resetForm();
                    resetLocalState();
                    onClose();
                })
                .catch(error => {
                    console.error(error);
                    setLoading(false);
                    action.setSubmitting(false);
                    toast.error('Failed to update group.');
                });
        }
    };

    // Saves immediately via its own endpoint; it is not part of the Formik submit.
    const handleToggleCsf = async (_name, checked) => {
        if (csfSaving) return;
        const next = !!checked;
        const message = next
            ? `Turn CSF ON for ${group.name}? CSF collection / CSF In will resume for this group (if its branch is also enabled).`
            : `Turn CSF OFF for ${group.name}?\n\nNo CSF collection or CSF In will be recorded for this group. The minimum CSF amount is added to the MCBU minimum instead.`;
        if (!window.confirm(message)) return;

        setCsfSaving(true);
        try {
            const response = await fetchWrapper.post(getApiBaseUrl() + 'groups/set-csf-enabled', {
                groupId: group._id,
                csfEnabled: next,
            });
            if (response.success) {
                setCsfEnabled(next);
                toast.success(`CSF ${next ? 'enabled' : 'disabled'} for ${group.name}.`);
                onCsfChanged?.();
            } else {
                toast.error(response.message || 'Failed to update CSF setting.');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to update CSF setting.');
        } finally {
            setCsfSaving(false);
        }
    };

    const handleCancel = () => {
        setShowSidebar(false);
        formikRef.current?.resetForm();
        resetLocalState();
        onClose();
    };

    const handleChangeDay = (field, value) => {
        const selectedDay = DAYS.find(d => d.value === value);
        if (!selectedDay) return;
        setDayNo(selectedDay.dayNo);
        setDay(value);
        formikRef.current?.setFieldValue(field, value);
    };

    useEffect(() => {
        if (Object.keys(group).length > 0) {
            setDay(group.day ? group.day.toLowerCase() : 'all');
            setDayNo(group.dayNo ?? 0);
            setOccurence(group.occurence || 'daily');
            setBranchId(group.branchId);
            setCsfEnabled(group.csfEnabled !== false);
        }
        setLoading(false);
    }, [group]);

    return (
        <React.Fragment>
            <SideBar title={mode === 'add' ? 'Add Group' : 'Edit Group'} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
                {loading ? (
                    <Spinner />
                ) : (
                    <div className="px-2">
                        <Formik enableReinitialize={true}
                            onSubmit={handleSaveUpdate}
                            initialValues={initialValues}
                            validationSchema={validationSchema}
                            innerRef={formikRef}>{({
                                values,
                                touched,
                                errors,
                                handleChange,
                                handleSubmit,
                                setFieldValue,
                                isSubmitting,
                                isValidating,
                                setFieldTouched
                            }) => (
                                <form onSubmit={handleSubmit} autoComplete="off">
                                    <div className="mt-4">
                                        <InputText
                                            name="name"
                                            value={values.name}
                                            onChange={handleChange}
                                            label="Name"
                                            placeholder="Enter Name"
                                            setFieldValue={setFieldValue}
                                            errors={touched.name && errors.name ? errors.name : undefined} />
                                    </div>
                                    {mode === 'add' &&
                                        <div className="flex flex-col mt-4 text-gray-500">
                                            <div>Group Occurence</div>
                                            <div className="flex flex-row ml-4">
                                                <RadioButton id="radio_daily" name="radio-occurence" label="Daily" checked={occurence === 'daily'} value="daily" onChange={() => handleOccurenceChange('daily')} />
                                                <RadioButton id="radio_weekly" name="radio-occurence" label="Weekly" checked={occurence === 'weekly'} value="weekly" onChange={() => handleOccurenceChange('weekly')} />
                                            </div>
                                        </div>
                                    }
                                    {occurence === 'weekly' && (
                                        <>
                                            <div className="mt-4">
                                                <SelectDropdown
                                                    name="day"
                                                    field="day"
                                                    value={day}
                                                    label="Day"
                                                    options={WEEKLY_DAYS}
                                                    onChange={(field, value) => handleChangeDay(field, value)}
                                                    onBlur={setFieldTouched}
                                                    placeholder="Select Day"
                                                />
                                            </div>
                                            <div className="mt-4">
                                                <InputNumber
                                                    name="dayNo"
                                                    value={dayNo}
                                                    onChange={handleChange}
                                                    label="Day No"
                                                    placeholder="Enter day number"
                                                    disabled={true}
                                                    setFieldValue={setFieldValue}
                                                />
                                            </div>
                                        </>
                                    )}
                                    <div className="mt-4">
                                        <InputText
                                            name="time"
                                            value={values.time}
                                            onChange={handleChange}
                                            label="Time"
                                            placeholder="Enter Time"
                                            setFieldValue={setFieldValue}
                                            errors={touched.time && errors.time ? errors.time : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="groupNo"
                                            field="groupNo"
                                            value={values.groupNo}
                                            label="Group Number"
                                            options={GROUP_NUMBER_OPTIONS}
                                            onChange={setFieldValue}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Group Number"
                                            errors={touched.groupNo && errors.groupNo ? errors.groupNo : undefined}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <InputNumber
                                            name="capacity"
                                            value={values.capacity}
                                            onChange={handleChange}
                                            label="Capacity"
                                            placeholder="Enter Capacity"
                                            setFieldValue={setFieldValue}
                                            errors={touched.capacity && errors.capacity ? errors.capacity : undefined}
                                        />
                                    </div>
                                    {currentUser.root && (
                                        <div className="mt-4">
                                            <SelectDropdown
                                                name="branchId"
                                                field="branchId"
                                                value={branchId}
                                                label="Branch"
                                                options={branchList}
                                                onChange={(e, selected) => handleBranchChange(selected)}
                                                onBlur={setFieldTouched}
                                                placeholder="Select Branch"
                                                disabled={mode === 'edit'}
                                                errors={touched.branchId && errors.branchId ? errors.branchId : undefined}
                                            />
                                        </div>
                                    )}
                                    {currentUser.role.rep <= 3 && (
                                        <div className="mt-4">
                                            <SelectDropdown
                                                name="loanOfficerId"
                                                field="loanOfficerId"
                                                value={values.loanOfficerId}
                                                label="Loan Officer"
                                                options={branchOfficers}
                                                onChange={setFieldValue}
                                                onBlur={setFieldTouched}
                                                disabled={mode === 'edit'}
                                                placeholder="Select Loan Officer"
                                                errors={touched.loanOfficerId && errors.loanOfficerId ? errors.loanOfficerId : undefined}
                                            />
                                        </div>
                                    )}
                                    {canToggleCsf && (
                                        <div className="mt-4 p-3 rounded-lg border border-gray-200 bg-gray-50">
                                            <CheckBox
                                                size={"md"}
                                                name="csfEnabled"
                                                value={csfEnabled}
                                                label="CSF collection / CSF In enabled"
                                                onChange={handleToggleCsf}
                                            />
                                            <p className="text-xs text-gray-500 mt-2">
                                                Saves immediately, no need to press Submit. When off, no CSF collection or CSF In is
                                                recorded for this group and the minimum CSF amount is added to the MCBU minimum instead.
                                            </p>
                                            {branchCsfOff && (
                                                <p className="text-xs text-amber-600 mt-1">
                                                    This branch has CSF turned off, so this setting has no effect until the branch is enabled.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex flex-row mt-5">
                                        <ButtonOutline label="Cancel" onClick={handleCancel} className="mr-3" />
                                        <ButtonSolid label="Submit" type="submit" isSubmitting={isValidating && isSubmitting} />
                                    </div>
                                </form>
                            )}
                        </Formik>
                    </div>
                )}
            </SideBar>
        </React.Fragment>
    );
};

export default AddUpdateGroup;