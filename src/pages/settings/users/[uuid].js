import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { setCurrentPageTitle } from "@/redux/actions/globalActions";
import { setUser } from "@/redux/actions/userActions";
import { useRouter } from "node_modules/next/router";
import { useRef, useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import InputText from "@/lib/ui/InputText";
import InputEmail from "@/lib/ui/InputEmail";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import placeholder from '/public/images/image-placeholder.png';
import Image from 'next/image';
import { checkFileSize } from "@/lib/utils";
import { getApiBaseUrl } from '@/lib/constants';

const UserDetailsPage = () => {
    const router = useRouter();
    const dispatch = useDispatch();
    const { uuid } = router.query;
    const [loading, setLoading] = useState(true);

    const [photo, setPhoto] = useState();
    const [photoW, setPhotoW] = useState(200);
    const [photoH, setPhotoH] = useState(200);
    const [image, setImage] = useState('');
    const hiddenInput = useRef(null);
    const [data, setData] = useState({});

    const onUploadClick = () => {
        hiddenInput.current.click();
    }

    const handleFileChange = async e => {
        const fileUploaded = e.target.files[0];

        const fileSizeMsg = checkFileSize(fileUploaded?.size);
        if (fileSizeMsg) {
            toast.error(fileSizeMsg);
        } else {
            setPhoto(URL.createObjectURL(fileUploaded));
            setImage(fileUploaded);
        }
    }

    const handleRemoveImage = () => {
        setPhoto('');
        setImage('');
        if (hiddenInput.current) {
            hiddenInput.current.value = '';
        }
    }

    const handleSaveUpdate = async () => {
        const values = {...data, _id: uuid, file: image, origin: 'updateUser'};
        fetchWrapper.sendData(getApiBaseUrl() + 'users/', values)
            .then(response => {
                setLoading(false);
                getCurrentUser();
                handleRemoveImage();
                toast.success('User successfully updated.');
                action.setSubmitting = false;
                action.resetForm();
            }).catch(error => {
                console.log(error);
            });
    }

    const getCurrentUser = async () => {
        const apiUrl = `${getApiBaseUrl()}users?`;
        const params = { _id: uuid };
        const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
        const imgpath = process.env.NEXT_PUBLIC_LOCAL_HOST !== 'local' && process.env.NEXT_PUBLIC_LOCAL_HOST;
        if (response.success) {
            const user = {...response.user, imgUrl: response.user.profile ? `${imgpath}/images/profiles/${response.user.profile}` : ''};
            setPhoto(user.imgUrl);
            dispatch(setUser(user));
            setData(user);

            setLoading(false);
        } else {
            toast.error('Error while loading data');
        }
    }
    
    useEffect(() => {
        let mounted = true;
        dispatch(setCurrentPageTitle('Edit User Details'));

        mounted && uuid && getCurrentUser(uuid);

        return () => {
            mounted = false;
        }
    }, [uuid]);

    return (
        <Layout>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <div className="flex flex-col">
                    <div className="mx-auto my-4 bg-white w-3/4 p-4 rounded-lg">
                        <form onSubmit={handleSaveUpdate} autoComplete="off">
                            <div className="profile-photo rounded-lg p-3 proxima-regular border">
                                <div className="proxima-bold">Profile Photo</div>
                                <div className="photo-row mt-4 flex space-x-4">
                                    <div className="photo-container rounded-lg">
                                        <div className="w-[200px] h-[200px] relative flex justify-center bg-slate-200 rounded-xl border overflow-hidden">
                                            <Image src={!photo ? placeholder : photo}
                                                className="overflow-hidden"
                                                alt="Profile Photo"
                                                width={photoW}
                                                height={photoH} />
                                        </div>
                                        <input type="file" name="file" ref={hiddenInput} onChange={(e) => handleFileChange(e)} className="hidden" />
                                    </div>
                                    <div className="w-48">
                                        <div className="flex flex-col space-y-4">
                                            <span>Photo should be at least 300px x 300px</span>
                                            <ButtonSolid label="Upload Photo" onClick={onUploadClick} />
                                            <ButtonOutline label="Remove Photo" onClick={handleRemoveImage} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4">
                                <InputText
                                    name="firstName"
                                    value={data.firstName}
                                    onChange={() => setData({ ...data, firstName: event.target.value })}
                                    label="First Name"
                                    placeholder="Enter First Name"
                                />
                            </div>
                            <div className="mt-4">
                                <InputText
                                    name="lastName"
                                    value={data.lastName}
                                    onChange={() => setData({ ...data, lastName: event.target.value })}
                                    label="Last Name"
                                    placeholder="Enter Last Name"
                                />
                            </div>
                            <div className="mt-4">
                                <InputEmail
                                    name="email"
                                    value={data.email}
                                    disabled={true}
                                    label="Email Address"
                                    placeholder="Enter Email Address"
                                />
                            </div>
                            <div className="mt-4">
                                <InputText
                                    name="number"
                                    value={data.number}
                                    onChange={() => data.number = event.target.value}
                                    label="Phone Number"
                                    placeholder="Enter Phone Number"
                                />
                            </div>
                            <div className="flex flex-row mt-5 pb-6 justify-end">
                                <ButtonSolid label="Submit" type="submit" width="w-64"/>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
}

export default UserDetailsPage;