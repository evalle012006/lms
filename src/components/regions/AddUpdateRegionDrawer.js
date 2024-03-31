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

const AddUpdateRegion = ({ mode = 'add', region = {}, managerList=[], showSidebar, setShowSidebar, onClose }) => {
    const formikRef = useRef();
    const areaList = useSelector(state => state.area.list);
    const [loading, setLoading] = useState(false);
    const [selectedAreas, setSelectedAreas] = useState([]);
    const [selectedManagers, setSelectedManagers] = useState([]);

    const initialValues = {
        name: region.name,
        managerIds: region.managerIds,
        areaIds: region.areaIds
    }

    const validationSchema = yup.object().shape({
        name: yup
            .string()
            .required('Please enter name')
    });

    const handleSelectManager = (selected) => {
        setSelectedManagers(selected);
    }

    const handleSelectArea = (selected) => {
        setSelectedAreas(selected);
    }

    const handleSaveUpdate = (values, action) => {
        setLoading(true);
        values.areaIds = selectedAreas.map(area => area._id);
        values.managerIds = selectedManagers.map(manager => manager._id);
        if (mode === 'add') {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'regions/save/';

            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    if (response.error) {
                        toast.error(response.message);
                    } else if (response.success) {
                        setLoading(false);
                        setShowSidebar(false);
                        toast.success('Region successfully added.');
                        action.setSubmitting = false;
                        action.resetForm({values: ''});
                        setSelectedAreas([]);
                        setSelectedManagers([]);
                        onClose();
                    }
                }).catch(error => {
                    console.log(error)
                });
        } else if (mode === 'edit') {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'regions';
            values._id = region._id;
            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    setLoading(false);
                    setShowSidebar(false);
                    toast.success('Region successfully updated.');
                    action.setSubmitting = false;
                    action.resetForm({values: ''});
                    setSelectedAreas([]);
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

        if (region && mode == 'edit') {
            const areas = areaList.filter(area => region?.areaIds.includes(area._id));
            setSelectedAreas(areas);
            const managers = managerList.filter(manager => region?.managerIds.includes(manager._id));
            setSelectedManagers(managers);
        }

        mounted && setLoading(false);

        return () => {
            mounted = false;
        };
    }, [region, areaList]);

    return (
        <React.Fragment>
            <SideBar title={mode === 'add' ? 'Add Region' : 'Edit Region'} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
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
                                            disabled={mode !== 'add'}
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
                                        <div className={`flex flex-col border rounded-md px-4 py-2 bg-white ${selectedAreas?.length > 0 ? 'border-main' : 'border-slate-400'}`}>
                                            <div className="flex justify-between">
                                                <label htmlFor="designatedBranch" className={`font-proxima-bold text-xs font-bold  ${selectedAreas?.length > 0 ? 'text-main' : 'text-gray-500'}`}>
                                                    Areas
                                                </label>
                                            </div>
                                            <div className="block h-fit">
                                                <Select 
                                                    options={areaList}
                                                    value={selectedAreas}
                                                    isMulti
                                                    styles={multiStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleSelectArea}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    placeholder={'Select areas'}/>
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

export default AddUpdateRegion;