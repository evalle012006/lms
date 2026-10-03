// src/components/clients/LafCiHistoryTab.js
// "LAF / CI History" tab inside ClientDetailPage.
// Self-fetching, same pattern as ClientProgramsTab.js — receives `client`,
// pulls its own data via /api/v2/clients/laf-ci-history.

import React, { useState, useEffect } from 'react';
import moment from 'moment';
import { IdentificationIcon } from '@heroicons/react/24/outline';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import Spinner from '../Spinner';

const STATUS_STYLES = {
    pending:            'bg-gray-100 text-gray-600',
    pending_validation: 'bg-yellow-100 text-yellow-800',
    ci_approved:        'bg-blue-100 text-blue-800',
    ci_declined:        'bg-red-100 text-red-800',
    promoted:           'bg-green-100 text-green-800',
};

const STATUS_LABELS = {
    pending:            'Pending CI',
    pending_validation: 'Pending Admin Validation',
    ci_approved:        'CI Approved',
    ci_declined:        'CI Declined',
    promoted:           'Promoted',
};

const DECISION_STYLES = {
    approved: 'bg-green-100 text-green-800',
    declined: 'bg-red-100 text-red-800',
};

function StatusBadge({ status }) {
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABELS[status] || status || '-'}
        </span>
    );
}

function DecisionBadge({ decision }) {
    if (!decision) return <span className="text-gray-400 text-sm">-</span>;
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${DECISION_STYLES[decision] || 'bg-gray-100 text-gray-600'}`}>
            {decision}
        </span>
    );
}

const LafCiHistoryTab = ({ client }) => {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading]           = useState(false);

    useEffect(() => {
        if (client?._id) {
            fetchHistory();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client?._id]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const url = getApiBaseUrl() + 'clients/laf-ci-history?clientId=' + client._id;
            const response = await fetchWrapper.get(url);
            setApplications(response.success ? (response.applications || []) : []);
        } catch (error) {
            console.error('Error fetching LAF/CI history:', error);
            setApplications([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <IdentificationIcon className="w-5 h-5 text-gray-400 mr-2" />
                        <h3 className="text-lg font-semibold text-gray-900">LAF / CI History</h3>
                    </div>
                    <span className="text-sm text-gray-500">{applications.length} application(s)</span>
                </div>
            </div>
            <div className="p-6">
                {loading ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                ) : applications.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CI Reference Code</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Submitted</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CI Decision</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {applications.map((app, i) => (
                                    <tr key={app._id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {app.ciReferenceCode || '-'}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {app.submittedAt ? moment(app.submittedAt).format('MMM DD, YYYY') : '-'}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <StatusBadge status={app.status} />
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <DecisionBadge decision={app.decision} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <IdentificationIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No LAF / CI history</h3>
                        <p className="text-gray-500">This client has no loan applications on record.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LafCiHistoryTab;