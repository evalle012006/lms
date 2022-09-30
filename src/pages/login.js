import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import logo from '/public/images/logo.png';
import { useRouter } from 'next/router';
import { Formik } from 'formik'
import * as yup from 'yup';
import { userService } from '@/services/user-service';
import toast from 'react-hot-toast';
import { useDispatch } from 'react-redux';
import { setUser } from '@/redux/actions/userActions';
import InputEmail from '@/lib/ui/InputEmail';
import InputPassword from '@/lib/ui/InputPassword';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import ButtonOutline from '@/lib/ui/ButtonOutline';

const LoginPage = () => {
    const router = useRouter();
    const dispatch = useDispatch();

    const initialValues = { email: '', password: '' };

    const validationSchema = yup.object().shape({
        email: yup.string().required('Email is required'),
        password: yup.string().required('Password is required')
    });

    const handleError = (message) => {
        toast.error('Error during authentication. ' + message);
    }

    const handleSuccess = (user) => {
        dispatch(setUser(user)); 
        const returnUrl = router.query.returnUrl || '/';
        router.push(returnUrl);        
    }

    const handleLogin = async (values, actions) => {        
        const { email, password } = values;
        const response = await userService.login(email, password);
        
        if (response.success) {
            handleSuccess(response.user);
        } else if (response.error) {
            handleError(response.message);
        }
    };

    const handleRegister = () => {
        router.push('/register');
    };

    const handleForgotPassword = () => {
        router.push('/forgot-password');
    }

    return (
        <div className="bg-no-repeat bg-cover bg-center relative login-page-bg">
            <div className="absolute bg-gradient-to-b from-gray-500 to-gray-400 opacity-60 inset-0 z-0"></div>
            <div className="flex flex-row min-h-screen sm:flex sm:flex-row mx-0 justify-center">
                <div className="flex-col flex  self-center p-10 sm:max-w-5xl max-w-3xl xl:max-w-xl  z-10">
                    <div className="self-start hidden lg:flex flex-col  text-white">
                        <h1 className="mb-3 font-bold text-5xl">Lending Management System </h1>
                        <p className="pr-3">Lorem ipsum is placeholder text commonly used in the graphic, print,
                            and publishing industries for previewing layouts and visual mockups</p>
                    </div>
                </div>
                <div className="flex justify-center self-center z-10">
                    <div className="p-12 bg-white mx-auto rounded-2xl w-100 ">
                        <div className="mb-4">
                            <h3 className="font-semibold text-2xl text-gray-800">Sign In </h3>
                            <p className="text-gray-500">Please sign in to your account.</p>
                        </div>
                        <div className="space-y-5">
                        <Formik onSubmit={handleLogin} initialValues={initialValues} validationSchema={validationSchema}>
                            {props => (
                                <form onSubmit={props.handleSubmit} autoComplete="off">
                                    <div className="mt-12">
                                        <InputEmail
                                            name="email"
                                            width="20rem"
                                            value={props.values.email}
                                            onChange={props.handleChange}
                                            label="Email" 
                                            placeholder="Enter your email"
                                            setFieldValue={props.setFieldValue}
                                            errors={props.touched.email && props.errors.email ? props.errors.email : undefined} />
                                    </div>
                                    <div className="mt-12">
                                        <InputPassword 
                                            name="password" 
                                            value={props.values.password}
                                            label="Password"
                                            placeholder="Enter your password"
                                            onChange={props.handleChange}
                                            errors={props.touched.password && props.errors.password ? props.errors.password : undefined} />
                                    </div>
                                    <div className="flex flex-row-reverse pt-5 px-2">
                                        <button className="login-forgot-password" type="button" onClick={handleForgotPassword}>Forgot Password?</button>
                                    </div>
                                    <div className="flex flex-row pt-8">
                                        <ButtonSolid className="font-bold" label="Login" type="submit" isSubmitting={!props.isValidating && props.isSubmitting} />
                                        {/* <ButtonOutline className="font-bold text-sm" label="Register" type="button" onClick={handleRegister} /> */}
                                    </div>
                                </form>
                            )}
                        </Formik>
                        </div>
                        <div className="pt-5 text-center text-gray-400 text-xs">
                            <span>
                                Copyright © 2022-2023
                                <a href="#" rel="" target="_blank" title="Ajimon" className="text-green hover:text-main "> xdonie11</a>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;