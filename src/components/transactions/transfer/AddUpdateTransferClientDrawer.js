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
import 'react-calendar/dist/Calendar.css';
import SelectDropdown from "@/lib/ui/select";
import SideBar from "@/lib/ui/SideBar";
import { UppercaseFirstLetter, formatPricePhp } from "@/lib/utils";
import Spinner from "@/components/Spinner";

const AddUpdateTransferClient = ({ mode = 'add', client = {}, showSidebar, setShowSidebar, onClose }) => {
    const formikRef = useRef();
    const dispatch = useDispatch();
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState('Add Transfer Client');
    const branchList = useSelector(state => state.branch.list);

    const [sourceUserList, setSourceUserList] = useState([]);
    const [sourceGroupList, setSourceGroupList] = useState([]);
    const [selectedSourceBranch, setSelectedSourceBranch] = useState();
    const [selectedSourceUser, setSelectedSourceUser] = useState();
    const [selectedSourceGroup, setSelectedSourceGroup] = useState();

    const [targetUserList, setTargetUserList] = useState([]);
    const [targetGroupList, setTargetGroupList] = useState([]);
    const [selectedTargetBranch, setSelectedTargetBranch] = useState();
    const [selectedTargetUser, setSelectedTargetUser] = useState();
    const [selectedTargetGroup, setSelectedTargetGroup] = useState();

    const [clientList, setClientList] = useState([]);
    const [selectedClientId, setSelectedClientId] = useState();
    const [selectedClient, setSelectedClient] = useState();
    const [slotNumbers, setSlotNumbers] = useState();
    const [selectedSlotNo, setSelectedSlotNo] = useState();

    const initialValues = {
        sourceBranchId: client.sourceBranchId,
        sourceUserId: client.sourceUserId,
        sourceGroupId: client.sourceGroupId,
        targetBranchId: client.targetbranchId,
        targetUserId: client.targetUserId,
        targetGroupId: client.targetGroupId,
        selectedClientId: client.clientId,
        selectedSlotNo: client.selectedSlotNo
    }

    const validationSchema = yup.object().shape({
        // sourceBranchId: yup
        //     .string()
        //     .required('Please select a source branch.'),
        // sourceUserId: yup
        //     .string()
        //     .required('Please select a source loan officer.'),
        // sourceGroupId: yup
        //     .string()
        //     .required('Please select a source group.'),
        // targetBranchId: yup
        //     .string()
        //     .required('Please select a target branch.'),
        // targetUserId: yup
        //     .string()
        //     .required('Please select a target loan officer.'),
        // targetGroupId: yup
        //     .string()
        //     .required('Please select a target group.'),
        // selectedClientId: yup
        //     .string()
        //     .required('Please select client to transfer.'),
        // selectedSlotNo: yup
        //     .number()
        //     .required('Please select slot number.')
    });

    const getListUser = async (selectedBranch, type) => {
        if (selectedBranch) {
            let url = process.env.NEXT_PUBLIC_API_URL + 'users/list';

            url = url + '?' + new URLSearchParams({ branchCode: selectedBranch.code });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let userList = [];
                response.users && response.users.filter(u => u.role.rep === 4).map(u => {
                    const name = `${u.firstName} ${u.lastName}`;
                    userList.push(
                        {
                            ...u,
                            value: u._id,
                            label: UppercaseFirstLetter(name)
                        }
                    );
                });
                userList.sort((a, b) => { return a.loNo - b.loNo; });
                if (type === "source") {
                    setSourceUserList(userList);
                    setSourceGroupList();
                    setSelectedSourceGroup();
                    setSelectedClientId();
                    setSelectedClient();
                    setClientList();
                } else {
                    setTargetUserList(userList);
                    setTargetGroupList();
                    setSelectedTargetGroup();
                }
                
            } else {
                toast.error('Error retrieving user list.');
            }

            setLoading(false);
        }
    }

    const getListGroup = async (selectedUser, type) => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'groups/list';
        let selectedBranch = {};
        if (type === "source") {
            selectedBranch = branchList.find(b => b._id === selectedSourceBranch);
        } else {
            selectedBranch = branchList.find(b => b._id === selectedTargetBranch);
        }
        
        if (selectedBranch && selectedUser) {
            url = url + '?' + new URLSearchParams({ branchId: selectedBranch._id, loId: selectedUser._id });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let groups = [];
                await response.groups && response.groups.map(group => {
                    groups.push({
                        ...group,
                        day: UppercaseFirstLetter(group.day),
                        value: group._id,
                        label: group.name
                    });
                });
                groups.sort((a, b) => { return a.groupNo - b.groupNo; });

                if (type === "source") {
                    setSourceGroupList(groups);
                    setSelectedSourceGroup();
                    setSelectedClientId();
                    setSelectedClient();
                    setClientList();
                } else {
                    setTargetGroupList(groups);
                    setSelectedTargetGroup();
                }

                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    const getListClient = async (groupId) => {
        setLoading(true);
        let url = process.env.NEXT_PUBLIC_API_URL + 'clients/list?' + new URLSearchParams({ mode: "view_all_by_group", groupId: groupId });;

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
            setSelectedClientId();
            setSelectedClient();
            setClientList(clients)
            setLoading(false);
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
        }
    }

    const handleChangeBranch = (field, value, type) => {
        const selected = branchList.find(b => b._id === value);
        if (type === "source") {
            setSelectedSourceBranch(value);
            getListUser(selected, "source");
        } else {
            setSlotNumbers();
            setSelectedTargetBranch(value);
            getListUser(selected, "target");
        }

        const form = formikRef.current;
        form.setFieldValue(field, value);  
    }

    const handleChangeUser = (field, value, type) => {
        if (type === "source") {
            const selected = sourceUserList.find(u => u._id === value);
            setSelectedSourceUser(value);
            getListGroup(selected, "source");
        } else {
            const selected = targetUserList.find(u => u._id === value);
            setSelectedTargetUser(value);
            getListGroup(selected, "target");
            setSlotNumbers();
        }

        const form = formikRef.current;
        form.setFieldValue(field, value);
    }

    const handleChangeGroup = (field, value, type) => {
        const form = formikRef.current;
        if (type === "source") {
            setSelectedSourceGroup(value);
            getListClient(value);
        } else {
            const sourceGroup = sourceGroupList.find(group => group._id === selectedSourceGroup);
            const targetGroup = targetGroupList.find(group => group._id === value);
            setSlotNumbers();
            if (value === sourceGroup._id) {
                toast.error('Selected group is the same as the source group.');
                setSelectedTargetGroup(null);
                form.setFieldValue(field, null);
            } else if (targetGroup.occurence !== sourceGroup.occurence) {
                toast.error(`Please select a ${sourceGroup.occurence} group.`);
                setSelectedTargetGroup(null);
                form.setFieldValue(field, null);
            } else if (targetGroup.status === 'available') {
                setSelectedTargetGroup(value);
                const availableSlots = targetGroup.availableSlots.map(s => {
                    return { label: s, value: s };
                })
                setSlotNumbers(availableSlots);
                form.setFieldValue(field, value);
            } else {
                toast.error("Selected group is currently full.");
                setSelectedTargetGroup(null);
                form.setFieldValue(field, null);
            }
        }
    }

    const handleChangeClient = (field, value) => {
        const selected = clientList.find(b => b._id === value);
        setSelectedClient(selected);
        setSelectedClientId(value);

        const form = formikRef.current;
        form.setFieldValue(field, value);  
    }

    const handleChangeSlotNo = (field, value) => {
        setSelectedSlotNo(value);
        const form = formikRef.current;
        form.setFieldValue(field, value);  
    }

    const reset = () => {
        setSourceUserList();
        setSourceGroupList();
        setSelectedSourceBranch();
        setSelectedSourceUser();
        setSelectedSourceGroup();
        setTargetUserList();
        setTargetGroupList();
        setSelectedTargetBranch();
        setSelectedTargetUser();
        setSelectedTargetGroup();
        setClientList();
        setSelectedClientId();
        setSelectedClient();
        setSlotNumbers();
        setSelectedSlotNo();
    }

    const handleSaveUpdate = (values, action) => {
        console.log("saving...");
        setLoading(true);
        if (selectedSourceGroup === selectedTargetGroup) {
            setLoading(false);
            toast.error('Selected source and target groups are the same.');
        } else if (!selectedClientId) {
            setLoading(false);
            toast.error("No selected client!");
        } else {
            if (selectedTargetGroup) {
                let uClient = {...selectedClient};

                uClient.branchId = selectedTargetBranch;
                uClient.loId = selectedTargetUser;
                uClient.groupId = selectedTargetGroup;
                uClient.sameLo = selectedClient.loId === selectedTargetUser;
                uClient.oldGroupId = selectedClient.groupId;
                uClient.oldBranchId = selectedClient.branchId;
                uClient.oldLoId = selectedClient.loId;
                
                if (selectedClient.loans.length > 0) {
                    uClient.loanId = selectedClient.loans[0]._id;
                    uClient.oldSlotNo = selectedClient.slotNo;
                    uClient.slotNo = values.selectedSlotNo;
                }

                if (mode === "add") {
                    fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/transfer-client', uClient)
                        .then(response => {
                            setLoading(false);
                            if (response.error) {
                                toast.error(response.message);
                            } else if (response.success) {
                                setShowSidebar(false);
                                toast.success('Transfer client successfully added.');
                                action.setSubmitting = false;
                                action.resetForm({values: ''});
                                reset();
                                onClose();
                            }
                        }).catch(error => {
                            console.log(error)
                        });
                } else {
                    // update
                }
            } else {
                setLoading(false);
                toast.error("Please select target group.");
            }
        }
    }

    const handleCancel = () => {
        setShowSidebar(false);
        formikRef.current.resetForm();
        reset();
        onClose();
    }

    useEffect(() => {
        let mounted = true;

        if (mode === 'add') {
            setTitle('Add Transfer Client');
        } else if (mode === 'edit') {
            setTitle('Edit Transfer Client');
            const form = formikRef.current;
            // setClientId(loan.clientId);
            // setSelectedGroup(loan.groupId);
            // setSlotNo(loan.slotNo);

            // form.setFieldValue('clientId', loan.clientId);
            // form.setFieldValue('groupId', loan.groupId);
            // form.setFieldValue('slotNo', loan.slotNo);
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
                    <div className="px-2 pb-8">
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
                                        <SelectDropdown
                                            name="sourceBranchId"
                                            field="sourceBranchId"
                                            value={selectedSourceBranch}
                                            label="Source Branch"
                                            options={branchList}
                                            onChange={(field, value) => handleChangeBranch(field, value, "source")}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Source Branch"
                                            errors={touched.sourceBranchId && errors.sourceBranchId ? errors.sourceBranchId : undefined}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="sourceUserId"
                                            field="sourceUserId"
                                            value={selectedSourceUser}
                                            label="Source Loan Officer"
                                            options={sourceUserList}
                                            onChange={(field, value) => handleChangeUser(field, value, "source")}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Source Loan Officer"
                                            errors={touched.sourceUserId && errors.sourceUserId ? errors.sourceUserId : undefined}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="sourceGroupId"
                                            field="sourceGroupId"
                                            value={selectedSourceGroup}
                                            label="Source Group"
                                            options={sourceGroupList}
                                            onChange={(field, value) => handleChangeGroup(field, value, "source")}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Source Group"
                                            errors={touched.sourceGroupId && errors.sourceGroupId ? errors.sourceGroupId : undefined}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="selectedClientId"
                                            field="selectedClientId"
                                            value={selectedClientId}
                                            label="Client to Transfer"
                                            options={clientList}
                                            onChange={(field, value) => handleChangeClient(field, value)}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Client"
                                            errors={touched.selectedClientId && errors.selectedClientId ? errors.selectedClientId : undefined}
                                        />
                                    </div>
                                    {selectedClient?.loans.length > 0 && (
                                        <React.Fragment>
                                            <div className="mt-4">
                                                <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                                    <div className="flex justify-between">
                                                        <label htmlFor={'slotNo'} className={`font-proxima-bold text-xs font-bold text-main`}>
                                                            Current Slot Number
                                                        </label>
                                                    </div>
                                                    <span className="text-gray-400">{ selectedClient.loans[0].slotNo }</span>
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                                    <div className="flex justify-between">
                                                        <label htmlFor={'slotNo'} className={`font-proxima-bold text-xs font-bold text-main`}>
                                                            Amount Release
                                                        </label>
                                                    </div>
                                                    <span className="text-gray-400">{ formatPricePhp(selectedClient.loans[0].amountRelease) }</span>
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                                    <div className="flex justify-between">
                                                        <label htmlFor={'slotNo'} className={`font-proxima-bold text-xs font-bold text-main`}>
                                                            Loan Balance
                                                        </label>
                                                    </div>
                                                    <span className="text-gray-400">{ formatPricePhp(selectedClient.loans[0].loanBalance) }</span>
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                                    <div className="flex justify-between">
                                                        <label htmlFor={'slotNo'} className={`font-proxima-bold text-xs font-bold text-main`}>
                                                            Target Collection
                                                        </label>
                                                    </div>
                                                    <span className="text-gray-400">{ formatPricePhp(selectedClient.loans[0].amountRelease - selectedClient.loans[0].loanBalance) }</span>
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                                    <div className="flex justify-between">
                                                        <label htmlFor={'slotNo'} className={`font-proxima-bold text-xs font-bold text-main`}>
                                                            Actual Collection
                                                        </label>
                                                    </div>
                                                    <span className="text-gray-400">{ formatPricePhp(selectedClient.loans[0].amountRelease - selectedClient.loans[0].loanBalance) }</span>
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                                    <div className="flex justify-between">
                                                        <label htmlFor={'slotNo'} className={`font-proxima-bold text-xs font-bold text-main`}>
                                                            Total MCBU
                                                        </label>
                                                    </div>
                                                    <span className="text-gray-400">{ formatPricePhp(selectedClient.loans[0].mcbu) }</span>
                                                </div>
                                            </div>
                                            {/* <div className="mt-4">
                                                <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                                    <div className="flex justify-between">
                                                        <label htmlFor={'slotNo'} className={`font-proxima-bold text-xs font-bold text-main`}>
                                                            MCBU Collection
                                                        </label>
                                                    </div>
                                                    <span className="text-gray-400">{ formatPricePhp(selectedClient.loans[0].mcbu) }</span>
                                                </div>
                                            </div> */}
                                        </React.Fragment>
                                    )}
                                    <div className="border-b border-zinc-300 h-4"></div>
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="targetBranchId"
                                            field="targetBranchId"
                                            value={selectedTargetBranch}
                                            label="Target Branch"
                                            options={branchList}
                                            onChange={(field, value) => handleChangeBranch(field, value, "target")}
                                            onBlur={setFieldTouched}
                                            disabled={!selectedClient}
                                            placeholder="Select Target Branch"
                                            errors={touched.targetBranchId && errors.targetBranchId ? errors.targetBranchId : undefined}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="targetUserId"
                                            field="targetUserId"
                                            value={selectedTargetUser}
                                            label="Target Loan Officer"
                                            options={targetUserList}
                                            onChange={(field, value) => handleChangeUser(field, value, "target")}
                                            onBlur={setFieldTouched}
                                            disabled={!selectedTargetBranch}
                                            placeholder="Select Target Loan Officer"
                                            errors={touched.targetUserId && errors.targetUserId ? errors.targetUserId : undefined}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="targetGroupId"
                                            field="targetGroupId"
                                            value={selectedTargetGroup}
                                            label="Target Group"
                                            options={targetGroupList}
                                            onChange={(field, value) => handleChangeGroup(field, value, "target")}
                                            onBlur={setFieldTouched}
                                            disabled={!selectedTargetUser}
                                            placeholder="Select Target Group"
                                            errors={touched.targetGroupId && errors.targetGroupId ? errors.targetGroupId : undefined}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="selectedSlotNo"
                                            field="selectedSlotNo"
                                            value={selectedSlotNo}
                                            label="New Slot Number"
                                            options={slotNumbers}
                                            onChange={(field, value) => handleChangeSlotNo(field, value)}
                                            onBlur={setFieldTouched}
                                            disabled={!selectedTargetGroup}
                                            placeholder="Select New Stot No"
                                            errors={touched.selectedSlotNo && errors.selectedSlotNo ? errors.selectedSlotNo : undefined}
                                        />
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

export default AddUpdateTransferClient;