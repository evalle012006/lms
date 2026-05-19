import React, { useEffect, useState, useCallback } from 'react';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import HierarchyTree from '@/components/hierarchy/HierarchyTree';
import DetailPanel from '@/components/hierarchy/DetailPanel';

const HierarchyPage = () => {
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);

    const [loading, setLoading]         = useState(true);
    const [divisions, setDivisions]     = useState([]);
    const [allBranches, setAllBranches] = useState([]);
    const [allManagers, setAllManagers] = useState([]);

    const [selectedDivisionId, setSelectedDivisionId] = useState(null);
    const [selectedRegionId,   setSelectedRegionId]   = useState(null);
    const [selectedAreaId,     setSelectedAreaId]     = useState(null);
    const [detailEntity,       setDetailEntity]       = useState(null);
    const [detailMode,         setDetailMode]         = useState('view');

    useEffect(() => {
        if (currentUser?.role && currentUser.role.rep !== 1 && !currentUser.root) {
            router.push('/');
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchWrapper.get(getApiBaseUrl() + 'hierarchy/list');
            if (res.success) {
                setDivisions(res.divisions ?? []);
                setAllBranches(res.branches ?? []);
                setAllManagers(res.managers ?? []);
            } else {
                toast.error('Failed to load hierarchy data.');
            }
        } catch {
            toast.error('Error loading hierarchy.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, []);

    const handleSelectDivision = (division) => {
        setSelectedDivisionId(division._id);
        setSelectedRegionId(null);
        setSelectedAreaId(null);
        setDetailEntity({ type: 'division', data: division });
        setDetailMode('view');
    };

    const handleSelectRegion = (region) => {
        setSelectedRegionId(region._id);
        setSelectedAreaId(null);
        setDetailEntity({ type: 'region', data: region });
        setDetailMode('view');
    };

    const handleSelectArea = (area) => {
        setSelectedAreaId(area._id);
        setDetailEntity({ type: 'area', data: area });
        setDetailMode('view');
    };

    const handleAddDivision = () => {
        setSelectedDivisionId(null);
        setSelectedRegionId(null);
        setSelectedAreaId(null);
        setDetailEntity({ type: 'division', data: {} });
        setDetailMode('add');
    };

    const handleAddRegion = () => {
        setDetailEntity({ type: 'region', data: { divisionId: selectedDivisionId } });
        setDetailMode('add');
    };

    const handleAddArea = () => {
        const region = selectedDivisionId
            ? divisions.find(d => d._id === selectedDivisionId)?.regions?.find(r => r._id === selectedRegionId)
            : null;
        setDetailEntity({
            type: 'area',
            data: {
                regionId:   selectedRegionId,
                divisionId: region?.divisionId ?? selectedDivisionId
            }
        });
        setDetailMode('add');
    };

    const handleSaved = async () => {
        await fetchData();
        setDetailMode('view');
    };

    return (
        <Layout>
            {loading ? (
                <Spinner />
            ) : (
                <div className="flex h-full min-h-0 overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
                    <HierarchyTree
                        divisions={divisions}
                        selectedDivisionId={selectedDivisionId}
                        selectedRegionId={selectedRegionId}
                        selectedAreaId={selectedAreaId}
                        onSelectDivision={handleSelectDivision}
                        onSelectRegion={handleSelectRegion}
                        onSelectArea={handleSelectArea}
                        onAddDivision={handleAddDivision}
                        onAddRegion={handleAddRegion}
                        onAddArea={handleAddArea}
                    />
                    <div className="flex-1 overflow-y-auto border-l border-gray-200 bg-gray-50">
                        {detailEntity ? (
                            <DetailPanel
                                mode={detailMode}
                                entity={detailEntity}
                                allBranches={allBranches}
                                allManagers={allManagers}
                                divisions={divisions}
                                onEdit={() => setDetailMode('edit')}
                                onCancel={() => setDetailMode('view')}
                                onSaved={handleSaved}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                <div className="text-center">
                                    <p className="text-lg font-medium mb-1">Select an entity to view details</p>
                                    <p className="text-sm">or add a new Division using the + button</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default HierarchyPage;