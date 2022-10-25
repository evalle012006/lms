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
import Spinner from "../Spinner";
import 'react-calendar/dist/Calendar.css';
import moment from 'moment'
import SelectDropdown from "@/lib/ui/select";
import SideBar from "@/lib/ui/SideBar";
import RadioButton from "@/lib/ui/radio-button";
import { setGroupList } from "@/redux/actions/groupActions";
import { setClientList } from "@/redux/actions/clientActions";
import { UppercaseFirstLetter } from "@/lib/utils";

const AddUpdateLoan = ({ mode = 'add', loan = {}, showSidebar, setShowSidebar, onClose }) => {
    const formikRef = useRef();
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState('Add Loan');
    const branchList = useSelector(state => state.branch.list);
    const groupList = useSelector(state => state.group.list);
    const clientList = useSelector(state => state.client.list);
    const [selectedGroup, setSelectedGroup] = useState();
    const [slotNo, setSlotNo] = useState();
    const [slotNumber, setSlotNumber] = useState([]);
    const [groupOccurence, setGroupOccurence] = useState('daily');
    const [clientType, setClientType] = useState('active');

    const initialValues = {
        branchId: loan.branchId,
        groupId: loan.groupId,
        slotNo: loan.slotNo,
        clientId: loan.clientId,
        fullName: loan.fullName,
        admissionDate: loan.admissionDate,
        mcbu: loan.mcbu,
        dateGranted: mode !== 'reloan' ? loan.dateGranted : null,
        principalLoan: loan.principalLoan,
        activeLoan: loan.activeLoan,
        loanBalance: loan.loanBalance,
        amountRelease: loan.amountRelease,
        noOfPayments: mode !== 'reloan' ? loan.noOfPayments : 0,
        coMaker: loan.coMaker,
        loanCycle: mode !== 'reloan' ? loan.loanCycle : loan.loanCycle + 1,
        status: mode !== 'reloan' ? loan.status : 'pending',
    }

    const validationSchema = yup.object().shape({
        groupId: yup
            .string()
            .required('Please select a group'),
        clientId: yup
            .string()
            .required('Please select a client'),
        principalLoan: yup
            .number()
            .integer()
            .positive()
            .moreThan(0, 'Princal loan should be greater than 0')
            .required('Please enter principal loan'),
        slotNo: yup
            .number()
            .integer()
            .positive()
            .required('Please select a slot number'),
        loanCycle: yup
            .number()
            .integer()
            .positive()
            .required('Please enter a loan cycle number'),
        // coMaker: yup
        //     .string()
        //     .required('Please enter co-maker')
    });

    const handleGroupChange = (field, value) => {
        setLoading(true);
        const form = formikRef.current;
        setSelectedGroup(value);
        const group = groupList.find(g => g._id === value);
        if (group) {
            let slotArr = [];
            group.availableSlots.map(slot => {
                slotArr.push({
                    value: slot,
                    label: slot
                });
            });

            setSlotNumber(slotArr);
        }
        
        form.setFieldValue(field, value);
        setLoading(false);
    }

    const handleSlotNoChange = (field, value) => {
        setLoading(true);
        const form = formikRef.current;
        setSlotNo(value);
        form.setFieldValue(field, value);
        setLoading(false);
    }

    const handleSaveUpdate = (values, action) => {
        setLoading(true);
        let group;
        if (mode !== 'reloan') {
            values.groupId = selectedGroup;
            group = groupList.find(g => g._id === values.groupId);
            values.groupName = group.name;
            const branch = branchList.find(b => b._id === group.branchId);
            values.branchId = branch._id;
            values.brancName = branch.name;
        } else {
            group = loan.group;
            values.mode = 'reloan';
            values.oldLoanId = loan.loanId;
        }

        values.slotNo = mode !== 'reloan' ? slotNo : loan.slotNo;

        if (values.status !== 'active') {
            if (group.occurence === 'weekly') {
                values.mcbu = 50;
                values.activeLoan = (values.principalLoan * 1.20) / 24;
            } else if (group.occurence === 'daily') {
                values.activeLoan = (values.principalLoan * 1.20) / 60;
            }
    
            values.loanBalance = values.principalLoan * 1.20; // initial
            values.amountRelease = values.loanBalance;
            values.noOfPayments = 0;
        }

        if (mode === 'add' || mode === 'reloan') {
            // should check if the user has previous loan that is loanCycle 0, then set the loanCycle to 1
            const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/save/';

            values.lastUpdated = null;  // use only when updating the mispayments
            values.admissionDate = moment(values.admissionDate).format('YYYY-MM-DD');
            values.status = 'pending';
            values.loanCycle = values.loanCycle ? values.loanCycle : 1;

            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    setLoading(false);
                    if (response.error) {
                        toast.error(response.message);
                    } else if (response.success) {
                        setShowSidebar(false);
                        toast.success('Loan successfully added.');
                        action.setSubmitting = false;
                        action.resetForm({values: ''});
                        setSelectedGroup();
                        setSlotNo();
                        setSlotNumber();
                        onClose();
                    }
                }).catch(error => {
                    console.log(error)
                });
        } else if (mode === 'edit') {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'transactions/loans';
            values._id = loan._id;
            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    if (response.success) {
                        let error = false;
                        if (values.status === 'active' && values.groupId !== loan.groupId) {
                            let params = { groupId: values.groupId, oldGroupId: loan.groupId };
                            
                            fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'groups/update-group', params)
                                .then(response => {
                                    if (response.error) {
                                        setLoading(false);
                                        error = true;
                                        toast.error(response.message);
                                    }
                            });
                        }

                        if (!error) {
                            setLoading(false);
                            setShowSidebar(false);
                            toast.success('Loan successfully updated.');
                            action.setSubmitting = false;
                            action.resetForm();
                            onClose();
                        }
                    } else if (response.error) {
                        setLoading(false);
                        toast.error(response.message);
                    }
                }).catch(error => {
                    console.log(error);
                });
        }
    }

    const getListGroup = async (occurence) => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'groups/list-by-group-occurence'
        if (currentUser.root !== true && currentUser.role.rep === 4 && branchList.length > 0) { 
            url = url + '?' + new URLSearchParams({ branchId: branchList[0]._id, loId: currentUser._id, occurence: occurence });
        } else if (currentUser.root !== true && currentUser.role.rep === 3 && branchList.length > 0) {
            url = url + '?' + new URLSearchParams({ branchId: branchList[0]._id, occurence: occurence });
        }

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let groups = [];
            await response.groups && response.groups.map(group => {
                groups.push({
                    ...group,
                    value: group._id,
                    label: UppercaseFirstLetter(group.name)
                });
            });
            dispatch(setGroupList(groups));
        } else if (response.error) {
            toast.error(response.message);
        }
        setLoading(false);
    }

    const getListClient = async (status) => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'clients/list';
        if (currentUser.root !== true && (currentUser.role.rep === 3 || currentUser.role.rep === 4) && branchList.length > 0) { 
            url = url + '?' + new URLSearchParams({ mode: "view_only_no_exist_loan", branchId: branchList[0]._id, status: status });
        } 

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let clients = [];
            await response.clients && response.clients.map(client => {
                clients.push({
                    ...client,
                    label: UppercaseFirstLetter(`${client.lastName}, ${client.firstName}`),
                    value: client._id
                });
            });
            dispatch(setClientList(clients));
        } else if (response.error) {
            toast.error(response.message);
        }
        setLoading(false);
    }

    const handleOccurenceChange = (value) => {
        setGroupOccurence(value);
        getListGroup(value);
    }

    const handleClientTypeChange = (value) => {
        setClientType(value);
        getListClient(value);
    }

    const handleCancel = () => {
        setShowSidebar(false);
        formikRef.current.resetForm();
        onClose();
    }

    useEffect(() => {
        let mounted = true;

        if (mode === 'add' || mode === 'reloan') {
            setTitle('Add Loan');
        } else if (mode === 'edit') {
            setTitle('Edit Loan');
        }

        mounted && setLoading(false);

        return () => {
            mounted = false;
        };
    }, [mode]);

    return (
        <React.Fragment>
            <SideBar title={title} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
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
                                    {mode !== 'reloan' ? (
                                        <React.Fragment>
                                            <div className="mt-4 flex flex-row">
                                                <RadioButton id={"radio_daily"} name="radio-group-occurence" label={"Daily"} checked={groupOccurence === 'daily'} value="daily" onChange={handleOccurenceChange} />
                                                <RadioButton id={"radio_weekly"} name="radio-group-occurence" label={"Weekly"} checked={groupOccurence === 'weekly'} value="weekly" onChange={handleOccurenceChange} />
                                            </div>
                                            <div className="mt-4">
                                                <SelectDropdown
                                                    name="groupId"
                                                    field="groupId"
                                                    value={selectedGroup}
                                                    label="Group"
                                                    options={groupList}
                                                    onChange={(field, value) => handleGroupChange(field, value)}
                                                    onBlur={setFieldTouched}
                                                    placeholder="Select Group"
                                                    errors={touched.groupId && errors.groupId ? errors.groupId : undefined}
                                                />
                                            </div>
                                            <div className="mt-4">
                                                <SelectDropdown
                                                    name="slotNo"
                                                    field="slotNo"
                                                    value={slotNo}
                                                    label="Slot Number"
                                                    options={slotNumber}
                                                    onChange={(field, value) => handleSlotNoChange(field, value)}
                                                    onBlur={setFieldTouched}
                                                    placeholder="Select Slot No"
                                                    errors={touched.slotNo && errors.slotNo ? errors.slotNo : undefined}
                                                />
                                            </div>
                                            <div className="mt-4 flex flex-row">
                                                <RadioButton id={"radio_active"} name="radio-client-type" label={"Active Clients"} checked={clientType === 'active'} value="active" onChange={handleClientTypeChange} />
                                                <RadioButton id={"radio_offset"} name="radio-client-type" label={"Offset Clients"} checked={clientType === 'offset'} value="offset" onChange={handleClientTypeChange} />
                                            </div>
                                            <div className="mt-4">
                                                <SelectDropdown
                                                    name="clientId"
                                                    field="clientId"
                                                    value={values.clientId}
                                                    label="Client"
                                                    options={clientList}
                                                    onChange={setFieldValue}
                                                    onBlur={setFieldTouched}
                                                    placeholder="Select Client"
                                                    errors={touched.clientId && errors.clientId ? errors.clientId : undefined}
                                                />
                                            </div>
                                        </React.Fragment>
                                    ) : (
                                        <React.Fragment>
                                            <div className="mt-4">
                                                <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                                    <div className="flex justify-between">
                                                        <label htmlFor={'group'} className={`font-proxima-bold text-xs font-bold text-main`}>
                                                            Group
                                                        </label>
                                                    </div>
                                                    <span className="text-gray-400">{ loan && loan.groupName }</span>
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                                    <div className="flex justify-between">
                                                        <label htmlFor={'slotNo'} className={`font-proxima-bold text-xs font-bold text-main`}>
                                                            Slot Number
                                                        </label>
                                                    </div>
                                                    <span className="text-gray-400">{ loan && loan.slotNo }</span>
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                                    <div className="flex justify-between">
                                                        <label htmlFor={'client'} className={`font-proxima-bold text-xs font-bold text-main`}>
                                                            Client
                                                        </label>
                                                    </div>
                                                    <span className="text-gray-400">{ loan && loan.fullName }</span>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    )}
                                    <div className="mt-4">
                                        <InputNumber
                                            name="loanCycle"
                                            value={values.loanCycle}
                                            onChange={handleChange}
                                            label="Loan Cycle"
                                            placeholder="Enter Loan Cycle"
                                            setFieldValue={setFieldValue}
                                            errors={touched.loanCycle && errors.loanCycle ? errors.loanCycle : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputNumber
                                            name="principalLoan"
                                            value={values.principalLoan}
                                            onChange={handleChange}
                                            label="Principal Loan"
                                            disabled={values.status === 'active'}
                                            placeholder="Enter Principal Loan"
                                            setFieldValue={setFieldValue}
                                            errors={touched.principalLoan && errors.principalLoan ? errors.principalLoan : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="coMaker"
                                            value={values.coMaker}
                                            onChange={handleChange}
                                            label="Co-Maker"
                                            placeholder="Enter Co-Maker"
                                            setFieldValue={setFieldValue}
                                            errors={touched.coMaker && errors.coMaker ? errors.coMaker : undefined} />
                                    </div>
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

export default AddUpdateLoan;