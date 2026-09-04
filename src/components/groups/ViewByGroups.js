// src/components/groups/ViewByGroups.js
// FIX: QR hidden/non-clickable for full groups
// FIX: LO self-view filters by transactionType (occurence param to API + client-side safety net)
// FIX: Ordering — LO by loNo (1→12), groups by groupNo within LO
// FIX: Higher roles — Branch → LO (by loNo) → Groups (by groupNo)

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSelector, useDispatch }    from 'react-redux';
import { useRouter }                   from 'next/router';
import { toast }                       from 'react-toastify';
import moment                          from 'moment';
import {
    QrCode, Search, RefreshCw, Edit2, Trash2,
    ChevronDown, ChevronRight, Users, CheckCircle,
    AlertTriangle, Clock, Building2,
} from 'lucide-react';
import Layout                          from '@/components/Layout';
import Spinner                         from '@/components/Spinner';
import { fetchWrapper }                from '@/lib/fetch-wrapper';
import { getApiBaseUrl }               from '@/lib/constants';
import { setGroupList }                from '@/redux/actions/groupActions';
import GroupQRModal                    from '@/components/groups/GroupQRModal';
import AddUpdateGroup                  from '@/components/groups/AddUpdateGroupDrawer';
import Dialog                          from '@/lib/ui/Dialog';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import ButtonSolid   from '@/lib/ui/ButtonSolid';
import { PlusIcon }                    from '@heroicons/react/24/solid';
import { setBranch } from '@/redux/actions/branchActions';

