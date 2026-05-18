// src/components/groups/ViewByGroups.js
// Revamped Groups page:
// — Groups displayed per Loan Officer (accordion/section per LO)
// — QR status badge visible inline — no need to click to check
// — Filters: Branch (admin/area+), Loan Officer, Status, QR status, Search
// — QR expiry shown with color coding (valid/expiring/expired)

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSelector, useDispatch }    from 'react-redux';
import { useRouter }                   from 'next/router';
import { toast }                       from 'react-toastify';
import moment                          from 'moment';
import {
    QrCode, Search, RefreshCw, Plus, Edit2, Trash2,
    ChevronDown, ChevronRight, Users, CheckCircle,
    AlertTriangle, Clock,
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

// ── QR status badge ───────────────────────────────────────────────────────
const QRBadge = ({ group, onClick }) => {
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
    const daysLeft  = expiresAt.diff(now, 'days');
    const expired   = now.isAfter(expiresAt);
    const expiring  = !expired && daysLeft <= 2;

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
                QR expires in {daysLeft}d
            </button>
        );
    }
    return (
        <button type="button" onClick={onClick}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition-colors">
            <CheckCircle className="w-3 h-3" />
            QR valid · {daysLeft}d left
        </button>
    );
};

// ── Group row card ────────────────────────────────────────────────────────
const GroupRow = ({ group, onQR, onEdit, onDelete, canEdit, canDelete, onRowClick }) => (
    <div onClick={() => onRowClick(group)}
        className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-center
            px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50
            last:border-0 transition-colors group/row">
        {/* Name */}
        <div>
            <p className="text-sm font-medium text-gray-900 group-hover/row:text-blue-700">
                {group.name}
            </p>
            <p className="text-xs text-gray-400">
                {group.occurence} · {group.day} · {group.time || '—'}
            </p>
        </div>
        {/* Members */}
        <div className="flex items-center gap-1 text-xs text-gray-500">
            <Users className="w-3.5 h-3.5" />
            {group.noOfClients ?? '—'} / {group.capacity ?? '—'}
        </div>
        {/* Status */}
        <div>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                group.status === 'open'  ? 'bg-green-100 text-green-700' :
                group.status === 'close' ? 'bg-red-100 text-red-700'    :
                group.status === 'full'  ? 'bg-amber-100 text-amber-700' :
                'bg-gray-100 text-gray-500'
            }`}>
                {group.status || '—'}
            </span>
        </div>
        {/* QR */}
        <div onClick={e => e.stopPropagation()}>
            <QRBadge group={group} onClick={() => onQR(group)} />
        </div>
        {/* Actions */}
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            {canEdit && (
                <button type="button" onClick={() => onEdit(group)}
                    className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400
                        hover:text-blue-600 transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                </button>
            )}
            {canDelete && (
                <button type="button" onClick={() => onDelete(group)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400
                        hover:text-red-600 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    </div>
);

// ── LO section (accordion) ────────────────────────────────────────────────
const LOSection = ({ loName, groups, defaultOpen = true, ...rowProps }) => {
    const [open, setOpen] = useState(defaultOpen);
    const qrCount = groups.filter(g => g.qrToken && moment().isBefore(moment(g.qrExpiresAt))).length;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-3">
            {/* LO header */}
            <button type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3
                    hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                    {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> :
                            <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <div className="text-left">
                        <p className="text-sm font-semibold text-gray-900">{loName}</p>
                        <p className="text-xs text-gray-400">
                            {groups.length} group{groups.length !== 1 ? 's' : ''}
                            {qrCount > 0 && ` · ${qrCount} with active QR`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {qrCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                            text-xs bg-green-100 text-green-700 border border-green-200">
                            <CheckCircle className="w-3 h-3" />
                            {qrCount} QR active
                        </span>
                    )}
                    <span className="text-xs text-gray-400 tabular-nums">
                        {groups.filter(g => !g.qrToken || moment().isAfter(moment(g.qrExpiresAt))).length} without QR
                    </span>
                </div>
            </button>

            {open && (
                <>
                    {/* Column headers */}
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2
                        bg-gray-50 border-t border-gray-100 text-xs font-semibold
                        text-gray-500 uppercase tracking-wide">
                        <span>Group Name</span>
                        <span>Members</span>
                        <span>Status</span>
                        <span>QR Code</span>
                        <span></span>
                    </div>
                    {groups.map(g => <GroupRow key={g._id} group={g} {...rowProps} />)}
                </>
            )}
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────
const ViewByGroupsPage = ({ uuid }) => {
    const dispatch    = useDispatch();
    const router      = useRouter();
    const currentUser = useSelector(s => s.user.data);
    const branchList  = useSelector(s => s.branch.list);
    const groupList   = useSelector(s => s.group.list);

    const [loading,   setLoading]   = useState(true);
    const [mode,      setMode]      = useState('add');
    const [group,     setGroup]     = useState({});
    const [showDrawer,setShowDrawer]= useState(false);
    const [showDel,   setShowDel]   = useState(false);

    // QR modal
    const [qrData,    setQrData]    = useState(null);
    const [qrOpen,    setQrOpen]    = useState(false);

    // Filters
    const [search,    setSearch]    = useState('');
    const [filterLO,  setFilterLO]  = useState('');
    const [filterSt,  setFilterSt]  = useState('');
    const [filterQR,  setFilterQR]  = useState('');

    const isAdmin    = currentUser?.role?.rep <= 2;
    const isBM       = currentUser?.role?.rep === 3;
    const isLO       = currentUser?.role?.rep === 4;
    const canEdit    = currentUser?.role?.rep <= 3;
    const canDelete  = currentUser?.role?.rep === 1;

    // ── Fetch ─────────────────────────────────────────────────────────────
    const fetchGroups = useCallback(async () => {
        setLoading(true);
        try {
            let url = getApiBaseUrl() + 'groups/list-all?';
            const params = {};

            // For rep 3/4, branchId is always on currentUser.designatedBranchId
            // No need to wait for branchList Redux store to populate
            const branchId = (isLO || isBM)
                ? (currentUser.designatedBranchId || branchList?.[0]?._id)
                : null;

            if (uuid) {
                params.loId     = uuid;
                if (branchId) params.branchId = branchId;
            } else if (isLO) {
                params.loId     = currentUser._id;
                if (branchId) params.branchId = branchId;
            } else if (isBM) {
                if (branchId) params.branchId = branchId;
            }
            // admin/area+: no branchId — fetches all
            // admin/area: no filter — gets all

            const res = await fetchWrapper.get(url + new URLSearchParams(params));
            if (res.success) {
                const groups = (res.groups || []).map(g => ({
                    ...g, day: g.day ? g.day.charAt(0).toUpperCase() + g.day.slice(1) : g.day
                }));
                dispatch(setGroupList(groups));
            } else {
                toast.error(res.message || 'Failed to load groups.');
            }
        } catch { toast.error('Error loading groups.'); }
        finally { setLoading(false); }
    }, [uuid, branchList, currentUser, isLO, isBM]);

    useEffect(() => {
        fetchGroups();
    }, [fetchGroups]);

    // ── QR ────────────────────────────────────────────────────────────────
    const buildQrData = (source) => ({
        ...source,
        url: `${window.location.origin}/apply/${source.qrToken}`,
    });

    const handleQR = useCallback(async (g) => {
        if (!g.qrToken || moment().isAfter(moment(g.qrExpiresAt))) {
            // Generate new QR
            try {
                const res = await fetchWrapper.post(getApiBaseUrl() + 'groups/generate-qr', { groupId: g._id });
                if (res.success) {
                    // API returns res.qr with qrToken, qrExpiresAt, groupName, branchName, loName
                    const merged = { ...g, ...res.qr };
                    setQrData(buildQrData(merged));
                    setQrOpen(true);
                    fetchGroups();
                } else { toast.error(res.message || 'Failed to generate QR.'); }
            } catch { toast.error('Error generating QR.'); }
        } else {
            // Existing valid QR — build URL from group's qrToken
            setQrData(buildQrData(g));
            setQrOpen(true);
        }
    }, [fetchGroups]);

    // ── LO options ────────────────────────────────────────────────────────
    const loOptions = useMemo(() => {
        const names = [...new Set((groupList || []).map(g => g.loanOfficerName).filter(Boolean))].sort();
        return names;
    }, [groupList]);

    // ── Filtered + grouped ────────────────────────────────────────────────
    const grouped = useMemo(() => {
        const now = moment();
        let list  = groupList || [];

        if (search)   list = list.filter(g =>
            g.name?.toLowerCase().includes(search.toLowerCase()) ||
            g.loanOfficerName?.toLowerCase().includes(search.toLowerCase()));
        if (filterLO) list = list.filter(g => g.loanOfficerName === filterLO);
        if (filterSt) list = list.filter(g => g.status === filterSt);
        if (filterQR === 'active')  list = list.filter(g => g.qrToken && now.isBefore(moment(g.qrExpiresAt)));
        if (filterQR === 'none')    list = list.filter(g => !g.qrToken || now.isAfter(moment(g.qrExpiresAt)));
        if (filterQR === 'expiring')list = list.filter(g => {
            if (!g.qrToken) return false;
            const d = moment(g.qrExpiresAt).diff(now, 'days');
            return d >= 0 && d <= 2;
        });

        // Group by loan officer
        const byLO = {};
        list.forEach(g => {
            const lo = g.loanOfficerName || 'Unassigned';
            if (!byLO[lo]) byLO[lo] = [];
            byLO[lo].push(g);
        });
        // Sort groups within each LO by groupNo
        Object.values(byLO).forEach(arr => arr.sort((a, b) => (a.groupNo || 0) - (b.groupNo || 0)));
        return Object.entries(byLO).sort(([a], [b]) => a.localeCompare(b));
    }, [groupList, search, filterLO, filterSt, filterQR]);

    const total   = groupList?.length || 0;
    const hasQR   = (groupList || []).filter(g => g.qrToken && moment().isBefore(moment(g.qrExpiresAt))).length;
    const noQR    = total - hasQR;

    const actionButtons = canEdit ? [
        <ButtonSolid key="add" label="Add Group" type="button"
            className="p-2 mr-3" onClick={() => { setMode('add'); setGroup({}); setShowDrawer(true); }}
            icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
    ] : [];

    const layout = (
        <Layout actionButtons={actionButtons}>
            <div className="pb-6 space-y-4">
                {/* Stats strip */}
                <div className="flex gap-4 flex-wrap">
                    {[
                        { label: 'Total Groups',    val: total },
                        { label: 'QR Active',       val: hasQR,  cls: 'text-green-700' },
                        { label: 'No/Expired QR',   val: noQR,   cls: 'text-amber-700' },
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
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search group or LO..."
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
                    <select value={filterQR} onChange={e => setFilterQR(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm
                            focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">All QR Statuses</option>
                        <option value="active">QR Active</option>
                        <option value="none">No / Expired QR</option>
                        <option value="expiring">Expiring Soon (≤2d)</option>
                    </select>
                    <button type="button" onClick={fetchGroups}
                        className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Groups by LO */}
                {loading ? <div className="flex justify-center py-16"><Spinner /></div> :
                 grouped.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <QrCode className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                        <p className="text-sm">No groups found</p>
                    </div>
                ) : grouped.map(([loName, groups]) => (
                    <LOSection key={loName} loName={loName} groups={groups}
                        defaultOpen={grouped.length <= 3}
                        onQR={handleQR}
                        onEdit={g => { setMode('edit'); setGroup(g); setShowDrawer(true); }}
                        onDelete={g => { setGroup(g); setShowDel(true); }}
                        onRowClick={g => router.push('/groups/clients/' + g._id)}
                        canEdit={canEdit} canDelete={canDelete}
                    />
                ))}
            </div>

            {/* Add/Edit drawer */}
            <AddUpdateGroup mode={mode} group={group}
                showSidebar={showDrawer} setShowSidebar={setShowDrawer}
                onClose={() => { setMode('add'); setGroup({}); fetchGroups(); }} />

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
                            const res = await fetchWrapper.postCors(getApiBaseUrl() + 'groups/delete', { _id: group._id });
                            if (res.success) { setShowDel(false); toast.success('Group deleted.'); fetchGroups(); }
                            else toast.error(res.message);
                        }} />
                </div>
            </Dialog>

            {/* QR modal */}
            {qrOpen && qrData && (
                <GroupQRModal
                    isOpen={qrOpen}
                    onClose={() => setQrOpen(false)}
                    qrData={qrData}
                    onRegenerate={() => handleQR(qrData)}
                />
            )}
        </Layout>
    );

    // LO gets the layout without the branch-level wrapper
    if (currentUser.role.rep >= 3) return layout;

    // Admin/area: wrap in their own layout (already done above)
    return layout;
};

export default ViewByGroupsPage;