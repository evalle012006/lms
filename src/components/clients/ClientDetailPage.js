import React, { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { toast } from "react-toastify";
import moment from 'moment';
import Image from 'next/image';
import { 
    UserIcon, 
    PhoneIcon, 
    MapPinIcon, 
    CalendarIcon, 
    BuildingOfficeIcon,
    UserGroupIcon,
    CurrencyDollarIcon,
    DocumentTextIcon,
    PencilIcon,
    CameraIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    XCircleIcon,
    InformationCircleIcon,
    BanknotesIcon,
    ClockIcon,
    IdentificationIcon,
    FlagIcon,
    ShieldCheckIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    MagnifyingGlassPlusIcon,
    MagnifyingGlassMinusIcon
} from '@heroicons/react/24/outline';
import ButtonSolid from "@/lib/ui/ButtonSolid";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import TableComponent, { StatusPill } from '@/lib/table';
import Spinner from "../Spinner";
import placeholder from '/public/images/image-placeholder.png';
import { formatPricePhp, checkFileSize } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/constants";
import { setClient } from "@/redux/actions/clientActions";

const ClientDetailPage = () => {
    const dispatch = useDispatch();
    const client = useSelector(state => state.client.data);
    
    // Local state for loan data instead of Redux
    const [loanList, setLoanList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [guarantorName, setGuarantorName] = useState('');
    const [lastLoan, setLastLoan] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [showAddLoanDrawer, setShowAddLoanDrawer] = useState(false);
    const [showUpdateClientDrawer, setShowUpdateClientDrawer] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [imageSrc, setImageSrc] = useState(null);
    const [showImageZoom, setShowImageZoom] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const imageRef = useRef();
    const zoomImageRef = useRef();

    // Status badge configurations
    const getStatusConfig = (status) => {
        const configs = {
            'active': { 
                bg: 'bg-green-100', 
                text: 'text-green-800', 
                icon: CheckCircleIcon,
                dot: 'bg-green-400'
            },
            'offset': { 
                bg: 'bg-red-100', 
                text: 'text-red-800', 
                icon: XCircleIcon,
                dot: 'bg-red-400'
            },
            'pending': { 
                bg: 'bg-yellow-100', 
                text: 'text-yellow-800', 
                icon: ClockIcon,
                dot: 'bg-yellow-400'
            },
            'inactive': { 
                bg: 'bg-gray-100', 
                text: 'text-gray-800', 
                icon: InformationCircleIcon,
                dot: 'bg-gray-400'
            }
        };
        return configs[status?.toLowerCase()] || configs.inactive;
    };

    const statusConfig = getStatusConfig(client?.status);
    const StatusIcon = statusConfig.icon;

    // Image handling
    useEffect(() => {
        if (client?.profile) {
            setImageSrc(client.profile);
            setImageError(false);
        } else {
            setImageSrc(placeholder);
            setImageError(false);
        }
    }, [client?.profile]);

    const handleImageError = () => {
        setImageError(true);
        setImageSrc(placeholder);
    };

    const handleImageLoad = () => {
        setImageError(false);
    };

    // Zoom functionality
    const handleOpenZoom = () => {
        setShowImageZoom(true);
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
    };

    const handleCloseZoom = () => {
        setShowImageZoom(false);
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
    };

    const handleZoomIn = () => {
        setZoomLevel(prev => Math.min(prev + 0.5, 5));
    };

    const handleZoomOut = () => {
        setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
    };

    const handleZoomReset = () => {
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
    };

    // Pan functionality
    const handleMouseDown = (e) => {
        if (zoomLevel > 1) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX - panOffset.x,
                y: e.clientY - panOffset.y
            });
        }
    };

    const handleMouseMove = (e) => {
        if (isDragging && zoomLevel > 1) {
            setPanOffset({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, dragStart, zoomLevel]);

    // Format complete address
    const getCompleteAddress = () => {
        const parts = [
            client?.addressStreetNo,
            client?.addressBarangayDistrict,
            client?.addressMunicipalityCity,
            client?.addressProvince,
            client?.addressZipCode
        ].filter(part => part && part.trim() !== '');
        
        return parts.length > 0 ? parts.join(', ') : client?.address || 'No address provided';
    };

    // API function to get client details and loan data
    const getClientDetails = async () => {
        if (!client?._id) return;
        
        setLoading(true);
        try {
            const url = getApiBaseUrl() + 'clients?clientId=' + client._id;
            const response = await fetchWrapper.get(url);
            
            if (response.success) {
                let loanData = [];
                
                // Process loan data from API response
                if (response.client && response.client.length > 0) {
                    response.client.forEach(clientItem => {
                        if (clientItem.loans && clientItem.loans.length > 0) {
                            clientItem.loans.forEach(loan => {
                                loanData.push({
                                    ...loan,
                                    groupName: loan.groupName,
                                    slotNo: loan.slotNo > 0 ? loan.slotNo : '-',
                                    missPayments: loan.missPayments || 0,
                                    loanStatus: loan.status,
                                    loanBalance: loan.loanBalance || 0,
                                    amountRelease: loan.amountRelease > 0 ? loan.amountRelease : loan?.history?.amountRelease || 0,
                                    dateGranted: loan.dateGranted,
                                    loanCycle: loan.loanCycle || 1,
                                    pnNumber: loan.pnNumber || '-',
                                    remarks: loan.remarks || '-',
                                    mispayment: loan.missPayments || 0,
                                    noOfPayments: loan.noOfPayments || 0,
                                    admissionDate: loan.admissionDate || loan.dateGranted,
                                    // Add guarantor information
                                    guarantorFirstName: loan.guarantorFirstName || '',
                                    guarantorMiddleName: loan.guarantorMiddleName || '',
                                    guarantorLastName: loan.guarantorLastName || ''
                                });
                            });
                        }
                    });
                }
                
                setLoanList(loanData);
            } else if (response.error) {
                toast.error(response.message);
            }
        } catch (error) {
            console.error('Error fetching client details:', error);
            toast.error('Failed to fetch client details');
        } finally {
            setLoading(false);
        }
    };

    // Photo upload handler
    const updatePhoto = async (event) => {
        const fileUploaded = event.target.files[0];
        if (!fileUploaded) return;

        const fileSizeMsg = checkFileSize(fileUploaded?.size);
        if (fileSizeMsg) {
            setLoading(false);
            toast.error(fileSizeMsg);
            return;
        }

        setLoading(true);
        const formData = new FormData();
        formData.append('file', fileUploaded);
        formData.append('origin', 'clients');
        formData.append('uuid', client?._id);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const responseData = await response.json();
            const updatedData = {...client, archived: client.archived || false, profile: responseData.fileUrl};
            
            fetchWrapper.sendData(process.env.NEXT_PUBLIC_API_URL + 'clients/', updatedData)
                .then(response => {
                    setLoading(false);
                    const updatedClient = {...response.client, profile: response.client.profile ? response.client.profile : ''};
                    dispatch(setClient(updatedClient));
                    // Update the image source with the new photo
                    setImageSrc(updatedClient.profile || placeholder);
                    setImageError(false);
                    toast.success('Photo successfully updated.');
                }).catch(error => {
                    console.log(error);
                    setLoading(false);
                    toast.error('Failed to update client profile');
                });
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error('Failed to upload file. Please try again.');
            setLoading(false);
        }
    };

    // Status pill component for loan status
    const LoanStatusPill = ({ status }) => {
        const getStatusStyle = (status) => {
            switch (status?.toLowerCase()) {
                case 'pending':
                    return 'bg-yellow-100 text-yellow-800';
                case 'completed':
                    return 'bg-green-100 text-green-800';
                case 'closed':
                    return 'bg-red-100 text-red-800';
                case 'active':
                    return 'bg-blue-100 text-blue-800';
                default:
                    return 'bg-gray-100 text-gray-800';
            }
        };

        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(status)}`}>
                {status || '-'}
            </span>
        );
    };

    // Tab configurations
    const tabs = [
        { id: 'overview', label: 'Overview', icon: UserIcon },
        { id: 'loans', label: 'Loan History', icon: CurrencyDollarIcon },
        { id: 'documents', label: 'Documents', icon: DocumentTextIcon }
    ];

    // Process guarantor name and last loan when loanList changes
    useEffect(() => {
        if (loanList && loanList.length > 0) {
            // Filter out rejected loans and get the most recent one
            const activeLoanList = loanList.filter(loan => loan.loanStatus !== 'reject');
            const lastLoan = activeLoanList.length > 0 ? activeLoanList[activeLoanList.length - 1] : null;
            
            if (lastLoan) {
                const firstName = lastLoan.guarantorFirstName || '';
                const middleName = (lastLoan.guarantorMiddleName && lastLoan.guarantorMiddleName?.trim().length > 0) ? lastLoan.guarantorMiddleName : '';
                const lastName = lastLoan.guarantorLastName || '';
                setGuarantorName(`${firstName} ${middleName} ${lastName}`.trim());
            }
            setLastLoan(lastLoan);
        }
    }, [loanList]);

    // Fetch client details when component mounts or client changes
    useEffect(() => {
        if (client?._id) {
            getClientDetails();
        }
    }, [client?._id]);

    return (
        <div className="bg-gray-50">
            {loading && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
                    <Spinner />
                </div>
            )}
            
            {/* Header Section */}
            <div className="bg-white border-b border-gray-200">
                <div className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="relative group">
                                {/* Larger Square Photo Container */}
                                <div className="w-32 h-32 relative rounded-xl overflow-hidden bg-gray-100 border-2 border-gray-200 group-hover:border-blue-300 transition-colors cursor-pointer">
                                    {imageSrc && !imageError && (
                                        <Image
                                            src={imageSrc}
                                            alt={`${client?.firstName} ${client?.lastName}`}
                                            layout="fill"
                                            objectFit="cover"
                                            className="rounded-xl"
                                            onError={handleImageError}
                                            onLoad={handleImageLoad}
                                            onClick={handleOpenZoom}
                                            placeholder="blur"
                                            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                                        />
                                    )}
                                    {/* Default avatar fallback when no image or on error */}
                                    {(!imageSrc || imageError) && (
                                        <div 
                                            className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500 cursor-pointer"
                                            onClick={handleOpenZoom}
                                        >
                                            <UserIcon className="w-16 h-16" />
                                        </div>
                                    )}
                                    
                                    {/* Zoom icon overlay */}
                                    <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MagnifyingGlassIcon className="w-4 h-4" />
                                    </div>
                                    
                                    {/* Edit overlay */}
                                    <div 
                                        className="absolute top-2 right-2 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white rounded-full p-1.5"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            imageRef.current?.click();
                                        }}
                                    >
                                        <CameraIcon className="w-4 h-4" />
                                    </div>
                                </div>
                                <input 
                                    ref={imageRef} 
                                    type="file" 
                                    className="hidden" 
                                    onChange={updatePhoto}
                                    accept="image/*"
                                />
                            </div>
                            
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">
                                    {client?.lastName}, {client?.firstName} {client?.middleName}
                                </h1>
                                <div className="flex items-center space-x-2 mt-2">
                                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                                        <div className={`w-2 h-2 rounded-full mr-2 ${statusConfig.dot}`}></div>
                                        <StatusIcon className="w-4 h-4 mr-1" />
                                        {client?.status?.toUpperCase()}
                                    </div>
                                    
                                    {client?.delinquent && (
                                        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                                            <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                                            Delinquent
                                        </div>
                                    )}
                                    
                                    {client?.groupLeader && (
                                        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                            <ShieldCheckIcon className="w-4 h-4 mr-1" />
                                            Group Leader
                                        </div>
                                    )}
                                    
                                    {client?.duplicate && (
                                        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                                            <FlagIcon className="w-4 h-4 mr-1" />
                                            Duplicate
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* Action Buttons */}
                        {(client?.status?.toLowerCase() === 'offset' && !client?.duplicate) && (
                            <div className="flex space-x-3">
                                <ButtonSolid
                                    label="Add Loan"
                                    onClick={() => setShowAddLoanDrawer(true)}
                                    className="px-4 py-2 text-sm"
                                />
                                <ButtonOutline
                                    label="Edit Client"
                                    onClick={() => setShowUpdateClientDrawer(true)}
                                    className="px-4 py-2 text-sm"
                                />
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Tab Navigation */}
                <div className="px-4">
                    <nav className="flex space-x-6">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                                        activeTab === tab.id
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* Tab Content */}
            <div className="p-6">
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Personal Information */}
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <div className="flex items-center mb-4">
                                <UserIcon className="w-5 h-5 text-gray-400 mr-2" />
                                <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">First Name</label>
                                        <p className="text-sm text-gray-900 mt-1">{client?.firstName || '-'}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Middle Name</label>
                                        <p className="text-sm text-gray-900 mt-1">{client?.middleName || '-'}</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Last Name</label>
                                    <p className="text-sm text-gray-900 mt-1">{client?.lastName || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Birthdate</label>
                                    <p className="text-sm text-gray-900 mt-1">
                                        {client?.birthdate && moment(client.birthdate).isValid() 
                                            ? moment(client.birthdate).format('MMMM DD, YYYY')
                                            : '-'
                                        }
                                        {client?.birthdate && moment(client.birthdate).isValid() && (
                                            <span className="text-gray-500 ml-2">
                                                (Age: {moment().diff(moment(client.birthdate), 'years')})
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Contact Information */}
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <div className="flex items-center mb-4">
                                <PhoneIcon className="w-5 h-5 text-gray-400 mr-2" />
                                <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Phone Number</label>
                                    <p className="text-sm text-gray-900 mt-1">{client?.contactNumber || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Complete Address</label>
                                    <p className="text-sm text-gray-900 mt-1">{getCompleteAddress()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Organization Information */}
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <div className="flex items-center mb-4">
                                <BuildingOfficeIcon className="w-5 h-5 text-gray-400 mr-2" />
                                <h3 className="text-lg font-semibold text-gray-900">Organization</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Branch</label>
                                    <p className="text-sm text-gray-900 mt-1">{client?.branchName || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Group</label>
                                    <p className="text-sm text-gray-900 mt-1">{client?.groupName || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Loan Officer ID</label>
                                    <p className="text-sm text-gray-900 mt-1">{client?.loId || '-'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Additional Information */}
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <div className="flex items-center mb-4">
                                <IdentificationIcon className="w-5 h-5 text-gray-400 mr-2" />
                                <h3 className="text-lg font-semibold text-gray-900">Additional Information</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-500">CI Name</label>
                                    <p className="text-sm text-gray-900 mt-1">{client?.ciName || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Guarantor</label>
                                    <p className="text-sm text-gray-900 mt-1">{guarantorName || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-500">Date Registered</label>
                                    <p className="text-sm text-gray-900 mt-1">
                                        {client?.dateAdded ? moment(client.dateAdded).format('MMMM DD, YYYY') : '-'}
                                    </p>
                                </div>
                                {client?.similarityScore && (
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Similarity Score</label>
                                        <p className="text-sm text-gray-900 mt-1">{client.similarityScore}%</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'loans' && (
                    <div className="bg-white rounded-lg border border-gray-200">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center">
                                <CurrencyDollarIcon className="w-5 h-5 text-gray-400 mr-2" />
                                <h3 className="text-lg font-semibold text-gray-900">Loan History</h3>
                            </div>
                        </div>
                        <div className="p-6">
                            {loanList && loanList.length > 0 ? (
                                <div className="overflow-auto max-h-96">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    LOAN DATE
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    AMOUNT RELEASED
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    LOAN BALANCE
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    STATUS
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    CYCLE
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    GROUP
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    PN NUMBER
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    MISS PAYMENTS
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {loanList.map((loan, index) => (
                                                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {loan.dateGranted ? moment(loan.dateGranted).format('MM/DD/YYYY') : '-'}
                                                    </td>
                                                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${loan.loanStatus == 'closed' ? 'line-through' : ''}`}>
                                                        {formatPricePhp(loan.amountRelease || 0)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {formatPricePhp(loan.loanBalance || 0)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <LoanStatusPill status={loan.loanStatus} />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {loan.loanCycle || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {loan.groupName || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {loan.pnNumber || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {loan.mispayment || 0}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <BanknotesIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">No loan history</h3>
                                    <p className="text-gray-500">This client hasn't taken any loans yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'documents' && (
                    <div className="bg-white rounded-lg border border-gray-200">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center">
                                <DocumentTextIcon className="w-5 h-5 text-gray-400 mr-2" />
                                <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="text-center py-8">
                                <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No documents available</h3>
                                <p className="text-gray-500">Document management feature coming soon.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Image Zoom Modal */}
            {showImageZoom && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center">
                    <div className="relative w-full h-full flex items-center justify-center">
                        {/* Close Button */}
                        <button
                            onClick={handleCloseZoom}
                            className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70 transition-all"
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>

                        {/* Zoom Controls */}
                        <div className="absolute top-4 left-4 z-10 flex flex-col space-y-2">
                            <button
                                onClick={handleZoomIn}
                                className="bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70 transition-all"
                                disabled={zoomLevel >= 5}
                            >
                                <MagnifyingGlassPlusIcon className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleZoomOut}
                                className="bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70 transition-all"
                                disabled={zoomLevel <= 0.5}
                            >
                                <MagnifyingGlassMinusIcon className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleZoomReset}
                                className="bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70 transition-all text-xs font-medium"
                            >
                                1:1
                            </button>
                        </div>

                        {/* Zoom Level Indicator */}
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                            {Math.round(zoomLevel * 100)}%
                        </div>

                        {/* Zoomable Image Container */}
                        <div 
                            className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-move"
                            onMouseDown={handleMouseDown}
                            style={{ cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
                        >
                            {imageSrc && !imageError ? (
                                <div
                                    ref={zoomImageRef}
                                    className="relative transition-transform duration-200 ease-out"
                                    style={{
                                        transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
                                        maxWidth: '90vw',
                                        maxHeight: '90vh'
                                    }}
                                >
                                    <img
                                        src={imageSrc}
                                        alt={`${client?.firstName} ${client?.lastName}`}
                                        className="max-w-full max-h-full object-contain"
                                        draggable={false}
                                        style={{ 
                                            width: 'auto', 
                                            height: 'auto',
                                            maxWidth: '80vw',
                                            maxHeight: '80vh'
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center justify-center bg-gray-800 rounded-lg p-8">
                                    <UserIcon className="w-32 h-32 text-gray-400" />
                                </div>
                            )}
                        </div>

                        {/* Instructions */}
                        {zoomLevel > 1 && (
                            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 bg-black bg-opacity-50 text-white px-4 py-2 rounded-full text-sm">
                                Click and drag to pan
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientDetailPage;