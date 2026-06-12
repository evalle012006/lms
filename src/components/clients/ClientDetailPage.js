import React, { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { toast } from "react-toastify";
import moment from 'moment';
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
    MagnifyingGlassMinusIcon,
    EyeIcon,
    StarIcon,
    ExclamationCircleIcon,
    UserCircleIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import ButtonSolid from "@/lib/ui/ButtonSolid";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import TableComponent, { StatusPill } from '@/lib/table';
import Spinner from "../Spinner";
import placeholder from '/public/images/image-placeholder.png';
import { formatPricePhp, checkFileSize } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/constants";
import { setClient } from "@/redux/actions/clientActions";
import PaymentHistoryModal from "./PaymentHistoryModal";
// ✅ Private file display — handles signed URLs automatically
import PrivateImage from "@/components/common/PrivateImage";
import { useSignedUrl } from "hooks/useSignedUrl";
import { GraduationCap } from 'lucide-react';
import ClientProgramsTab from './programs/ClientProgramsTab';

const ClientDetailPage = () => {
    const dispatch = useDispatch();
    const client = useSelector(state => state.client.data);
    
    // Local state for loan data instead of Redux
    const [loanList, setLoanList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [guarantorName, setGuarantorName] = useState('');
    const [activeLoan, setActiveLoan] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [showAddLoanDrawer, setShowAddLoanDrawer] = useState(false);
    const [showUpdateClientDrawer, setShowUpdateClientDrawer] = useState(false);

    // ✅ Removed: imageError + imageSrc states (handled by PrivateImage / useSignedUrl)
    
    // Payment History Modal state
    const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
    const [selectedLoanForHistory, setSelectedLoanForHistory] = useState(null);
    
    // Image preview state
    const [showImagePreview, setShowImagePreview] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    
    const fileInputRef = useRef(null);

    // ✅ Get signed URL for the full-screen preview modal
    const { signedUrl: profileSignedUrl } = useSignedUrl(client?.profile);

    // Fetch client details (including loans) when client changes
    useEffect(() => {
        if (client?._id) {
            getClientDetails();
        }
    }, [client?._id]);

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
                                    groupName: loan.groupName || clientItem.groupName,
                                    slotNo: loan.slotNo > 0 ? loan.slotNo : clientItem.slotNo,
                                });
                            });
                        }
                    });
                }
                
                // Sort loans by loanCycle in descending order (latest first)
                loanData.sort((a, b) => (b.loanCycle || 0) - (a.loanCycle || 0));
                setLoanList(loanData);
            }
        } catch (error) {
            console.error('Error fetching client details:', error);
            toast.error('Failed to fetch client details');
        } finally {
            setLoading(false);
        }
    };

    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleImageChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Check file size (max 5MB)
        if (!checkFileSize(file, 5)) {
            toast.error('File size must be less than 5MB');
            return;
        }

        // Check file type
        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }

        setLoading(true);
        try {
            // Step 1: Upload file to /api/upload
            const formData = new FormData();
            formData.append('file', file);
            formData.append('origin', 'clients');
            formData.append('uuid', client._id);

            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!uploadResponse.ok) {
                throw new Error('Upload failed');
            }

            const uploadResult = await uploadResponse.json();
            
            // ✅ API now returns fileKey (storage path), not a public URL
            if (!uploadResult.fileKey) {
                throw new Error('No file key returned');
            }

            // Step 2: Prepare sanitized client data for update
            const sanitizedClientData = {
                _id: client._id,
                firstName: client.firstName,
                middleName: client.middleName || '',
                lastName: client.lastName,
                birthdate: client.birthdate,
                addressStreetNo: client.addressStreetNo || '',
                addressBarangayDistrict: client.addressBarangayDistrict || '',
                addressMunicipalityCity: client.addressMunicipalityCity || '',
                addressProvince: client.addressProvince || '',
                addressZipCode: client.addressZipCode || '',
                contactNumber: client.contactNumber || '',
                branchId: client.branchId,
                branchName: client.branchName || '',
                status: client.status,
                loId: client.loId,
                groupId: client.groupId,
                groupName: client.groupName || '',
                ciName: client.ciName || '',
                profile: uploadResult.fileKey,  // ✅ store key, not public URL
                delinquent: client.delinquent === true,
                duplicate: client.duplicate === true,
                groupLeader: client.groupLeader === true,
                archived: client.archived === true,
            };

            if (sanitizedClientData.archived && client.archivedBy) {
                sanitizedClientData.archivedBy = client.archivedBy;
            }

            // Step 3: Update client record
            const updateResponse = await fetchWrapper.sendData(
                getApiBaseUrl() + 'clients/', 
                sanitizedClientData
            );

            if (updateResponse.success) {
                // ✅ Update Redux with the fileKey — PrivateImage will fetch the signed URL
                dispatch(setClient({ ...client, profile: uploadResult.fileKey }));
                toast.success('Photo successfully updated.');
            } else {
                toast.error(updateResponse.message || 'Failed to update client profile');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error('Failed to upload file. Please try again.');
        } finally {
            setLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Handle View Payment History
    const handleViewPaymentHistory = (loan) => {
        setSelectedLoanForHistory(loan);
        setShowPaymentHistoryModal(true);
    };

    const handleClosePaymentHistoryModal = () => {
        setShowPaymentHistoryModal(false);
        setSelectedLoanForHistory(null);
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
                    return 'bg-gray-100 text-gray-800';
                case 'active':
                    return 'bg-blue-100 text-blue-800';
                default:
                    return 'bg-gray-100 text-gray-800';
            }
        };

        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusStyle(status)}`}>
                {status || '-'}
            </span>
        );
    };

    // Boolean badge component
    const BooleanBadge = ({ value, trueLabel = 'Yes', falseLabel = 'No', trueColor = 'green', falseColor = 'gray' }) => {
        const colorClasses = {
            green: value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600',
            red: value ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600',
            yellow: value ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600',
            blue: value ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600',
        };
        
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${value ? colorClasses[trueColor].split(' ')[0] + ' ' + colorClasses[trueColor].split(' ')[1] : 'bg-gray-100 text-gray-600'}`}>
                {value ? trueLabel : falseLabel}
            </span>
        );
    };

    // Tab configurations
    const tabs = [
        { id: 'overview',   label: 'Overview',      icon: UserIcon },
        { id: 'loans',      label: 'Loan History',  icon: CurrencyDollarIcon },
        { id: 'documents',  label: 'Documents',     icon: DocumentTextIcon },
        { id: 'programs',   label: 'Programs',      icon: GraduationCap },
    ];

    // Process guarantor name and active loan when loanList changes
    useEffect(() => {
        if (loanList && loanList.length > 0) {
            // Find active loan first, if none found, get the most recent (first after sorting)
            const currentActiveLoan = loanList.find(loan => loan.status === 'active') || loanList[0];
            
            if (currentActiveLoan) {
                const firstName = currentActiveLoan.guarantorFirstName || '';
                const middleName = (currentActiveLoan.guarantorMiddleName && currentActiveLoan.guarantorMiddleName?.trim().length > 0 && currentActiveLoan.guarantorMiddleName !== '.') 
                    ? ` ${currentActiveLoan.guarantorMiddleName.charAt(0)}.` 
                    : '';
                const lastName = currentActiveLoan.guarantorLastName && currentActiveLoan.guarantorLastName !== '.' ? ` ${currentActiveLoan.guarantorLastName}` : '';
                setGuarantorName(`${firstName}${middleName}${lastName}`.trim() || '-');
                setActiveLoan(currentActiveLoan);
            }
        } else {
            setActiveLoan(null);
            setGuarantorName('-');
        }
    }, [loanList]);

    // Helper function to format full address
    const formatFullAddress = () => {
        const parts = [
            client?.addressStreetNo,
            client?.addressBarangayDistrict,
            client?.addressMunicipalityCity,
            client?.addressProvince,
            client?.addressZipCode
        ].filter(Boolean);
        
        return parts.length > 0 ? parts.join(', ') : (client?.address || '-');
    };

    // Helper function to calculate age from birthdate
    const calculateAge = (birthdate) => {
        if (!birthdate) return '-';
        const years = moment().diff(moment(birthdate), 'years');
        return years > 0 ? years : '-';
    };

    // Image preview handlers
    const handleOpenImagePreview = () => {
        // ✅ Check client.profile (key) instead of imageSrc state
        if (client?.profile) {
            setShowImagePreview(true);
            setZoomLevel(1);
        }
    };

    const handleCloseImagePreview = () => {
        setShowImagePreview(false);
        setZoomLevel(1);
    };

    const handleZoomIn = () => {
        setZoomLevel(prev => Math.min(prev + 0.25, 3));
    };

    const handleZoomOut = () => {
        setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
    };

    // Get slot number from active loan or client
    const getSlotNumber = () => {
        if (activeLoan?.slotNo) return activeLoan.slotNo;
        if (client?.slotNo) return client.slotNo;
        return '-';
    };

    if (!client) {
        return (
            <div className="flex items-center justify-center h-64">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-full">
            {/* Header Section */}
            <div className="bg-white border-b border-gray-200">
                <div className="px-6 py-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                        {/* Client Info */}
                        <div className="flex items-start space-x-4">
                            {/* Profile Image */}
                            <div className="relative group">
                                <div 
                                    className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-lg cursor-pointer"
                                    onClick={handleOpenImagePreview}
                                >
                                    {/* ✅ PrivateImage fetches a signed URL automatically */}
                                    <PrivateImage
                                        src={client.profile}
                                        alt={`${client.firstName} ${client.lastName}`}
                                        width={96}
                                        height={96}
                                        className="object-cover w-full h-full"
                                        fallback={placeholder}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleImageClick}
                                    className="absolute bottom-0 right-0 p-1.5 bg-primary-1 rounded-full text-white shadow-lg hover:bg-primary-2 transition-colors"
                                >
                                    <CameraIcon className="w-4 h-4" />
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="hidden"
                                />
                            </div>
                            
                            {/* Name and Basic Info */}
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-2xl font-bold text-gray-900">
                                        {client.lastName}, {client.firstName} {client.middleName ? `${client.middleName}.` : ''}
                                    </h1>
                                    {client.groupLeader && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                            <StarIconSolid className="w-3 h-3 mr-1" />
                                            Group Leader
                                        </span>
                                    )}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                                    <span className="flex items-center">
                                        <IdentificationIcon className="w-4 h-4 mr-1" />
                                        Slot #{getSlotNumber()}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center">
                                        <UserGroupIcon className="w-4 h-4 mr-1" />
                                        {client.groupName || '-'}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center">
                                        <BuildingOfficeIcon className="w-4 h-4 mr-1" />
                                        {client.branchName || '-'}
                                    </span>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    <LoanStatusPill status={client.status} />
                                    {client.delinquent && (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                            <ExclamationCircleIcon className="w-3 h-3 mr-1" />
                                            Delinquent
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-6">
                    <nav className="flex space-x-8 border-t border-gray-200" aria-label="Tabs">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    flex items-center py-4 px-1 border-t-2 font-medium text-sm transition-colors
                                    ${activeTab === tab.id
                                        ? 'border-primary-1 text-primary-1'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }
                                `}
                            >
                                <tab.icon className={`w-5 h-5 mr-2 ${activeTab === tab.id ? 'text-primary-1' : 'text-gray-400'}`} />
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Content Section */}
            <div className="p-6">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Personal Information */}
                        <div className="bg-white rounded-lg border border-gray-200">
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex items-center">
                                    <UserIcon className="w-5 h-5 text-gray-400 mr-2" />
                                    <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                                </div>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Date of Birth</label>
                                        <p className="mt-1 text-sm text-gray-900">
                                            {client.birthdate ? moment(client.birthdate).format('MMMM DD, YYYY') : '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Age</label>
                                        <p className="mt-1 text-sm text-gray-900">
                                            {calculateAge(client.birthdate)} {calculateAge(client.birthdate) !== '-' ? 'years old' : ''}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase">Contact Number</label>
                                    <p className="mt-1 text-sm text-gray-900 flex items-center">
                                        <PhoneIcon className="w-4 h-4 mr-2 text-gray-400" />
                                        {client.contactNumber || '-'}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase">Address</label>
                                    <p className="mt-1 text-sm text-gray-900 flex items-start">
                                        <MapPinIcon className="w-4 h-4 mr-2 text-gray-400 mt-0.5 flex-shrink-0" />
                                        <span>{formatFullAddress()}</span>
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Date Added</label>
                                        <p className="mt-1 text-sm text-gray-900">
                                            {client.dateAdded ? moment(client.dateAdded).format('MMMM DD, YYYY') : '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Last Modified</label>
                                        <p className="mt-1 text-sm text-gray-900">
                                            {client.dateModified ? moment(client.dateModified).format('MMMM DD, YYYY') : '-'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Assignment & Status Information */}
                        <div className="bg-white rounded-lg border border-gray-200">
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex items-center">
                                    <BuildingOfficeIcon className="w-5 h-5 text-gray-400 mr-2" />
                                    <h3 className="text-lg font-semibold text-gray-900">Assignment & Status</h3>
                                </div>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Branch</label>
                                        <p className="mt-1 text-sm text-gray-900">{client.branchName || '-'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Group</label>
                                        <p className="mt-1 text-sm text-gray-900">{client.groupName || '-'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">CI Name</label>
                                        <p className="mt-1 text-sm text-gray-900 flex items-center">
                                            <UserCircleIcon className="w-4 h-4 mr-1 text-gray-400" />
                                            {client.ciName || '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Slot Number</label>
                                        <p className="mt-1 text-sm text-gray-900">#{getSlotNumber()}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Group Leader</label>
                                        <p className="mt-1">
                                            <BooleanBadge 
                                                value={client.groupLeader} 
                                                trueLabel="Yes" 
                                                falseLabel="No"
                                                trueColor="yellow"
                                            />
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Delinquent</label>
                                        <p className="mt-1">
                                            <BooleanBadge 
                                                value={client.delinquent} 
                                                trueLabel="Yes" 
                                                falseLabel="No"
                                                trueColor="red"
                                            />
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Account Status</label>
                                        <p className="mt-1">
                                            <LoanStatusPill status={client.status} />
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Archived</label>
                                        <p className="mt-1">
                                            <BooleanBadge 
                                                value={client.archived} 
                                                trueLabel="Yes" 
                                                falseLabel="No"
                                                trueColor="red"
                                            />
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Current Loan Information - Full Width */}
                        <div className="bg-white rounded-lg border border-gray-200 lg:col-span-2">
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <CurrencyDollarIcon className="w-5 h-5 text-gray-400 mr-2" />
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            {activeLoan?.status === 'active' ? 'Current Loan Information' : 'Latest Loan Information'}
                                        </h3>
                                    </div>
                                    {activeLoan && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-500">PN: {activeLoan.pnNumber || '-'}</span>
                                            <LoanStatusPill status={activeLoan.status} />
                                        </div>
                                    )}
                                </div>
                            </div>
                            {activeLoan ? (
                                <div className="p-6">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">Loan Cycle</label>
                                            <p className="mt-1 text-2xl font-bold text-gray-900">{activeLoan.loanCycle || '-'}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">Loan Terms</label>
                                            <p className="mt-1 text-sm text-gray-900">{activeLoan.loanTerms || '-'} days ({activeLoan.occurence || 'daily'})</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">Principal Loan</label>
                                            <p className="mt-1 text-sm text-gray-900">{formatPricePhp(activeLoan.principalLoan || 0)}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">Amount Release</label>
                                            <p className="mt-1 text-lg font-semibold text-green-600">{formatPricePhp(activeLoan.amountRelease || 0)}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">Loan Balance</label>
                                            <p className="mt-1 text-lg font-semibold text-gray-900">{formatPricePhp(activeLoan.loanBalance || 0)}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">Daily Collection</label>
                                            <p className="mt-1 text-sm text-gray-900">{formatPricePhp(activeLoan.activeLoan || 0)}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">No. of Payments</label>
                                            <p className="mt-1 text-sm text-gray-900">{activeLoan.noOfPayments || 0} / {activeLoan.loanTerms || 0}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">Advance Days</label>
                                            <p className="mt-1 text-sm text-gray-900">{activeLoan.advanceDays || 0}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6 pt-6 border-t border-gray-100">
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">MCBU</label>
                                            <p className="mt-1 text-sm text-gray-900">{formatPricePhp(activeLoan.mcbu || 0)}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">MCBU Collection</label>
                                            <p className="mt-1 text-sm text-gray-900">{formatPricePhp(activeLoan.mcbuCollection || 0)}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">Mispayments</label>
                                            <p className={`mt-1 text-sm font-medium ${(activeLoan.mispayment || 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                                {activeLoan.mispayment || 0}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">Past Due</label>
                                            <p className={`mt-1 text-sm font-medium ${(activeLoan.pastDue || 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                                {formatPricePhp(activeLoan.pastDue || 0)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6 pt-6 border-t border-gray-100">
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">Date Granted</label>
                                            <p className="mt-1 text-sm text-gray-900">
                                                {activeLoan.dateGranted ? moment(activeLoan.dateGranted).format('MMM DD, YYYY') : '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">Start Date</label>
                                            <p className="mt-1 text-sm text-gray-900">
                                                {activeLoan.startDate ? moment(activeLoan.startDate).format('MMM DD, YYYY') : '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">End Date</label>
                                            <p className="mt-1 text-sm text-gray-900">
                                                {activeLoan.endDate ? moment(activeLoan.endDate).format('MMM DD, YYYY') : '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">Last Updated</label>
                                            <p className="mt-1 text-sm text-gray-900">
                                                {activeLoan.lastUpdated ? moment(activeLoan.lastUpdated).format('MMM DD, YYYY') : '-'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6 pt-6 border-t border-gray-100">
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">Guarantor</label>
                                            <p className="mt-1 text-sm text-gray-900">{guarantorName}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">Loan Officer</label>
                                            <p className="mt-1 text-sm text-gray-900">{activeLoan.loanOfficerName || '-'}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">CI Name</label>
                                            <p className="mt-1 text-sm text-gray-900">{activeLoan.ciName || client.ciName || '-'}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase">Group / Slot</label>
                                            <p className="mt-1 text-sm text-gray-900">{activeLoan.groupName || '-'} / #{activeLoan.slotNo || '-'}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-6 text-center">
                                    <CurrencyDollarIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">No active loan</h3>
                                    <p className="text-gray-500">This client doesn't have any loan records.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Loans Tab */}
                {activeTab === 'loans' && (
                    <div className="bg-white rounded-lg border border-gray-200">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <BanknotesIcon className="w-5 h-5 text-gray-400 mr-2" />
                                    <h3 className="text-lg font-semibold text-gray-900">Loan History</h3>
                                </div>
                                <span className="text-sm text-gray-500">{loanList.length} loan(s)</span>
                            </div>
                        </div>
                        <div className="p-6">
                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <Spinner />
                                </div>
                            ) : loanList.length > 0 ? (
                                <div className="overflow-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cycle</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PN Number</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Granted</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Principal</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Released</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payments</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Miss</th>
                                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {loanList.map((loan, index) => (
                                                <tr key={loan._id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{loan.loanCycle || '-'}</td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{loan.pnNumber || '-'}</td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {loan.dateGranted ? moment(loan.dateGranted).format('MMM DD, YYYY') : 
                                                         loan.dateOfRelease ? moment(loan.dateOfRelease).format('MMM DD, YYYY') : '-'}
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{formatPricePhp(loan.principalLoan || 0)}</td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{formatPricePhp(loan.amountRelease || 0)}</td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{formatPricePhp(loan.loanBalance || 0)}</td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{loan.noOfPayments || 0} / {loan.loanTerms || 0}</td>
                                                    <td className="px-4 py-4 whitespace-nowrap"><LoanStatusPill status={loan.status} /></td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{loan.groupName || '-'}</td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        <span className={`${(loan.mispayment || 0) > 0 ? 'text-red-600 font-medium' : ''}`}>{loan.mispayment || 0}</span>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleViewPaymentHistory(loan)}
                                                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-primary-1 bg-primary-4 hover:bg-primary-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-1 transition-colors"
                                                        >
                                                            <EyeIcon className="w-4 h-4 mr-1" />
                                                            View History
                                                        </button>
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

                {/* Documents Tab */}
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
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No documents</h3>
                                <p className="text-gray-500">No documents uploaded for this client.</p>
                            </div>
                        </div>
                    </div>
                )}
                {/* ── Programs Tab — shows all educational programs client is enrolled in ──────────────── */}
                {activeTab === 'programs' && (
                    <ClientProgramsTab client={client} />
                )}
            </div>

            {/* Payment History Modal */}
            <PaymentHistoryModal
                show={showPaymentHistoryModal}
                onClose={handleClosePaymentHistoryModal}
                loan={selectedLoanForHistory}
            />

            {/* Image Preview Modal */}
            {showImagePreview && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
                        <div 
                            className="fixed inset-0 transition-opacity bg-black bg-opacity-75" 
                            onClick={handleCloseImagePreview}
                        ></div>
                        <div className="relative z-10">
                            <div className="absolute top-4 right-4 flex space-x-2">
                                <button onClick={handleZoomIn} className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100">
                                    <MagnifyingGlassPlusIcon className="w-6 h-6" />
                                </button>
                                <button onClick={handleZoomOut} className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100">
                                    <MagnifyingGlassMinusIcon className="w-6 h-6" />
                                </button>
                                <button onClick={handleCloseImagePreview} className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100">
                                    <XMarkIcon className="w-6 h-6" />
                                </button>
                            </div>
                            {/* ✅ Use signed URL for the raw <img> in the preview modal */}
                            <img
                                src={profileSignedUrl || placeholder.src}
                                alt="Client Profile"
                                style={{ transform: `scale(${zoomLevel})` }}
                                className="max-w-full max-h-[80vh] rounded-lg transition-transform duration-200"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientDetailPage;