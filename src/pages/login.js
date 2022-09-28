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
        // if (user.status !== 'active') {
        //     router.push('/register?action=inactive');
        // } else {
        //     dispatch(setUser(user)); 
        //     const returnUrl = router.query.returnUrl || '/';
        //     router.push(returnUrl);
        // }
    }

    const handleLogin = async (values, actions) => {        
        const { email, password } = values;
        const response = await userService.login(email, password);
        
        if (response.error) {
            toast.error(`Error during Authentication. ${response.message}`)
        }

        if (response.success) {
            handleSuccess(response.user);
        }
    };

    const handleRegister = () => {
        router.push('/register');
    };

    const handleForgotPassword = () => {
        router.push('/forgot-password');
    }

    return (
        <div className="login-container">
            <div className="login-left">
                <div className="login-left-content"></div>
            </div>
            <div className="login-right">
                <div className="login-right-content">
                    <Image src={logo} />
                    <div className="login-welcome">Hi There!</div>
                    <div className="login-welcome-text">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</div>
                    <Formik onSubmit={handleLogin} initialValues={initialValues} validationSchema={validationSchema}>
                        {props => (
                            <form onSubmit={props.handleSubmit} autoComplete="off">
                                <div className="mt-12">
                                    <InputEmail
                                        name="email" 
                                        value={props.values.email}
                                        onChange={props.handleChange}
                                        label="Email" 
                                        placeholder="youremail@gmail.com"
                                        setFieldValue={props.setFieldValue}
                                        errors={props.touched.email && props.errors.email ? props.errors.email : undefined} />
                                </div>
                                <div className="mt-12">
                                    <InputPassword 
                                        name="password" 
                                        value={props.values.password}
                                        label="Password"
                                        placeholder="****************"
                                        onChange={props.handleChange}
                                        errors={props.touched.password && props.errors.password ? props.errors.password : undefined} />
                                </div>
                                <div className="flex flex-row-reverse pt-5 px-2">
                                    <button className="login-forgot-password" type="button" onClick={handleForgotPassword}>Forgot Password?</button>
                                </div>
                                <div className="flex flex-row pt-8">
                                    <ButtonSolid className="font-bold mr-6" label="Login" type="submit" isSubmitting={!props.isValidating && props.isSubmitting} />
                                    <ButtonOutline className="font-bold text-sm" label="Register" type="button" onClick={handleRegister} />
                                </div>
                            </form>
                        )}
                    </Formik>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;