const ScheduleTypeBadge = ({ scheduleType }) => {
    if (!scheduleType) return null;
    const isAccelerated = scheduleType === 'accelerated';
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
            ${isAccelerated
                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                : 'bg-sky-100 text-sky-700 border border-sky-200'}`}>
            {isAccelerated ? '⚡ Accelerated · 12wk' : '📅 Standard · 24wk'}
        </span>
    );
};

// ── QR status badge ───────────────────────────────────────────────────────
const QRBadge = ({ currentBranch, group, onClick }) => {
    if (currentBranch?.clientFlowVersion === 'v1') {
        return null;
    }
    // FIX: use both status AND availableSlots — either signals full
    // const isFull = group.status === 'full' || !group.availableSlots?.length;

    // Full group — always show non-clickable badge regardless of QR state
    // if (isFull) {
    //     return (
    //         <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
    //             bg-gray-100 text-gray-500 border border-gray-200">
    //             <Users className="w-3 h-3" />
    //             Group Full
    //         </div>
    //     );
    // }

    if (!group.qrToken) {
        return (
            <button type="button" onClick={onClick}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                    bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600
                    border border-gray-200 transition-colors">
                <QrCode className="w-3 h-3" />
                Generate QR
            </button>
        );
    }

    const now       = moment();
    const expiresAt = moment(group.qrExpiresAt);
    const expired   = now.isAfter(expiresAt);
    const minsLeft  = expiresAt.diff(now, 'minutes');
    const hoursLeft = expiresAt.diff(now, 'hours');
    const daysLeft  = expiresAt.diff(now, 'days');
    const expiring  = !expired && daysLeft < 2;

    const timeLabel = expired ? '' :
        minsLeft < 60  ? `${minsLeft}m` :
        hoursLeft < 24 ? `${hoursLeft}h` :
        `${daysLeft}d`;

    if (expired) {
        return (
            <button type="button" onClick={onClick}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                    bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 transition-colors">
                <AlertTriangle className="w-3 h-3" />
                QR Expired — Renew
            </button>
        );
    }
    if (expiring) {
        return (
            <button type="button" onClick={onClick}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                    bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 transition-colors">
                <Clock className="w-3 h-3" />
                QR expires in {timeLabel}
            </button>
        );
    }
    return (
        <button type="button" onClick={onClick}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition-colors">
            <CheckCircle className="w-3 h-3" />
            QR valid · {timeLabel} left
        </button>
    );
};

// ── Group row ─────────────────────────────────────────────────────────────
const GroupRow = ({ currentBranch, group, onQR, onEdit, onDelete, canEdit, canDelete, onRowClick }) => {
    const showQR = currentBranch?.clientFlowVersion === 'v2';
    return (
        <div onClick={() => onRowClick(group)}
            className={`grid ${showQR ? 'grid-cols-[2fr_1fr_1fr_1fr_auto]' : 'grid-cols-[2fr_1fr_1fr_auto]'} gap-3 items-center
                px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50
                last:border-0 transition-colors group/row"`}>
            <div>
                <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 group-hover/row:text-blue-700">
                        {group.name}
                    </p>
                    {group.occurence === 'weekly' && (
                        <ScheduleTypeBadge scheduleType={group.weeklyScheduleType} />
                    )}
                </div>
                <p className="text-xs text-gray-400">
                    {group.occurence} · {group.day} · {group.time || '—'}
                </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
                <Users className="w-3.5 h-3.5" />
                {group.noOfClients ?? '—'} / {group.capacity ?? '—'}
            </div>
            <div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    group.status === 'open'      ? 'bg-green-100 text-green-700'  :
                    group.status === 'close'     ? 'bg-red-100 text-red-700'      :
                    group.status === 'full'      ? 'bg-amber-100 text-amber-700'  :
                    group.status === 'available' ? 'bg-blue-50 text-blue-600'     :
                    'bg-gray-100 text-gray-500'
                }`}>
                    {group.status || '—'}
                </span>
            </div>
            {showQR && (
                <div onClick={e => e.stopPropagation()}>
                    <QRBadge currentBranch={currentBranch} group={group} onClick={() => onQR(group)} />
                </div>
            )}
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                {canEdit && (
                    <button type="button" onClick={() => onEdit(group)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                )}
                {canDelete && (
                    <button type="button" onClick={() => onDelete(group)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
};

// ── LO section (accordion) ────────────────────────────────────────────────
const LOSection = ({ currentBranch, loName, groups, defaultOpen = true, ...rowProps }) => {
    const [open, setOpen] = useState(defaultOpen);
    const showQR = currentBranch?.clientFlowVersion === 'v2';
    const now     = moment();
    const qrCount = groups.filter(g => g.qrToken && now.isBefore(moment(g.qrExpiresAt))).length;
    const noQRCount = groups.filter(g => !g.qrToken || now.isAfter(moment(g.qrExpiresAt))).length;

    // ── Detect mixed schedule types within this LO's weekly groups ──
    // If groups.length > 15 for a weekly LO, or more than one distinct
    // weeklyScheduleType value appears, that's almost certainly stale
    // duplicate data — surface it loudly rather than silently rendering both.
    const weeklyGroups = groups.filter(g => g.occurence === 'weekly');
    const scheduleTypes = [...new Set(weeklyGroups.map(g => g.weeklyScheduleType).filter(Boolean))];
    const hasMixedSchedule = scheduleTypes.length > 1;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-3">
            <button type="button" onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                    {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <div className="text-left">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">{loName}</p>
                            {hasMixedSchedule && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                                    text-xs font-semibold bg-red-100 text-red-700 border border-red-300">
                                    <AlertTriangle className="w-3 h-3" />
                                    Mixed schedule types — needs cleanup
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400">
                            {groups.length} group{groups.length !== 1 ? 's' : ''}
                            {showQR && qrCount > 0 && ` · ${qrCount} with active QR`}
                        </p>
                    </div>
                </div>
                {showQR && (
                    <div className="flex items-center gap-2">
                        {qrCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                                text-xs bg-green-100 text-green-700 border border-green-200">
                                <CheckCircle className="w-3 h-3" />
                                {qrCount} QR active
                            </span>
                        )}
                        {noQRCount > 0 && (
                            <span className="text-xs text-gray-400 tabular-nums">
                                {noQRCount} without QR
                            </span>
                        )}
                    </div>
                )}
            </button>

            {open && (
                <>
                    <div className={`grid ${showQR ? 'grid-cols-[2fr_1fr_1fr_1fr_auto]' : 'grid-cols-[2fr_1fr_1fr_auto]'} gap-3 px-4 py-2
                        bg-gray-50 border-t border-gray-100 text-xs font-semibold
                        text-gray-500 uppercase tracking-wide"`}>
                        <span>Group Name</span>
                        <span>Members</span>
                        <span>Status</span>
                        {showQR && <span>QR Code</span>}
                        <span />
                    </div>
                    {groups.map(g => <GroupRow key={g._id} currentBranch={currentBranch} group={g} {...rowProps} />)}
                </>
            )}
        </div>
    );
};

