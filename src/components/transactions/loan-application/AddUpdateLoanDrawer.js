import React, { useState, useEffect, useRef } from "react";
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import InputText from "@/lib/ui/InputText";
import InputNumber from "@/lib/ui/InputNumber";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import Spinner from "../../Spinner";
import 'react-calendar/dist/Calendar.css';
import moment, { min } from 'moment'
import SelectDropdown from "@/lib/ui/select";
import SideBar from "@/lib/ui/SideBar";
import RadioButton from "@/lib/ui/radio-button";
import { setGroupList } from "@/redux/actions/groupActions";
import { setClientList, setComakerList } from "@/redux/actions/clientActions";
import { UppercaseFirstLetter, checkIfWeekend, formatPricePhp, getNextValidDate } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/constants";
import DatePicker2 from "@/lib/ui/DatePicker2";

const AddUpdateLoan = ({ mode = 'add', loan = {}, showSidebar, setShowSidebar, onClose, type }) => {
    const formikRef = useRef();
    const dispatch = useDispatch();
    const holidayList = useSelector(state => state.holidays.list);
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const isWeekend = useSelector(state => state.systemSettings.weekend);
    const list = useSelector(state => state.loan.list);
    const currentUser = useSelector(state => state.user.data);
    const transactionSettings = useSelector(state => state.transactionsSettings.data);
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState('Add Loan');
    const branchList = useSelector(state => state.branch.list);
    const userList = useSelector(state => state.user.list);
    const groupList = useSelector(state => state.group.list);
    const clientList = useSelector(state => state.client.list);
    const currentBranch = useSelector(state => state.branch.data);
    const comakerList = useSelector(state => state.client.comakerList);
    const [selectedLo, setSelectedLo] = useState();
    const [selectedGroup, setSelectedGroup] = useState();
    const [slotNo, setSlotNo] = useState();
    const [slotNumber, setSlotNumber] = useState([]);
    const [groupOccurence, setGroupOccurence] = useState(type);
    const [clientId, setClientId] = useState();
    const [clientType, setClientType] = useState('pending');
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const [loanTerms, setLoanTerms] = useState(60);
    const [selectedCoMaker, setSelectedCoMaker] = useState();
    const [tempSlotNo, setTempSlotNo] = useState([]);
    const [loanBalance, setLoanBalance] = useState();

    const [selectedOldBranch, setSelectedOldBranch] = useState();
    const [selectedOldLO, setSelectedOldLO] = useState();
    const [selectedOldGroup, setSelectedOldGroup] = useState();
    const [oldLOList, setOldLOList] = useState();
    const [oldGroupList, setOldGroupList] = useState();
    const [selectedLoanId, setSelectedLoanId] = useState();

    // const [loanFor, setLoanFor] = useState('today');
    const [loStatus, setLoStatus] = useState();
    const [initialDateRelease, setInitialDateRelease] = useState();

    const initialValues = {
        branchId: loan.branchId,
        loId: loan.loId,
        groupId: loan.groupId,
        slotNo: loan.slotNo,
        clientId: loan.clientId,
        fullName: loan.fullName,
        admissionDate: loan.admissionDate,
        mcbu: type === 'weekly' ? (mode === 'edit' || mode === 'reloan') ? loan.mcbu : 50 : (mode === 'edit' || mode === 'reloan') ? loan.mcbu : 0,
        dateGranted: mode !== 'reloan' ? loan.dateGranted : null,
        principalLoan: loan.principalLoan,
        activeLoan: loan.activeLoan,
        loanBalance: loan.loanBalance,
        amountRelease: loan.amountRelease,
        noOfPayments: mode !== 'reloan' ? loan.noOfPayments : 0,
        coMaker: loan.coMaker ? typeof loan.coMaker == 'string' ? parseInt(loan.coMaker) : null : null,
        loanCycle: mode !== 'reloan' ? mode === 'add' ? 1 : loan.loanCycle : loan.loanCycle + 1,
        pnNumber: loan.pnNumber,
        guarantorFirstName: loan.guarantorFirstName,
        guarantorMiddleName: loan.guarantorMiddleName,
        guarantorLastName: loan.guarantorLastName,
        status: mode !== 'reloan' ? loan.status : 'pending',
        ciName: loan?.ciName || '',
        dateOfRelease: loan.dateOfRelease,
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
            .moreThan(4999, 'Princal loan should be 5000 or greater')
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
        // pnNumber: yup
        //     .string()
        //     .required('Please enter a promisory note number.'),
        guarantorFirstName: yup
            .string()
            .required('Please enter guarantor first name'),
        guarantorLastName: yup
            .string()
            .required('Please enter guarantor last name'),
        ciName: yup.string().required('Please enter C.I. name'),
    });

    // const handleLoanForChange = (value) => {
    //     setLoanFor(value);
    // }

    const handleLoIdChange = (field, value) => {
        setLoading(true);
        const form = formikRef.current;
        const u = userList.find(u => u._id == value);
        setSelectedLo(value);
        setGroupOccurence(u?.transactionType);
        const group = groupList.find(g => g._id === value);
        if (group) {
            let slotArr = [];
            group.availableSlots.map(slot => {
                if (slot <= group.capacity) {
                    slotArr.push({
                        value: slot,
                        label: slot
                    });
                }
            });

            setSlotNumber(slotArr);
            form.setFieldValue('loId', group.loanOfficerId);
        }

        if (clientType !== 'advance' && clientType !== 'active') {
            getListGroup(u?.transactionType, value);
        } else {
            getListGroup(u?.transactionType, value, 'filter');
        }

        form.setFieldValue(field, value);
        setLoading(false);
    }

    const handleGroupIdChange = (field, value) => {
        setLoading(true);
        const form = formikRef.current;
        setSelectedGroup(value);
        const group = groupList.find(g => g._id === value);
        if (group) {
            let slotArr = [];
            group.availableSlots.map(slot => {
                if (slot <= group.capacity) {
                    slotArr.push({
                        value: slot,
                        label: slot
                    });
                }
            });

            setSlotNumber(slotArr);
            form.setFieldValue('loId', group.loanOfficerId);
        }

        if (clientType == 'offset') {
            form.setFieldValue('clientId', clientId);
        }
        
        form.setFieldValue(field, value);
        if (clientType !== 'offset') {
            getListClient(clientType, value);
        }
        setLoading(false);
    }

    const handleClientIdChange = (field, value) => {
        setLoading(true);
        const form = formikRef.current;
        setClientId(value);
        
        if (clientType === 'active' || clientType == 'advance') {
            const currentClient = clientList.find(c => c._id === value);
            const currentSlotNo = currentClient && currentClient.loans[0].slotNo;
            const currentLoanCycle = currentClient && currentClient.loans[0].loanCycle;
            setSlotNo(currentSlotNo);
            setLoanBalance(currentClient?.loans[0]?.loanBalance);
            setSelectedLoanId(currentClient?.loans[0]?._id);
            form.setFieldValue('slotNo', currentSlotNo);
            form.setFieldValue('loanCycle', currentLoanCycle + 1);
        }

        form.setFieldValue('groupId', selectedGroup);

        form.setFieldValue(field, value);
        setLoading(false);
    }

    const handleSlotNoChange = (field, value) => {
        setLoading(true);
        const form = formikRef.current;
        setSlotNo(value);
        if (mode !== 'reloan') {
            form.setFieldValue('groupId', selectedGroup);
        }

        if (clientType == 'offset') {
            form.setFieldValue('clientId', clientId);
        }

        form.setFieldValue(field, value);
        setLoading(false);
    }

    const handleCoMakerChange = (field, value) => {
        setLoading(true);
        const form = formikRef.current;
        setSelectedCoMaker(value);
        if (mode !== 'reloan') {
            form.setFieldValue('groupId', selectedGroup);
        }

        if (clientType == 'offset') {
            form.setFieldValue('clientId', clientId);
        }

        form.setFieldValue(field, value);
        setLoading(false);
    }

    const handleSaveUpdate = (values, action) => {
        setLoading(true);
        let group;
        values.currentDate = currentDate;
        values.clientId = clientId;
        values.loanFor = 'tomorrow';
        values.dateOfRelease = values.dateOfRelease ? values.dateOfRelease : initialDateRelease;

        if (values.dateOfRelease == currentDate)  {
            values.loanFor = 'today';
        }

        if (mode !== 'reloan') {
            values.groupId = selectedGroup;
            group = groupList.find(g => g._id === values.groupId);
            values.groupName = group?.name;
            const branch = branchList.find(b => b._id === group.branchId);
            values.branchId = branch._id;
            values.branchName = branch.name;
            values.loId = group.loanOfficerId;
            values.occurence = group?.occurence;

            if (clientType == 'advance' || clientType == 'active') {
                values.mode = clientType;
                if (mode == 'add') {
                    values.oldLoanId = selectedLoanId;
                    values.advanceTransaction = true;
                }
            }
        } else {
            group = loan.group;
            values.loId = loan.loId;
            values.groupId = loan.groupId;
            values.groupName = loan.groupName;
            values.mode = 'reloan';
            values.oldLoanId = loan.loanId;
            values.clientId = loan.clientId;
            values.branchId = loan.branchId;
            values.prevLoanFullPaymentDate = loan.fullPaymentDate;
            values.prevLoanFullPaymentAmount = loan?.history.amountRelease;
            values.occurence = loan.occurence;
        }

        values.slotNo = mode !== 'reloan' ? slotNo : loan.slotNo;

        if (values.occurence === 'weekly') {
            values.groupDay = loan.groupDay;
        }

        const loanLimit = values.occurence == 'daily' ? transactionSettings.loanDailyLimit : transactionSettings.loanWeeklyLimit;
        if (values.principalLoan > loanLimit) {
            setLoading(false);
            toast.error(`Invalid Principal Loan. Maximum loanable amount is up to ${formatPricePhp(loanLimit)} only.`);
        } else if (values.principalLoan % 1000 === 0) {
            if (type === 'weekly' && (!values.mcbu || parseFloat(values.mcbu) < 50)) {
                setLoading(false);
                toast.error('Invalid MCBU amount. Please enter at least 50.');
            } else if (loanTerms === 100 && values.principalLoan < 10000) {
                setLoading(false);
                toast.error('For 100 days loan term, principal amount should be greater than or equal to 10,0000.');
            } else {
                if (values.status !== 'active') {
                    if (values.occurence === 'weekly') {
                        values.activeLoan = (values.principalLoan * 1.20) / 24;
                        values.loanTerms = 24;
                    } else if (values.occurence === 'daily') {
                        values.loanTerms = loanTerms;
                        if (loanTerms === 60) {
                            values.activeLoan = (values.principalLoan * 1.20) / 60;
                        } else {
                            values.activeLoan = (values.principalLoan * 1.20) / 100;
                        }
                    }
            
                    values.loanBalance = values.principalLoan * 1.20; // initial
                    values.amountRelease = values.loanBalance;
                }

                values.group = group;

                if (mode === 'add' || mode === 'reloan') {
                    // should check if the user has previous loan that is loanCycle 0, then set the loanCycle to 1
                    const apiUrl = getApiBaseUrl() + 'transactions/loans/save/';

                    values.lastUpdated = null;  // use only when updating the mispayments
                    values.admissionDate = currentDate;
                    values.status = 'pending';
                    values.loanCycle = values.loanCycle ? values.loanCycle : 1;
                    values.noOfPayments = 0;
                    values.insertedBy = currentUser._id;
                    values.currentReleaseAmount = values.amountRelease;
                    values.mcbuWithdrawal = 0;
                    values.mcbuInterest = 0;
                    values.mcbuReturnAmt = 0;
                    console.log(values.admissionDate, currentDate)
                    fetchWrapper.post(apiUrl, values)
                        .then(response => {
                            setLoading(false);
                            if (response.error) {
                                toast.error(response.message);
                            } else if (response.success) {
                                setShowSidebar(false);
                                toast.success('Loan successfully added.');

                                if (clientType == 'active') {
                                    const pendingLoan = [{...values, loanId: values.oldLoanId}];
                                    setTimeout(async () => {
                                        await fetchWrapper.post(getApiBaseUrl() + 'transactions/cash-collections/update-pending-loans', pendingLoan);
                                    }, 3000);
                                }

                                action.setSubmitting = false;
                                action.resetForm({values: ''});
                                setSelectedGroup();
                                setClientId();
                                setSlotNo();
                                setSlotNumber();
                                setSelectedCoMaker();
                                setGroupOccurence('daily');
                                // setLoanFor('today');
                                onClose();
                            }
                        }).catch(error => {
                            console.log(error)
                        });
                } else if (mode === 'edit') {
                    const apiUrl = getApiBaseUrl() + 'transactions/loans';
                    values._id = loan._id;
                    values.modifiedBy = currentUser._id;
                    values.modifiedDate = moment(new Date()).format("YYYY-MM-DD");
                    fetchWrapper.post(apiUrl, values)
                        .then(response => {
                            if (response.success) {
                                let error = false;
                                if (values.status === 'active' && values.groupId !== loan.groupId) {
                                    let params = { groupId: values.groupId, oldGroupId: loan.groupId };
                                    
                                    fetchWrapper.post(getApiBaseUrl() + 'groups/update-group', params)
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
                                    setSelectedGroup();
                                    setClientId();
                                    setSlotNo();
                                    setSlotNumber();
                                    setSelectedCoMaker();
                                    setGroupOccurence('daily');
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
        } else {
            setLoading(false);
            toast.error('Principal Loan must be divisible by 1000');
        }
    }

    const getLastPNNumber = async () => {
        const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/get-last-pn-number-by-branch?' + new URLSearchParams({ branchId: currentBranch._id, currentDate: currentDate }));
        if (response.success) {
            const form = formikRef.current;
            if (response.data.length > 0) {
                const lastPNNumber = response.data[0];
                const numberPart = lastPNNumber.maxNumber + 1;
                const pnNumber = `${currentUser.designatedBranch}-${moment(currentDate).format('MM-DD')}-${numberPart.toString().padStart(3, '0')}`;
                form.setFieldValue('pnNumber', pnNumber);
            } else {
                const pnNumber = `${currentUser.designatedBranch}-${moment(currentDate).format('MM-DD')}-001`;
                form.setFieldValue('pnNumber', pnNumber);
            }
        }
    }

    const handlePNNumber = async (e) => {
        const pnNumber = e.target.value;
        if (pnNumber && currentBranch) {
            const response = await fetchWrapper.get(getApiBaseUrl() + 'transactions/loans/check-existing-pn-number-by-branch?' + new URLSearchParams({ branchId: currentBranch._id, pnNumber: pnNumber, currentDate: currentDate }));
            if (response.success) {
                if (response.loans.length > 0) {
                    // const form = formikRef.current;
                    await getLastPNNumber()
                    // form.setFieldValue('pnNumber', '');
                    toast.error(response.message);
                }
            }
        }
    }

    const getListUser = async (branchCode, type) => {
        let url = getApiBaseUrl() + 'users/list?' + new URLSearchParams({ branchCode: branchCode });
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let userList = [];
            response.users && response.users.filter(u => u.role.rep === 4).map(u => {
                const name = `${u.firstName} ${u.lastName}`;
                userList.push(
                    {
                        ...u,
                        name: name,
                        label: name,
                        value: u._id
                    }
                );
            });
            userList.sort((a, b) => { return a.loNo - b.loNo; });

            if (type == 'old') {
                setOldLOList(userList);
            }
        } else {
            toast.error('Error retrieving user list.');
        }
    }

    const getListGroup = async (occurence, loId, mode, origin) => {
        setLoading(true);
        let url = getApiBaseUrl() + 'groups/list-by-group-occurence';
        if (currentUser.root !== true && currentUser.role.rep === 4 && branchList.length > 0) { 
            let branchId = origin == 'old' ? selectedOldBranch : currentUser.designatedBranchId;
            if (mode == 'filter') {
                url = url + '?' + new URLSearchParams({ branchId: branchId, loId: currentUser._id, occurence: occurence, mode: 'filter' });
            } else {
                url = url + '?' + new URLSearchParams({ branchId: branchId, loId: currentUser._id, occurence: occurence });
            }
            processGroupList(url);
        } else if (currentUser.root !== true && currentUser.role.rep === 3 && branchList.length > 0) {
            let branchId = origin == 'old' ? selectedOldBranch : currentUser.designatedBranchId;
            if (mode == 'filter') {
                url = url + '?' + new URLSearchParams({ branchId: branchId, loId: loId, occurence: occurence, mode: 'filter' });
            } else {
                url = url + '?' + new URLSearchParams({ branchId: branchId, loId: loId, occurence: occurence });
            }
            processGroupList(url, origin);
        }
    }

    const processGroupList = async (url, origin) => {
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
            groups.sort((a,b) => { return a.groupNo - b.groupNo });
            if (origin == 'old') {
                setOldGroupList(groups);
            } else {
                dispatch(setGroupList(groups));
            }
            setLoading(false);
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
        }
    }

    const getListClient = async (status, groupId, origin) => {
        setLoading(true);
        let url = getApiBaseUrl() + 'clients/list';
        if (currentUser.root !== true && currentUser.role.rep === 4 && branchList.length > 0) {
            if (status === 'active') {
                url = url + '?' + new URLSearchParams({ mode: "view_only_no_exist_loan", branchId: currentUser.designatedBranchId, groupId: groupId, status: status });
            } else if (status === 'advance') {
                url = url + '?' + new URLSearchParams({ mode: "view_existing_loan", branchId: currentUser.designatedBranchId, groupId: groupId, status: status });
            } else if (status === 'offset') {
                url = url + '?' + new URLSearchParams({ mode: "view_offset", status: status, branchId: selectedOldBranch, loId: selectedOldLO, groupId: groupId });
            } else {
                url = url + '?' + new URLSearchParams({ mode: "view_only_no_exist_loan", loId: currentUser._id, groupId: groupId, status: status });
            }
        } else if (currentUser.root !== true && currentUser.role.rep === 3 && branchList.length > 0) {
            if (status === 'active') {
                url = url + '?' + new URLSearchParams({ mode: "view_only_no_exist_loan", branchId: currentUser.designatedBranchId, groupId: groupId, status: status });
            } else if (status === 'advance') {
                url = url + '?' + new URLSearchParams({ mode: "view_existing_loan", branchId: currentUser.designatedBranchId, groupId: groupId, status: status });
            } else if (status === 'offset') {
                url = url + '?' + new URLSearchParams({ mode: "view_offset", status: status, branchId: selectedOldBranch, loId: selectedOldLO, groupId: groupId });
            } else {
                url = url + '?' + new URLSearchParams({ mode: "view_only_no_exist_loan", branchId: currentUser.designatedBranchId, groupId: groupId, status: status });
            }
        }

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let clients = [];
            await response.clients && response.clients.map(client => {
                if (status === 'active' || status === 'advance') {
                    let temp = {
                        ...client.client,
                        loans: [client],
                        label: UppercaseFirstLetter(`${client.slotNo} - ${client.client.lastName}, ${client.client.firstName}`),
                        value: client.client._id,
                        slotNo: client.slotNo
                    };
                    delete temp.loans[0].client;
                    clients.push(temp);
                } else {
                    clients.push({
                        ...client,
                        label: UppercaseFirstLetter(`${client.lastName}, ${client.firstName}`),
                        value: client._id
                    });   
                }
            });
            if (status === 'active' || status === 'advance') {
                clients.sort((a,b) => { return a.slotNo - b.slotNo });
            }

            dispatch(setClientList(clients));
            setLoading(false);
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
        }
    }

    const getListCoMaker = async (groupId) => {
        setLoading(true);
        let url = getApiBaseUrl() + 'clients/list';
        if (currentUser.role.rep == 3 || currentUser.role.rep === 4) {
            url = url + '?' + new URLSearchParams({ mode: "view_by_group", groupId: groupId });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const clients = [];
                await response.clients && response.clients.map(loan => {
                    clients.push({
                        slotNo: loan.slotNo,
                        value: loan.clientId,
                        label: loan.slotNo
                    });
                });
                clients.sort((a, b) => { return a.slotNo - b.slotNo })
                dispatch(setComakerList(clients));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    const handleOccurenceChange = (value) => {
        setGroupOccurence(value);
        getListGroup(value);
    }

    const handleClientTypeChange = (value) => {
        setClientType(value);
        if (value !== 'offset') {
            getListClient(value, selectedGroup);
        }
        if ((value == 'advance' || value == 'active') && currentUser.role.rep == 4) {
            getListGroup(currentUser.transactionType, currentUser._id, 'filter');
        }
    }

    const handleLoanTermsChange = (value) => {
        setLoanTerms(parseInt(value));
    }

    const handleCancel = () => {
        setShowSidebar(false);
        formikRef.current.resetForm();
        setSelectedGroup();
        setClientId();
        setSlotNo();
        setSlotNumber();
        setSelectedCoMaker();
        onClose();
    }

    const handleOldBranchIdChange = (field, value) => {
        setLoading(true);
        const form = formikRef.current;
        const selectedBranch = branchList.find(b => b._id == value);
        setSelectedOldBranch(value);
        form.setFieldValue(field, value);
        getListUser(selectedBranch?.code, 'old');
        setLoading(false);
    }

    const handleOldLoIdChange = (field, value) => {
        setLoading(true);
        const form = formikRef.current;
        const selectedLO = oldLOList.find(l => l._id == value);
        setSelectedOldLO(value);
        form.setFieldValue(field, value);
        getListGroup(selectedLO.transactionType, value, 'filter', 'old');
        setLoading(false);
    }

    const handleOldGroupIdChange = (field, value) => {
        setLoading(true);
        const form = formikRef.current;
        setSelectedOldGroup(value);
        form.setFieldValue(field, value);
        getListClient(clientType, value, 'old');
        setLoading(false);
    }

    const handleDateOfRelease = (selected) => {
        const form = formikRef.current;
        form.setFieldValue('dateOfRelease', selected);
    }

    const [showCalendar, setShowCalendar] = useState(false);
    const openCalendar = () => {
        setShowCalendar(true);
    };

    const getAllLoanPerGroup = async (groupId) => {
        const response = await fetchWrapper.get(getApiBaseUrl() + 'transactions/loans/get-comaker-by-group?' + new URLSearchParams({ groupId: groupId }));

        let slotNumbers = [];
        if (response.success) {
            slotNumbers = await response.data;
        }

        return slotNumbers;
    }

    useEffect(() => {
        let mounted = true;
        if (mode === 'add') {
            setTitle('Add Loan');
        } else if (mode === 'edit') {
            setTitle('Edit Loan');
            const form = formikRef.current;
            setClientId(loan.clientId);
            setSelectedGroup(loan.groupId);
            setSlotNo(loan.slotNo);
            setSelectedCoMaker(loan.coMaker);
            // setLoanFor(loan?.loanFor);

            form.setFieldValue('clientId', loan.clientId);
            form.setFieldValue('groupId', loan.groupId);
            form.setFieldValue('slotNo', loan.slotNo);

            getListGroup(loan.occurence, loan.loId, 'filter');
        } else if (mode === 'reloan') {
            setTitle('Reloan');
            setLoanTerms(loan.loanTerms);
        }

        mounted && setLoading(false);

        return () => {
            mounted = false;
        };
    }, [mode]);

    // useEffect(() => {
    //     if (mode !== 'edit' && selectedGroup) {
    //         getListCoMaker(selectedGroup);
    //     }
    // }, [selectedGroup, mode]);

    useEffect(() => {
        if (selectedGroup || mode === 'reloan') {
            const setSlotNumbers = async () => {
                // const existingSlotNumbers = await getAllLoanPerGroup(selectedGroup);
                const ts = [];
                for (let i = 1; i <= 30; i++) {
                    // if (existingSlotNumbers && !existingSlotNumbers.includes(i)) {
                        ts.push({ value: i, label: i });
                    // }
                }

                setTempSlotNo(ts);
            }

            setSlotNumbers();
        }
    }, [list, selectedGroup, mode]);

    useEffect(() => {
        const getLOStatus = async (loId) => {
            const response = await fetchWrapper.get(getApiBaseUrl() + 'transactions/cash-collections/get-lo-status?' + new URLSearchParams({ loId: loId, currentDate: currentDate }));
            if (response.success) {
                setLoStatus(response.status);

                // if (response.status === 'open') {
                //     setLoanFor('today');
                // } else {
                //     setLoanFor('tomorrow');
                // }

                // if (isHoliday || isWeekend) {
                //     setLoanFor('tomorrow');
                // }
            }
        }

        if (mode == 'add') {
            if (currentUser.role.rep == 4) {
                getLOStatus(currentUser._id);
            } else if (selectedLo){
                getLOStatus(selectedLo);
            }
        }
    }, [mode, currentUser, selectedLo]);
    // const ddddate = "2024-12-10";
    useEffect(() => {
        if (mode == 'add' && currentDate) {
            const dayName = moment(currentDate).format('dddd');
            if (dayName == 'Friday') {
                setInitialDateRelease(getNextValidDate(moment(currentDate).add(4, 'days').format('YYYY-MM-DD'), holidayList).format('YYYY-MM-DD'));
            } else if (isWeekend) {
                setInitialDateRelease(getNextValidDate(moment(currentDate).add(dayName == 'Saturday' ? 3 : 2, 'days').format('YYYY-MM-DD'), holidayList).format('YYYY-MM-DD'));
            } else {
                const nextValidDate = getNextValidDate(moment(currentDate).add(2, 'days').format('YYYY-MM-DD'), holidayList);
                setInitialDateRelease(nextValidDate.format('YYYY-MM-DD'));
            }
        } else if (mode == 'edit' && loan.dateOfRelease) {
            setInitialDateRelease(loan.dateOfRelease);
        }
    }, [mode, loan.dateOfRelease, currentDate, isWeekend, isHoliday, holidayList]);

    const [minDate, setMinDate] = useState();
    const [maxDate, setMaxDate] = useState();
    useEffect(() => {
        if (currentDate && initialDateRelease) {
            // let initialMinDate = initialDateRelease;
            let initialMinDate = moment(currentDate).add(1, 'days').format('YYYY-MM-DD');
            if (mode == 'edit') {
                let admissionDate = loan?.admissionDate;
                let allowedAdmissionDate = moment(admissionDate).add(2, 'days').isSameOrAfter(moment(currentDate));
                if (admissionDate && moment(admissionDate).isBefore(currentDate)) {
                    allowedAdmissionDate = true;
                }

                if (allowedAdmissionDate) {
                    initialMinDate = getNextValidDate(currentDate, holidayList);
                }
            }

            initialMinDate = moment(initialMinDate);
            setMinDate(initialMinDate.toDate());

            const initialMinDateDay = moment(initialMinDate).format('dddd');
            let numberOfDays = initialMinDateDay == 'Monday' ? 4 : 8;
            const initialMaxDate = moment(initialMinDate).add(numberOfDays, 'days').format("YYYY-MM-DD");
            setMaxDate(getNextValidDate(initialMaxDate, holidayList).toDate());
        }
    }, [mode, loan.admissionDate, currentDate, holidayList, initialDateRelease]);

    return (
        <React.Fragment>
            <SideBar title={title} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
                {loading ? (
                    <div className="flex items-center justify-center h-screen">
                        <Spinner />
                    </div>
                ) : (
                    <div className="px-2 pb-4">
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
                                    {/* <div className="flex flex-col mt-4 text-gray-500">
                                        <div>Loan for</div>
                                        <div className="flex flex-row ml-4">
                                            <RadioButton id={"radio_today"} name="radio-loan-type" label={"Today"} checked={loanFor === 'today'} value="today" onChange={() => setLoanFor('today')} />
                                            <RadioButton id={"radio_tomorrow"} name="radio-loan-type" label={"Tomorrow"} checked={loanFor === 'tomorrow'} value="tomorrow" onChange={() => setLoanFor('tomorrow')} />
                                        </div>
                                    </div> */}
                                    {(initialDateRelease && minDate && maxDate) && (
                                        <div className="relative w-full mt-4" onClick={openCalendar}>
                                            <span className="text-sm">Date of Release</span>
                                            <DatePicker2
                                                name="dateOfRelease"
                                                value={initialDateRelease}
                                                onChange={handleDateOfRelease}
                                                minDate={minDate}
                                                maxDate={maxDate}
                                            />
                                        </div>
                                    )}
                                    {mode === 'add' ? (
                                        <React.Fragment>
                                            <div className="mt-4 flex flex-row">
                                                <RadioButton id={"radio_pending"} name="radio-client-type" label={"Prospect Clients"} checked={clientType === 'pending'} value="pending" onChange={handleClientTypeChange} />
                                                <RadioButton id={"radio_advance"} name="radio-client-type" label={"Reloan Clients"} checked={clientType === 'advance'} value="advance" onChange={handleClientTypeChange} />
                                                <RadioButton id={"radio_active"} name="radio-client-type" label={"Pending Clients"} checked={clientType === 'active'} value="active" onChange={handleClientTypeChange} />
                                                <RadioButton id={"radio_offset"} name="radio-client-type" label={"Balik Clients"} checked={clientType === 'offset'} value="offset" onChange={handleClientTypeChange} />
                                            </div>
                                            {clientType == 'offset' && (
                                                <div className="mt-4">
                                                    <span className="text-sm font-bold">Search Client</span>
                                                    <div className="mt-4">
                                                        <SelectDropdown
                                                            name="oldBranchId"
                                                            field="oldBranchId"
                                                            value={selectedOldBranch}
                                                            label="Previous Branch (Required)"
                                                            options={branchList}
                                                            onChange={(field, value) => handleOldBranchIdChange(field, value)}
                                                            onBlur={setFieldTouched}
                                                            placeholder="Select Previous Branch"
                                                            errors={touched.oldBranchId && errors.oldBranchId ? errors.oldBranchId : undefined}
                                                        />
                                                    </div>
                                                    <div className="mt-4">
                                                        <SelectDropdown
                                                            name="oldLOId"
                                                            field="oldLOId"
                                                            value={selectedOldLO}
                                                            label="Previous Loan Officer (Required)"
                                                            options={oldLOList}
                                                            onChange={(field, value) => handleOldLoIdChange(field, value)}
                                                            onBlur={setFieldTouched}
                                                            placeholder="Select Previous Loan Officer"
                                                            errors={touched.oldLOId && errors.oldLOId ? errors.oldLOId : undefined}
                                                        />
                                                    </div>
                                                    <div className="mt-4">
                                                        <SelectDropdown
                                                            name="oldGroupId"
                                                            field="oldGroupId"
                                                            value={selectedOldGroup}
                                                            label="Previous Group (Required)"
                                                            options={oldGroupList}
                                                            onChange={(field, value) => handleOldGroupIdChange(field, value)}
                                                            onBlur={setFieldTouched}
                                                            placeholder="Select Previous Group"
                                                            errors={touched.oldGroupId && errors.oldGroupId ? errors.oldGroupId : undefined}
                                                        />
                                                    </div>
                                                    <div className="mt-4">
                                                        <SelectDropdown
                                                            name="clientId"
                                                            field="clientId"
                                                            value={clientId}
                                                            label="Client (Required)"
                                                            options={clientList}
                                                            onChange={(field, value) => handleClientIdChange(field, value)}
                                                            onBlur={setFieldTouched}
                                                            placeholder="Select Client"
                                                            errors={touched.clientId && errors.clientId ? errors.clientId : undefined}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            { currentUser.role.rep === 3 && (
                                                <div className="mt-4">
                                                    <SelectDropdown
                                                        name="loId"
                                                        field="loId"
                                                        value={selectedLo}
                                                        label="Loan Officer (Required)"
                                                        options={userList}
                                                        onChange={(field, value) => handleLoIdChange(field, value)}
                                                        onBlur={setFieldTouched}
                                                        placeholder="Select Group"
                                                        errors={touched.loId && errors.loId ? errors.loId : undefined}
                                                    />
                                                </div>
                                            ) }
                                            <div className="mt-4">
                                                <SelectDropdown
                                                    name="groupId"
                                                    field="groupId"
                                                    value={selectedGroup}
                                                    label="Group (Required)"
                                                    options={groupList}
                                                    onChange={(field, value) => handleGroupIdChange(field, value)}
                                                    onBlur={setFieldTouched}
                                                    placeholder="Select Group"
                                                    errors={touched.groupId && errors.groupId ? errors.groupId : undefined}
                                                />
                                            </div>
                                            {clientType != 'offset' && (
                                                <div className="mt-4">
                                                    <SelectDropdown
                                                        name="clientId"
                                                        field="clientId"
                                                        value={clientId}
                                                        label="Client (Required)"
                                                        options={clientList}
                                                        onChange={(field, value) => handleClientIdChange(field, value)}
                                                        onBlur={setFieldTouched}
                                                        placeholder="Select Client"
                                                        errors={touched.clientId && errors.clientId ? errors.clientId : undefined}
                                                    />
                                                </div>
                                            )}
                                            {(clientType === 'active' || clientType === 'advance') ? (
                                                <React.Fragment>
                                                    <div className="mt-4">
                                                        <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                                            <div className="flex justify-between">
                                                                <label htmlFor={'slotNo'} className={`font-proxima-bold text-xs font-bold text-main`}>
                                                                    Slot Number
                                                                </label>
                                                            </div>
                                                            <span className="text-gray-400">{ slotNo ? slotNo : '-' }</span>
                                                        </div>
                                                    </div>
                                                    <div className="mt-4">
                                                        <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                                            <div className="flex justify-between">
                                                                <label htmlFor={'slotNo'} className={`font-proxima-bold text-xs font-bold text-main`}>
                                                                    Loan Balance
                                                                </label>
                                                            </div>
                                                            <span className="text-gray-400">{ formatPricePhp(loanBalance) }</span>
                                                        </div>
                                                    </div>
                                                </React.Fragment>
                                            ) : (
                                                <div className="mt-4">
                                                    <SelectDropdown
                                                        name="slotNo"
                                                        field="slotNo"
                                                        value={slotNo}
                                                        label="Slot Number (Required)"
                                                        options={slotNumber}
                                                        onChange={(field, value) => handleSlotNoChange(field, value)}
                                                        onBlur={setFieldTouched}
                                                        placeholder="Select Slot No"
                                                        errors={touched.slotNo && errors.slotNo ? errors.slotNo : undefined}
                                                    />
                                                </div>
                                            )}
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
                                            value={((clientType === 'pending' || clientType === 'offset') && mode !== 'reloan') ? 1 : values.loanCycle}
                                            onChange={handleChange}
                                            label="Loan Cycle (Required)"
                                            placeholder="Enter Loan Cycle"
                                            setFieldValue={setFieldValue}
                                            disabled={(clientType === 'pending' || clientType === 'offset') && mode !== 'reloan'}
                                            errors={touched.loanCycle && errors.loanCycle ? errors.loanCycle : undefined} />
                                    </div>
                                    {(mode === 'reloan' || groupOccurence === 'weekly' || (groupOccurence === 'daily' && (mode !== 'add' && mode !== 'edit'))) && (
                                        <div className="mt-4">
                                            <InputNumber
                                                name="mcbu"
                                                value={values.mcbu}
                                                onChange={handleChange}
                                                label="MCBU"
                                                placeholder="Enter MCBU"
                                                setFieldValue={setFieldValue}
                                                errors={touched.mcbu && errors.mcbu ? errors.mcbu : undefined} />
                                        </div>
                                    )}
                                    {(mode === 'reloan' && loan.occurence === 'daily') && (
                                        <div className="mt-4 flex flex-col">
                                            <span className="text-base text-zinc-600">Loan Terms</span>
                                            <div className="flex flex-row">
                                                <RadioButton id={"radio_60"} name="radio-group-occurence" label={"60 Days"} checked={loanTerms === 60} value={60} onChange={handleLoanTermsChange} />
                                                <RadioButton id={"radio_100"} name="radio-group-occurence" label={"100 Days"} checked={loanTerms === 100} value={100} onChange={handleLoanTermsChange} />
                                            </div>
                                        </div>
                                    )}
                                    <div className="mt-4">
                                        <InputNumber
                                            name="principalLoan"
                                            value={values.principalLoan}
                                            onChange={handleChange}
                                            label="Principal Loan (Required)"
                                            disabled={values.status === 'active'}
                                            placeholder="Enter Principal Loan"
                                            setFieldValue={setFieldValue}
                                            errors={touched.principalLoan && errors.principalLoan ? errors.principalLoan : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="coMaker"
                                            field="coMaker"
                                            value={selectedCoMaker}
                                            label="Co Maker"
                                            options={tempSlotNo}
                                            onChange={(field, value) => handleCoMakerChange(field, value)}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Co Maker"
                                            errors={touched.coMaker && errors.coMaker ? errors.coMaker : undefined}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="guarantorFirstName"
                                            value={values.guarantorFirstName}
                                            onChange={handleChange}
                                            label="Guarantor First Name (Required)"
                                            placeholder="Enter Guarantor First Name"
                                            setFieldValue={setFieldValue}
                                            errors={touched.guarantorFirstName && errors.guarantorFirstName ? errors.guarantorFirstName : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="guarantorMiddleName"
                                            value={values.guarantorMiddleName}
                                            onChange={handleChange}
                                            label="Guarantor Middle Name"
                                            placeholder="Enter Guarantor Middle Name"
                                            setFieldValue={setFieldValue}
                                            errors={touched.guarantorMiddleName && errors.guarantorMiddleName ? errors.guarantorMiddleName : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="guarantorLastName"
                                            value={values.guarantorLastName}
                                            onChange={handleChange}
                                            label="Guarantor Last Name (Required)"
                                            placeholder="Enter Guarantor Last Name"
                                            setFieldValue={setFieldValue}
                                            errors={touched.guarantorLastName && errors.guarantorLastName ? errors.guarantorLastName : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="ciName"
                                            value={values.ciName}
                                            onChange={handleChange}
                                            label="CI Name (Required)"
                                            placeholder="Enter CI Name"
                                            setFieldValue={setFieldValue}
                                            errors={touched.ciName && errors.ciName ? errors.ciName : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="pnNumber"
                                            value={values.pnNumber}
                                            onChange={handleChange}
                                            onBlur={handlePNNumber}
                                            onFocus={getLastPNNumber}
                                            label="Promisory Note Number"
                                            placeholder="Enter PN Number"
                                            setFieldValue={setFieldValue}
                                            errors={touched.pnNumber && errors.pnNumber ? errors.pnNumber : undefined} />
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