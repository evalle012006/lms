import { Formik } from 'formik';
import InputText from '@/lib/ui/InputText';
import InputEmail from '@/lib/ui/InputEmail';
import InputPassword from '@/lib/ui/InputPassword';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import { useEffect, useState } from 'react';

const UserRegistration = ({ handleRegistration, initialValues, validationSchema, errorFields }) => {
    return (
        <Formik onSubmit={handleRegistration} initialValues={initialValues} validationSchema={validationSchema}>
            {props => (
                <form onSubmit={props.handleSubmit} autoComplete="off">
                    <div className="mt-8">
                        <InputText
                            name="firstName"
                            value={props.values.firstName}
                            onChange={props.handleChange}
                            label="First Name"
                            placeholder="First Name"
                            setFieldValue={props.setFieldValue}
                            errors={props.touched.firstName && props.errors.firstName ? props.errors.firstName : undefined} />
                    </div>
                    <div className="mt-6">
                        <InputText
                            name="lastName"
                            value={props.values.lastName}
                            onChange={props.handleChange}
                            label="Last Name"
                            placeholder="Last Name"
                            setFieldValue={props.setFieldValue}
                            errors={props.touched.lastName && props.errors.lastName ? props.errors.lastName : undefined} />
                    </div>
                    <div className="mt-6">
                        <InputEmail
                            name="email"
                            value={props.values.email}
                            onChange={props.handleChange}
                            label="Email"
                            placeholder="youremail@gmail.com"
                            setFieldValue={props.setFieldValue}
                            errors={(props.touched.email && props.errors.email) || errorFields 
                                ? (errorFields ? errorFields : props.errors.email ) 
                                : undefined} />
                    </div>
                    <div className="mt-6">
                        <InputPassword
                            name="password"
                            value={props.values.password}
                            label="Password"
                            placeholder="****************"
                            onChange={props.handleChange}
                            errors={props.touched.password && props.errors.password ? props.errors.password : undefined} />
                    </div>
                    <div className="flex flex-row pt-8">
                        <ButtonOutline className="font-bold" label="Register" type="submit" />
                    </div>
                </form>
            )}
        </Formik>
    );
}

export default UserRegistration;