import { useEffect, useRef, useState } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { toast } from "react-toastify";
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import Dialog from '@/lib/ui/Dialog';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import { useRouter } from 'node_modules/next/router';
import Select from 'react-select';
import { styles, DropdownIndicator, borderStyles } from "@/styles/select";
import { useSelector } from 'react-redux';
import { UppercaseFirstLetter } from '@/lib/utils';
import InputPassword from '@/lib/ui/InputPassword';
import { getApiBaseUrl } from '@/lib/constants';

const AutomationPage = () => {
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const [loading, setLoading] = useState(false);
    const [transType, setTransType] = useState();
    const [showWarningDialog, setShowWarningDialog] = useState(false);
    const [branchList, setBranchList] = useState();
    const [groupList, setGroupList] = useState();
    const [userList, setUserList] = useState();

    const [selectedBranch, setSelectedBranch] = useState();
    const [selectedUser, setSelectedUser] = useState();
    const [selectedGroup, setSelectedGroup] = useState();

    const [closeTime, setCloseTime] = useState(10);
    const [showCloseDialog, setShowCloseDialog] = useState(false);

    const [password, setPassword] = useState();
    const [passwordError, setPasswordError] = useState();
    const [passwordVerified, setPasswordVerified] = useState(false);

    const handleSelectBranch = async (selected) => {
        setSelectedBranch(selected);
        setSelectedUser();
        setSelectedGroup();
        getListUser(selected);
    }

    const handleSelectUser = async (selected) => {
        setSelectedUser(selected);
        getListGroup(selectedBranch, selected);
        setSelectedGroup();
    }

    const handleSelectGroup = (selected) => {
        setSelectedGroup(selected);
    }

    const handleResetClick = (type) => {
        setTransType(type);
        setShowWarningDialog(true);
    }

    const handleResetData = async () => {
        setLoading(true);

        if (password) {
            const valid = await verifyPassword();
            if (valid) {
                setPasswordError('');
                setPasswordVerified(true);
                switch (transType) {
                    case 'system':
                        processResetSystem();
                        break;
                    case 'branch':
                        processResetBranch();
                        break;
                    case 'lo':
                        processResetLO();
                        break;
                    case 'group':
                        processResetGroup();
                        break;
                    default: break;
                }
            } else {
                toast.error('Error occcured. Entered password is incorrect');
                setPasswordError('Incorrect password.');
                setPasswordVerified(false);
            }
        } else {
            toast.error('Error occured. Please input super admin password.');
            setPasswordVerified(false);
        }
    }

    const verifyPassword = async () => {
        const data = {
            username: currentUser.email,
            password: password
        }

        const apiURL = process.env.NEXT_PUBLIC_API_URL + 'authenticate';
        return fetchWrapper.post(apiURL, data)
            .then(data => {
                setLoading(false);
                if (!data.success && data.error == 'NO_PASS') {
                    return false;
                } else if (data.success) {
                    return true;
                }
            });
    }

    const processResetSystem = async () => {
        const apiURL = `${process.env.NEXT_PUBLIC_API_URL}secure/reset-system`;
        const response = await fetchWrapper.post(apiURL);

        if (response.success) {
            setLoading(false);
            setShowWarningDialog(false);
            beginTimer();
        }
    }

    const processResetBranch = async () => {
        const apiURL = `${getApiBaseUrl()}secure/reset-branch`;
        const response = await fetchWrapper.post(apiURL, {branchId: selectedBranch._id});

        if (response.success) {
            setLoading(false);
            setShowWarningDialog(false);
            beginTimer();
        }
    }

    const processResetLO = async () => {
        const apiURL = `${process.env.NEXT_PUBLIC_API_URL}secure/reset-lo`;
        const response = await fetchWrapper.post(apiURL, {loId: selectedUser._id});

        if (response.success) {
            setLoading(false);
            setShowWarningDialog(false);
            beginTimer();
        }
    }

    const processResetGroup = async () => {
        const apiURL = `${getApiBaseUrl()}secure/reset-group`;
        const response = await fetchWrapper.post(apiURL, {groupId: selectedGroup._id});

        if (response.success) {
            setLoading(false);
            setShowWarningDialog(false);
            beginTimer();
        }
    }

    const beginTimer = () => {
        setShowCloseDialog(true)
        let sec = closeTime;
        setInterval(() => {
            sec--;
            setCloseTime(sec)
            if (sec === 0) {
                window.location.reload();
            }
        }, 1000);
    }

    useEffect(() => {
        if ((currentUser.role && currentUser.role.rep > 1)) {
            router.push('/');
        }
    }, []);


    const getListBranch = async () => {
        const response = await fetchWrapper.get(getApiBaseUrl() + 'branches/list');
        if (response.success) {
            let branches = [];
            response.branches && response.branches.map(branch => {
                branches.push(
                    {
                        ...branch,
                        value: branch._id,
                        label: UppercaseFirstLetter(branch.name)
                    }
                );
            });

            setBranchList(branches);
            setLoading(false);
        } else {
            setLoading(false);
            toast.error('Error retrieving branch list.');
        }
    }

    const getListUser = async (branch) => {
        setLoading(true);
        if (branchList.length > 0 && branch) {
            let url = getApiBaseUrl() + 'users/list';
            url = url + '?' + new URLSearchParams({ branchCode: branch.code });
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
                setUserList(userList);
            } else {
                toast.error('Error retrieving user list.');
            }

            setLoading(false);
        }
    }

    const getListGroup = async (branch, user) => {
        setLoading(true);
        if (branch && user) {
            let url = getApiBaseUrl() + 'groups/list'
            url = url + '?' + new URLSearchParams({ branchId: branch._id, loId: user._id });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let groupList = [];
                await response.groups && response.groups.map(group => {
                    groupList.push({
                        ...group,
                        value: group._id,
                        label: UppercaseFirstLetter(group.name)
                    });
                });

                setGroupList(groupList);
                setLoading(false);
            } else if (response.error) {
                toast.error(response.message);
                setLoading(false);
            }
        }
    }

    useEffect(() => {
        let mounted = true;

        mounted && getListBranch();
        mounted && setLoading(false);

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <Layout>
            <div className="mt-5">
                {loading ? (
                        <div className="absolute top-1/2 left-1/2">
                            <Spinner />
                        </div>
                    ) : (
                        <div className="flex flex-1 lg:mt-0 mt-5">
                            <div className="profile-photo bg-white rounded-lg p-3 proxima-regular mt-10 lg:w-5/6 w-80 lg:mt-0 m-4">
                                <div className="proxima-bold mt-2">Reset Data</div>
                                <div className='flex flex-col'>
                                    <div className='flex flex-row p-4'>
                                        <div className='border border-zinc-200 flex flex-col p-6 w-full'>
                                            <h6>Reset Group Data</h6>
                                            <div className="mt-4">
                                                <Select 
                                                    options={branchList}
                                                    value={selectedBranch && branchList.find(b => {
                                                        return b._id === selectedBranch._id
                                                    })}
                                                    styles={borderStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleSelectBranch}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    placeholder={'Branch Filter'} 
                                                />
                                            </div>
                                            <div className="mt-4">
                                                <Select 
                                                    options={userList}
                                                    value={selectedUser && userList.find(b => {
                                                        return b._id === selectedUser._id
                                                    })}
                                                    styles={borderStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleSelectUser}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    isDisabled={selectedBranch ? false : true}
                                                    placeholder={'User Filter'} 
                                                />
                                            </div>
                                            <div className="mt-4 mb-4">
                                                <Select 
                                                    options={groupList}
                                                    value={selectedGroup && groupList.find(b => {
                                                        return b._id === selectedGroup._id
                                                    })}
                                                    styles={borderStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleSelectGroup}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    isDisabled={selectedUser ? false : true}
                                                    placeholder={'Group Filter'} 
                                                />
                                            </div>
                                            <ButtonSolid label="Reset" onClick={() => handleResetClick('group')} />
                                        </div>
                                        <div className='border border-zinc-200 flex flex-col p-6 w-full'>
                                            <h6>Reset Loan Officer Data</h6>
                                            <div className="mt-4">
                                                <Select 
                                                    options={branchList}
                                                    value={selectedBranch && branchList.find(b => {
                                                        return b._id === selectedBranch._id
                                                    })}
                                                    styles={borderStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleSelectBranch}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    placeholder={'Branch Filter'} 
                                                />
                                            </div>
                                            <div className="mt-4 mb-4">
                                                <Select 
                                                    options={userList}
                                                    value={selectedUser && userList.find(b => {
                                                        return b._id === selectedUser._id
                                                    })}
                                                    styles={borderStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleSelectUser}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    isDisabled={selectedBranch ? false : true}
                                                    placeholder={'User Filter'} 
                                                />
                                            </div>
                                            <ButtonSolid label="Reset" onClick={() => handleResetClick('lo')} />
                                        </div>
                                        <div className='border border-zinc-200 flex flex-col p-6 w-full'>
                                            <h6>Reset Branch Data</h6>
                                            <div className="mt-4 mb-4">
                                                <Select 
                                                    options={branchList}
                                                    value={selectedBranch && branchList.find(b => {
                                                        return b._id === selectedBranch._id
                                                    })}
                                                    styles={borderStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleSelectBranch}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    placeholder={'Branch Filter'} 
                                                />
                                            </div>
                                            <ButtonSolid label="Reset" onClick={() => handleResetClick('branch')} />
                                        </div>
                                        <div className='border border-zinc-200 flex flex-col p-6 w-full'>
                                            <h6 className='mb-4'>Reset Whole System Data</h6>
                                            <ButtonSolid label="Reset" onClick={() => handleResetClick('system')} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Dialog show={showWarningDialog}>
                                <h2>Reset Data</h2>
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start justify-center">
                                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                                            <div className="mt-2 flex flex-col">
                                                {transType === 'system' && 'Are you sure you want to reset the whole system?'}
                                                {transType === 'branch' && 'Are you sure you want to reset the selected branch?'}
                                                {transType === 'lo' && 'Are you sure you want to reset the selected loan officer?'}
                                                {transType === 'group' && 'Are you sure you want to reset the selected group?'}
                                                <InputPassword
                                                    name="verify-password" 
                                                    value={password}
                                                    label="Password"
                                                    placeholder="Enter your password to proceed"
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    errors={passwordError ? passwordError : undefined} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-row justify-end text-center px-4 py-3 sm:px-6 sm:flex">
                                    <div className='flex flex-row'>
                                        <ButtonOutline label="Cancel" type="button" className="p-2 mr-3" onClick={() => setShowWarningDialog(false)} />
                                        <ButtonSolid label="Proceed" type="button" className="p-2 mr-3" onClick={handleResetData} />
                                    </div>
                                </div>
                            </Dialog>

                            <Dialog show={showCloseDialog}>
                                <h2>System</h2>
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start justify-center">
                                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                                            <div className="mt-2 flex flex-col">
                                                <span>Data reset completes in: </span>
                                                <span className='text-lg'>{closeTime}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Dialog>
                        </div>
                    )
                }
            </div>
        </Layout>
    );
}

export default AutomationPage;