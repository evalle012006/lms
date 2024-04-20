import React, { useState, useEffect, useRef } from "react";
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import SelectDropdown from "@/lib/ui/select";
import { multiStyles, DropdownIndicator } from "@/styles/select";
import Select from 'react-select';
import InputText from "@/lib/ui/InputText";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import SideBar from "@/lib/ui/SideBar";
import Spinner from "../Spinner";
import { getApiBaseUrl } from "@/lib/constants";

const AddUpdateArea = ({ mode = 'add', area = {}, managerList=[], showSidebar, setShowSidebar, onClose }) => {
    const formikRef = useRef();
    const branchList = useSelector(state => state.branch.list);
    const [loading, setLoading] = useState(false);
    const [selectedBranches, setSelectedBranches] = useState([]);
    const [selectedManagers, setSelectedManagers] = useState([]);

    const initialValues = {
        name: area.name,
        managerIds: area.managerIds,
        branchIds: area.branchIds
    }

    const validationSchema = yup.object().shape({
        name: yup
            .string()
            .required('Please enter name')
    });

    const handleSelectManager = (selected) => {
        setSelectedManagers(selected);
    }

    const handleSelectBranch = (selectedBranch) => {
        setSelectedBranches(selectedBranch);
    }

    const handleSaveUpdate = (values, action) => {
        setLoading(true);
        values.branchIds = selectedBranches.map(branch => branch._id);
        values.managerIds = selectedManagers.map(manager => manager._id);
        if (mode === 'add') {
            const apiUrl = getApiBaseUrl() + 'areas/save/';

            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    if (response.error) {
                        toast.error(response.message);
                    } else if (response.success) {
                        setLoading(false);
                        setShowSidebar(false);
                        toast.success('Area successfully added.');
                        action.setSubmitting = false;
                        action.resetForm({values: ''});
                        setSelectedBranches([]);
                        setSelectedManagers([]);
                        onClose();
                    }
                }).catch(error => {
                    console.log(error)
                });
        } else if (mode === 'edit') {
            const apiUrl = getApiBaseUrl() + 'areas';
            values._id = area._id;
            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    setLoading(false);
                    setShowSidebar(false);
                    toast.success('Area successfully updated.');
                    action.setSubmitting = false;
                    action.resetForm({values: ''});
                    setSelectedBranches([]);
                    setSelectedManagers([]);
                    onClose();
                }).catch(error => {
                    console.log(error);
                });
        }
    }

    const handleCancel = () => {
        setShowSidebar(false);
        formikRef.current.resetForm();
        onClose();
    }

    useEffect(() => {
        let mounted = true;
        console.log(area, mode, branchList.length)
        if (area && mode == 'edit' && branchList.length > 0) {
            const branches = branchList.filter(branch => area?.branchIds.includes(branch._id));
            console.log(branches)
            setSelectedBranches(branches);
            const managers = managerList.filter(manager => area?.managerIds.includes(manager._id));
            console.log(managers)
            setSelectedManagers(managers);
        }

        mounted && setLoading(false);

        return () => {
            mounted = false;
        };
    }, [area, mode, branchList]);

    return (
        <React.Fragment>
            <SideBar title={mode === 'add' ? 'Add Area' : 'Edit Area'} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
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
                                    <div className="mt-4">
                                        <div className={`flex flex-col border rounded-md px-4 py-2 bg-white ${selectedManagers?.length > 0 ? 'border-main' : 'border-slate-400'}`}>
                                            <div className="flex justify-between">
                                                <label htmlFor="designatedBranch" className={`font-proxima-bold text-xs font-bold  ${selectedManagers?.length > 0 ? 'text-main' : 'text-gray-500'}`}>
                                                    Manager
                                                </label>
                                            </div>
                                            <div className="block h-fit">
                                                <Select 
                                                    options={managerList}
                                                    value={selectedManagers}
                                                    isMulti
                                                    styles={multiStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleSelectManager}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    placeholder={'Select manager'}/>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <div className={`flex flex-col border rounded-md px-4 py-2 bg-white ${selectedBranches?.length > 0 ? 'border-main' : 'border-slate-400'}`}>
                                            <div className="flex justify-between">
                                                <label htmlFor="designatedBranch" className={`font-proxima-bold text-xs font-bold  ${selectedBranches?.length > 0 ? 'text-main' : 'text-gray-500'}`}>
                                                    Branches
                                                </label>
                                            </div>
                                            <div className="block h-fit">
                                                <Select 
                                                    options={branchList}
                                                    value={selectedBranches}
                                                    isMulti
                                                    styles={multiStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleSelectBranch}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    placeholder={'Select branches'}/>
                                            </div>
                                        </div>
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

export default AddUpdateArea;