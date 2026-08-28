// src/components/transactions/loan-application/SelectClientPanel.js
// FIX 1: Remove "Fixed" badge from slot read-only display
// FIX 2: loanCycle now reads from loanCycle prop (values.loanCycle from Formik)
// FIX 3: Co-maker — if previous co-maker exists in group, show read-only display;
//         otherwise show dropdown to select

import React, { useState } from 'react';
import {
    UserIcon, UsersIcon, CreditCardIcon,
} from '@heroicons/react/24/outline';

import SelectDropdownV2 from '@/lib/ui/selectv2';
import { UppercaseFirstLetter } from '@/lib/utils';

import SectionCard from './SectionCard';
import ClientList from './ClientList';
import OffsetClientTable from './OffsetClientTable';

const ReadOnlyField = ({ label, value }) => (
    <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-sm font-medium text-gray-800">{value || '—'}</p>
    </div>
);

const CLIENT_TYPES = [
    { value: 'pending', label: 'Prospect Clients' },
    { value: 'advance', label: 'Reloan Clients'   },
    { value: 'active',  label: 'Pending Clients'  },
    { value: 'offset',  label: 'Balik Clients'    },
];

const SelectClientPanel = ({
    rep,
    currentUser,
    branchList,
    loList,
    loListLoading,
    groupList,
    clientList,
    comakerList,
    selectedLo,
    selectedGroup,
    clientId,
    clientType,
    initialClientType,
    offsetClient,
    selectedClientObj,
    selectedOldBranch,
    selectedOldLO,
    selectedOldGroup,
    oldLOList,
    oldGroupList,
    slotNo,
    slotReadOnly,
    slotNumber,
    loanCycle,
    selectedCoMaker,
    coMakerReadOnly,        // FIX 3: true when prev co-maker found in group
    coMakerReadOnlyLabel,   // FIX 3: display label for read-only co-maker
    loStatus,
    handleLoIdChange,
    handleGroupIdChange,
    handleClientIdChange,
    handleClientTypeChange,
    handleSlotNoChange,
    handleCoMakerChange,
    handleOldBranchIdChange,
    handleOldLoIdChange,
    handleOldGroupIdChange,
    handleOffsetClientSelect,
    onClearClient,
    touched,
    errors,
    setFieldTouched,
    isEditMode,
    coMakerChecking,
    coMakerPending,
    coMakerPendingName,
    onCoMakerPendingChange,
    onCoMakerPendingNameChange,
    fromCI = false,
    initialLoName = null,
    initialGroupName = null,
}) => {

    if (selectedClientObj && clientType !== 'offset') {
        return (
            <div className="flex flex-col gap-5">
                {/* LO + Group — read-only when fromCI, locked in edit mode */}
                {rep === 3 && (
                    fromCI ? (
                        <SectionCard icon={UserIcon} title="Loan Officer &amp; Group"
                            subtitle="Pre-filled from LAF application — read only">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                    <span className="text-sm text-gray-500 font-medium">Loan Officer</span>
                                    <span className="text-sm text-gray-900 font-semibold">
                                        {initialLoName
                                            || loList.find(l => l._id === selectedLo)?.label
                                            || '—'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-sm text-gray-500 font-medium">Group</span>
                                    <span className="text-sm text-gray-900 font-semibold">
                                        {initialGroupName
                                            || (Array.isArray(groupList) ? groupList : [])
                                                .find(g => g._id === selectedGroup)?.name
                                            || '—'}
                                    </span>
                                </div>
                            </div>
                        </SectionCard>
                    ) : (
                        <SectionCard icon={UserIcon} title="Loan Officer &amp; Group">
                            <SelectDropdownV2
                                name="loId" field="loId" value={selectedLo}
                                label="Loan Officer (Required)" options={loList}
                                onChange={handleLoIdChange} onBlur={setFieldTouched}
                                placeholder={loListLoading ? 'Loading...' : 'Select Loan Officer'}
                                disabled={loListLoading || isEditMode}
                                errors={touched.loId && errors.loId ? errors.loId : undefined}
                            />
                            <div className="mt-4">
                                <SelectDropdownV2
                                    name="groupId" field="groupId" value={selectedGroup}
                                    label="Group (Required)"
                                    options={Array.isArray(groupList) ? groupList : []}
                                    onChange={handleGroupIdChange} onBlur={setFieldTouched}
                                    placeholder="Select Group"
                                    disabled={isEditMode}
                                    errors={touched.groupId && errors.groupId ? errors.groupId : undefined}
                                />
                            </div>
                        </SectionCard>
                    )
                )}
                {rep === 4 && !fromCI && (
                    <SectionCard icon={UsersIcon} title="Group">
                        <SelectDropdownV2
                            name="groupId" field="groupId" value={selectedGroup}
                            label="Group (Required)"
                            options={Array.isArray(groupList) ? groupList : []}
                            onChange={handleGroupIdChange} onBlur={setFieldTouched}
                            placeholder="Select Group"
                            disabled={isEditMode}
                            errors={touched.groupId && errors.groupId ? errors.groupId : undefined}
                        />
                    </SectionCard>
                )}

                <SectionCard icon={UsersIcon} title="Selected client" subtitle="Read only — from client record">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-teal-100 border border-teal-200">
                            {selectedClientObj.resolvedPhotoUrl ? (
                                <img src={selectedClientObj.resolvedPhotoUrl}
                                    alt={selectedClientObj.firstName}
                                    className="object-cover w-full h-full" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-sm font-bold text-teal-700">
                                    {selectedClientObj.firstName?.[0]}{selectedClientObj.lastName?.[0]}
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">
                                {UppercaseFirstLetter(`${selectedClientObj.lastName}, ${selectedClientObj.firstName} ${selectedClientObj.middleName || ''}`)}
                            </p>
                            <p className="text-xs text-gray-400">{selectedClientObj.contactNumber}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <ReadOnlyField label="Group" value={selectedClientObj.groupName} />
                        <ReadOnlyField label="Birthdate" value={selectedClientObj.birthdate} />
                        <ReadOnlyField label="CI Name" value={selectedClientObj.ciName} />
                        <ReadOnlyField label="Contact" value={selectedClientObj.contactNumber} />
                    </div>
                    <ReadOnlyField label="Address" value={selectedClientObj.address} />
                    {(!isEditMode && !fromCI) && (
                        <button type="button" onClick={onClearClient}
                            className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline">
                            ← Choose a different client
                        </button>
                    )}
                </SectionCard>

                <SlotCycleCard
                    clientType={clientType} slotNo={slotNo} slotNumber={slotNumber}
                    loanCycle={loanCycle} initialClientType={initialClientType}
                    slotReadOnly={slotReadOnly}
                    selectedCoMaker={selectedCoMaker} comakerList={comakerList}
                    coMakerReadOnly={coMakerReadOnly}
                    coMakerReadOnlyLabel={coMakerReadOnlyLabel}
                    loStatus={loStatus} coMakerChecking={coMakerChecking}
                    coMakerPending={coMakerPending} coMakerPendingName={coMakerPendingName}
                    onCoMakerPendingChange={onCoMakerPendingChange}
                    onCoMakerPendingNameChange={onCoMakerPendingNameChange}
                    handleSlotNoChange={handleSlotNoChange}
                    handleCoMakerChange={handleCoMakerChange}
                    touched={touched} errors={errors} setFieldTouched={setFieldTouched}
                />
            </div>
        );
    }

    if (offsetClient) {
        return (
            <div className="flex flex-col gap-5">
                {rep === 3 && (
                    <SectionCard icon={UserIcon} title="Loan Officer &amp; Group">
                        <SelectDropdownV2
                            name="loId" field="loId" value={selectedLo}
                            label="Loan Officer (Required)" options={loList}
                            onChange={handleLoIdChange} onBlur={setFieldTouched}
                            placeholder={loListLoading ? 'Loading...' : 'Select Loan Officer'}
                            disabled={loListLoading}
                        />
                        <div className="mt-4">
                            <SelectDropdownV2
                                name="groupId" field="groupId" value={selectedGroup}
                                label="Group (Required)"
                                options={Array.isArray(groupList) ? groupList : []}
                                onChange={handleGroupIdChange} onBlur={setFieldTouched}
                                placeholder="Select Group"
                            />
                        </div>
                    </SectionCard>
                )}
                <SectionCard icon={UsersIcon} title="Selected Balik client">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-700 flex-shrink-0">
                            {offsetClient.firstName?.[0]}{offsetClient.lastName?.[0]}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">
                                {UppercaseFirstLetter(`${offsetClient.lastName}, ${offsetClient.firstName}`)}
                            </p>
                            <p className="text-xs text-gray-400">Balik Client · {offsetClient.groupName}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <ReadOnlyField label="CI Name" value={offsetClient.ciName} />
                        <ReadOnlyField label="Contact" value={offsetClient.contactNumber} />
                    </div>
                    {!isEditMode && (
                        <button type="button" onClick={onClearClient}
                            className="text-xs text-gray-400 hover:text-gray-600 underline">
                            ← Choose a different client
                        </button>
                    )}
                </SectionCard>
                <SlotCycleCard
                    clientType={clientType} slotNo={slotNo} slotNumber={slotNumber}
                    loanCycle={loanCycle} initialClientType={initialClientType}
                    slotReadOnly={slotReadOnly}
                    selectedCoMaker={selectedCoMaker} comakerList={comakerList}
                    coMakerReadOnly={coMakerReadOnly}
                    coMakerReadOnlyLabel={coMakerReadOnlyLabel}
                    loStatus={loStatus} coMakerChecking={coMakerChecking}
                    coMakerPending={coMakerPending} coMakerPendingName={coMakerPendingName}
                    onCoMakerPendingChange={onCoMakerPendingChange}
                    onCoMakerPendingNameChange={onCoMakerPendingNameChange}
                    handleSlotNoChange={handleSlotNoChange}
                    handleCoMakerChange={handleCoMakerChange}
                    touched={touched} errors={errors} setFieldTouched={setFieldTouched}
                />
            </div>
        );
    }

    const groupSelected = !!selectedGroup;

    return (
        <div className="flex flex-col gap-5">
            {rep === 3 && (
                <SectionCard icon={UserIcon} title="Loan Officer &amp; Group" 
                    subtitle={fromCI
                    ? 'Pre-filled from LAF application — read only'
                    : 'Select loan officer first'}
                >
                    {fromCI ? (
                        /* ── Read-only display: coming from CI flow ── */
                        <div className="space-y-3">
                            {/* LO — only show for rep=3, rep=4 is always current user */}
                            {rep === 3 && (
                                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                    <span className="text-sm text-gray-500 font-medium">Loan Officer</span>
                                    <span className="text-sm text-gray-900 font-semibold">
                                        {initialLoName
                                            || loList.find(l => l._id === selectedLo)?.label
                                            || selectedLo
                                            || '—'}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between items-center py-2">
                                <span className="text-sm text-gray-500 font-medium">Group</span>
                                <span className="text-sm text-gray-900 font-semibold">
                                    {initialGroupName
                                        || (Array.isArray(groupList) ? groupList : [])
                                            .find(g => g._id === selectedGroup)?.name
                                        || selectedGroup
                                        || '—'}
                                </span>
                            </div>
                        </div>
                    ) : (
                        /* ── Normal interactive mode ── */
                        <>
                            <SelectDropdownV2
                                name="loId" field="loId" value={selectedLo}
                                label="Loan Officer (Required)" options={loList}
                                onChange={handleLoIdChange} onBlur={setFieldTouched}
                                placeholder={loListLoading ? 'Loading...' : 'Select Loan Officer'}
                                disabled={loListLoading}
                                errors={touched.loId && errors.loId ? errors.loId : undefined}
                            />
                            <div className="mt-4">
                                <SelectDropdownV2
                                    name="groupId" field="groupId" value={selectedGroup}
                                    label="Group (Required)"
                                    options={Array.isArray(groupList) ? groupList : []}
                                    onChange={handleGroupIdChange} onBlur={setFieldTouched}
                                    placeholder="Select Group"
                                    errors={touched.groupId && errors.groupId ? errors.groupId : undefined}
                                />
                            </div>
                        </>
                    )}
                </SectionCard>
            )}

            {rep === 4 && clientType !== 'offset' && (
                <SectionCard icon={UsersIcon} title="Group" subtitle="Select group first">
                    <SelectDropdownV2
                        name="groupId" field="groupId" value={selectedGroup}
                        label="Group (Required)"
                        options={Array.isArray(groupList) ? groupList : []}
                        onChange={handleGroupIdChange} onBlur={setFieldTouched}
                        placeholder="Select Group"
                        errors={touched.groupId && errors.groupId ? errors.groupId : undefined}
                    />
                </SectionCard>
            )}

            <SectionCard
                icon={UsersIcon}
                title="Select Client"
                subtitle={groupSelected ? 'Choose a client from the list below' : 'Select a group first to see clients'}
            >
                {!fromCI && (
                    <div className="flex flex-wrap gap-2 mb-4">
                        {CLIENT_TYPES.map(ct => (
                            <button key={ct.value} type="button"
                                onClick={() => handleClientTypeChange(ct.value)}
                                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                                    clientType === ct.value
                                        ? 'bg-teal-600 text-white border-teal-600'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400'
                                }`}>
                                {ct.label}
                            </button>
                        ))}
                    </div>
                )}

                {clientType === 'offset' && (
                    <div className="flex flex-col gap-4">
                        <SelectDropdownV2
                            name="oldBranchId" field="oldBranchId" value={selectedOldBranch}
                            label="Previous Branch (Required)"
                            options={Array.isArray(branchList) ? branchList : []}
                            onChange={handleOldBranchIdChange} onBlur={setFieldTouched}
                            placeholder="Select Previous Branch"
                        />
                        {selectedOldBranch && (
                            <SelectDropdownV2
                                name="oldLOId" field="oldLOId" value={selectedOldLO}
                                label="Previous Loan Officer (Required)"
                                options={oldLOList}
                                onChange={handleOldLoIdChange} onBlur={setFieldTouched}
                                placeholder="Select Previous Loan Officer"
                            />
                        )}
                        {selectedOldLO && (
                            <SelectDropdownV2
                                name="oldGroupId" field="oldGroupId" value={selectedOldGroup}
                                label="Previous Group (Required)"
                                options={oldGroupList}
                                onChange={handleOldGroupIdChange} onBlur={setFieldTouched}
                                placeholder="Select Previous Group"
                            />
                        )}
                        {selectedOldGroup && (
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                    Select Balik Client
                                </p>
                                <OffsetClientTable
                                    branchId={selectedOldBranch} loId={selectedOldLO}
                                    groupId={selectedOldGroup}
                                    onSelect={handleOffsetClientSelect} selectedId={clientId}
                                />
                            </div>
                        )}
                        {touched.clientId && errors.clientId && (
                            <p className="text-xs text-red-500">{errors.clientId}</p>
                        )}
                    </div>
                )}

                {(clientType !== 'offset' && !fromCI) && (
                    <>
                        <ClientList
                            clients={Array.isArray(clientList) ? clientList : []}
                            selectedId={clientId}
                            onSelect={(c, photoUrl) => handleClientIdChange('clientId', c._id || c.value, photoUrl)}
                            disabled={!groupSelected}
                        />
                        {touched.clientId && errors.clientId && (
                            <p className="text-xs text-red-500 mt-2">{errors.clientId}</p>
                        )}
                    </>
                )}
            </SectionCard>

            {(clientId || offsetClient) && (
                <SlotCycleCard
                    clientType={clientType} slotNo={slotNo} slotNumber={slotNumber}
                    loanCycle={loanCycle} initialClientType={initialClientType}
                    slotReadOnly={slotReadOnly}
                    selectedCoMaker={selectedCoMaker} comakerList={comakerList}
                    coMakerReadOnly={coMakerReadOnly}
                    coMakerReadOnlyLabel={coMakerReadOnlyLabel}
                    loStatus={loStatus} coMakerChecking={coMakerChecking}
                    coMakerPending={coMakerPending} coMakerPendingName={coMakerPendingName}
                    onCoMakerPendingChange={onCoMakerPendingChange}
                    onCoMakerPendingNameChange={onCoMakerPendingNameChange}
                    handleSlotNoChange={handleSlotNoChange}
                    handleCoMakerChange={handleCoMakerChange}
                    touched={touched} errors={errors} setFieldTouched={setFieldTouched}
                />
            )}
        </div>
    );
};

// ── SlotCycleCard ──────────────────────────────────────────
const SlotCycleCard = ({
    clientType, slotNo, slotNumber, loanCycle,
    slotReadOnly, initialClientType,
    selectedCoMaker, comakerList, loStatus,
    coMakerReadOnly,        // FIX 3: true = show read-only display
    coMakerReadOnlyLabel,   // FIX 3: "Slot 20 — NAME" string
    handleSlotNoChange, handleCoMakerChange, touched, errors, setFieldTouched,
    coMakerChecking = false,
    coMakerPending = false, coMakerPendingName = '',
    onCoMakerPendingChange, onCoMakerPendingNameChange,
}) => (
    <SectionCard icon={CreditCardIcon} title="Slot &amp; Cycle">
        <div className="grid grid-cols-2 gap-4">
            {/* FIX 1: slot read-only — no "Fixed" badge, just plain display */}
            {(slotReadOnly && initialClientType !== 'balik') ? (
                <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                        Slot No.
                    </p>
                    <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                        <span className="text-sm font-semibold text-gray-900">{slotNo}</span>
                    </div>
                </div>
            ) : (
                <SelectDropdownV2
                    name="slotNo" field="slotNo" value={slotNo ? Number(slotNo) : slotNo}
                    label="Slot No. (Required)" options={slotNumber}
                    onChange={handleSlotNoChange} onBlur={setFieldTouched}
                    placeholder="Select Slot"
                    errors={touched.slotNo && errors.slotNo ? errors.slotNo : undefined}
                />
            )}

            {/* Loan Cycle — trust the Formik value as-is. It's resolved once,
                correctly, at the point of client selection (see
                src/lib/loan-cycle.js). This display must never re-guess it
                from clientType — that's what caused the Balik/Pending Member
                mixup in the first place. */}
            <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    Loan Cycle
                </p>
                <p className="text-sm font-semibold text-gray-800 pt-2">
                    {loanCycle || '—'}
                </p>
            </div>
        </div>

        <div className="mt-4">
            {/* FIX 3: co-maker read-only if previous co-maker found in group */}
            {coMakerReadOnly ? (
                <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                        Co-maker Slot
                    </p>
                    <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl
                        flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-800">
                            {coMakerReadOnlyLabel}
                        </span>
                        <button
                            type="button"
                            onClick={() => onCoMakerPendingChange?.('clear')}
                            className="text-xs text-gray-400 hover:text-gray-600 underline ml-2"
                        >
                            Change
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                        Previous co-maker found in this group.
                    </p>
                </div>
            ) : (
                <>
                    <SelectDropdownV2
                        name="coMaker" field="coMaker" value={selectedCoMaker}
                        label="Co-maker Slot"
                        options={Array.isArray(comakerList) ? comakerList : []}
                        onChange={handleCoMakerChange} onBlur={setFieldTouched}
                        placeholder="Select Co-maker"
                        disabled={coMakerChecking}
                    />
                    {coMakerChecking && (
                        <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1.5">
                            <svg className="w-3 h-3 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10"
                                    stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor"
                                    d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                            Checking co-maker...
                        </p>
                    )}
                    {!selectedCoMaker && !coMakerChecking && (
                        <div className="mt-3">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="checkbox" checked={coMakerPending}
                                    onChange={e => onCoMakerPendingChange?.(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                                <span className="text-xs text-gray-500">
                                    Co-maker not yet encoded — assign later
                                </span>
                            </label>
                            {coMakerPending && (
                                <input type="text" value={coMakerPendingName}
                                    onChange={e => onCoMakerPendingNameChange?.(e.target.value.toUpperCase())}
                                    placeholder="Co-maker name (for reference)"
                                    className="mt-2 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                                        focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent
                                        placeholder:text-gray-300 uppercase" />
                            )}
                        </div>
                    )}
                </>
            )}
        </div>

        {loStatus && loStatus !== 'open' && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-700 font-medium">
                    LO collection is {loStatus} — loan may release tomorrow.
                </p>
            </div>
        )}
    </SectionCard>
);

export default SelectClientPanel;