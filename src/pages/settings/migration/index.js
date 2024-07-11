import React, { useEffect, useRef, useState } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from "react-toastify";
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { useRouter } from 'node_modules/next/router';
import { setBranchList } from '@/redux/actions/branchActions';
import Select from 'react-select';
import { DropdownIndicator, borderStyles } from "@/styles/select";
import { setUserList } from '@/redux/actions/userActions';
import { UppercaseFirstLetter, getLastWeekdayOfTheMonth, getMonths, getYears } from '@/lib/utils';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import InputNumber from '@/lib/ui/InputNumber';
import moment from 'moment';
import { getApiBaseUrl } from '@/lib/constants';

const MigrationPage = () => {
    const dispatch = useDispatch();
    const router = useRouter();
    const fileInput = useRef();
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const [loading, setLoading] = useState(true);
    const branchList = useSelector(state => state.branch.list);
    const userList = useSelector(state => state.user.list);
    const [selectedBranch, setSelectedBranch] = useState();
    const [selectedUser, setSelectedUser] = useState();
    const [file, setFile] = useState();
    const [selectedMonth, setSelectedMonth] = useState();
    const [selectedYear, setSelectedYear] = useState();
    const [date, setDate] = useState();
    const holidayList = useSelector(state => state.holidays.list);
    const months = getMonths();
    const years = getYears();
    const [data, setData] = useState({
        day: "Commulative",
        transfer: 0,
        newMember: 0,
        mcbuTarget: 0,
        mcbuActual: 0,
        mcbuWithdrawal: 0,
        mcbuInterest: 0,
        noMcbuReturn: 0,
        mcbuReturnAmt: 0,
        mcbuBalance: 0,
        offsetPerson: 0,
        activeClients: 0,
        loanReleasePerson: "-",
        loanReleaseAmount: 0,
        activeLoanReleasePerson: 0,
        activeLoanReleaseAmount: 0,
        collectionAdvancePayment: 0,
        collectionActual: 0,
        pastDuePerson: 0,
        pastDueAmount: 0,
        mispaymentPerson: 0,
        fullPaymentPerson: 0,
        fullPaymentAmount: 0,
        activeBorrowers: 0,
        loanBalance: 0,
        grandTotal: true
    });
    

    const handleBranchChange = (selected) => {
        setSelectedBranch(selected);
        dispatch(setUserList([]));
    }

    const handleUserChange = (selected) => {
        setSelectedUser(selected);
    }

    const handleFileChange = async e => {
        if (e.target.value) {
            setFile(e.target.files[0]);
            
        }
    }

    const handleMigration = async () => {
        if (selectedBranch && selectedUser) {
            setLoading(true);
            if (file) {
                const params = {
                    file: file,
                    branchId: selectedBranch._id,
                    loId: selectedUser._id,
                    occurence: selectedUser.transactionType
                }
        
                const response = await fetchWrapper.sendData(getApiBaseUrl() + 'migration/', params);
                if (response.success) {
                    const resp = await addForwardBalance();
                    if (resp.success) {
                        setLoading(false);
                        toast.success('File is currently processing...please wait.');
                    }
                }
            } else {
                const resp = await addForwardBalance();
                if (resp.success) {
                    setLoading(false);
                    toast.success(`Added forward balance for ${selectedUser.firstName} ${selectedUser.lastName}`);
                }
            }
        } else {
            toast.error('Please select Branch and/or Loan Officer');
        }
    }

    const addForwardBalance = async () => {
        const fBal = {
            userId: selectedUser._id,
            branchId: selectedBranch._id,
            month: selectedMonth,
            year: selectedYear,
            dateAdded: date,
            insertedBy: 'migration',
            insertedDate: currentDate,
            data: data,
            losType: "commulative",
            occurence: selectedUser.transactionType
        }
        return await fetchWrapper.post(getApiBaseUrl() + 'migration/add-los-commulative-data', fBal);
    }

    const handleResetMigration = async () => {
        if (selectedUser) {
            setLoading(true);

            const response = await fetchWrapper.get(getApiBaseUrl() + 'migration/reset-migration?' + new URLSearchParams({ loId: selectedUser._id }));
            if (response.success) {
                setLoading(false);
                toast.success('Selected LO Migration Data resetted!');
            }
        } else {
            toast.error('No LO selected.');
        }
    }

    const handleChange = (value, field) => {
        let temp = {...data};
        if (value && value.trim()) {
            const input = parseFloat(value);
            temp[field] = input;
        } else {
            temp[field] = value;
        }

        setData(temp);
    }

    useEffect(() => {
        if ((currentUser.role && currentUser.role.rep > 2)) {
            router.push('/');
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        const getListBranch = async () => {
            let url = getApiBaseUrl() + 'branches/list';
            if (currentUser.role.rep === 1) {
                const response = await fetchWrapper.get(url);
                if (response.success) {
                    let branches = [];
                    response.branches.map(branch => {
                        branches.push({
                            ...branch,
                            value: branch._id,
                            label: branch.name
                        });
                    });
                    dispatch(setBranchList(branches));
                    setLoading(false);
                } else if (response.error) {
                    setLoading(false);
                    toast.error(response.message);
                }
            }
        }

        mounted && getListBranch();

        return (() => {
            mounted = false;
        })
    }, [currentUser]);

    useEffect(() => {
        if (currentDate) {
            const month = moment(currentDate).month();
            setSelectedMonth(month == 0 ? 1 : month);
            setSelectedYear(moment(currentDate).year());
        }
    }, [currentDate]);

    useEffect(() => {
        if (selectedMonth && selectedYear) {
            setDate(getLastWeekdayOfTheMonth(selectedYear, selectedMonth, holidayList));
        }
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        if (selectedBranch) {
            const getListUser = async () => {
                let url = getApiBaseUrl() + 'users/list';
    
                url = url + '?' + new URLSearchParams({ branchCode: selectedBranch.code });
                const response = await fetchWrapper.get(url);
                if (response.success) {
                    let listUser = [];
                    response.users && response.users.filter(u => u.role.rep === 4).map(u => {
                        const name = `${u.firstName} ${u.lastName}`;
                        listUser.push(
                            {
                                ...u,
                                value: u._id,
                                label: UppercaseFirstLetter(name)
                            }
                        );
                    });
                    listUser.sort((a, b) => { return a.loNo - b.loNo; });
                    dispatch(setUserList(listUser));
                } else {
                    toast.error('Error retrieving user list.');
                }
    
                setLoading(false);
            }

            getListUser();
        }
    }, [selectedBranch]);

    return (
        <Layout>
            <div className="mt-5 p-6 h-screen">
                {loading ? (
                        <div className="absolute top-1/2 left-1/2">
                            <Spinner />
                        </div>
                    ) : (
                        <div className='bg-white rounded-lg p-6' style={{ minHeight: '30rem' }}>
                            <div className='flex flex-col'>
                                <div className='flex flex-row mb-4'>
                                    <div className='ml-4 flex flex-row'>
                                        <span className='mr-4 mt-1'>Branch: </span>
                                        <Select 
                                                options={branchList}
                                                value={branchList && branchList.find(branch => { return branch.value === selectedBranch?.value } )}
                                                styles={borderStyles}
                                                components={{ DropdownIndicator }}
                                                onChange={handleBranchChange}
                                                isSearchable={true}
                                                closeMenuOnSelect={true}
                                                placeholder={'Select Branch'}/>
                                    </div>
                                    <div className='flex flex-row ml-4'>
                                        <span className='mr-4 mt-1'>Loan Officer: </span>
                                        <Select 
                                                options={userList}
                                                value={userList && userList.find(user => { return user.value === selectedUser?.value } )}
                                                styles={borderStyles}
                                                components={{ DropdownIndicator }}
                                                onChange={handleUserChange}
                                                isSearchable={true}
                                                closeMenuOnSelect={true}
                                                placeholder={'Select Loan Officer'}/>
                                    </div>
                                </div>
                                <div style={{ width: '50%' }}>
                                    <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white" htmlFor="file_input">Upload file: </label>
                                    <input ref={fileInput} onChange={(e) => handleFileChange(e)} className="block w-full text-sm text-gray-900 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none" id="file_input" type="file" />
                                </div>
                                <div className='flex flex-col justify-center mt-4 py-4'>
                                    <span className='font-bold text-md'>Forward Balance Info:</span>
                                    <div className='flex flex-row mb-4'>
                                        <span>Month</span>
                                        <div className="ml-4 flex">
                                            <Select 
                                                options={months}
                                                value={selectedMonth && months.find(m => {
                                                    return parseInt(m.value) === selectedMonth
                                                })}
                                                styles={borderStyles}
                                                components={{ DropdownIndicator }}
                                                onChange={(selected) => { setSelectedMonth(selected.value) }}
                                                isSearchable={true}
                                                closeMenuOnSelect={true}
                                                placeholder={'Month'}/>
                                        </div>
                                    </div>
                                    <div className='flex flex-row mb-4'>
                                        <span>Year</span>
                                        <div className="ml-4 flex">
                                            <Select 
                                                options={years}
                                                value={selectedYear && years.find(y => {
                                                    return y.value === selectedYear
                                                })}
                                                styles={borderStyles}
                                                components={{ DropdownIndicator }}
                                                onChange={(selected) => { setSelectedYear(selected.value) }}
                                                isSearchable={true}
                                                closeMenuOnSelect={true}
                                                placeholder={'Year'}/>
                                        </div>
                                    </div>
                                    <div className='flex flex-row mb-4'>
                                        <span className='mr-4 mt-1'>Active Client</span>
                                        <InputNumber className='w-12' value={data.activeClients} onChange={(e) => { handleChange(e.target.value, "activeClients") }} />
                                    </div>
                                    <div className='flex flex-row mb-4'>
                                        <span className='mr-4 mt-1'>MCBU Balance</span>
                                        <InputNumber value={data.mcbuBalance} onChange={(e) => { handleChange(e.target.value, "mcbuBalance") }} />
                                    </div>
                                    <div className='flex flex-row mb-4'>
                                        <span className='mr-4 mt-1'>Active Borrowers</span>
                                        <InputNumber className='w-12' value={data.activeBorrowers} onChange={(e) => { handleChange(e.target.value, "activeBorrowers") }} />
                                    </div>
                                    <div className='flex flex-row mb-4'>
                                        <span className='mr-4 mt-1'>Active Loan</span>
                                        <InputNumber value={data.activeLoanReleaseAmount} onChange={(e) => { handleChange(e.target.value, "activeLoanReleaseAmount") }} />
                                    </div>
                                    <div className='flex flex-row mb-4'>
                                        <span className='mr-4 mt-1'>Loan Target</span>
                                        <InputNumber value={data.collectionAdvancePayment} onChange={(e) => { handleChange(e.target.value, "collectionAdvancePayment") }} />
                                    </div>
                                    <div className='flex flex-row mb-4'>
                                        <span className='mr-4 mt-1'>Loan Actual</span>
                                        <InputNumber value={data.collectionActual} onChange={(e) => { handleChange(e.target.value, "collectionActual") }} />
                                    </div>
                                    <div className='flex flex-row mb-4'>
                                        <span className='mr-4 mt-1'>Person</span>
                                        <InputNumber className='w-12' value={data.activeLoanReleasePerson} onChange={(e) => { handleChange(e.target.value, "activeLoanReleasePerson") }} />
                                    </div>
                                    <div className='flex flex-row mb-4'>
                                        <span className='mr-4 mt-1'>Loan Balance</span>
                                        <InputNumber value={data.loanBalance} onChange={(e) => { handleChange(e.target.value, "loanBalance") }} />
                                    </div>
                                </div>
                                <div className="flex flex-row mt-5 w-64">
                                    <ButtonSolid label="Process" onClick={handleMigration} />
                                    <ButtonSolid className='ml-6' label="Reset LO" onClick={handleResetMigration} />
                                </div>
                            </div>
                        </div>
                    )
                }
            </div>
        </Layout>
    );
}

export default MigrationPage;