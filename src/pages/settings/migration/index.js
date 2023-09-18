import React, { useEffect, useRef, useState } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { useSelector, useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { useRouter } from 'node_modules/next/router';
import { setBranchList } from '@/redux/actions/branchActions';
import Select from 'react-select';
import { DropdownIndicator, borderStyles } from "@/styles/select";
import { setUserList } from '@/redux/actions/userActions';
import { UppercaseFirstLetter } from '@/lib/utils';
import ButtonSolid from '@/lib/ui/ButtonSolid';

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
    const [firstCollectionIdx, setFirstCollectionIdx] = useState();

    const handleBranchChange = (selected) => {
        setSelectedBranch(selected);
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
        setLoading(true);
        const params = {
            file: file,
            branchId: selectedBranch._id,
            loId: selectedUser._id
        }

        const response = await fetchWrapper.sendData(process.env.NEXT_PUBLIC_API_URL + 'migration/', params);
        if (response.success) {
            setLoading(false);
            toast.success('File is currently processing...please wait.');
        }
    }

    useEffect(() => {
        if ((currentUser.role && currentUser.role.rep > 2)) {
            router.push('/');
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        const getListBranch = async () => {
            let url = process.env.NEXT_PUBLIC_API_URL + 'branches/list';
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
        if (selectedBranch) {
            console.log(selectedBranch)
            const getListUser = async () => {
                let url = process.env.NEXT_PUBLIC_API_URL + 'users/list';
    
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
                                    <input ref={fileInput} onChange={(e) => handleFileChange(e)} className="block w-full text-sm text-gray-900 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400" id="file_input" type="file" />
                                </div>
                                <div className="flex flex-row mt-5 w-32">
                                    <ButtonSolid label="Process" onClick={handleMigration} />
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