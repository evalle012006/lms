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
    MagnifyingGlassMinusIcon,
    EyeIcon
} from '@heroicons/react/24/outline';
import ButtonSolid from "@/lib/ui/ButtonSolid";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import TableComponent, { StatusPill } from '@/lib/table';
import Spinner from "../Spinner";
import placeholder from '/public/images/image-placeholder.png';
import { formatPricePhp, checkFileSize } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/constants";
import { setClient } from "@/redux/actions/clientActions";
import PaymentHistoryModal from "./PaymentHistoryModal";

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
    
    // Payment History Modal state
    const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
    const [selectedLoanForHistory, setSelectedLoanForHistory] = useState(null);
    
    // Image preview state
    const [showImagePreview, setShowImagePreview] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    
    const fileInputRef = useRef(null);

    // Fetch client details (including loans) when client changes
    useEffect(() => {
        if (client?._id) {
            getClientDetails();
        }
    }, [client?._id]);

    // Update image source when client changes
    useEffect(() => {
        if (client?.profile) {
            setImageSrc(client.profile);
            setImageError(false);
        } else {
            setImageSrc(placeholder);
        }
    }, [client?.profile]);

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
            
            if (!uploadResult.fileUrl) {
                throw new Error('No file URL returned');
            }

            // Step 2: Prepare sanitized client data for update
            // Only include fields that are needed for the update to avoid type conversion issues
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
                profile: uploadResult.fileUrl, // New profile URL
                // Boolean fields - ensure they are actual booleans, not null
                delinquent: client.delinquent === true,
                duplicate: client.duplicate === true,
                groupLeader: client.groupLeader === true,
                archived: client.archived === true,
            };

            // Only add archivedBy if archived is true
            if (sanitizedClientData.archived && client.archivedBy) {
                sanitizedClientData.archivedBy = client.archivedBy;
            }

            // Step 3: Update client record
            const updateResponse = await fetchWrapper.sendData(
                getApiBaseUrl() + 'clients/', 
                sanitizedClientData
            );

            if (updateResponse.success) {
                // Update Redux state
                dispatch(setClient({ ...client, profile: uploadResult.fileUrl }));
                setImageSrc(uploadResult.fileUrl);
                setImageError(false);
                toast.success('Photo successfully updated.');
            } else {
                toast.error(updateResponse.message || 'Failed to update client profile');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error('Failed to upload file. Please try again.');
        } finally {
            setLoading(false);
            // Reset file input to allow re-uploading same file
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
                const middleName = (lastLoan.guarantorMiddleName && lastLoan.guarantorMiddleName?.trim().length > 0) 
                    ? ` ${lastLoan.guarantorMiddleName.charAt(0)}.` 
                    : '';
                const lastName = lastLoan.guarantorLastName ? ` ${lastLoan.guarantorLastName}` : '';
                setGuarantorName(`${firstName}${middleName}${lastName}`);
                setLastLoan(lastLoan);
            }
        }
    }, [loanList]);

    // Image preview handlers
    const handleOpenImagePreview = () => {
        if (imageSrc && imageSrc !== placeholder) {
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
                                    <Image
                                        src={imageError ? placeholder : (imageSrc || placeholder)}
                                        alt={`${client.firstName} ${client.lastName}`}
                                        width={96}
                                        height={96}
                                        className="object-cover w-full h-full"
                                        onError={() => setImageError(true)}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleImageClick}
                                    className="absolute bottom-0 right-0 p-1.5 bg-primary-600 rounded-full text-white shadow-lg hover:bg-primary-700 transition-colors"
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
                                <h1 className="text-2xl font-bold text-gray-900">
                                    {client.lastName}, {client.firstName} {client.middleName ? `${client.middleName.charAt(0)}.` : ''}
                                </h1>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                                    <span className="flex items-center">
                                        <IdentificationIcon className="w-4 h-4 mr-1" />
                                        Slot #{client.slotNo || '-'}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center">
                                        <UserGroupIcon className="w-4 h-4 mr-1" />
                                        {client.groupName || '-'}
                                    </span>
                                </div>
                                <div className="mt-2">
                                    <LoanStatusPill status={client.status} />
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
                                        ? 'border-primary-500 text-primary-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }
                                `}
                            >
                                <tab.icon className={`w-5 h-5 mr-2 ${activeTab === tab.id ? 'text-primary-500' : 'text-gray-400'}`} />
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
                                            {client.dateOfBirth ? moment(client.dateOfBirth).format('MMMM DD, YYYY') : '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Age</label>
                                        <p className="mt-1 text-sm text-gray-900">
                                            {client.dateOfBirth ? moment().diff(moment(client.dateOfBirth), 'years') : '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Gender</label>
                                        <p className="mt-1 text-sm text-gray-900">{client.gender || '-'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Civil Status</label>
                                        <p className="mt-1 text-sm text-gray-900">{client.civilStatus || '-'}</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase">Contact Number</label>
                                    <p className="mt-1 text-sm text-gray-900 flex items-center">
                                        <PhoneIcon className="w-4 h-4 mr-2 text-gray-400" />
                                        {client.contactNo || '-'}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase">Address</label>
                                    <p className="mt-1 text-sm text-gray-900 flex items-start">
                                        <MapPinIcon className="w-4 h-4 mr-2 text-gray-400 mt-0.5" />
                                        {client.address || '-'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Loan Information */}
                        <div className="bg-white rounded-lg border border-gray-200">
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex items-center">
                                    <CurrencyDollarIcon className="w-5 h-5 text-gray-400 mr-2" />
                                    <h3 className="text-lg font-semibold text-gray-900">Current Loan Information</h3>
                                </div>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Loan Cycle</label>
                                        <p className="mt-1 text-sm text-gray-900">{lastLoan?.loanCycle || '-'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Loan Terms</label>
                                        <p className="mt-1 text-sm text-gray-900">{lastLoan?.loanTerms || '-'} days</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Amount Release</label>
                                        <p className="mt-1 text-sm text-gray-900 font-semibold text-green-600">
                                            {formatPricePhp(lastLoan?.amountRelease || 0)}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Loan Balance</label>
                                        <p className="mt-1 text-sm text-gray-900 font-semibold">
                                            {formatPricePhp(lastLoan?.loanBalance || 0)}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">MCBU</label>
                                        <p className="mt-1 text-sm text-gray-900">{formatPricePhp(lastLoan?.mcbu || 0)}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase">Mispayments</label>
                                        <p className="mt-1 text-sm text-gray-900">{lastLoan?.mispayment || 0}</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase">Guarantor</label>
                                    <p className="mt-1 text-sm text-gray-900">{guarantorName || '-'}</p>
                                </div>
                            </div>
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
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    ACTIONS
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {loanList.map((loan, index) => (
                                                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {loan.dateGranted ? moment(loan.dateGranted).format('MMM DD, YYYY') : 
                                                         loan.dateOfRelease ? moment(loan.dateOfRelease).format('MMM DD, YYYY') : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {formatPricePhp(loan.amountRelease || 0)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {formatPricePhp(loan.loanBalance || 0)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <LoanStatusPill status={loan.status} />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {loan.loanCycle || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {loan.group?.name || loan.groupName || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {loan.pnNo || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {loan.mispayment || 0}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleViewPaymentHistory(loan)}
                                                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                                                            title="View Payment History"
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
                                <button
                                    onClick={handleZoomIn}
                                    className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                                >
                                    <MagnifyingGlassPlusIcon className="w-6 h-6" />
                                </button>
                                <button
                                    onClick={handleZoomOut}
                                    className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                                >
                                    <MagnifyingGlassMinusIcon className="w-6 h-6" />
                                </button>
                                <button
                                    onClick={handleCloseImagePreview}
                                    className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                                >
                                    <XMarkIcon className="w-6 h-6" />
                                </button>
                            </div>
                            <img
                                src={imageSrc}
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