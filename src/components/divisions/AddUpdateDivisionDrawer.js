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

const AddUpdateDivision = ({ mode = 'add', division = {}, managerList=[], showSidebar, setShowSidebar, onClose }) => {
    const formikRef = useRef();
    const regionList = useSelector(state => state.region.list);
    const [loading, setLoading] = useState(false);
    const [selectedRegions, setSelectedRegions] = useState([]);
    const [selectedManagers, setSelectedManagers] = useState([]);

    const initialValues = {
        name: division.name,
        managerIds: division.managerIds,
        regionIds: division.areaIds
    }

    const validationSchema = yup.object().shape({
        name: yup
            .string()
            .required('Please enter name')
    });

    const handleSelectManager = (selected) => {
        setSelectedManagers(selected);
    }

    const handleSelectRegion = (selected) => {
        setSelectedRegions(selected);
    }

    const handleSaveUpdate = (values, action) => {
        setLoading(true);
        values.regionIds = selectedRegions.map(region => region._id);
        values.managerIds = selectedManagers.map(manager => manager._id);
        console.log(values.managerIds)
        if (mode === 'add') {
            const apiUrl = getApiBaseUrl() + 'divisions/save/';

            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    if (response.error) {
                        toast.error(response.message);
                    } else if (response.success) {
                        setLoading(false);
                        setShowSidebar(false);
                        toast.success('Division successfully added.');
                        action.setSubmitting = false;
                        action.resetForm({values: ''});
                        setSelectedManagers([]);
                        setSelectedRegions([]);
                        onClose();
                    }
                }).catch(error => {
                    console.log(error)
                });
        } else if (mode === 'edit') {
            const apiUrl = getApiBaseUrl() + 'divisions';
            values._id = division._id;
            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    setLoading(false);
                    setShowSidebar(false);
                    toast.success('Division successfully updated.');
                    action.setSubmitting = false;
                    action.resetForm({values: ''});
                    setSelectedManagers([]);
                    setSelectedRegions([]);
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

        if (division && mode == 'edit') {
            const regions = regionList.filter(region => division?.regionIds.includes(region._id));
            setSelectedRegions(regions);
            const managers = managerList.filter(manager => division?.managerIds.includes(manager._id));
            setSelectedManagers(managers);
        }

        mounted && setLoading(false);

        return () => {
            mounted = false;
        };
    }, [division, regionList]);

    return (
        <React.Fragment>
            <SideBar title={mode === 'add' ? 'Add Division' : 'Edit Division'} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
                {loading ? (
                    // <div className="flex items-center justify-center h-screen">
                        <Spinner />
                    // </div>
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
                                        <div className={`flex flex-col border rounded-md px-4 py-2 bg-white ${selectedRegions?.length > 0 ? 'border-main' : 'border-slate-400'}`}>
                                            <div className="flex justify-between">
                                                <label htmlFor="designatedBranch" className={`font-proxima-bold text-xs font-bold  ${selectedRegions?.length > 0 ? 'text-main' : 'text-gray-500'}`}>
                                                    Regions
                                                </label>
                                            </div>
                                            <div className="block h-fit">
                                                <Select 
                                                    options={regionList}
                                                    value={selectedRegions}
                                                    isMulti
                                                    styles={multiStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleSelectRegion}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    placeholder={'Select regions'}/>
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

export default AddUpdateDivision;