// ── Branch header — for admin/area views ──────────────────────────────────
const BranchHeader = ({ branchName, totalGroups }) => (
    <div className="flex items-center gap-2 mb-2 px-1 mt-4 first:mt-0">
        <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <p className="text-sm font-bold text-gray-800">{branchName}</p>
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">{totalGroups} group{totalGroups !== 1 ? 's' : ''}</span>
    </div>
);

// ── Main component ────────────────────────────────────────────────────────
const ViewByGroupsPage = ({ origin, uuid }) => {
    const dispatch    = useDispatch();
    const router      = useRouter();
    const currentUser = useSelector(s => s.user.data);
    const branchList  = useSelector(s => s.branch.list);
    const groupList   = useSelector(s => s.group.list);
    const currentBranch = useSelector(state => state.branch.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const selectedLO = useSelector(s => s.user.selectedLO);

    const [loading,    setLoading]    = useState(true);
    const [mode,       setMode]       = useState('add');
    const [group,      setGroup]      = useState({});
    const [showDrawer, setShowDrawer] = useState(false);
    const [showDel,    setShowDel]    = useState(false);
    const [qrData,     setQrData]     = useState(null);
    const [qrOpen,     setQrOpen]     = useState(false);

    // Filters
    const [search,   setSearch]   = useState('');
    const [filterLO, setFilterLO] = useState('');
    const [filterSt, setFilterSt] = useState('');
    const [filterQR, setFilterQR] = useState('');

    const isAdmin = currentUser?.role?.rep <= 2;
    const isBM    = currentUser?.role?.rep === 3;
    const isLO    = currentUser?.role?.rep === 4;
    const canEdit  = currentUser?.role?.rep <= 3;
    const canDelete = currentUser?.role?.rep === 1;

    const getCurrentBranch = async (branchId) => {
        const apiUrl = `${getApiBaseUrl()}branches?`;
        const params = { _id: branchId, date: currentDate };
        const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
        if (response.success) {
            dispatch(setBranch(response.branch));
        }
    }

    useEffect(() => {
        if (origin === 'lo-groups' && selectedLO?.designatedBranchId) {
            getCurrentBranch(selectedLO.designatedBranchId);
        }
    }, [origin, selectedLO])

    // ── Fetch ─────────────────────────────────────────────────────────────
    const fetchGroups = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            const branchId = (isLO || isBM)
                ? (currentUser.designatedBranchId || branchList?.[0]?._id)
                : null;

            if (uuid) {
                // BM clicked through to a specific LO
                params.loId = uuid;
                if (branchId) params.branchId = branchId;
            } else if (isLO) {
                params.loId = currentUser._id;
                if (branchId) params.branchId = branchId;
                // FIX: pass transactionType as occurence so API filters
                // groups matching the LO's own type (daily or weekly)
                if (currentUser.transactionType) {
                    params.occurence = currentUser.transactionType;
                }
            } else if (isBM) {
                if (branchId) params.branchId = branchId;
            }
            // admin/area+: no filter — fetches all

            const res = await fetchWrapper.get(
                getApiBaseUrl() + 'groups/list-all?' + new URLSearchParams(params)
            );
            if (res.success) {
                const groups = (res.groups || []).map(g => ({
                    ...g,
                    day: g.day ? g.day.charAt(0).toUpperCase() + g.day.slice(1) : g.day,
                }));
                dispatch(setGroupList(groups));
            } else {
                toast.error(res.message || 'Failed to load groups.');
            }
        } catch {
            toast.error('Error loading groups.');
        } finally {
            setLoading(false);
        }
    }, [uuid, branchList, currentUser, isLO, isBM]);

    useEffect(() => { fetchGroups(); }, [fetchGroups]);

    // ── QR ────────────────────────────────────────────────────────────────
    const buildQrData = (source) => ({
        ...source,
        url:        `${window.location.origin}/apply/${source.qrToken}`,
        loName:     source.loName     || source.loanOfficerName || '—',
        branchName: source.branchName || '—',
        groupName:  source.groupName  || source.name            || '—',
    });

    const handleQR = useCallback(async (g, forceGenerate = false) => {
        if (forceGenerate || !g.qrToken || moment().isAfter(moment(g.qrExpiresAt))) {
            try {
                const res = await fetchWrapper.post(
                    getApiBaseUrl() + 'groups/generate-qr', { groupId: g._id }
                );
                if (res.success) {
                    const merged = { ...g, ...res.qr };
                    setQrData(buildQrData(merged));
                    setQrOpen(true);
                    fetchGroups();
                } else {
                    toast.error(res.message || 'Failed to generate QR.');
                }
            } catch {
                toast.error('Error generating QR.');
            }
        } else {
            setQrData(buildQrData(g));
            setQrOpen(true);
        }
    }, [fetchGroups]);

    // ── LO filter options ─────────────────────────────────────────────────
    const loOptions = useMemo(() => {
        const names = [...new Set(
            (groupList || []).map(g => g.loanOfficerName).filter(Boolean)
        )].sort();
        return names;
    }, [groupList]);

    // ── Grouped data — Branch → LO (by loNo) → Groups (by groupNo) ───────
    const grouped = useMemo(() => {
        const now = moment();
        let list  = groupList || [];

        // FIX: LO self-view — client-side safety net filter by transactionType
        // In case API didn't filter (e.g. cached redux state from a previous fetch)
        if (isLO && currentUser?.transactionType) {
            list = list.filter(g =>
                g.occurence === currentUser.transactionType ||
                g.loTransactionType === currentUser.transactionType
            );
        }

        // NEW: exact schedule-type filter — only show a weekly group if its own
        // weeklyScheduleType matches its LO's CURRENT weeklyScheduleType. This is
        // what actually hides stale duplicate-theme groups (e.g. leftover
        // 'standard' groups on an LO that's since switched to 'accelerated'),
        // rather than just making them visually distinct. Daily groups
        // (weeklyScheduleType === null on both sides) pass through untouched.
        list = list.filter(g => {
            if (g.occurence !== 'weekly') return true;
            // If loWeeklyScheduleType is missing (e.g. API not yet redeployed,
            // or an LO record with no weeklyScheduleType set), fail open rather
            // than hiding everything — better to show a possible duplicate than
            // to silently hide a legitimate group due to a data gap.
            if (!g.loWeeklyScheduleType) return true;
            return g.weeklyScheduleType === g.loWeeklyScheduleType;
        });

        // ── Apply search + filters ────────────────────────────────────────
        if (search)   list = list.filter(g =>
            g.name?.toLowerCase().includes(search.toLowerCase()) ||
            g.loanOfficerName?.toLowerCase().includes(search.toLowerCase()) ||
            g.branchName?.toLowerCase().includes(search.toLowerCase())
        );
        if (filterLO) list = list.filter(g => g.loanOfficerName === filterLO);
        if (filterSt) list = list.filter(g => g.status === filterSt);
        if (filterQR === 'active')   list = list.filter(g =>
            g.qrToken && now.isBefore(moment(g.qrExpiresAt)));
        if (filterQR === 'none')     list = list.filter(g =>
            !g.qrToken || now.isAfter(moment(g.qrExpiresAt)));
        if (filterQR === 'expiring') list = list.filter(g => {
            if (!g.qrToken) return false;
            const d = moment(g.qrExpiresAt).diff(now, 'days');
            return d >= 0 && d <= 2;
        });

        // ── Higher roles (admin/area/BM without specific LO uuid) ─────────
        // Structure: Branch → LO (by loNo) → Groups (by groupNo)
        const showBranchLevel = !isLO && !uuid && (isAdmin || isBM);

        if (showBranchLevel) {
            // { branchKey: { loKey: { loNo, loName, groups[] } } }
            const byBranch = {};
            list.forEach(g => {
                const branchKey = g.branchName || g.branchCode || g.branchId || 'Unknown Branch';
                const loKey     = g.loanOfficerId || 'unassigned';
                const loName    = g.loanOfficerName || 'Unassigned';
                // FIX: extract loNo from loanOfficerName as fallback
                const loNoFromName2 = loName.match(/LO\s+(\d+)/i);
                const loNo      = g.loNo ?? (loNoFromName2 ? parseInt(loNoFromName2[1]) : 999);

                if (!byBranch[branchKey]) byBranch[branchKey] = {};
                if (!byBranch[branchKey][loKey]) {
                    byBranch[branchKey][loKey] = { loNo, loName, groups: [] };
                }
                byBranch[branchKey][loKey].groups.push(g);
            });

            // Sort groups within each LO by groupNo
            Object.values(byBranch).forEach(loMap => {
                Object.values(loMap).forEach(lo => {
                    lo.groups.sort((a, b) => (a.groupNo || 0) - (b.groupNo || 0));
                });
            });

            // Return: [ { branchName, sections: [ { loName, groups[] } ] } ]
            // branches sorted alphabetically, LOs within branch sorted by loNo
            return Object.entries(byBranch)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([branchName, loMap]) => ({
                    branchName,
                    sections: Object.values(loMap)
                        .sort((a, b) => (a.loNo || 999) - (b.loNo || 999))
                        .map(({ loName, groups }) => ({ loName, groups })),
                }));
        }

        // ── LO self-view or BM viewing specific LO (uuid) ─────────────────
        // Structure: LO (by loNo) → Groups (by groupNo) — no branch header
        const byLO = {};
        list.forEach(g => {
            const loKey  = g.loanOfficerId || 'unassigned';
            const loName = g.loanOfficerName || 'Unassigned';
            // FIX: extract loNo from loanOfficerName if loNo not returned by API
            // e.g. "Naga, LO 3" → 3, "Pasig II, LO 12" → 12
            const loNoFromName = loName.match(/LO\s+(\d+)/i);
            const loNo   = g.loNo ?? (loNoFromName ? parseInt(loNoFromName[1]) : 999);
            if (!byLO[loKey]) byLO[loKey] = { loNo, loName, groups: [] };
            byLO[loKey].groups.push(g);
        });

        // Sort groups within each LO by groupNo
        Object.values(byLO).forEach(lo => {
            lo.groups.sort((a, b) => (a.groupNo || 0) - (b.groupNo || 0));
        });

        // Return: [ { loName, groups[] } ] sorted by loNo (1 → 12)
        return Object.values(byLO)
            .sort((a, b) => (a.loNo || 999) - (b.loNo || 999))
            .map(({ loName, groups }) => ({ loName, groups }));

    }, [groupList, search, filterLO, filterSt, filterQR,
        isLO, isAdmin, isBM, uuid, currentUser]);

    // ── Stats ─────────────────────────────────────────────────────────────
    const total = groupList?.length || 0;
    const hasQR = (groupList || []).filter(g =>
        g.qrToken && moment().isBefore(moment(g.qrExpiresAt))
    ).length;
    const noQR  = total - hasQR;

    const rowProps = {
        onQR:      handleQR,
        onEdit:    g => { setMode('edit'); setGroup(g); setShowDrawer(true); },
        onDelete:  g => { setGroup(g); setShowDel(true); },
        onRowClick: g => router.push('/groups/clients/' + g._id),
        canEdit,
        canDelete,
    };

    const actionButtons = canEdit ? [
        <ButtonSolid key="add" label="Add Group" type="button"
            className="p-2 mr-3"
            onClick={() => { setMode('add'); setGroup({}); setShowDrawer(true); }}
            icon={[<PlusIcon key="icon" className="w-5 h-5" />, 'left']} />,
    ] : [];

    const content = (
        <div className="pb-6 space-y-4">

            {/* Stats strip */}
            <div className="flex gap-4 flex-wrap">
                {[
                    { label: 'Total Groups',  val: total },
                    ...(currentBranch?.clientFlowVersion === 'v2' ? [
                        { label: 'QR Active',     val: hasQR, cls: 'text-green-700' },
                        { label: 'No/Expired QR', val: noQR,  cls: 'text-amber-700' },
                    ] : []),
                ].map(({ label, val, cls }) => (
                    <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 py-2">
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className={`text-lg font-bold ${cls || 'text-gray-900'}`}>{val}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap gap-3">
                <div className="flex-1 min-w-[180px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search group, LO or branch..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm
                            focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {!isLO && (
                    <select value={filterLO} onChange={e => setFilterLO(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm
                            focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">All Loan Officers</option>
                        {loOptions.map(lo => <option key={lo} value={lo}>{lo}</option>)}
                    </select>
                )}
                <select value={filterSt} onChange={e => setFilterSt(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm
                        focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">All Statuses</option>
                    {['open','close','full','available'].map(s =>
                        <option key={s} value={s}>{s}</option>)}
                </select>
                {currentBranch?.clientFlowVersion === 'v2' && (
                    <select value={filterQR} onChange={e => setFilterQR(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm
                            focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">All QR Statuses</option>
                        <option value="active">QR Active</option>
                        <option value="none">No / Expired QR</option>
                        <option value="expiring">Expiring Soon (≤2d)</option>
                    </select>
                )}
                <button type="button" onClick={fetchGroups}
                    className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Group list */}
            {loading ? (
                <div className="flex justify-center py-16"><Spinner /></div>
            ) : grouped.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <QrCode className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                    <p className="text-sm">No groups found</p>
                </div>
            ) : grouped.map((item, i) => {
                if (item.branchName) {
                    const totalGroups = item.sections.reduce(
                        (t, s) => t + s.groups.length, 0
                    );
                    return (
                        <div key={item.branchName + i}>
                            <BranchHeader
                                branchName={item.branchName}
                                totalGroups={totalGroups}
                            />
                            {item.sections.map(({ loName, groups }) => (
                                <LOSection
                                    currentBranch={currentBranch}
                                    key={loName}
                                    loName={loName}
                                    groups={groups}
                                    defaultOpen={
                                        grouped.length <= 2 &&
                                        item.sections.length <= 4
                                    }
                                    {...rowProps}
                                />
                            ))}
                        </div>
                    );
                }

                return (
                    <LOSection
                        currentBranch={currentBranch}
                        key={item.loName + i}
                        loName={item.loName}
                        groups={item.groups}
                        defaultOpen={grouped.length <= 3}
                        {...rowProps}
                    />
                );
            })}
        </div>
    );

    return (
        <React.Fragment>
            {origin === 'lo-groups' ? (
                <div className="p-6">
                    {content}
                </div>
            ) : (
                <Layout actionButtons={actionButtons}>
                    {content}
                </Layout>
            )}

            {/* Add/Edit drawer */}
            <AddUpdateGroup
                mode={mode} group={group}
                showSidebar={showDrawer} setShowSidebar={setShowDrawer}
                onClose={() => { setMode('add'); setGroup({}); fetchGroups(); }}
            />

            {/* Delete dialog */}
            <Dialog show={showDel}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <p className="text-center text-xl font-normal text-gray-800">
                        Delete <strong>{group.name}</strong>?
                    </p>
                </div>
                <div className="flex flex-row justify-center px-4 py-3 gap-3">
                    <ButtonOutline label="Cancel" type="button" className="p-2"
                        onClick={() => setShowDel(false)} />
                    <ButtonSolid label="Yes, delete" type="button" className="p-2"
                        onClick={async () => {
                            const res = await fetchWrapper.postCors(
                                getApiBaseUrl() + 'groups/delete', { _id: group._id }
                            );
                            if (res.success) {
                                setShowDel(false);
                                toast.success('Group deleted.');
                                fetchGroups();
                            } else {
                                toast.error(res.message);
                            }
                        }} />
                </div>
            </Dialog>

            {/* QR modal */}
            {qrOpen && qrData && (
                <GroupQRModal
                    isOpen={qrOpen}
                    onClose={() => setQrOpen(false)}
                    qrData={qrData}
                    onRegenerate={() => handleQR(
                        { ...qrData, _id: qrData._id }, true
                    )}
                />
            )}
        </React.Fragment>
    );
};

export default ViewByGroupsPage;