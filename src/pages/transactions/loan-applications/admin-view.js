import React, { useEffect, useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { getApiBaseUrl } from "@/lib/constants";
import { formatPricePhp } from "@/lib/utils";
import moment from "moment";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import Dialog from "@/lib/ui/Dialog";
import ButtonOutline from "@/lib/ui/ButtonOutline";

const LoanApprovalsPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    
    const [loading, setLoading] = useState(true);
    const [loans, setLoans] = useState([]);
    const [selectedLoans, setSelectedLoans] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Filter states
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [selectedLO, setSelectedLO] = useState('all');
    const [selectedGroup, setSelectedGroup] = useState('all');
    const [selectedLoanType, setSelectedLoanType] = useState('all');
    
    // Summary statistics
    const [totalLoans, setTotalLoans] = useState(0);
    const [totalAmount, setTotalAmount] = useState(0);

    // Reject modal state
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectingLoan, setRejectingLoan] = useState(null);
    const [rejectReason, setRejectReason] = useState('');

    // Approve confirmation modal state
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [approvingLoan, setApprovingLoan] = useState(null);

    // Bulk approve confirmation modal state
    const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);

    // Check access control - only role.rep <= 3
    useEffect(() => {
        if (currentUser && currentUser.role && currentUser.role.rep > 3) {
            toast.error("You don't have permission to access this page");
            return;
        }

        if (currentUser && currentUser.role && currentDate) {
            fetchApprovedLoans();
        }
    }, [currentUser, currentDate]);

    // Fetch pending approval loans
    const fetchApprovedLoans = async () => {
        try {
            setLoading(true);
            
            const params = new URLSearchParams({
                currentDate: currentDate,
                currentUserId: currentUser._id,
                status: 'pending',
                pendingApproved: 'true'
            });

            const response = await fetchWrapper.get(
                getApiBaseUrl() + 'transactions/loans/list?' + params.toString()
            );

            if (response.success) {
                const filteredLoans = response.loans || [];
                
                // Transform loans for table display
                const transformedLoans = filteredLoans.map((loan) => {
                    const client = loan.client?.[0] || loan.client || {};
                    const group = loan.group || {};
                    const loanOfficer = loan.loanOfficer || {};
                    const branch = loan.branch?.[0] || {};
                    
                    return {
                        ...loan,
                        _id: loan._id,
                        slotNo: loan.slotNo || 'N/A',
                        clientName: client.fullName || loan.fullName || 'N/A',
                        dob: client.birthdate ? moment(client.birthdate).format('MMM DD, YYYY') : 'N/A',
                        groupName: group.name || loan.groupName || 'N/A',
                        loanCycle: loan.loanCycle || 1,
                        dateOfRelease: loan.dateOfRelease ? moment(loan.dateOfRelease).format('MMM DD, YYYY') : moment(currentDate).format('MMM DD, YYYY'),
                        principalLoan: loan.principalLoan || 0,
                        amountRelease: loan.amountRelease || 0,
                        designatedLO: loanOfficer.loNo ? `LO ${loanOfficer.loNo}` : 'N/A',
                        pnNumber: loan.pnNumber || 'N/A',
                        branchName: branch.name || loan.branchName || 'N/A',
                        branchCode: branch.code || 'N/A'
                    };
                });
                
                setLoans(transformedLoans);
                
                // Calculate totals (these will be recalculated with filtered data)
                const total = filteredLoans.length || 0;
                const amount = filteredLoans.reduce((sum, loan) => 
                    sum + (parseFloat(loan.amountRelease) || 0), 0) || 0;
                
                setTotalLoans(total);
                setTotalAmount(amount);
            } else {
                toast.error('Failed to fetch loan approvals');
            }
        } catch (error) {
            console.error('Error fetching pending approval loans:', error);
            toast.error('Error loading data');
        } finally {
            setLoading(false);
        }
    };

    // Get unique filter options
    const filterOptions = useMemo(() => {
        const branches = [...new Set(loans.map(loan => loan.branchName).filter(name => name !== 'N/A'))].sort();
        const loanOfficers = [...new Set(loans.map(loan => loan.designatedLO).filter(lo => lo !== 'N/A'))].sort();
        const groups = [...new Set(loans.map(loan => loan.groupName).filter(name => name !== 'N/A'))].sort();
        
        return {
            branches,
            loanOfficers,
            groups
        };
    }, [loans]);

    // Apply filters to loans
    const filteredLoans = useMemo(() => {
        let filtered = [...loans];

        // Filter by Branch
        if (selectedBranch !== 'all') {
            filtered = filtered.filter(loan => loan.branchName === selectedBranch);
        }

        // Filter by LO
        if (selectedLO !== 'all') {
            filtered = filtered.filter(loan => loan.designatedLO === selectedLO);
        }

        // Filter by Group
        if (selectedGroup !== 'all') {
            filtered = filtered.filter(loan => loan.groupName === selectedGroup);
        }

        // Filter by Loan Type
        if (selectedLoanType === 'new') {
            filtered = filtered.filter(loan => loan.loanCycle === 1);
        } else if (selectedLoanType === 'reloaner') {
            filtered = filtered.filter(loan => loan.loanCycle > 1);
        }

        return filtered;
    }, [loans, selectedBranch, selectedLO, selectedGroup, selectedLoanType]);

    // Update totals based on filtered loans
    useEffect(() => {
        const total = filteredLoans.length;
        const amount = filteredLoans.reduce((sum, loan) => 
            sum + (parseFloat(loan.amountRelease) || 0), 0);
        
        setTotalLoans(total);
        setTotalAmount(amount);
    }, [filteredLoans]);

    // Reset filters
    const handleResetFilters = () => {
        setSelectedBranch('all');
        setSelectedLO('all');
        setSelectedGroup('all');
        setSelectedLoanType('all');
    };

    // Handle select all checkbox
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedLoans(filteredLoans.map(loan => loan._id));
        } else {
            setSelectedLoans([]);
        }
    };

    // Handle individual checkbox
    const handleSelectLoan = (loanId) => {
        if (selectedLoans.includes(loanId)) {
            setSelectedLoans(selectedLoans.filter(id => id !== loanId));
        } else {
            setSelectedLoans([...selectedLoans, loanId]);
        }
    };

    // Handle bulk approve - show confirmation modal
    const handleBulkApprove = () => {
        if (selectedLoans.length === 0) {
            toast.warning('Please select at least one loan to approve');
            return;
        }
        setShowBulkApproveModal(true);
    };

    // Confirm bulk approve
    const confirmBulkApprove = async () => {
        try {
            setIsProcessing(true);
            setShowBulkApproveModal(false);

            // Get the full loan objects for selected IDs
            const selectedLoanObjects = loans.filter(loan => selectedLoans.includes(loan._id)).map(loan => {
                return { ...loan, status: "active" };
            });
            const params = { loanData: selectedLoanObjects, origin: "application", user: currentUser };
            const response = await fetchWrapper.post(
                getApiBaseUrl() + 'transactions/loans/approve-by-batch',
                params
            );

            if (response.success) {
                toast.success(`${selectedLoans.length} loan(s) approved successfully`);
                setSelectedLoans([]);
                await fetchApprovedLoans();
            } else {
                toast.error(response.message || 'Failed to approve loans');
            }

        } catch (error) {
            console.error('Error approving loans:', error);
            toast.error('Error approving loans');
        } finally {
            setIsProcessing(false);
        }
    };

    // Handle approve loan click - show confirmation modal
    const handleApproveLoan = (loan) => {
        setApprovingLoan(loan);
        setShowApproveModal(true);
    };

    // Confirm single approve
    const confirmApproveLoan = async () => {
        try {
            setIsProcessing(true);
            setShowApproveModal(false);

            const loanToApprove = { ...approvingLoan, status: "active" };
            const params = { loanData: [loanToApprove], origin: "application", user: currentUser };
            
            const response = await fetchWrapper.post(
                getApiBaseUrl() + 'transactions/loans/approve-by-batch',
                params
            );

            if (response.success) {
                toast.success('Loan approved successfully');
                setApprovingLoan(null);
                await fetchApprovedLoans();
            } else {
                toast.error(response.message || 'Failed to approve loan');
            }

        } catch (error) {
            console.error('Error approving loan:', error);
            toast.error('Error approving loan');
        } finally {
            setIsProcessing(false);
        }
    };

    // Handle reject click - show reject modal
    const handleRejectClick = (loan) => {
        setRejectingLoan(loan);
        setShowRejectModal(true);
    };

    // Handle reject confirm
    const handleRejectConfirm = async () => {
        if (!rejectReason.trim()) {
            toast.warning('Please provide a reason for rejection');
            return;
        }

        try {
            setIsProcessing(true);
            setShowRejectModal(false);

            const params = {
                loanId: rejectingLoan._id,
                rejectReason: rejectReason,
                rejectedBy: currentUser._id,
                rejectedDate: currentDate
            };

            const response = await fetchWrapper.post(
                getApiBaseUrl() + 'transactions/loans/reject',
                params
            );

            if (response.success) {
                toast.success('Loan rejected successfully');
                setRejectingLoan(null);
                setRejectReason('');
                await fetchApprovedLoans();
            } else {
                toast.error(response.message || 'Failed to reject loan');
            }

        } catch (error) {
            console.error('Error rejecting loan:', error);
            toast.error('Error rejecting loan');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Layout header={false}>
            <div className="p-6">
                {/* Page Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Loan Approvals</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        Review and approve pending loan applications
                    </p>
                </div>

                {/* Filter Section */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
                        <button
                            onClick={handleResetFilters}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Reset All
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Branch Filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Branch
                            </label>
                            <select
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">All Branches</option>
                                {filterOptions.branches.map(branch => (
                                    <option key={branch} value={branch}>
                                        {branch}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* LO Filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Loan Officer
                            </label>
                            <select
                                value={selectedLO}
                                onChange={(e) => setSelectedLO(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">All Loan Officers</option>
                                {filterOptions.loanOfficers.map(lo => (
                                    <option key={lo} value={lo}>
                                        {lo}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Group Filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Group
                            </label>
                            <select
                                value={selectedGroup}
                                onChange={(e) => setSelectedGroup(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">All Groups</option>
                                {filterOptions.groups.map(group => (
                                    <option key={group} value={group}>
                                        {group}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Loan Type Filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Loan Type
                            </label>
                            <select
                                value={selectedLoanType}
                                onChange={(e) => setSelectedLoanType(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">All</option>
                                <option value="new">New Member</option>
                                <option value="reloaner">Reloaner</option>
                            </select>
                        </div>
                    </div>

                    {/* Active Filters Display */}
                    {(selectedBranch !== 'all' || selectedLO !== 'all' || selectedGroup !== 'all' || selectedLoanType !== 'all') && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            <span className="text-sm text-gray-600">Active filters:</span>
                            {selectedBranch !== 'all' && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                                    Branch: {selectedBranch}
                                    <button
                                        onClick={() => setSelectedBranch('all')}
                                        className="ml-2 text-blue-600 hover:text-blue-800"
                                    >
                                        ×
                                    </button>
                                </span>
                            )}
                            {selectedLO !== 'all' && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                                    LO: {selectedLO}
                                    <button
                                        onClick={() => setSelectedLO('all')}
                                        className="ml-2 text-green-600 hover:text-green-800"
                                    >
                                        ×
                                    </button>
                                </span>
                            )}
                            {selectedGroup !== 'all' && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800">
                                    Group: {selectedGroup}
                                    <button
                                        onClick={() => setSelectedGroup('all')}
                                        className="ml-2 text-purple-600 hover:text-purple-800"
                                    >
                                        ×
                                    </button>
                                </span>
                            )}
                            {selectedLoanType !== 'all' && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800">
                                    Type: {selectedLoanType === 'new' ? 'New Member' : 'Reloaner'}
                                    <button
                                        onClick={() => setSelectedLoanType('all')}
                                        className="ml-2 text-yellow-600 hover:text-yellow-800"
                                    >
                                        ×
                                    </button>
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Summary Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Loans</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{totalLoans}</p>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-full">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Amount</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{formatPricePhp(totalAmount)}</p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-full">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bulk Actions */}
                {selectedLoans.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <span className="text-sm font-medium text-blue-900">
                                    {selectedLoans.length} loan(s) selected
                                </span>
                            </div>
                            <div className="w-36">
                                <ButtonSolid
                                    label="Approve Selected"
                                    onClick={handleBulkApprove}
                                    disabled={isProcessing}
                                    className="bg-green-600 hover:bg-green-700"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Loans Table */}
                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <Spinner />
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        {filteredLoans.length === 0 ? (
                            <div className="text-center py-12">
                                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <h3 className="mt-2 text-sm font-medium text-gray-900">No loans found</h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    {(selectedBranch !== 'all' || selectedLO !== 'all' || selectedGroup !== 'all' || selectedLoanType !== 'all') 
                                        ? 'No loans match the selected filters.'
                                        : 'No pending loan approvals at this time.'}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedLoans.length === filteredLoans.length && filteredLoans.length > 0}
                                                    onChange={handleSelectAll}
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Slot No
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Branch
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Client Name
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Date of Birth
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Group
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Loan Cycle
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Date of Release
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Principal
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Amount to Release
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Designated LO
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                PN Number
                                            </th>
                                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredLoans.map((loan) => (
                                            <tr key={loan._id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedLoans.includes(loan._id)}
                                                        onChange={() => handleSelectLoan(loan._id)}
                                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                    />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {loan.slotNo}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {loan.branchName}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {loan.clientName}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {loan.dob}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {loan.groupName}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                        loan.loanCycle === 1 
                                                            ? 'bg-green-100 text-green-800' 
                                                            : 'bg-blue-100 text-blue-800'
                                                    }`}>
                                                        {loan.loanCycle === 1 ? 'New' : `Cycle ${loan.loanCycle}`}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {loan.dateOfRelease}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {formatPricePhp(loan.principalLoan)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {formatPricePhp(loan.amountRelease)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {loan.designatedLO}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {loan.pnNumber}
                                                </td>
                                                {/* Actions */}
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <button
                                                            onClick={() => handleApproveLoan(loan)}
                                                            disabled={isProcessing}
                                                            className="text-green-600 hover:text-green-900 font-medium disabled:opacity-50"
                                                        >
                                                            Approve
                                                        </button>
                                                        <span className="text-gray-300">|</span>
                                                        <button
                                                            onClick={() => handleRejectClick(loan)}
                                                            disabled={isProcessing}
                                                            className="text-red-600 hover:text-red-900 font-medium disabled:opacity-50"
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Single Approve Confirmation Modal */}
            <Dialog show={showApproveModal}>
                <h2 className="text-lg font-semibold mb-4">Approve Loan</h2>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="sm:flex sm:items-start justify-center">
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center w-full">
                            {approvingLoan && (
                                <div className="mb-4 text-left">
                                    <p className="text-sm text-gray-600">
                                        <span className="font-semibold">Client:</span> {approvingLoan.clientName}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        <span className="font-semibold">Amount:</span> {formatPricePhp(approvingLoan.amountRelease)}
                                    </p>
                                </div>
                            )}
                            <p className="text-base text-gray-700">
                                Are you sure you want to approve this loan?
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-row justify-end text-center px-4 py-3 sm:px-6 sm:flex">
                    <div className='flex flex-row'>
                        <ButtonOutline 
                            label="Cancel" 
                            type="button" 
                            className="p-2 mr-3" 
                            onClick={() => {
                                setShowApproveModal(false);
                                setApprovingLoan(null);
                            }} 
                        />
                        <ButtonSolid 
                            label={isProcessing ? "Processing..." : "Approve"} 
                            type="button" 
                            className="p-2 mr-3 bg-green-600 hover:bg-green-700" 
                            onClick={confirmApproveLoan}
                            disabled={isProcessing}
                        />
                    </div>
                </div>
            </Dialog>

            {/* Bulk Approve Confirmation Modal */}
            <Dialog show={showBulkApproveModal}>
                <h2 className="text-lg font-semibold mb-4">Approve Multiple Loans</h2>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="sm:flex sm:items-start justify-center">
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center w-full">
                            <p className="text-base text-gray-700">
                                Are you sure you want to approve <span className="font-semibold">{selectedLoans.length}</span> loan(s)?
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-row justify-end text-center px-4 py-3 sm:px-6 sm:flex">
                    <div className='flex flex-row'>
                        <ButtonOutline 
                            label="Cancel" 
                            type="button" 
                            className="p-2 mr-3" 
                            onClick={() => setShowBulkApproveModal(false)} 
                        />
                        <ButtonSolid 
                            label={isProcessing ? "Processing..." : "Approve"} 
                            type="button" 
                            className="p-2 mr-3 bg-green-600 hover:bg-green-700" 
                            onClick={confirmBulkApprove}
                            disabled={isProcessing}
                        />
                    </div>
                </div>
            </Dialog>

            {/* Reject Modal */}
            <Dialog show={showRejectModal}>
                <h2 className="text-lg font-semibold mb-4">Reject Loan</h2>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="sm:flex sm:items-start justify-center">
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center w-full">
                            {rejectingLoan && (
                                <div className="mb-4 text-left">
                                    <p className="text-sm text-gray-600">
                                        <span className="font-semibold">Client:</span> {rejectingLoan.clientName}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        <span className="font-semibold">Amount:</span> {formatPricePhp(rejectingLoan.amountRelease)}
                                    </p>
                                </div>
                            )}
                            <div className="mt-2">
                                <label className="block text-sm font-medium text-gray-700 text-left mb-2">
                                    Reject Reason <span className="text-red-500">*</span>
                                </label>
                                <textarea 
                                    rows="4" 
                                    value={rejectReason} 
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    className="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border 
                                                border-gray-300 focus:ring-blue-500 focus:border-blue-500" 
                                    placeholder="Enter reason for rejection..."
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-row justify-end text-center px-4 py-3 sm:px-6 sm:flex">
                    <div className='flex flex-row'>
                        <ButtonOutline 
                            label="Cancel" 
                            type="button" 
                            className="p-2 mr-3" 
                            onClick={() => {
                                setShowRejectModal(false);
                                setRejectingLoan(null);
                                setRejectReason('');
                            }} 
                        />
                        <ButtonSolid 
                            label={isProcessing ? "Processing..." : "Reject"} 
                            type="button" 
                            className="p-2 mr-3 bg-red-600 hover:bg-red-700" 
                            onClick={handleRejectConfirm}
                            disabled={isProcessing}
                        />
                    </div>
                </div>
            </Dialog>
        </Layout>
    );
};

export default LoanApprovalsPage;