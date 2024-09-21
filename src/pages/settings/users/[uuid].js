import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { setCurrentPageTitle } from "@/redux/actions/globalActions";
import { setUser } from "@/redux/actions/userActions";
import { useRouter } from "next/router";
import { useRef, useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import InputText from "@/lib/ui/InputText";
import InputEmail from "@/lib/ui/InputEmail";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import placeholder from '/public/images/image-placeholder.png';
import Image from 'next/image';
import { checkFileSize } from "@/lib/utils";

const UserDetailsPage = () => {
    const router = useRouter();
    const dispatch = useDispatch();
    const { uuid } = router.query;
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    const [photo, setPhoto] = useState('');
    const [photoW, setPhotoW] = useState(200);
    const [photoH, setPhotoH] = useState(200);
    const [image, setImage] = useState('');
    const hiddenInput = useRef(null);
    const [data, setData] = useState({});

    const onUploadClick = () => {
        hiddenInput.current.click();
    }

    const handleFileChange = async (e) => {
        const fileUploaded = e.target.files[0];

        const fileSizeMsg = checkFileSize(fileUploaded?.size);
        if (fileSizeMsg) {
            toast.error(fileSizeMsg);
        } else {
            setPhoto(URL.createObjectURL(fileUploaded));
            setImage(fileUploaded);

            const formData = new FormData();
            formData.append('file', fileUploaded);
            formData.append('origin', 'profiles');
            formData.append('uuid', uuid);

            setUploading(true);
            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    throw new Error('Upload failed');
                }

                const responseData = await response.json();
                const updatedData = {...data, profile: responseData.fileUrl, role: JSON.stringify(data.role)}
                setData(updatedData);
                await triggerSaveUpdate(updatedData);
                toast.success('File uploaded successfully.');
            } catch (error) {
                console.error('Error uploading file:', error);
                toast.error('Failed to upload file. Please try again.');
            } finally {
                setUploading(false);
            }
        }
    }

    const handleRemoveImage = () => {
        setPhoto('');
        setImage('');
        setData(prevData => ({...prevData, profile: ''}));
        if (hiddenInput.current) {
            hiddenInput.current.value = '';
        }
    }

    const handleSaveUpdate = async (e) => {
        e.preventDefault();
        const values = {...data, _id: uuid, role: JSON.stringify(data.role)};
        await triggerSaveUpdate(values);
    }

    const triggerSaveUpdate = async (userData) => {
        setLoading(true);
        try {
            const response = await fetchWrapper.sendData(`${process.env.NEXT_PUBLIC_API_URL}users/`, userData);
            getCurrentUser();
            toast.success('User successfully updated.');
        } catch (error) {
            console.error(error);
            toast.error('Failed to update user. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    const getCurrentUser = async () => {
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}users?`;
        const params = { _id: uuid };
        try {
            const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
            const imgpath = process.env.NEXT_PUBLIC_LOCAL_HOST !== 'local' && process.env.NEXT_PUBLIC_LOCAL_HOST;
            if (response.success) {
                const user = {...response.user};
                setPhoto(user.profile);
                dispatch(setUser(user));
                setData(user);
            } else {
                throw new Error('Failed to load user data');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error while loading data');
        } finally {
            setLoading(false);
        }
    }
    
    useEffect(() => {
        dispatch(setCurrentPageTitle('Edit User Details'));
        if (uuid) {
            getCurrentUser(uuid);
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
                                        <input type="file" name="file" ref={hiddenInput} onChange={handleFileChange} className="hidden" />
                                    </div>
                                    {uuid && (
                                        <div className="w-48">
                                            <div className="flex flex-col space-y-4">
                                                <span>Photo should be at least 300px x 300px</span>
                                                <ButtonSolid label={uploading ? "Uploading..." : "Upload Photo"} onClick={onUploadClick} disabled={uploading} />
                                                <ButtonOutline label="Remove Photo" onClick={handleRemoveImage} disabled={uploading} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="mt-4">
                                <InputText
                                    name="firstName"
                                    value={data.firstName}
                                    onChange={(e) => setData({ ...data, firstName: e.target.value })}
                                    label="First Name"
                                    placeholder="Enter First Name"
                                />
                            </div>
                            <div className="mt-4">
                                <InputText
                                    name="lastName"
                                    value={data.lastName}
                                    onChange={(e) => setData({ ...data, lastName: e.target.value })}
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
                                    onChange={(e) => setData({ ...data, number: e.target.value })}
                                    label="Phone Number"
                                    placeholder="Enter Phone Number"
                                />
                            </div>
                            <div className="flex flex-row mt-5 pb-6 justify-end">
                                <ButtonSolid label="Submit" type="submit" width="w-64" disabled={uploading}/>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
}

export default UserDetailsPage;