import React, { useState, useRef, useCallback } from 'react';
import { UserIcon, CreditCardIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

import InputText from '@/lib/ui/InputText';
import InputNumber from '@/lib/ui/InputNumber';
import SelectDropdown from '@/lib/ui/select';
import DatePicker2 from '@/lib/ui/DatePicker2';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';

import SectionCard from './SectionCard';

/**
 * LoanFormPanel - right column
 * Contains: Date of release, Loan details, Guarantor (with soft duplicate warning), CI Information, Actions
 */
const LoanFormPanel = ({
    values,
    touched,
    errors,
    handleChange,
    setFieldValue,
    setFieldTouched,
    // date picker
    initialDateRelease,
    minDate,
    maxDate,
    onDateChange,
    // loan terms
    loanTerms,
    setLoanTerms,
    // flags
    groupOccurence,
    groupLeader,
    clientType,
    selectedClientObj,
    offsetClient,
    // PN handlers
    onPNFocus,
    onPNBlur,
    // guarantor check
    branchId,
    // actions
    onBack,
    loading,
    coMakerChecking = false,
    isSubmitting,
    isValidating,
}) => {
    const ciAutoFilled = !!(selectedClientObj?.ciName || offsetClient?.ciName);

    // Guarantor duplicate soft warning state
    const [guarantorWarning, setGuarantorWarning]   = useState(null);
    const [guarantorChecking, setGuarantorChecking] = useState(false);
    const checkTimerRef = useRef(null);

    // Single debounced check — called from both field blurs.
    // Uses a 50ms debounce so if both fields blur in sequence
    // (tab from firstName to lastName then out), only one API call fires.
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
                    new URLSearchParams({ branchId, guarantorFirstName: firstName, guarantorLastName: lastName })
                );
                if (res.success) {
                    setGuarantorWarning(res.count > 0 ? res : null);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setGuarantorChecking(false);
            }
        }, 50);
    }, [values.guarantorFirstName, values.guarantorLastName, branchId]);

    // Both fields share the same handler
    const handleGuarantorBlur          = scheduleGuarantorCheck;
    const handleGuarantorFirstNameBlur = scheduleGuarantorCheck;

    return (
        <div className="flex flex-col gap-5">

            {/* Date of release */}
            {initialDateRelease && minDate && maxDate && (
                <SectionCard icon={CreditCardIcon} title="Date of release">
                    <DatePicker2
                        name="dateOfRelease"
                        value={initialDateRelease}
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
                    <SelectDropdown
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
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                    <InputNumber
                        name="loanCycle"
                        value={(clientType === 'pending' || clientType === 'offset') ? 1 : values.loanCycle}
                        onChange={handleChange}
                        label="Loan Cycle (Required)"
                        placeholder="1"
                        setFieldValue={setFieldValue}
                        disabled={clientType === 'pending' || clientType === 'offset'}
                        errors={touched.loanCycle && errors.loanCycle ? errors.loanCycle : undefined}
                    />
                    {(groupOccurence === 'weekly' || groupLeader) && (
                        <InputNumber
                            name="mcbu"
                            value={values.mcbu}
                            onChange={handleChange}
                            label="MCBU"
                            placeholder="0"
                            setFieldValue={setFieldValue}
                            errors={touched.mcbu && errors.mcbu ? errors.mcbu : undefined}
                        />
                    )}
                </div>

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
                        onChange={e => {
                            handleChange(e);
                            // Clear warning when name changes
                            setGuarantorWarning(null);
                        }}
                        onBlur={handleGuarantorFirstNameBlur}
                        label="First Name (Required)"
                        placeholder="First name"
                        setFieldValue={setFieldValue}
                        errors={touched.guarantorFirstName && errors.guarantorFirstName ? errors.guarantorFirstName : undefined}
                    />
                    <InputText
                        name="guarantorLastName"
                        value={values.guarantorLastName}
                        onChange={e => {
                            handleChange(e);
                            setGuarantorWarning(null);
                        }}
                        onBlur={handleGuarantorBlur}
                        label="Last Name (Required)"
                        placeholder="Last name"
                        setFieldValue={setFieldValue}
                        errors={touched.guarantorLastName && errors.guarantorLastName ? errors.guarantorLastName : undefined}
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

                {/* Soft duplicate warning */}
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
                            Warning: Guarantor already on {guarantorWarning.count} active/pending loan{guarantorWarning.count !== 1 ? 's' : ''} in this branch
                        </p>
                        <p className="text-xs text-amber-700 mb-2">
                            This loan will be flagged for admin review and blocked from LDF approval until cleared.
                        </p>
                        <div className="space-y-1">
                            {guarantorWarning.loans.slice(0, 3).map(l => (
                                <p key={l._id} className="text-xs text-amber-600">
                                    • {l.clientFullName} — {l.groupName} Slot {l.slotNo}
                                    {l.pnNumber ? ` · ${l.pnNumber}` : ''}
                                    <span className={`ml-1 px-1 py-0.5 rounded text-xs font-medium ${
                                        l.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                    }`}>{l.status}</span>
                                </p>
                            ))}
                            {guarantorWarning.loans.length > 3 && (
                                <p className="text-xs text-amber-500">...and {guarantorWarning.loans.length - 3} more</p>
                            )}
                        </div>
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
                    disabled={ciAutoFilled}
                    errors={touched.ciName && errors.ciName ? errors.ciName : undefined}
                />
                {ciAutoFilled && (
                    <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                        <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Auto-filled from client record
                    </p>
                )}
            </SectionCard>

            {/* Actions */}
            <div className="flex gap-3">
                <button
                    type="button" onClick={onBack}
                    className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={(isSubmitting && isValidating) || loading || coMakerChecking || guarantorChecking}
                    className="flex-1 py-3 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
                >
                    {(coMakerChecking || guarantorChecking)
                        ? <span className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                            Validating...
                          </span>
                        : loading ? 'Saving...' : 'Save Loan Application'
                    }
                </button>
            </div>
        </div>
    );
};

export default LoanFormPanel;