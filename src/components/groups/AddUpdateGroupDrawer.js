import React, { useState, useEffect, useRef } from "react";
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from "react-redux";
import InputText from "@/lib/ui/InputText";
import InputNumber from "@/lib/ui/InputNumber";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import SideBar from "@/lib/ui/SideBar";
import Spinner from "../Spinner";
import SelectDropdown from "@/lib/ui/select";
import RadioButton from "@/lib/ui/radio-button";

const AddUpdateGroup = ({ mode = 'add', group = {}, showSidebar, setShowSidebar, onClose }) => {
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const userList = useSelector(state => state.user.list);
    const formikRef = useRef();
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [day, setDay] = useState('');
    const [dayNo, setDayNo] = useState('');
    const [occurence, setOccurence] = useState('daily');
    const [branchId, setBranchId] = useState();
    const [branchOfficers, setBranchOfficers] = useState(userList);
    const days = [
        {label: 'All Week', value: 'all', dayNo: 0},
        {label: 'Monday', value: 'monday', dayNo: 1}, 
        {label: 'Tuesday', value: 'tuesday', dayNo: 2}, 
        {label: 'Wednesday', value: 'wednesday', dayNo: 3}, 
        {label: 'Thursday', value: 'thursday', dayNo: 4}, 
        {label: 'Friday', value: 'friday', dayNo: 5}
    ];

    const initialValues = {
        name: group.name,
        branchId: group.branchId,
        day: group.day,
        dayNo: group.dayNo,
        time: group.time,
        groupNo: group.groupNo,
        occurence: group.occurence,
        loanOfficerId: group.loanOfficerId,
        loanOfficerName: group.loanOfficerName,
        availableSlots: group.availableSlots
    }

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
        // loanOfficerId: yup
        //     .string()
        //     .required('Please select a loan officer'),

    });

    const handleBranchChange = (selected) => {
        setBranchId(selected);
        const branch = branchList.find(b => b._id === selected);
        const newUserList = userList.filter(u => u.designatedBranch === branch.code);
        setBranchOfficers(newUserList);
    }

    const handleSaveUpdate = (values, action) => {
        setLoading(true);
        const branch = branchList.find(b => b._id === branchId);
        values.day = day;
        values.dayNo = dayNo;
        values.occurence = occurence;
        values.capacity = occurence === 'daily' ? 26 : 30;
        values.noOfClients = group.noOfClients;
        // values.status = group.status;

        if (currentUser.role.rep === 4) {
            const cuBranch = branchList.find(b => b.code === currentUser.designatedBranch);
            values.branchId = cuBranch._id;
            values.branchName = cuBranch.name;
            values.loanOfficerId = currentUser._id;
            values.loanOfficerName = `${currentUser.firstName} ${currentUser.lastName}`;
        } else {
            values.branchId = branch._id;
            values.branchName = branch.name;
            values.loanOfficerName = branchOfficers.find(u => u._id === values.loanOfficerId).label;
        }
        
        if (mode === 'add') {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'groups/save/';

            let availableSlots = [];
            for (let i = 1; i <= 40; i++) {
                availableSlots.push(i);
            }
            values.availableSlots = availableSlots;
            values.status = 'available';
            values.noOfClients = 0;

            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    if (response.error) {
                        toast.error(response.message);
                    } else if (response.success) {
                        setLoading(false);
                        setShowSidebar(false);
                        toast.success('Group successfully added.');
                        action.setSubmitting = false;
                        action.resetForm({values: ''});
                        setDay('');
                        setDayNo('');
                        onClose();
                    }
                }).catch(error => {
                    console.log(error)
                });
        } else if (mode === 'edit') {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'groups';
            values._id = group._id;
            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    setLoading(false);
                    setShowSidebar(false);
                    toast.success('Group successfully updated.');
                    action.setSubmitting = false;
                    action.resetForm({values: ''});
                    setDay('');
                    setDayNo('');
                    onClose();
                }).catch(error => {
                    console.log(error);
                });
        }
    }

    const handleCancel = () => {
        setShowSidebar(false);
        formikRef.current.resetForm();
        setDay('');
        setDayNo('');
        onClose();
    }

    const handleChangeDay = async (field, value) => {
        setLoading(true);
        const form = formikRef.current;
        const day = days.find(d => d.value === value);
        // set formik field value and state
        setDayNo(day.dayNo);
        setDay(value);
        form.setFieldValue(field, value);
        setLoading(false);
    }

    useEffect(() => {
        let mounted = true;

        if (Object.keys(group).length > 0) {
            setDay(group && group.day ? group.day.toLowerCase() : 'all');
            setDayNo(group && group.dayNo);
            setOccurence(group && group.occurence);
            setBranchId(group && group.branchId);
        }

        mounted && setLoading(false);

        return () => {
            mounted = false;
        };
    }, [group]);

    return (
        <React.Fragment>
            <SideBar title={mode === 'add' ? 'Add Group' : 'Edit Group'} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
                {loading ? (
                    <div className="flex items-center justify-center h-screen">
                        <Spinner />
                    </div>
                ) : (
                    <div className="px-2">
                        <Formik enableReinitialize={true}
                            onSubmit={handleSaveUpdate}
                            initialValues={initialValues}
                            validationSchema={validationSchema}
                            innerRef={formikRef}>{({
                                values,
                                actions,
                                touched,
                                errors,
                                handleChange,
                                handleSubmit,
                                setFieldValue,
                                resetForm,
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
                                    <div className="flex flex-col mt-4 text-gray-500">
                                        <div>Group Occurence</div>
                                        <div className="flex flex-row ml-4">
                                            <RadioButton id={"radio_daily"} name="radio-occurence" label={"Daily"} checked={occurence === 'daily'} value="daily" onChange={() => setOccurence('daily')} />
                                            <RadioButton id={"radio_weekly"} name="radio-occurence" label={"Weekly"} checked={occurence === 'weekly'} value="weekly" onChange={() => setOccurence('weekly')} />
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="day"
                                            field="day"
                                            value={day}
                                            label="Day"
                                            options={days}
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
                                                options={[
                                                    { label: 1, value: 1 },
                                                    { label: 2, value: 2 },
                                                    { label: 3, value: 3 },
                                                    { label: 4, value: 4 },
                                                    { label: 5, value: 5 },
                                                    { label: 6, value: 6 },
                                                    { label: 7, value: 7 },
                                                    { label: 8, value: 8 }
                                                ]}
                                                onChange={setFieldValue}
                                                onBlur={setFieldTouched}
                                                placeholder="Select Group Number"
                                                errors={touched.groupNo && errors.groupNo ? errors.groupNo : undefined}
                                            />
                                    </div>
                                    {currentUser.role.rep < 4 && (
                                        <React.Fragment>
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
                                                    errors={touched.branchId && errors.branchId ? errors.branchId : undefined}
                                                />
                                            </div>
                                            <div className="mt-4">
                                                <SelectDropdown
                                                    name="loanOfficerId"
                                                    field="loanOfficerId"
                                                    value={values.loanOfficerId}
                                                    label="Loan Officer"
                                                    options={branchOfficers}
                                                    onChange={setFieldValue}
                                                    onBlur={setFieldTouched}
                                                    placeholder="Select Loan Officer"
                                                    errors={touched.loanOfficerId && errors.loanOfficerId ? errors.loanOfficerId : undefined}
                                                />
                                            </div>
                                        </React.Fragment>
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
    )
}

export default AddUpdateGroup;