// src/components/transactions/loan-application/LoanFormPanel.js
// FIX: Added fromCI prop — when true, don't force loanCycle=1 for clientType='pending'
// because fromCI 'pending' = Pending Member (existing client), not Prospect

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { UserIcon, CreditCardIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

import InputText    from '@/lib/ui/InputText';
import InputNumber  from '@/lib/ui/InputNumber';
import SelectDropdownV2 from '@/lib/ui/selectv2';
import DatePicker2  from '@/lib/ui/DatePicker2';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import moment from 'moment';

import SectionCard from './SectionCard';

const LoanFormPanel = ({
    values,
    touched,
    errors,
    handleChange,
    setFieldValue,
    setFieldTouched,
    currentDate,
    initialDateRelease,
    minDate,
    maxDate,
    onDateChange,
    loanTerms,
    setLoanTerms,
    groupOccurence,
    groupLeader,
    weeklyScheduleType = 'standard',
    clientId,
    clientType,
    selectedClientObj,
    offsetClient,
    onPNFocus,
    onPNBlur,
    branchId,
    clientFlowVersionV2  = false,
    onBack,
    loading,
    coMakerChecking = false,
    isSubmitting,
    isValidating,
    guarantorPhotoPreview   = null,
    guarantorIdPhotoPreview = null,
    onGuarantorPhotoChange  = null,
    onGuarantorIdChange     = null,
    isEdit = false,
    fromCI = false,
}) => {
    const ciAutoFilled = !!(selectedClientObj?.ciName || offsetClient?.ciName);

    const [guarantorWarning,  setGuarantorWarning]  = useState(null);
    const [guarantorChecking, setGuarantorChecking] = useState(false);
    const checkTimerRef = useRef(null);

    useEffect(() => {
        if (!isEdit || !values.dateOfRelease || !initialDateRelease) return;
        console.log('useEffect', moment(values.dateOfRelease).isBefore(currentDate, 'day'))
        if (moment(values.dateOfRelease).isBefore(currentDate, 'day')) {
            setFieldValue('dateOfRelease', initialDateRelease);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEdit, initialDateRelease, currentDate]);

    // Weekly loan terms are derived server-side from weeklyScheduleType
    // (see handleSaveUpdate in AddLoanPage — it computes weeklyTermDays
    // directly from loWeeklyScheduleType, ignoring values.loanTerms).
    // So for weekly groups this is display-only, not a real choice.
    useEffect(() => {
        if (isEdit) return;
        if (groupOccurence === 'weekly') {
            setLoanTerms(weeklyScheduleType === 'accelerated' ? 12 : 24);
        } else if (groupOccurence === 'daily') {
            setLoanTerms(60);
        }
    }, [groupOccurence, weeklyScheduleType, setLoanTerms]);

    const scheduleGuarantorCheck = useCallback(() => {
        if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
        checkTimerRef.current = setTimeout(async () => {
            const firstName = values.guarantorFirstName?.trim();
            const lastName  = values.guarantorLastName?.trim();
            if (!firstName || !lastName || !branchId) return;
            setGuarantorChecking(true);
            try {
                const res = await fetchWrapper.get(
                    getApiBaseUrl() + 'transactions/loans/check-guarantor?' +
                    new URLSearchParams({
                        branchId,
                        guarantorFirstName: firstName,
                        guarantorLastName:  lastName,
                        ...(clientId ? { clientId } : {}),
                    })
                );
                if (res.success) setGuarantorWarning(res.count > 0 ? res : null);
            } catch (e) { console.error(e); }
            finally { setGuarantorChecking(false); }
        }, 50);
    }, [values.guarantorFirstName, values.guarantorLastName, branchId, clientId]);

    const handleGuarantorBlur          = scheduleGuarantorCheck;
    const handleGuarantorFirstNameBlur = scheduleGuarantorCheck;

    return (
        <div className="flex flex-col gap-5">
            {/* Date of release */}
            {initialDateRelease && minDate && maxDate && (
                <SectionCard icon={CreditCardIcon} title="Date of release">
                    <DatePicker2
                        name="dateOfRelease"
                        value={
                            values.dateOfRelease && !moment(values.dateOfRelease).isBefore(currentDate, 'day')
                                ? values.dateOfRelease
                                : initialDateRelease
                        }
                        onChange={onDateChange}
                        minDate={minDate}
                        maxDate={maxDate}
                    />
                </SectionCard>
            )}

            {/* Loan details */}
            <SectionCard icon={CreditCardIcon} title="Loan details">
                <div className="grid grid-cols-2 gap-4">
                    <InputNumber
                        name="principalLoan"
                        value={values.principalLoan}
                        onChange={handleChange}
                        label="Principal Loan P (Required)"
                        placeholder="5000"
                        setFieldValue={setFieldValue}
                        errors={touched.principalLoan && errors.principalLoan ? errors.principalLoan : undefined}
                    />
                    {groupOccurence === 'weekly' ? (
                        <div>
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                                Loan Terms
                            </label>
                            <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                                bg-gray-50 text-gray-700 flex items-center justify-between">
                                <span>
                                    {loanTerms} weeks
                                    ({weeklyScheduleType === 'accelerated' ? 'Accelerated' : 'Standard'})
                                </span>
                            </div>
                        </div>
                    ) : (
                        <SelectDropdownV2
                            name="loanTerms" field="loanTerms"
                            value={loanTerms}
                            label="Loan Terms"
                            options={[
                                { value: 60,  label: '60 days'  },
                                { value: 75,  label: '75 days'  },
                                { value: 100, label: '100 days' },
                            ]}
                            onChange={(_, v) => setLoanTerms(parseInt(v))}
                            onBlur={setFieldTouched}
                            placeholder="Select Terms"
                        />
                    )}
                </div>

                {/* Loan Cycle removed — displayed as read-only in SlotCycleCard (SelectClientPanel) */}
                {(groupOccurence === 'weekly' || groupLeader) && (
                    <div className="mt-4">
                        <InputNumber
                            name="mcbu"
                            value={values.mcbu}
                            onChange={handleChange}
                            label="MCBU"
                            placeholder="0"
                            setFieldValue={setFieldValue}
                            errors={touched.mcbu && errors.mcbu ? errors.mcbu : undefined}
                        />
                    </div>
                )}

                <div className="mt-4">
                    <InputText
                        name="pnNumber"
                        value={values.pnNumber}
                        onChange={handleChange}
                        onBlur={onPNBlur}
                        onFocus={onPNFocus}
                        label="Promissory Note Number"
                        placeholder="Enter PN Number"
                        setFieldValue={setFieldValue}
                        errors={touched.pnNumber && errors.pnNumber ? errors.pnNumber : undefined}
                    />
                </div>
            </SectionCard>

            {/* Guarantor */}
            <SectionCard icon={UserIcon} title="Guarantor">
                <div className="grid grid-cols-2 gap-4">
                    <InputText
                        name="guarantorFirstName"
                        value={values.guarantorFirstName}
                        onChange={e => { handleChange(e); setGuarantorWarning(null); }}
                        onBlur={handleGuarantorFirstNameBlur}
                        label="First Name (Required)"
                        placeholder="First name"
                        setFieldValue={setFieldValue}
                        errors={touched.guarantorFirstName && errors.guarantorFirstName
                            ? errors.guarantorFirstName : undefined}
                    />
                    <InputText
                        name="guarantorLastName"
                        value={values.guarantorLastName}
                        onChange={e => { handleChange(e); setGuarantorWarning(null); }}
                        onBlur={handleGuarantorBlur}
                        label="Last Name (Required)"
                        placeholder="Last name"
                        setFieldValue={setFieldValue}
                        errors={touched.guarantorLastName && errors.guarantorLastName
                            ? errors.guarantorLastName : undefined}
                    />
                </div>
                <div className="mt-4">
                    <InputText
                        name="guarantorMiddleName"
                        value={values.guarantorMiddleName}
                        onChange={handleChange}
                        label="Middle Name"
                        placeholder="Middle name"
                        setFieldValue={setFieldValue}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                    <InputText
                        name="guarantorBirthDate"
                        value={values.guarantorBirthDate || ''}
                        onChange={handleChange}
                        label="Birthdate"
                        placeholder="YYYY-MM-DD"
                        setFieldValue={setFieldValue}
                        type="date"
                    />
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                            Civil Status
                        </label>
                        <select
                            name="guarantorCivilStatus"
                            value={values.guarantorCivilStatus || ''}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Select...</option>
                            <option value="Single">Single</option>
                            <option value="Married">Married</option>
                            <option value="Widowed">Widowed</option>
                            <option value="Separated">Separated</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                    <InputText
                        name="guarantorBusiness"
                        value={values.guarantorBusiness || ''}
                        onChange={handleChange}
                        label="Business / Work"
                        placeholder="e.g. Sari-sari store"
                        setFieldValue={setFieldValue}
                    />
                    <InputText
                        name="guarantorDailyIncome"
                        value={values.guarantorDailyIncome || ''}
                        onChange={handleChange}
                        label="Daily Income (₱)"
                        placeholder="e.g. 500"
                        setFieldValue={setFieldValue}
                    />
                </div>
                <div className="mt-4">
                    <InputText
                        name="guarantorAddress"
                        value={values.guarantorAddress || ''}
                        onChange={handleChange}
                        label="Guarantor Address"
                        placeholder="Complete address"
                        setFieldValue={setFieldValue}
                    />
                </div>

                {guarantorChecking && (
                    <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                        Checking guarantor...
                    </p>
                )}

                {!guarantorChecking && guarantorWarning && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <p className="text-xs font-semibold text-amber-800 mb-1">
                            Warning: Guarantor already on {guarantorWarning.count} active/pending
                            loan{guarantorWarning.count !== 1 ? 's' : ''} in this branch
                        </p>
                        <p className="text-xs text-amber-700 mb-2">
                            This loan will be flagged for admin review and blocked from LDF
                            approval until cleared.
                        </p>
                        <div className="space-y-1">
                            {guarantorWarning.loans.slice(0, 3).map(l => (
                                <p key={l._id} className="text-xs text-amber-600">
                                    • {l.clientFullName} — {l.groupName} Slot {l.slotNo}
                                    {l.pnNumber ? ` · ${l.pnNumber}` : ''}
                                    <span className={`ml-1 px-1 py-0.5 rounded text-xs font-medium ${
                                        l.status === 'active'
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-yellow-100 text-yellow-700'
                                    }`}>{l.status}</span>
                                </p>
                            ))}
                            {guarantorWarning.loans.length > 3 && (
                                <p className="text-xs text-amber-500">
                                    ...and {guarantorWarning.loans.length - 3} more
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {clientFlowVersionV2 && onGuarantorPhotoChange && (
                    <div className="mt-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            Guarantor Photo <span className="text-red-500">*</span>
                        </p>
                        <label className="block cursor-pointer">
                            <input type="file" accept="image/*" className="hidden" onChange={onGuarantorPhotoChange} />
                            {guarantorPhotoPreview ? (
                                <div className="relative">
                                    <img src={guarantorPhotoPreview} alt="Guarantor"
                                        className="w-full max-h-40 object-contain rounded-xl border border-gray-200 bg-gray-50" />
                                    <span className="absolute bottom-2 right-2 text-xs bg-black bg-opacity-50 text-white px-2 py-0.5 rounded">
                                        Click to change
                                    </span>
                                </div>
                            ) : (
                                <div className="w-full h-24 border-2 border-dashed border-gray-200 rounded-xl
                                    flex items-center justify-center gap-2 text-gray-400
                                    hover:border-blue-300 hover:text-blue-500 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span className="text-xs">Upload guarantor photo</span>
                                </div>
                            )}
                        </label>
                    </div>
                )}

                {/* Read-only fallback: non-v2 branch, but a photo exists on the record (e.g. legacy/migrated) */}
                {!clientFlowVersionV2 && guarantorPhotoPreview && (
                    <div className="mt-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            Guarantor Photo
                        </p>
                        <img src={guarantorPhotoPreview} alt="Guarantor"
                            className="w-full max-h-40 object-contain rounded-xl border border-gray-200 bg-gray-50" />
                    </div>
                )}

                {clientFlowVersionV2 && onGuarantorIdChange && (
                    <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            Guarantor Valid ID <span className="text-red-500">*</span>
                        </p>
                        <label className="block cursor-pointer">
                            <input type="file" accept="image/*" className="hidden" onChange={onGuarantorIdChange} />
                            {guarantorIdPhotoPreview ? (
                                <div className="relative">
                                    <img src={guarantorIdPhotoPreview} alt="Guarantor ID"
                                        className="w-full max-h-36 object-contain rounded-xl border border-gray-200 bg-gray-50" />
                                    <span className="absolute bottom-2 right-2 text-xs bg-black bg-opacity-50 text-white px-2 py-0.5 rounded">
                                        Click to change
                                    </span>
                                </div>
                            ) : (
                                <div className="w-full h-20 border-2 border-dashed border-gray-200 rounded-xl
                                    flex items-center justify-center gap-2 text-gray-400
                                    hover:border-blue-300 hover:text-blue-500 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                            d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
                                    </svg>
                                    <span className="text-xs">Upload guarantor ID</span>
                                </div>
                            )}
                        </label>
                    </div>
                )}

                {!clientFlowVersionV2 && guarantorIdPhotoPreview && (
                    <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            Guarantor Valid ID
                        </p>
                        <img src={guarantorIdPhotoPreview} alt="Guarantor ID"
                            className="w-full max-h-36 object-contain rounded-xl border border-gray-200 bg-gray-50" />
                    </div>
                )}
            </SectionCard>

            {/* CI Information */}
            <SectionCard icon={ShieldCheckIcon} title="CI Information" subtitle="Credit investigator name">
                <InputText
                    name="ciName"
                    value={values.ciName}
                    onChange={handleChange}
                    label="CI Name (Required)"
                    placeholder="Enter CI Name"
                    setFieldValue={setFieldValue}
                    disabled={clientFlowVersionV2 && ciAutoFilled && values.ciName != ''}
                    errors={touched.ciName && errors.ciName ? errors.ciName : undefined}
                />
                {clientFlowVersionV2 && ciAutoFilled && values.ciName != '' && (
                    <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                        <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd" />
                        </svg>
                        Auto-filled from client record
                    </p>
                )}
            </SectionCard>

            {/* Actions */}
            <div className="flex gap-3">
                <button type="button" onClick={onBack}
                    className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-medium
                        text-gray-700 hover:bg-gray-50 transition-colors">
                    Cancel
                </button>
                <button type="submit"
                    disabled={(isSubmitting && isValidating) || loading || coMakerChecking || guarantorChecking}
                    className="flex-1 py-3 rounded-xl bg-teal-600 text-white text-sm font-medium
                        hover:bg-teal-700 disabled:opacity-50 transition-colors">
                    {(coMakerChecking || guarantorChecking) ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                            Validating...
                        </span>
                    ) : loading ? 'Saving...' : 'Save Loan Application'}
                </button>
            </div>
        </div>
    );
};

export default LoanFormPanel;