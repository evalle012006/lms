import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Formik } from 'formik';
import * as yup from 'yup';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import moment from 'moment';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { compressImage } from '@/lib/image-compress';
import { UppercaseFirstLetter, formatPricePhp } from '@/lib/utils';
import { getNextValidDate } from '@/lib/date-utils';
import { setGroupList } from '@/redux/actions/groupActions';
import { setClientList, setComakerList } from '@/redux/actions/clientActions';

import Spinner from '@/components/Spinner';
import { useSignedUrl } from 'hooks/useSignedUrl';
import GuarantorDuplicateBanner from './GuarantorDuplicateBanner';
import SelectClientPanel from './SelectClientPanel';
import LoanFormPanel from './LoanFormPanel';

// Treat legacy placeholder values as empty
const isPlaceholder = (v) => !v || v.trim() === '.' || v.trim() === '-';

const AddLoanPage = ({
    onBack, onSuccess, mode = 'add', loanId = null,
    initialClientId   = null,
    initialGroupId    = null,
    initialLoId       = null,
    initialClientType = null,
    initialGroupName  = null,
    initialLoName     = null,
    // Client identity — lets us build selectedClientObj without fetching clientList
    initialFirstName  = null,
    initialLastName   = null,
    initialMiddleName = null,
    initialContact    = null,
    initialAddress    = null,
    initialSlotNo     = null,
    initialLoanCycle  = null,
    initialBirthdate  = null,
    initialPhotoUrl   = null,
    // Guarantor from LAF record (authoritative — overrides stale client record)
    initialGuarantorFN      = null,
    initialGuarantorLN      = null,
    initialGuarantorRel     = null,
    initialGuarantorContact = null,
    initialGuarantorBD      = null,
    initialGuarantorCS      = null,
    initialGuarantorBiz     = null,
    initialGuarantorDI      = null,
    initialGuarantorAddress = null,
    initialCiName           = null,
}) => {
    const dispatch        = useDispatch();
    const formikRef       = useRef();

    // ── Redux ──────────────────────────────────────────────────
    const currentUser         = useSelector(s => s.user.data);
    const currentDate         = useSelector(s => s.systemSettings.currentDate);
    const holidayList         = useSelector(s => s.holidays.list);
    const isWeekend           = useSelector(s => s.systemSettings.weekend);
    const transactionSettings = useSelector(s => s.transactionsSettings.data);
    const branchList          = useSelector(s => s.branch.list);
    const groupList           = useSelector(s => s.group.list);
    const clientList          = useSelector(s => s.client.list);
    const comakerList         = useSelector(s => s.client.comakerList);
    const currentBranch       = useSelector(s => s.branch.data);

    const rep = currentUser?.role?.rep;

    // ── State ──────────────────────────────────────────────────
    const [loading, setLoading]                   = useState(false);
    // FIX: guarantor photo/ID upload state
    const [guarantorPhotoFile,    setGuarantorPhotoFile]    = useState(null);
    const [guarantorPhotoPreview, setGuarantorPhotoPreview] = useState(null);
    const [guarantorIdFile,       setGuarantorIdFile]       = useState(null);
    const [guarantorIdPreview,    setGuarantorIdPreview]    = useState(null);
    const [clientType, setClientType]             = useState('pending');
    const [groupOccurence, setGroupOccurence]     = useState(currentUser?.transactionType || 'daily');
    // LO-level (not group-level) — drives 24 vs 12 week term for weekly loans.
    // rep=4: sourced from currentUser directly. rep=3: sourced from loList entry, set in handleLoIdChange.
    const [loWeeklyScheduleType, setLoWeeklyScheduleType] = useState(
        rep === 4 ? (currentUser?.weeklyScheduleType || 'standard') : 'standard'
    );
    const [selectedLo, setSelectedLo]             = useState(rep === 4 ? currentUser._id : null);
    const [selectedGroup, setSelectedGroup]       = useState(null);
    const [clientId, setClientId]                 = useState(null);
    const [selectedClientObj, setSelectedClientObj] = useState(null);
    const [slotNo, setSlotNo] = useState(
        (initialClientId && initialGroupId && initialLoId && initialSlotNo)
            ? parseInt(initialSlotNo)
            : null
    );
    const [slotNumber, setSlotNumber]             = useState([]);
    const [loanTerms, setLoanTerms]               = useState(60);
    const [groupLeader, setGroupLeader]           = useState(false);
    const [selectedCoMaker, setSelectedCoMaker]   = useState(null);
    const [coMakerChecking, setCoMakerChecking]     = useState(false);
    const [coMakerPending, setCoMakerPending]       = useState(false);
    const [coMakerPendingName, setCoMakerPendingName] = useState('');
    const [loStatus, setLoStatus]                 = useState(null);
    const [initialDateRelease, setInitialDateRelease] = useState(null);
    const [minDate, setMinDate]                   = useState(null);
    const [maxDate, setMaxDate]                   = useState(null);
    const [selectedLoanId, setSelectedLoanId]     = useState(null);
    // Initialize from URL params when coming from CI flow
    // This avoids async loan-history fetch race conditions entirely
    const [slotReadOnly, setSlotReadOnly] = useState(
        !!(initialClientId && initialGroupId && initialLoId && initialSlotNo)
    );
    const [coMakerReadOnly,      setCoMakerReadOnly]      = useState(false);
    const [coMakerReadOnlyLabel, setCoMakerReadOnlyLabel] = useState('');

    // LO list for rep=3
    const [loList, setLoList]               = useState([]);
    const [loListLoading, setLoListLoading] = useState(false);

    // Offset
    const [selectedOldBranch, setSelectedOldBranch] = useState(null);
    const [selectedOldLO, setSelectedOldLO]         = useState(null);
    const [selectedOldGroup, setSelectedOldGroup]   = useState(null);
    const [oldLOList, setOldLOList]                 = useState([]);
    const [oldGroupList, setOldGroupList]           = useState([]);
    const [offsetClient, setOffsetClient]           = useState(null);
    const [ciStatus, setCiStatus]                   = useState(null);  // null | { hasCI, latestCI, isBalik }
    const [ciChecking, setCiChecking]               = useState(false);

    // ── Edit mode state ────────────────────────────────────
    const [loanData, setLoanData]       = useState(null);
    const [loanFetching, setLoanFetching] = useState(false);
    // Holds raw coMaker values from loan record until comakerList is ready
    const [pendingCoMakerRestore, setPendingCoMakerRestore] = useState(null);
    const [clientProfileKey, setClientProfileKey] = useState(null);
    const isEdit = mode === 'edit';

    // fromCI: true when arriving from CI Investigation promote flow.
    // LO, Group, and client type are locked — user must not change them.
    const fromCI = !!(initialClientId && initialGroupId && initialLoId);

    const [hasPreFilled, setHasPreFilled] = useState(false);

    // Resolve client profile photo in edit mode via the signed-url hook
    const { signedUrl: editClientPhotoUrl } = useSignedUrl(clientProfileKey);

    // ── Load LO list for BM ────────────────────────────────────
    useEffect(() => {
        if (rep !== 3) return;
        setLoListLoading(true);
        fetchWrapper
            .get(getApiBaseUrl() + 'users/list?' + new URLSearchParams({ branchCode: currentUser.designatedBranch }))
            .then(res => {
                if (res.success) {
                    setLoList(
                        (res.users || [])
                            .filter(u => u.role?.rep === 4)
                            .map(u => ({ ...u, label: `LO ${u.loNo} - ${u.firstName} ${u.lastName}`, value: u._id }))
                            .sort((a, b) => (a.loNo || 0) - (b.loNo || 0))
                    );
                }
            })
            .finally(() => setLoListLoading(false));
    }, [rep]);

    // ── Auto-load groups for LO ────────────────────────────────
    useEffect(() => {
        if (rep === 4) getListGroup(currentUser.transactionType, currentUser._id);
    }, [rep]);

    // ── LO Status ──────────────────────────────────────────────
    useEffect(() => {
        if (!currentDate) return;
        const check = async (loId) => {
            const res = await fetchWrapper.get(
                getApiBaseUrl() + 'transactions/cash-collections/get-lo-status?' +
                new URLSearchParams({ loId, currentDate })
            );
            if (res.success) setLoStatus(res.status);
        };
        if (rep === 4) check(currentUser._id);
        else if (rep === 3 && selectedLo) check(selectedLo);
    }, [rep, selectedLo, currentDate]);

    // ── Initial date of release ────────────────────────────────
    useEffect(() => {
        if (!currentDate) return;
        const holidays = (holidayList || []).map(h => h.date);
        const dayName  = moment(currentDate).format('dddd');
        let addDays = 2;
        if (dayName === 'Friday')   addDays = 4;
        if (dayName === 'Saturday') addDays = 3;
        setInitialDateRelease(
            getNextValidDate(moment(currentDate).add(addDays, 'days').format('YYYY-MM-DD'), holidays).format('YYYY-MM-DD')
        );
    }, [currentDate, isWeekend, holidayList]);

    // ── Min/Max date ───────────────────────────────────────────
    useEffect(() => {
        if (!currentDate || !initialDateRelease) return;
        const holidays = (holidayList || []).map(h => h.date);
        const initialMin = moment(currentDate);
        setMinDate(initialMin.toDate());
        const nDays = initialMin.format('dddd') === 'Monday' ? 4 : 8;
        setMaxDate(getNextValidDate(moment(initialMin).add(nDays, 'days').format('YYYY-MM-DD'), holidays).toDate());
    }, [currentDate, holidayList, initialDateRelease]);

    // ── Slot numbers — from group.availableSlots ─────────────
    useEffect(() => {
        if (offsetClient) {
            setSlotNumber(Array.from({ length: 30 }, (_, i) => ({ value: i + 1, label: i + 1 })));
            return;
        }
        if (!selectedGroup) return;
        const group = (Array.isArray(groupList) ? groupList : []).find(g => g._id === selectedGroup);
        if (group?.availableSlots?.length) {
            let slots = [...group.availableSlots];
            // Add client's own slot back if it's occupied but should be displayed:
            // - Edit mode: slot is already taken by this loan
            // - active/advance: reloan client keeps their slot
            // - fromCI with slotReadOnly: existing client's slot from URL params
            if ((isEdit || clientType === 'active' || clientType === 'advance'
                    || (fromCI && slotReadOnly))
                && slotNo && !slots.includes(parseInt(slotNo))) {
                slots.push(parseInt(slotNo));
            }
            setSlotNumber(
                slots.sort((a, b) => a - b).map(s => ({ value: s, label: s }))
            );
        } else {
            setSlotNumber(Array.from({ length: 30 }, (_, i) => ({ value: i + 1, label: i + 1 })));
        }
    }, [selectedGroup, offsetClient, groupList, isEdit, slotNo, clientType, fromCI, slotReadOnly]);

    // ── Auto-fill CI Name + Guarantor from client (add mode only) ─
    // In edit mode, guarantor comes from the loan record — never overwrite from client
    useEffect(() => {
        if (!selectedClientObj || mode === 'edit') return;
        // FALLBACK ONLY for v2 — the ciStatus effect above overwrites this once the
        // authoritative CI investigation lookup resolves. This still matters as the
        // only source for non-v2 branches and as a placeholder while checkClientCI is in flight.
        // formikRef.current?.setFieldValue('ciName', selectedClientObj.ciName || '');
        const form = formikRef.current;
        if (!form) return;
        const current = form.values;
        // Use placeholder check — '.' from legacy records is not a real value
        if (isPlaceholder(current.guarantorFirstName)) {
            form.setFieldValue('guarantorFirstName',
                isPlaceholder(selectedClientObj.guarantorFirstName) ? '' : selectedClientObj.guarantorFirstName);
            form.setFieldValue('guarantorMiddleName',
                isPlaceholder(selectedClientObj.guarantorMiddleName) ? '' : selectedClientObj.guarantorMiddleName);
            form.setFieldValue('guarantorLastName',
                isPlaceholder(selectedClientObj.guarantorLastName) ? '' : selectedClientObj.guarantorLastName);
            form.setFieldValue('guarantorBirthDate',   selectedClientObj.guarantorBirthDate   || '');
            form.setFieldValue('guarantorCivilStatus', selectedClientObj.guarantorCivilStatus || '');
            form.setFieldValue('guarantorBusiness',    selectedClientObj.guarantorBusiness    || '');
            form.setFieldValue('guarantorDailyIncome', selectedClientObj.guarantorDailyIncome || '');
            form.setFieldValue('guarantorAddress',     selectedClientObj.guarantorAddress
                || selectedClientObj.address || '');
        }
    }, [selectedClientObj, mode]);

    // ── Update client photo when signed URL resolves (edit mode) ─
    useEffect(() => {
        if (!editClientPhotoUrl) return;
        setSelectedClientObj(prev => prev
            ? { ...prev, resolvedPhotoUrl: editClientPhotoUrl }
            : prev
        );
    }, [editClientPhotoUrl]);

    // ── Auto-fill CI Name from offset client ───────────────────
    useEffect(() => {
        if (!offsetClient) return;
        formikRef.current?.setFieldValue('ciName', offsetClient.ciName || '');
    }, [offsetClient]);

    // ── CI Name authority: for v2, the approved CI investigation's picUserName
    // is the source of truth. The client/offsetClient effects below still run
    // first and set a denormalized fallback immediately (so the field isn't
    // empty while checkClientCI is in flight); this effect overwrites it once
    // the authoritative value resolves. Never runs in edit mode — loanData.ciName
    // (the value saved on the loan record) is authoritative there instead.
    useEffect(() => {
        if (mode === 'edit') return;
        if (currentBranch?.clientFlowVersion !== 'v2') return;
        if (!ciStatus) return; // still checking, or not applicable (e.g. pending client) — leave fallback in place

        if (ciStatus.hasCI && ciStatus.latestCI?.picUserName) {
            formikRef.current?.setFieldValue('ciName', ciStatus.latestCI.picUserName);
        }
        // hasCI === false: no approved CI exists at all — nothing authoritative to
        // set, leave whatever the fallback effects populated (client.ciName / offsetClient.ciName).
        // handleSaveUpdate already blocks submission in this case, so this is display-only risk.
    }, [ciStatus, mode, currentBranch]);

    // ── Fetch loan in edit mode ────────────────────────────
    useEffect(() => {
        if (mode !== 'edit' || !loanId) return;
        setLoanFetching(true);
        fetchWrapper.get(
            getApiBaseUrl() + 'transactions/loans?' +
            new URLSearchParams({ _id: loanId })
        )
        .then(res => {
            if (res.success && res.loan) {
                const l = res.loan;
                setLoanData(l);
                // Pre-populate Formik fields once mounted
                setTimeout(() => {
                    const form = formikRef.current;
                    if (!form) return;

                    // Loan fields
                    form.setFieldValue('principalLoan',       l.principalLoan || 5000);
                    form.setFieldValue('loanCycle',           l.loanCycle || 1);
                    form.setFieldValue('mcbu',                l.mcbu || 0);
                    form.setFieldValue('pnNumber',            l.pnNumber || '');
                    form.setFieldValue('ciName',              l.ciName || '');
                    form.setFieldValue('dateOfRelease',       l.dateOfRelease || '');
                    form.setFieldValue('groupId',             l.groupId || '');
                    form.setFieldValue('clientId',            l.clientId || '');
                    form.setFieldValue('slotNo',              l.slotNo || '');

                    // Guarantor — comes from the loan record, NOT the client
                    form.setFieldValue('guarantorFirstName',  l.guarantorFirstName || '');
                    form.setFieldValue('guarantorMiddleName', l.guarantorMiddleName || '');
                    form.setFieldValue('guarantorLastName',   l.guarantorLastName || '');
                    form.setFieldValue('guarantorBirthDate',   l.guarantorBirthDate   || '');
                    form.setFieldValue('guarantorCivilStatus', l.guarantorCivilStatus || '');
                    form.setFieldValue('guarantorBusiness',    l.guarantorBusiness    || '');
                    form.setFieldValue('guarantorDailyIncome', l.guarantorDailyIncome || '');
                    form.setFieldValue('guarantorAddress',     l.guarantorAddress     || '');

                    // FIX: restore guarantor photo previews in edit mode
                    if (l.guarantorPhotoKey)   setGuarantorPhotoPreview(l.guarantorPhotoKey);
                    if (l.guarantorIdPhotoKey) setGuarantorIdPreview(l.guarantorIdPhotoKey);

                    // Restore derived state
                    setSelectedGroup(l.groupId);
                    // getListCoMaker called outside setTimeout via separate effect
                    // so it waits for currentDate to be available
                    // Store coMaker restore data — will resolve once comakerList is populated
                    if (l.coMaker || l.coMakerId) {
                        setPendingCoMakerRestore({ slotNo: l.coMaker, coMakerId: l.coMakerId });
                    }
                    // Restore coMaker pending flag
                    if (l.coMakerPending) {
                        setCoMakerPending(true);
                        setCoMakerPendingName(l.coMakerPendingName || '');
                    }
                    setClientId(l.clientId);
                    setSlotNo(l.slotNo);
                    setLoanTerms(l.loanTerms || 60);
                    if (l.weeklyScheduleType) setLoWeeklyScheduleType(l.weeklyScheduleType);
                    if (l.loId) setSelectedLo(l.loId);
                    if (l.occurence) setGroupOccurence(l.occurence);

                    // Populate groupList so the Group dropdown shows the selected value
                    if (l.group) {
                        dispatch(setGroupList([{
                            ...l.group,
                            value: l.group._id,
                            label: UppercaseFirstLetter(l.group.name),
                        }]));
                    }

                    // Restore client obj for read-only card
                    if (l.client) {
                        setSelectedClientObj({
                            ...l.client,
                            groupName: l.group?.name || l.groupName || '',
                            resolvedPhotoUrl: null, // resolved below via signed-url
                        });

                        // Set profile key — useSignedUrl hook resolves it
                        if (l.client.profile) {
                            setClientProfileKey(l.client.profile);
                        }
                    }
                }, 150);
            }
        })
        .finally(() => setLoanFetching(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, loanId]);

    // ── Load co-maker list when group + currentDate are both ready ──
    useEffect(() => {
        if (!selectedGroup || !currentDate) return;
        // Pass clientId from state — this useEffect is for group/date changes,
        // handleClientIdChange handles client selection with fresh ID directly
        getListCoMaker(selectedGroup, clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedGroup, currentDate]);

    // ── Resolve coMaker once comakerList is populated ─────────────────
    useEffect(() => {
        if (!pendingCoMakerRestore || !comakerList?.length) return;
        const { slotNo: prevSlot, coMakerId } = pendingCoMakerRestore;
        // Match by clientId UUID first, fall back to slot number
        const entry = comakerList.find(c =>
            (coMakerId && (c.clientId === coMakerId || c.value === coMakerId)) ||
            (prevSlot && String(c.slotNo) === String(prevSlot))
        );
        if (entry) {
            // Found in current group — pre-select and show read-only
            setSelectedCoMaker(entry.value);
            formikRef.current?.setFieldValue('coMaker', entry.value);
            if (clientType === 'active' || clientType === 'advance') {
                // FIX 3: show as read-only since previous co-maker is still in group
                setCoMakerReadOnly(true);
                setCoMakerReadOnlyLabel(entry.label);
            }
        } else {
            // Not found — co-maker may have left group or loan completed
            // Show dropdown so BM can select a new one
            setCoMakerReadOnly(false);
            setCoMakerReadOnlyLabel('');
            if (clientType === 'active' || clientType === 'advance') {
                toast.info('Previous co-maker not found in this group. Please select a new co-maker.', { autoClose: 4000 });
            }
        }
        setPendingCoMakerRestore(null);
    }, [comakerList, pendingCoMakerRestore, clientType]);

    // Auto-generate PN number on mount (add mode only)
    // Guard with mode prop directly — isEdit may be stale on first render
    useEffect(() => {
        if (mode !== 'add' || !currentDate || !currentUser?.designatedBranchId) return;
        const timer = setTimeout(() => {
            if (formikRef.current) {
                getLastPNNumber(formikRef.current.setFieldValue);
            }
        }, 150);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDate, mode]);

    useEffect(() => {
        if (!initialClientId || !initialGroupId || hasPreFilled) return;
        if (mode !== 'add') return;

        const ct = initialClientType || 'pending';
        setClientType(ct);
        if (initialLoId) setSelectedLo(initialLoId);

        // FIX Issue 2: call getListGroup for the pre-set LO so groupList is populated
        // for BM (rep=3). This resolves the group name in the read-only display.
        if (initialLoId && rep === 3) {
            getListGroup(currentUser.transactionType || 'daily', initialLoId);
        }

        setSelectedGroup(initialGroupId);
        formikRef.current?.setFieldValue('groupId', initialGroupId);

        // FIX Issue 1 (Select Client blank) + avoid broken getListClient call:
        // Build selectedClientObj directly from URL params.
        // getListClient('pending', groupId) fetches clients with loan status='pending'
        // but Pending Member clients have loan status='completed' in the DB —
        // so they never appear in the list and selectedClientObj is never set.
        if (initialLastName && initialFirstName) {
            setSelectedClientObj({
                _id:           initialClientId,
                firstName:     initialFirstName,
                lastName:      initialLastName,
                middleName:    initialMiddleName  || '',
                contactNumber: initialContact     || '',
                address:       initialAddress     || '',
                birthdate:     initialBirthdate   || '', 
                groupName:     initialGroupName   || '',
                ciName:        initialCiName      || '',
                resolvedPhotoUrl: initialPhotoUrl || null,
            });
        }

        setClientId(initialClientId);
        formikRef.current?.setFieldValue('clientId', initialClientId);

        // Slot — existing clients already have one
        if (initialSlotNo) {
            const slot = parseInt(initialSlotNo);
            setSlotNo(slot);
            setSlotReadOnly(true);
            setTimeout(() => {
                formikRef.current?.setFieldValue('slotNo', slot);
            }, 150);
        }

        // Load co-maker list
        if (currentDate) getListCoMaker(initialGroupId, initialClientId);

        if (initialClientId) {
            fetchWrapper.get(
                getApiBaseUrl() + `clients/loan-history?clientId=${initialClientId}`
            ).then(res => {
                if (!res.success) return;
                const loans = res.loans || [];
                // Block if a pending loan already exists for this client
                const hasPendingLoan = loans.some(l => l.status === 'pending');
                if (hasPendingLoan) {
                    setSelectedClientObj(null);
                    setClientId(null);
                    toast.error(
                        'This client already has a pending loan application. ' +
                        'Please check the Loan Applications list.',
                        { autoClose: 8000 }
                    );
                    return;
                }
                // Set selectedLoanId from the most recent non-pending loan
                // so handleSaveUpdate can send oldLoanId for reloan mode
                const latestLoan = loans.find(l => l.status !== 'pending');
                if (latestLoan?._id) {
                    setSelectedLoanId(latestLoan._id);
                }
            }).catch(() => {});
        }

        setHasPreFilled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialClientId, initialGroupId]);

    // ── Apply LAF values when arriving from CI flow ───────────────────────
    // guarantorFirstName on client record may be stale ('.') — LAF record is authoritative.
    // ciName from LAF investigation.picUserName is the correct CI investigator.
    useEffect(() => {
        const hasGuarantor = initialGuarantorFN || initialGuarantorLN;
        const hasCiName    = initialCiName;
        if (!hasGuarantor && !hasCiName) return;
        if (mode === 'edit') return;
        const applyFields = () => {
            const form = formikRef.current;
            if (!form) return;
            if (initialGuarantorFN)      form.setFieldValue('guarantorFirstName',    initialGuarantorFN);
            if (initialGuarantorLN)      form.setFieldValue('guarantorLastName',     initialGuarantorLN);
            if (initialGuarantorBD)      form.setFieldValue('guarantorBirthDate',    initialGuarantorBD);
            if (initialGuarantorCS)      form.setFieldValue('guarantorCivilStatus',  initialGuarantorCS);
            if (initialGuarantorBiz)     form.setFieldValue('guarantorBusiness',     initialGuarantorBiz);
            if (initialGuarantorDI)      form.setFieldValue('guarantorDailyIncome',  initialGuarantorDI);
            if (initialCiName)           form.setFieldValue('ciName',                initialCiName);
        };
        // Run immediately and again after 300ms to ensure Formik is ready
        applyFields();
        const t = setTimeout(applyFields, 300);
        return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialGuarantorFN, initialGuarantorLN, initialCiName]);

    // ─────────────────────────────────────────────────────────
    // API helpers — exact mirror of AddUpdateLoanDrawer
    // ─────────────────────────────────────────────────────────
    const getListGroup = async (occurence, loId, mode, origin) => {
        setLoading(true);
        const branchId = origin === 'old' ? selectedOldBranch : currentUser.designatedBranchId;
        let url = getApiBaseUrl() + 'groups/list-by-group-occurence?';

        url += rep === 4
            ? new URLSearchParams(
                mode === 'filter'
                    ? { branchId, loId: currentUser._id, occurence, mode: 'filter' }
                    : { branchId, loId: currentUser._id, occurence }
            )
            : new URLSearchParams(
                mode === 'filter'
                    ? { branchId, loId, occurence, mode: 'filter' }
                    : { branchId, loId, occurence }
            );

        const res = await fetchWrapper.get(url);
        if (res.success) {
            const groups = (res.groups || [])
                .map(g => ({ ...g, value: g._id, label: UppercaseFirstLetter(g.name) }))
                .sort((a, b) => a.groupNo - b.groupNo);
            if (origin === 'old') setOldGroupList(groups);
            else dispatch(setGroupList(groups));
        } else toast.error(res.message);
        setLoading(false);
    };

    const getListUser = async (branchCode, type) => {
        const res = await fetchWrapper.get(
            getApiBaseUrl() + 'users/list?' + new URLSearchParams({ branchCode })
        );
        if (res.success) {
            const users = (res.users || [])
                .filter(u => u.role?.rep === 4)
                .map(u => ({ ...u, label: `${u.firstName} ${u.lastName}`, value: u._id }))
                .sort((a, b) => a.loNo - b.loNo);
            if (type === 'old') setOldLOList(users);
        }
    };

    const getListClient = async (status, groupId) => {
        setLoading(true);

        let url = getApiBaseUrl() + 'clients/list?';

        if (status === 'active') {
            url += new URLSearchParams({ mode: 'view_only_no_exist_loan', groupId, status });
        } else if (status === 'advance') {
            url += new URLSearchParams({ mode: 'view_existing_loan', groupId, status });
        } else if (status === 'offset') {
            url += new URLSearchParams({ mode: 'view_offset', status, branchId: selectedOldBranch, loId: selectedOldLO, groupId });
        } else {
            url += rep === 4
                ? new URLSearchParams({ mode: 'view_only_no_exist_loan', loId: currentUser._id, groupId, status })
                : new URLSearchParams({ mode: 'view_only_no_exist_loan', groupId, status });
        }

        const res = await fetchWrapper.get(url);
        if (res.success) {
            let clients = [];
            (res.clients || []).forEach(client => {
                if (status === 'active' || status === 'advance') {
                    const temp = {
                        ...client.client,
                        loans: [client],
                        label: UppercaseFirstLetter(`${client.slotNo} - ${client.client.lastName}, ${client.client.firstName}`),
                        value: client.client._id,
                        slotNo: client.slotNo,
                    };
                    delete temp.loans[0].client;
                    clients.push(temp);
                } else {
                    clients.push({ ...client, label: UppercaseFirstLetter(`${client.lastName}, ${client.firstName}`), value: client._id });
                }
            });
            if (status === 'active' || status === 'advance') clients.sort((a, b) => a.slotNo - b.slotNo);
            dispatch(setClientList(clients));
        } else toast.error(res.message);
        setLoading(false);
    };

    const getListCoMaker = async (groupId, currentClientId = null) => {
        if (!groupId) return;
        const excludeId = currentClientId || clientId;

        // Server-side view_comakers_by_group already excludes:
        //   - clients with no live slot in this group
        //   - clients whose most recent loan is reject/closed
        //   - clients already assigned as coMaker on another live loan (see coMaker field note)
        // No further client-side filtering needed.
        const res = await fetchWrapper.get(
            getApiBaseUrl() + 'clients/list?' +
            new URLSearchParams({
                mode: 'view_comakers_by_group',
                groupId,
                excludeClientId: excludeId || '',
            })
        ).catch(() => ({ success: false }));

        const entries = (res.clients || [])
            .map(l => ({
                slotNo:   l.slotNo,
                clientId: l.client?._id || l.clientId,
                value:    l.client?._id || l.clientId,
                label:    l.client
                    ? `Slot ${l.slotNo} — ${l.client.lastName}, ${l.client.firstName}`.toUpperCase()
                    : `Slot ${l.slotNo}`,
            }))
            .sort((a, b) => (a.slotNo || 999) - (b.slotNo || 999));

        dispatch(setComakerList(entries));
    };

    const getLastPNNumber = async (setFieldValue) => {
        const res = await fetchWrapper.get(
            getApiBaseUrl() + 'transactions/loans/get-last-pn-number-by-branch?' +
            new URLSearchParams({ branchId: currentUser.designatedBranchId, currentDate })
        );
        if (res.success) {
            if (res.data?.length > 0) {
                // Existing PNs today — increment the max number
                const lastPN   = res.data[0];
                const nextNum  = lastPN.maxNumber + 1;
                const pnNumber = `${currentUser.designatedBranch}-${moment(currentDate).format('MM-DD')}-${nextNum.toString().padStart(3, '0')}`;
                setFieldValue('pnNumber', pnNumber);
            } else {
                // No PNs today — start at 001
                const pnNumber = `${currentUser.designatedBranch}-${moment(currentDate).format('MM-DD')}-001`;
                setFieldValue('pnNumber', pnNumber);
            }
        }
    };

    const handlePNNumber = async (e, setFieldValue) => {
        const pnNumber = e.target.value;
        if (pnNumber && currentBranch) {
            const res = await fetchWrapper.get(
                getApiBaseUrl() + 'transactions/loans/check-existing-pn-number-by-branch?' +
                new URLSearchParams({ branchId: currentBranch._id, pnNumber, currentDate })
            );
            if (res.success && res.loans?.length > 0) {
                await getLastPNNumber(setFieldValue);
                toast.error(res.message);
            }
        }
    };

    // ─────────────────────────────────────────────────────────
    // Change handlers
    // ─────────────────────────────────────────────────────────
    const resetClient = (form) => {
        setClientId(null);
        setSelectedClientObj(null);
        setSlotNo(null);
        setSlotReadOnly(false);
        setCoMakerReadOnly(false);
        setCoMakerReadOnlyLabel('');
        form?.setFieldValue('clientId', '');
        form?.setFieldValue('slotNo', '');
        form?.setFieldValue('ciName', '');
        form?.setFieldValue('guarantorFirstName', '');
        form?.setFieldValue('guarantorMiddleName', '');
        form?.setFieldValue('guarantorLastName', '');
    };

    const handleLoIdChange = (field, value) => {
        const form = formikRef.current;
        const u = loList.find(u => u._id === value);
        setSelectedLo(value);
        setGroupOccurence(u?.transactionType || 'daily');
        setLoWeeklyScheduleType(u?.weeklyScheduleType || 'standard');
        form?.setFieldValue(field, value);
        setSelectedGroup(null);
        form?.setFieldValue('groupId', '');
        resetClient(form);
        dispatch(setClientList([]));
        if (clientType !== 'advance' && clientType !== 'active') {
            getListGroup(u?.transactionType || 'daily', value);
        } else {
            getListGroup(u?.transactionType || 'daily', value, 'filter');
        }
    };

    const handleGroupIdChange = (field, value) => {
        const form = formikRef.current;
        setSelectedGroup(value);
        const group = (Array.isArray(groupList) ? groupList : []).find(g => g._id === value);
        if (group) {
            form?.setFieldValue('loId', group.loanOfficerId);
            setGroupOccurence(group.occurence || 'daily');
        }
        form?.setFieldValue(field, value);
        resetClient(form);
        if (clientType !== 'offset') getListClient(clientType, value);
        // co-maker list loaded via useEffect watching selectedGroup + currentDate
    };

    const checkClientCI = async (clientId, isBalik = false) => {
        setCiChecking(true);
        try {
            const res = await fetchWrapper.get(
                getApiBaseUrl() + `laf/ci/latest?clientId=${clientId}`
            );
            if (res.success) {
                setCiStatus({ hasCI: res.hasCI, latestCI: res.latestCI, isBalik });
            }
        } catch { /* non-fatal */ }
        finally { setCiChecking(false); }
    };

    const handleClientIdChange = (field, value, resolvedPhotoUrl = null) => {
        const form = formikRef.current;
        setClientId(value);
        if (selectedGroup && currentDate) {
            getListCoMaker(selectedGroup, value);
        }
        setCiStatus(null);
        const c = (Array.isArray(clientList) ? clientList : []).find(c => c._id === value || c.value === value);
        if (!c) return;
        setSelectedClientObj({ ...c, resolvedPhotoUrl });
        if (currentBranch?.clientFlowVersion === 'v2') {
            checkClientCI(value, clientType === 'offset');
        }
        setGroupLeader(c.groupLeader || false);
        if (clientType === 'active' || clientType === 'advance') {
            // ── Restore slot/loanCycle/comaker from the client's existing loan ──
            const sl             = c.loans?.[0]?.slotNo;
            const lc             = c.loans?.[0]?.loanCycle;
            const prevCoMaker    = c.loans?.[0]?.coMaker;
            const prevCoMakerId  = c.loans?.[0]?.coMakerId;

            setSlotNo(sl);
            setSelectedLoanId(c.loans?.[0]?._id);
            setSlotReadOnly(true);
            setCoMakerReadOnly(false);
            setCoMakerReadOnlyLabel('');
            setSelectedCoMaker(null);
            form?.setFieldValue('coMaker', null);

            if (prevCoMaker || prevCoMakerId) {
                setPendingCoMakerRestore({ slotNo: prevCoMaker, coMakerId: prevCoMakerId });
            }

            // Set slotNo + loanCycle in Formik — useMemo on initialValues
            // ensures enableReinitialize won't wipe these after comakerList loads
            setTimeout(() => {
                formikRef.current?.setFieldValue('slotNo', sl);
                formikRef.current?.setFieldValue('loanCycle', (lc || 0) + 1);
            }, 150);

            // ── Fetch LAF guarantor data (delayed so slot/loanCycle setTimeout fires first) ──
            setTimeout(() => {
                fetchWrapper.get(
                    getApiBaseUrl() + `laf/applications/list?existingClientId=${value}&status=promoted`
                ).then(res => {
                    if (!res.success) return;
                    const apps = res.applications || [];
                    const latestApp = apps
                        .filter(a => a.status === 'promoted')
                        .sort((a, b) =>
                            new Date(b.promotedAt || b.submittedAt || 0) -
                            new Date(a.promotedAt || a.submittedAt || 0)
                        )[0];
                    if (!latestApp) return;
                    const form = formikRef.current;
                    if (!form) return;
                    if (latestApp.guarantorFirstName && !isPlaceholder(latestApp.guarantorFirstName))
                        form.setFieldValue('guarantorFirstName', latestApp.guarantorFirstName);
                    if (latestApp.guarantorLastName && !isPlaceholder(latestApp.guarantorLastName))
                        form.setFieldValue('guarantorLastName',  latestApp.guarantorLastName);
                    if (latestApp.guarantorBirthDate)
                        form.setFieldValue('guarantorBirthDate',   latestApp.guarantorBirthDate);
                    if (latestApp.guarantorCivilStatus)
                        form.setFieldValue('guarantorCivilStatus', latestApp.guarantorCivilStatus);
                    if (latestApp.guarantorBusiness)
                        form.setFieldValue('guarantorBusiness',    latestApp.guarantorBusiness);
                    if (latestApp.guarantorDailyIncome)
                        form.setFieldValue('guarantorDailyIncome', latestApp.guarantorDailyIncome);
                    if (latestApp.guarantorAddress)
                        form.setFieldValue('guarantorAddress',     latestApp.guarantorAddress);
                }).catch(() => {});
            }, 300);

        } else {
            setSlotReadOnly(false);
            setCoMakerReadOnly(false);
            setCoMakerReadOnlyLabel('');
        }
        form?.setFieldValue('groupId', selectedGroup);
        form?.setFieldValue(field, value);
    };

    const handleSlotNoChange = (field, value) => {
        setSlotNo(value);
        formikRef.current?.setFieldValue('groupId', selectedGroup);
        if (clientType === 'offset') formikRef.current?.setFieldValue('clientId', clientId);
        formikRef.current?.setFieldValue(field, value);
    };

    const handleCoMakerChange = async (field, value) => {
        setSelectedCoMaker(value);
        formikRef.current?.setFieldValue('groupId', selectedGroup);
        if (clientType === 'offset') formikRef.current?.setFieldValue('clientId', clientId);
        formikRef.current?.setFieldValue(field, value);
        // Selecting a real co-maker clears the pending flag immediately
        if (value) {
            setCoMakerPending(false);
            setCoMakerPendingName('');
        }

        // Soft co-maker duplicate check — block UI while validating
        if (value && selectedGroup) {
            setCoMakerChecking(true);
            try {
                const params = new URLSearchParams({
                    groupId:   selectedGroup,
                    coMakerId: value,
                });
                // Pass clientId so server can detect self co-maker
                if (clientId) params.set('clientId', clientId);

                const res = await fetchWrapper.get(
                    getApiBaseUrl() + 'transactions/loans/check-comaker?' + params
                );

                if (res.success) {
                    if (res.selfCoMaker) {
                        // Block immediately — clear the selection
                        setSelectedCoMaker(null);
                        formikRef.current?.setFieldValue(field, null);
                        toast.error('A client cannot be their own co-maker.');
                    } else if (res.count > 0) {
                        const names = (res.loans || [])
                            .map(l => `${l.fullName} (Slot ${l.slotNo})`)
                            .join(', ');
                        toast.warning(
                            `Warning: This co-maker is already assigned to ${res.count} other loan(s) in this group: ${names}. ` +
                            `Proceed only if intentional.`,
                            { autoClose: 6000 }
                        );
                    }
                }
            } catch (e) { console.error(e); }
            finally { setCoMakerChecking(false); }
        }
    };

    const handleClientTypeChange = (value) => {
        setClientType(value);
        setOffsetClient(null);
        setSelectedClientObj(null);
        dispatch(setClientList([]));
        const form = formikRef.current;
        resetClient(form);
        if (value !== 'offset' && selectedGroup) getListClient(value, selectedGroup);

        const needsFullGroupList = value === 'advance' || value === 'active';
        if (rep === 4) {
            getListGroup(
                currentUser.transactionType,
                currentUser._id,
                needsFullGroupList ? 'filter' : undefined
            );
        } else if (rep === 3 && selectedLo) {
            getListGroup(
                groupOccurence,
                selectedLo,
                needsFullGroupList ? 'filter' : undefined
            );
        }
    };

    const handleOldBranchIdChange = (field, value) => {
        setSelectedOldBranch(value);
        setSelectedOldLO(null);
        setSelectedOldGroup(null);
        setOldLOList([]);
        setOldGroupList([]);
        formikRef.current?.setFieldValue(field, value);
        const b = (Array.isArray(branchList) ? branchList : []).find(b => b._id === value);
        if (b) getListUser(b.code, 'old');
    };

    const handleOldLoIdChange = (field, value) => {
        const lo = (oldLOList || []).find(l => l._id === value);
        setSelectedOldLO(value);
        setSelectedOldGroup(null);
        setOldGroupList([]);
        formikRef.current?.setFieldValue(field, value);
        getListGroup(lo?.transactionType || 'daily', value, 'filter', 'old');
    };

    const handleOldGroupIdChange = (field, value) => {
        setSelectedOldGroup(value);
        formikRef.current?.setFieldValue(field, value);
    };

    const handleOffsetClientSelect = (client) => {
        setOffsetClient(client);
        setClientId(client._id);
        setCiStatus(null);
        formikRef.current?.setFieldValue('clientId', client._id);
        // Balik clients always need new CI
        if (currentBranch?.clientFlowVersion === 'v2') {
            checkClientCI(client._id, true);
        }
    };

    // FIX: guarantor photo handlers
    const handleGuarantorPhotoChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const compressed = await compressImage(file);
        setGuarantorPhotoFile(compressed);
        setGuarantorPhotoPreview(URL.createObjectURL(compressed));
    };

    const handleGuarantorIdChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const compressed = await compressImage(file);
        setGuarantorIdFile(compressed);
        setGuarantorIdPreview(URL.createObjectURL(compressed));
    };

    const handleClearClient = () => {
        setSelectedClientObj(null);
        setOffsetClient(null);
        setCiStatus(null);
        resetClient(formikRef.current);
        setGuarantorPhotoFile(null);
        setGuarantorPhotoPreview(null);
        setGuarantorIdFile(null);
        setGuarantorIdPreview(null);
    };

    // ─────────────────────────────────────────────────────────
    // Save — exact mirror of AddUpdateLoanDrawer
    // ─────────────────────────────────────────────────────────
    const handleSaveUpdate = async(values, action) => {
        // ── Phase 7: Block loan creation without valid CI ─────────────────
        // Applies to all existing client types (reloan/pending/balik).
        // Prospect (clientType='pending') is excluded — they have no CI yet.
        // fromCI=true: already arrived from a completed CI investigation —
        // the CI check is redundant and ciStatus will always be null here.
        const needsCICheck = clientType !== 'pending' && !fromCI && currentBranch?.clientFlowVersion === 'v2';
        if (needsCICheck) {
            if (!ciStatus) {
                toast.error('Please wait — checking CI investigation status...');
                return;
            }
            if (!ciStatus.hasCI) {
                toast.error(
                    'Cannot add loan: no approved CI investigation found for this client. ' +
                    'A CI investigation must be completed before adding a loan.'
                );
                return;
            }
            if (ciStatus.latestCI?.isOld) {
                toast.error(
                    `Cannot add loan: CI investigation is outdated (${ciStatus.latestCI.monthsAgo} months ago). ` +
                    'A new CI investigation must be completed before adding a loan.'
                );
                return;
            }
        }

        // ── Guarantor ID photo is required ────────────────────────────────
        const requiresGuarantorPhoto = currentBranch?.clientFlowVersion === 'v2';
        if (requiresGuarantorPhoto && !guarantorIdFile && !guarantorIdPreview) {
            toast.error('Please upload a Guarantor Valid ID photo.');
            return;
        }

        setLoading(true);
        values.currentDate   = currentDate;
        values.clientId      = clientId;
        values.dateOfRelease = values.dateOfRelease || initialDateRelease;
        values.loanFor       = values.dateOfRelease === currentDate ? 'today' : 'tomorrow';
        values.groupLeader   = groupLeader;
        values.groupId       = selectedGroup;

        const group       = (Array.isArray(groupList) ? groupList : []).find(g => g._id === selectedGroup);
        values.groupName  = group?.name;
        values.loId       = group?.loanOfficerId;
        values.occurence  = group?.occurence;

        // group.branchId may be absent from list-by-group-occurence response.
        // Always fall back to currentUser.designatedBranchId for rep 3/4.
        const branch      = (Array.isArray(branchList) ? branchList : []).find(b => b._id === group?.branchId);
        values.branchId   = branch?._id   || currentUser.designatedBranchId || null;
        values.branchName = branch?.name  || currentUser.designatedBranch   || '';

        if (clientType === 'advance' || clientType === 'active') {
            values.mode               = clientType;
            values.oldLoanId          = selectedLoanId;
            values.advanceTransaction = true;
        } else if (clientType === 'pending' && selectedLoanId) {
            // Pending Member (completed loan) re-applying via CI flow
            // Treat as reloan so save.js closes old loan and updates MCBU correctly
            values.mode      = 'reloan';
            values.oldLoanId = selectedLoanId;
        }

        values.slotNo      = slotNo;
        values.loanTerms   = loanTerms;
        values.insertedBy  = currentUser._id;
        values.modifiedBy  = currentUser._id;
        values.modifiedDate = moment(new Date()).format('YYYY-MM-DD');
        if (values.occurence === 'weekly') values.groupDay = group?.day;

        const loanCycle = values.loanCycle || 1;
        if (loanCycle === 1) {
            values.admissionCollection     = transactionSettings.admissionFee;
            values.lrfCollection           = values.principalLoan * transactionSettings.lrfRate;
            values.cbhbCollection          = transactionSettings.cbhbFee;
            values.addHospitalization      = transactionSettings.addHospitalization;
            values.otherPassbookCollection = transactionSettings.otherPassbookFee;
            values.otherPictureCollection  = transactionSettings.otherPictureFee;
        } else {
            values.admissionCollection     = 0;
            values.lrfCollection           = values.principalLoan * transactionSettings.lrfRate;
            values.cbhbCollection          = transactionSettings.cbhbFee;
            values.addHospitalization      = transactionSettings.addHospitalization;
            values.otherPassbookCollection = transactionSettings.otherPassbookFee;
            values.otherPictureCollection  = 0;
        }
        values.csfCollection = 0;
        values.csfWithdrawal = 0;
        values.csfReturnAmt  = 0;

        // ── Computed loan financials ────────────────────────────────────
        // Recompute whenever the loan is not yet active — covers both new
        // pending loans and edits to existing pending loans. Only an
        // already-active loan should keep its financials untouched on edit.
        if (values.status !== 'active') {
            const serviceChargeRate = transactionSettings.serviceChargeRate;
            if (values.occurence === 'weekly') {
                // values.activeLoan = (values.principalLoan * serviceChargeRate) / 24;
                // values.loanTerms  = 24;
                const weeklyTermDays = loWeeklyScheduleType === 'accelerated' ? 12 : 24;
                values.activeLoan       = (values.principalLoan * serviceChargeRate) / weeklyTermDays;
                values.loanTerms        = weeklyTermDays;
                values.weeklyScheduleType = loWeeklyScheduleType;
            } else {
                values.loanTerms  = loanTerms;
                values.activeLoan = (values.principalLoan * serviceChargeRate) / (loanTerms === 60 ? 60 : 100);
                values.weeklyScheduleType = null;
            }
            values.loanBalance          = values.principalLoan * serviceChargeRate;
            values.amountRelease        = values.loanBalance;
            values.loanRelease          = values.loanBalance;
            values.currentReleaseAmount = values.amountRelease;
        }

        // ── Add mode only fields ───────────────────────────────────────────
        if (!isEdit) {
            values.admissionDate      = currentDate;
            values.status             = 'pending';
            values.noOfPayments       = 0;
            values.lastUpdated        = null;
            values.mcbuWithdrawal     = 0;
            values.mcbuInterest       = 0;
            values.mcbuReturnAmt      = 0;
            values.coMakerPending     = coMakerPending;
            values.coMakerPendingName = coMakerPending ? (coMakerPendingName || null) : null;
            // fullName from selected client
            const client = selectedClientObj || offsetClient;
            if (client) {
                values.fullName = `${client.lastName}, ${client.firstName}${client.middleName ? ' ' + client.middleName : ''}`.toUpperCase();
            }
        }


        // ── CoMaker — store slot number AND client UUID ──────────────────
        // selectedCoMaker is a client UUID (value from comakerList)
        // coMaker column in DB is varchar — must send as string not integer
        if (selectedCoMaker) {
            const coMakerEntry = (comakerList || []).find(c => c.value === selectedCoMaker);
            values.coMaker   = coMakerEntry?.slotNo
                ? coMakerEntry.slotNo.toString()   // varchar — always string
                : null;
            values.coMakerId = coMakerEntry?.clientId || selectedCoMaker || null;
        } else {
            values.coMaker   = null;
            values.coMakerId = null;
        }

        // Guard against empty strings being sent — always null not ""
        if (!values.coMaker)   values.coMaker   = null;
        if (!values.coMakerId) values.coMakerId = null;

        // Auto-clear coMakerPending when a real co-maker is assigned
        if (values.coMakerId) {
            values.coMakerPending     = false;
            values.coMakerPendingName = null;
        }

        const loanLimit = values.occurence === 'daily'
            ? transactionSettings.loanDailyLimit
            : transactionSettings.loanWeeklyLimit;

        if (values.principalLoan > loanLimit) {
            setLoading(false);
            toast.error(`Invalid Principal Loan. Maximum is ${formatPricePhp(loanLimit)}.`);
            return;
        }
        if (loanCycle === 1 && groupLeader && values.mcbu < transactionSettings.mcbuCsfMCBUForNM) {
            setLoading(false);
            toast.error(`Invalid MCBU. Minimum for group leader is ${formatPricePhp(transactionSettings.mcbuCsfMCBUForNM)}.`);
            return;
        }
        if (values.principalLoan % 1000 !== 0) {
            setLoading(false);
            toast.error('Principal loan must be divisible by 1,000.');
            return;
        }
        if (values.occurence === 'weekly' && (!values.mcbu || parseFloat(values.mcbu) < transactionSettings.minWeeklyMcbuCollection)) {
            setLoading(false);
            toast.error(`Invalid MCBU. Please enter at least ${transactionSettings.minWeeklyMcbuCollection}.`);
            return;
        }
        if (loanTerms === 100 && values.principalLoan < 10000) {
            setLoading(false);
            toast.error('For 100-day loan term, principal must be ≥ 10,000.');
            return;
        }

        let guarantorPhotoKey = isEdit ? (loanData?.guarantorPhotoKey || null) : null;
        if (guarantorPhotoFile) {
            try {
                const fd = new FormData();
                fd.append('file', guarantorPhotoFile);
                fd.append('origin', 'guarantor-photos');
                fd.append('uuid', clientId || `guarantor-${Date.now()}`);
                const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd });
                if (!uploadRes.ok) throw new Error(`Guarantor photo upload failed (${uploadRes.status}).`);
                const uploadData = await uploadRes.json();
                if (!uploadData.fileKey) throw new Error('Guarantor photo upload returned no file key.');
                guarantorPhotoKey = uploadData.fileKey;
            } catch (e) {
                console.error('Guarantor photo upload failed:', e);
                setLoading(false);
                toast.error('Failed to upload guarantor photo. Please try again before saving.');
                return;
            }
        }

        let guarantorIdPhotoKey = isEdit ? (loanData?.guarantorIdPhotoKey || null) : null;
        if (guarantorIdFile) {
            try {
                const fd = new FormData();
                fd.append('file', guarantorIdFile);
                fd.append('origin', 'guarantor-id-photos');
                fd.append('uuid', clientId || `guarantor-id-${Date.now()}`);
                const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd });
                if (!uploadRes.ok) throw new Error(`Guarantor ID upload failed (${uploadRes.status}).`);
                const uploadData = await uploadRes.json();
                if (!uploadData.fileKey) throw new Error('Guarantor ID upload returned no file key.');
                guarantorIdPhotoKey = uploadData.fileKey;
            } catch (e) {
                console.error('Guarantor ID upload failed:', e);
                setLoading(false);
                toast.error('Failed to upload guarantor ID. Please try again before saving.');
                return;
            }
        }

        const saveUrl = isEdit
            ? getApiBaseUrl() + 'transactions/loans'
            : getApiBaseUrl() + 'transactions/loans/save';


        // ── Build edit payload: loanData base + form values overlay ─────
        // Strip nested join objects that the update API doesn't accept.
        const loanDataFlat = isEdit && loanData ? (() => {
            const { branch, group, client, loanOfficer, groupStatus, pendings, ...flat } = loanData;
            return flat;
        })() : {};

        // Fields the form explicitly controls — only these override loanDataFlat.
        // Empty/null form values must NOT override populated DB values.
        const formControlledFields = {
            coMakerPending:      coMakerPending,
            coMakerPendingName:  coMakerPending ? (coMakerPendingName || null) : null,
            principalLoan:       values.principalLoan,
            loanCycle:           values.loanCycle,
            loanTerms:           values.loanTerms,
            mcbu:                values.mcbu,
            pnNumber:            values.pnNumber,
            dateOfRelease:       values.dateOfRelease,
            guarantorFirstName:  values.guarantorFirstName,
            guarantorMiddleName: values.guarantorMiddleName,
            guarantorLastName:   values.guarantorLastName,
            ciName:              values.ciName,
            groupId:             values.groupId,
            loId:                values.loId,
            slotNo:              values.slotNo,
            clientId:            values.clientId,
            coMaker:             values.coMaker,
            coMakerId:           values.coMakerId,
            // FIX: guarantor photo keys
            guarantorPhotoKey,
            guarantorIdPhotoKey,
            guarantorBirthDate:   values.guarantorBirthDate   || null,
            guarantorCivilStatus: values.guarantorCivilStatus || null,
            guarantorBusiness:    values.guarantorBusiness    || null,
            guarantorDailyIncome: values.guarantorDailyIncome || null,
            guarantorAddress:     values.guarantorAddress     || null,
        };

        // Computed fields set in handleSaveUpdate — always override
        const computedFields = {
            branchId:            values.branchId,
            branchName:          values.branchName,
            groupName:           values.groupName,
            occurence:           values.occurence,
            weeklyScheduleType:  values.weeklyScheduleType,
            loanFor:             values.loanFor,
            groupLeader:         values.groupLeader,
            modifiedBy:          values.modifiedBy,
            modifiedDate:        values.modifiedDate,
            currentDate:         values.currentDate,
            currentReleaseAmount: values.currentReleaseAmount,
            // FIX: financial fields computed above were being dropped —
            // loanDataFlat's stale values were winning instead.
            loanBalance:         values.loanBalance,
            amountRelease:       values.amountRelease,
            activeLoan:          values.activeLoan,
            loanRelease:         values.loanRelease,
            loanTerms:           values.loanTerms,
            admissionCollection:     values.admissionCollection,
            lrfCollection:           values.lrfCollection,
            cbhbCollection:          values.cbhbCollection,
            addHospitalization:      values.addHospitalization,
            otherPassbookCollection: values.otherPassbookCollection,
            otherPictureCollection:  values.otherPictureCollection,
            csfCollection:           values.csfCollection,
            csfWithdrawal:           values.csfWithdrawal,
            csfReturnAmt:            values.csfReturnAmt,
            // groupDay from group object
            groupDay: (() => {
                const grp = (Array.isArray(groupList) ? groupList : []).find(g => g._id === selectedGroup);
                return grp?.day || loanDataFlat.groupDay || null;
            })(),
        };

        // ── Derive fullName from client object (most reliable source) ──
        // loanData.fullName may be empty on bad test records — use client join
        const derivedFullName = (() => {
            const c = loanData?.client;
            if (c?.lastName && c?.firstName) {
                return `${c.lastName}, ${c.firstName}${c.middleName ? ' ' + c.middleName : ''}`.toUpperCase();
            }
            return loanDataFlat.fullName || values.fullName || '';
        })();

        const savePayload = isEdit
            ? {
                ...loanDataFlat,          // all original fields + flags preserved
                ...formControlledFields,  // form-edited fields win
                ...computedFields,        // computed/derived fields always win

                // fullName — derived from client object, never empty
                fullName: derivedFullName,

                // admissionDate — use loanData value if populated, else currentDate
                // (admissionDate = the date the loan was encoded, set once on creation)
                admissionDate: loanDataFlat.admissionDate?.trim()
                    ? loanDataFlat.admissionDate
                    : currentDate || '',

                // dateGranted — only set when loan is approved (status → active)
                // Keep null for pending loans — do NOT set from currentDate
                dateGranted: loanDataFlat.dateGranted || null,

                // dateAdded — server-side only, preserve whatever is in DB
                dateAdded: loanDataFlat.dateAdded || null,

                startDate:   loanDataFlat.startDate  || null,
                endDate:     loanDataFlat.endDate    || null,
                advanceDays: loanDataFlat.advanceDays ?? 0,

                _id: loanId,
              }
            : values;

        fetchWrapper.post(saveUrl, savePayload)
            .then(async response => {
                setLoading(false);
                if (response.error) {
                    toast.error(response.message);
                } else if (response.success || response.loan) {
                    if (!isEdit && clientType === 'active') {
                        const pendingLoan = [{ ...values, loanId: values.oldLoanId }];
                        setTimeout(async () => {
                            await fetchWrapper.post(
                                getApiBaseUrl() + 'transactions/cash-collections/update-pending-loans',
                                pendingLoan
                            );
                        }, 3000);
                    }

                    // Post-save guarantor duplicate check — runs in both add AND edit mode
                    // In edit mode: re-checks in case guarantor name was changed
                    // Uses the loan's own _id as excludeLoanId so it won't match itself
                    const targetLoanId = isEdit
                        ? loanId
                        : (response.loan?._id || response.loan?.data?._id || response._id);

                    if (targetLoanId && values.guarantorFirstName && values.guarantorLastName) {
                        try {
                            const checkRes = await fetchWrapper.get(
                                getApiBaseUrl() + 'transactions/loans/check-guarantor?' +
                                new URLSearchParams({
                                    branchId:           values.branchId || currentUser.designatedBranchId,
                                    guarantorFirstName: values.guarantorFirstName,
                                    guarantorLastName:  values.guarantorLastName,
                                    excludeLoanId:      targetLoanId,
                                    clientId:           clientId || values.clientId || '', // FIX: exclude this client's own loan history
                                })
                            );
                            if (checkRes.success && checkRes.count > 0) {
                                // Flag if not already flagged
                                if (!savePayload.guarantorDuplicate) {
                                    await fetchWrapper.post(
                                        getApiBaseUrl() + 'transactions/loans/clear-guarantor-flag',
                                        { loanId: targetLoanId, action: 'flag' }
                                    );
                                }
                                toast.warning(
                                    `Loan saved but flagged for guarantor review. ` +
                                    `Guarantor "${values.guarantorFirstName} ${values.guarantorLastName}" ` +
                                    `appears on ${checkRes.count} other loan(s). Admin review required before LDF approval.`,
                                    { autoClose: 6000 }
                                );
                            } else if (isEdit && savePayload.guarantorDuplicate) {
                                // Guarantor name was changed and no longer conflicts — auto-clear the flag
                                await fetchWrapper.post(
                                    getApiBaseUrl() + 'transactions/loans/clear-guarantor-flag',
                                    { loanId: targetLoanId, action: 'clear' }
                                ).catch(() => {});
                            }
                        } catch (e) { console.error('Guarantor check failed:', e); }
                    }

                    // Show co-maker duplicate warning if server flagged it
                    if (!isEdit && response.coMakerDuplicateWarning) {
                        const dupeNames = (response.coMakerDuplicateLoans || [])
                            .map(l => `${l.fullName} (Slot ${l.slotNo})`)
                            .join(', ');
                        toast.warning(
                            `Loan saved but co-maker is already assigned to: ${dupeNames}. Admin review may be required.`,
                            { autoClose: 8000 }
                        );
                    }
                    toast.success(isEdit ? 'Loan successfully updated.' : 'Loan application successfully added.');
                    action.setSubmitting = false;
                    // Small delay so flag mutations complete before navigating away
                    setTimeout(() => onSuccess?.(), 500);
                }
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
                toast.error('An error occurred. Please try again.');
            });
    };

    // ─────────────────────────────────────────────────────────
    // Formik config
    // ─────────────────────────────────────────────────────────
    const initialValues = useMemo(() => ({
        branchId:            '',
        loId:                rep === 4 ? (currentUser?._id || '') : '',
        groupId:             '',
        slotNo:              (initialClientId && initialGroupId && initialLoId && initialSlotNo)
                                 ? parseInt(initialSlotNo)
                                 : '',
        clientId:            '',
        fullName:            '',
        admissionDate:       '',
        mcbu:                groupOccurence === 'weekly'
                                 ? (transactionSettings?.minWeeklyMcbuCollection || 0) : 0,
        csf:                 0,
        dateGranted:         null,
        principalLoan:       5000,
        activeLoan:          0,
        loanBalance:         0,
        amountRelease:       0,
        noOfPayments:        0,
        coMaker:             null,
        loanCycle:           initialLoanCycle ? parseInt(initialLoanCycle) : 1,
        pnNumber:            '',
        guarantorFirstName:  initialGuarantorFN  || '',
        guarantorMiddleName: '',
        guarantorLastName:   initialGuarantorLN  || '',
        guarantorBirthDate:  initialGuarantorBD  || '',
        guarantorCivilStatus: initialGuarantorCS || '',
        guarantorBusiness:   initialGuarantorBiz || '',
        guarantorDailyIncome: initialGuarantorDI || '',
        guarantorAddress:    initialGuarantorAddress || '',
        status:              'pending',
        ciName:              initialCiName || '',
        dateOfRelease:       '',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []); 

    const validationSchema = yup.object().shape({
        groupId:            yup.string().required('Please select a group'),
        clientId:           yup.string().required('Please select a client'),
        principalLoan:      yup.number().integer().positive()
            .moreThan(4999, 'Principal loan should be 5,000 or greater')
            .required('Please enter principal loan'),
        slotNo:             yup.number().integer().positive().required('Please select a slot number'),
        loanCycle:          yup.number().integer().positive().required('Please enter a loan cycle number'),
        guarantorFirstName: yup.string().required('Please enter guarantor first name'),
        guarantorLastName:  yup.string().required('Please enter guarantor last name'),
        ciName:             yup.string().required('Please enter C.I. name'),
    });

    // ─────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────
    return (
        <div className="w-full min-h-screen bg-gray-50">

            {/* Sticky top bar */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
                <button type="button" onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                    <ArrowLeftIcon className="w-5 h-5 text-gray-500" />
                </button>
                <h1 className="text-sm font-semibold text-gray-900">{isEdit ? 'Edit Loan Application' : 'Add Loan Application'}</h1>
                {loading && <Spinner />}
            </div>

            {/* Guarantor duplicate banner — admin review in edit mode */}
            {isEdit && loanData?.guarantorDuplicate && (
                <div className="px-6 pt-4">
                    <GuarantorDuplicateBanner
                        loan={loanData}
                        onResolved={() => {
                            setLoanData(prev => ({ ...prev, guarantorDuplicate: false }));
                            setTimeout(() => onSuccess?.(), 800);
                        }}
                    />
                </div>
            )}

            {loanFetching && (
                <div className="flex items-center justify-center h-64">
                    <Spinner />
                </div>
            )}

            {!loanFetching && (
            <Formik
                enableReinitialize
                initialValues={initialValues}
                validationSchema={validationSchema}
                onSubmit={handleSaveUpdate}
                innerRef={formikRef}
            >
                {({ values, touched, errors, handleChange, handleSubmit, setFieldValue, setFieldTouched, isSubmitting, isValidating }) => (
                    <form onSubmit={handleSubmit} autoComplete="off">
                        <div className="px-6 py-6 grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-6">

                            {/* ── CI Warning Banner ─────────────────────────────── */}
                            {/* Shows when reloan/pending/balik client has no recent CI */}
                            {(ciChecking || ciStatus) && clientType !== 'pending' && currentBranch?.clientFlowVersion === 'v2' && (
                                <div className={`col-span-full mb-2 px-4 py-3 rounded-xl border flex items-start gap-3 ${
                                    ciChecking
                                        ? 'bg-gray-50 border-gray-200'
                                        : !ciStatus?.hasCI || ciStatus?.isBalik
                                            ? 'bg-red-50 border-red-300'
                                            : ciStatus?.latestCI?.isOld
                                                ? 'bg-amber-50 border-amber-300'
                                                : 'bg-green-50 border-green-300'
                                }`}>
                                    {ciChecking ? (
                                        <>
                                            <svg className="w-4 h-4 animate-spin text-gray-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                            </svg>
                                            <p className="text-sm text-gray-500">Checking CI investigation status...</p>
                                        </>
                                    ) : ciStatus?.isBalik && !ciStatus?.hasCI ? (
                                        <>
                                            <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                                            </svg>
                                            <div>
                                                <p className="text-sm font-semibold text-red-700">CI Required — Balik Client</p>
                                                <p className="text-xs text-red-600 mt-0.5">
                                                    This client is returning after a loan offset. A new CI investigation is required before processing their reloan.
                                                </p>
                                            </div>
                                        </>
                                    ) : !ciStatus?.hasCI ? (
                                        <>
                                            <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                                            </svg>
                                            <div>
                                                <p className="text-sm font-semibold text-red-700">No CI Investigation Found</p>
                                                <p className="text-xs text-red-600 mt-0.5">
                                                    This client has no approved CI investigation on record. Please conduct a CI investigation before processing this reloan.
                                                </p>
                                            </div>
                                        </>
                                    ) : ciStatus?.latestCI?.isOld ? (
                                        <>
                                            <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                                            </svg>
                                            <div>
                                                <p className="text-sm font-semibold text-amber-700">CI Investigation is Old</p>
                                                <p className="text-xs text-amber-600 mt-0.5">
                                                    Last CI was {ciStatus.latestCI.monthsAgo} months ago
                                                    {ciStatus.latestCI.picUserName ? ` by ${ciStatus.latestCI.picUserName}` : ''}.
                                                    Consider conducting a new CI investigation.
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                                            </svg>
                                            <div>
                                                <p className="text-sm font-semibold text-green-700">CI Investigation Complete</p>
                                                <p className="text-xs text-green-600 mt-0.5">
                                                    CI approved {ciStatus.latestCI.monthsAgo === 0 ? 'this month' : `${ciStatus.latestCI.monthsAgo} month(s) ago`}
                                                    {ciStatus.latestCI.picUserName ? ` by ${ciStatus.latestCI.picUserName}` : ''}.
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* LEFT — client selection */}
                            <SelectClientPanel
                                rep={rep}
                                currentUser={currentUser}
                                branchList={branchList}
                                loList={loList}
                                loListLoading={loListLoading}
                                groupList={groupList}
                                clientList={clientList}
                                comakerList={comakerList}
                                selectedLo={selectedLo}
                                selectedGroup={selectedGroup}
                                clientId={clientId}
                                clientType={clientType}
                                offsetClient={offsetClient}
                                selectedClientObj={selectedClientObj}
                                selectedOldBranch={selectedOldBranch}
                                selectedOldLO={selectedOldLO}
                                selectedOldGroup={selectedOldGroup}
                                oldLOList={oldLOList}
                                oldGroupList={oldGroupList}
                                slotNo={slotNo}
                                slotNumber={slotNumber}
                                selectedCoMaker={selectedCoMaker}
                                slotReadOnly={slotReadOnly}
                                coMakerReadOnly={coMakerReadOnly}
                                coMakerReadOnlyLabel={coMakerReadOnlyLabel}
                                loanCycle={values.loanCycle}
                                loStatus={loStatus}
                                handleLoIdChange={handleLoIdChange}
                                handleGroupIdChange={handleGroupIdChange}
                                handleClientIdChange={handleClientIdChange}
                                handleClientTypeChange={handleClientTypeChange}
                                handleSlotNoChange={handleSlotNoChange}
                                handleCoMakerChange={handleCoMakerChange}
                                coMakerChecking={coMakerChecking}
                                coMakerPending={coMakerPending}
                                coMakerPendingName={coMakerPendingName}
                                onCoMakerPendingChange={v => {
                                    if (v === 'clear') {
                                        // "Change" button clicked on read-only co-maker
                                        setCoMakerReadOnly(false);
                                        setCoMakerReadOnlyLabel('');
                                        setSelectedCoMaker(null);
                                        formikRef.current?.setFieldValue('coMaker', null);
                                        return;
                                    }
                                    setCoMakerPending(v);
                                    if (!v) setCoMakerPendingName('');
                                }}
                                onCoMakerPendingNameChange={setCoMakerPendingName}
                                handleOldBranchIdChange={handleOldBranchIdChange}
                                handleOldLoIdChange={handleOldLoIdChange}
                                handleOldGroupIdChange={handleOldGroupIdChange}
                                handleOffsetClientSelect={handleOffsetClientSelect}
                                onClearClient={handleClearClient}
                                isEditMode={isEdit}
                                touched={touched}
                                errors={errors}
                                setFieldTouched={setFieldTouched}
                                fromCI={fromCI}
                                initialLoName={initialLoName}
                                initialGroupName={initialGroupName}
                            />

                            {/* RIGHT — loan form */}
                            <LoanFormPanel
                                values={values}
                                touched={touched}
                                errors={errors}
                                handleChange={handleChange}
                                setFieldValue={setFieldValue}
                                setFieldTouched={setFieldTouched}
                                initialDateRelease={initialDateRelease}
                                fromCI={fromCI}
                                minDate={minDate}
                                maxDate={maxDate}
                                onDateChange={date => formikRef.current?.setFieldValue('dateOfRelease', date)}
                                loanTerms={loanTerms}
                                setLoanTerms={setLoanTerms}
                                groupOccurence={groupOccurence}
                                groupLeader={groupLeader}
                                clientId={clientId}
                                clientType={clientType}
                                selectedClientObj={selectedClientObj}
                                offsetClient={offsetClient}
                                onPNFocus={() => getLastPNNumber(setFieldValue)}
                                onPNBlur={e => handlePNNumber(e, setFieldValue)}
                                branchId={currentUser.designatedBranchId}
                                clientFlowVersionV2={currentBranch?.clientFlowVersion === 'v2'}
                                onBack={onBack}
                                loading={loading}
                                coMakerChecking={coMakerChecking}
                                isSubmitting={isSubmitting}
                                isValidating={isValidating}
                                guarantorPhotoPreview={guarantorPhotoPreview}
                                guarantorIdPhotoPreview={guarantorIdPreview}
                                onGuarantorPhotoChange={handleGuarantorPhotoChange}
                                onGuarantorIdChange={handleGuarantorIdChange}
                            />
                        </div>
                    </form>
                )}
            </Formik>
            )}
        </div>
    );
};

export default AddLoanPage;