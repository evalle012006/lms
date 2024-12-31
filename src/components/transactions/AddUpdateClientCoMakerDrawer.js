import React, { useState, useEffect, useRef } from "react";
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import Spinner from "../Spinner";
import 'react-calendar/dist/Calendar.css';
import SelectDropdown from "@/lib/ui/select";
import SideBar from "@/lib/ui/SideBar";
import { getApiBaseUrl } from '@/lib/constants';

const AddUpdateClientCoMaker = ({ client = {}, showSidebar, setShowSidebar, onClose, type }) => {
    const formikRef = useRef();
    const currentUser = useSelector(state => state.user.data);
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState('Update Active Loan Co Maker');
    const [coMakers, setCoMakers] = useState();
    const [selectedCoMaker, setSelectedCoMaker] = useState();

    const initialValues = {
        clientId: client._id,
        groupId: client.groupId,
        coMaker: client.coMaker
    }

    const validationSchema = yup.object().shape({
        coMaker: yup
            .number()
            .integer()
            .positive()
            .required('Please enter a co maker'),
    });

    const handleCoMakerChange = (field, value) => {
        const form = formikRef.current;
        setSelectedCoMaker(value);
        form.setFieldValue(field, value);
    }

    const handleSaveUpdate = (values, action) => {
        const apiUrl = getApiBaseUrl() + 'transactions/loans/add-comaker-loan';
        fetchWrapper.post(apiUrl, values)
            .then(response => {
                setLoading(false);
                if (response.error) {
                    toast.error(response.message);
                } else if (response.success) {
                    setShowSidebar(false);
                    toast.success('CoMaker successfully added.');
                    action.setSubmitting = false;
                    action.resetForm({values: ''});
                    onClose();
                }
            }).catch(error => {
                console.log(error)
            });
    }

    const handleCancel = () => {
        setShowSidebar(false);
        formikRef.current.resetForm();
        onClose();
    }

    useEffect(() => {
        if (client) {
            setSelectedCoMaker(client.coMaker);
        }
    }, [client]);

    useEffect(() => {
        const setSlotNumbers = async () => {
            // const existingSlotNumbers = await getAllLoanPerGroup(selectedGroup);
            const ts = [];
            for (let i = 1; i <= 30; i++) {
                // if (existingSlotNumbers && !existingSlotNumbers.includes(i)) {
                    ts.push({ value: i, label: i });
                // }
            }

            setCoMakers(ts);
        }

        setSlotNumbers();
    }, []);

    return (
        <React.Fragment>
            <SideBar title={title} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
                {loading ? (
                    // <div className="flex items-center justify-center h-screen">
                        <Spinner />
                    // </div>
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
                                    <SelectDropdown
                                        name="coMaker"
                                        field="coMaker"
                                        value={selectedCoMaker}
                                        label="Co Maker"
                                        options={coMakers}
                                        onChange={(field, value) => handleCoMakerChange(field, value)}
                                        onBlur={setFieldTouched}
                                        placeholder="Select Co Maker"
                                        errors={touched.coMaker && errors.coMaker ? errors.coMaker : undefined}
                                    />
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

export default AddUpdateClientCoMaker;