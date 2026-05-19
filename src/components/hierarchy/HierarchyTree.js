import React, { useState, useMemo } from 'react';
import { PlusIcon, ChevronRightIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import { BuildingOffice2Icon, MapIcon, HomeModernIcon } from '@heroicons/react/24/outline';

const HierarchyTree = ({
    divisions,
    selectedDivisionId,
    selectedRegionId,
    selectedAreaId,
    onSelectDivision,
    onSelectRegion,
    onSelectArea,
    onAddDivision,
    onAddRegion,
    onAddArea,
}) => {
    const [expandedRegions, setExpandedRegions] = useState({});
    const [divisionSearch, setDivisionSearch]   = useState('');
    const [regionSearch,   setRegionSearch]     = useState('');
    const [areaSearch,     setAreaSearch]       = useState('');

    const toggleRegion = (regionId, e) => {
        e.stopPropagation();
        setExpandedRegions(prev => ({ ...prev, [regionId]: !prev[regionId] }));
    };

    const selectedDivision = divisions.find(d => d._id === selectedDivisionId) ?? null;

    // ── Filtered lists ────────────────────────────────────────────────────────
    const filteredDivisions = useMemo(() =>
        divisions.filter(d => d.name.toLowerCase().includes(divisionSearch.toLowerCase())),
        [divisions, divisionSearch]
    );

    const filteredRegions = useMemo(() => {
        if (!selectedDivision?.regions) return [];
        return selectedDivision.regions.filter(r =>
            r.name.toLowerCase().includes(regionSearch.toLowerCase())
        );
    }, [selectedDivision, regionSearch]);

    // Areas shown as sub-items under selected region, with area search
    const getFilteredAreas = (region) =>
        (region.areas ?? []).filter(a =>
            a.name.toLowerCase().includes(areaSearch.toLowerCase())
        );

    return (
        <div className="flex h-full min-h-0" style={{ width: '500px', minWidth: '500px' }}>

            {/* ── Column 1: Divisions ─────────────────────────────────────────── */}
            <div className="flex flex-col h-full border-r border-gray-200 bg-white overflow-hidden" style={{ width: '210px', minWidth: '210px' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 bg-gray-50">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Divisions</span>
                    <button
                        onClick={onAddDivision}
                        className="flex items-center gap-0.5 text-xs text-teal-600 hover:text-teal-800 font-semibold"
                        title="Add Division"
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                        Division
                    </button>
                </div>

                {/* Search */}
                <div className="px-2 py-1.5 border-b border-gray-100">
                    <div className="flex items-center gap-1.5 bg-gray-100 rounded px-2 py-1">
                        <MagnifyingGlassIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={divisionSearch}
                            onChange={e => setDivisionSearch(e.target.value)}
                            className="text-xs bg-transparent outline-none w-full text-gray-600 placeholder-gray-400"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {filteredDivisions.length === 0 ? (
                        <p className="text-xs text-gray-400 p-3">No divisions found</p>
                    ) : (
                        filteredDivisions.map(division => (
                            <button
                                key={division._id}
                                onClick={() => onSelectDivision(division)}
                                className={`w-full text-left px-3 py-2.5 flex items-center gap-2 border-b border-gray-50 transition-colors ${
                                    selectedDivisionId === division._id
                                        ? 'bg-teal-50 border-l-2 border-l-teal-500 text-teal-700'
                                        : 'hover:bg-gray-50 text-gray-700'
                                }`}
                            >
                                <BuildingOffice2Icon className={`w-4 h-4 flex-shrink-0 ${selectedDivisionId === division._id ? 'text-teal-500' : 'text-gray-400'}`} />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{division.name}</p>
                                    <p className="text-xs text-gray-400">{division.regions?.length ?? 0} regions</p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* ── Column 2: Regions + Areas ────────────────────────────────────── */}
            <div className="flex flex-col h-full bg-white overflow-hidden" style={{ width: '290px', minWidth: '290px' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 bg-gray-50">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
                        {selectedDivision ? selectedDivision.name : 'Regions & Areas'}
                    </span>
                    {selectedDivisionId && (
                        <button
                            onClick={onAddRegion}
                            className="flex items-center gap-0.5 text-xs text-teal-600 hover:text-teal-800 font-semibold flex-shrink-0 ml-2"
                            title="Add Region"
                        >
                            <PlusIcon className="w-3.5 h-3.5" />
                            Region
                        </button>
                    )}
                </div>

                {/* Search */}
                <div className="px-2 py-1.5 border-b border-gray-100">
                    <div className="flex items-center gap-1.5 bg-gray-100 rounded px-2 py-1">
                        <MagnifyingGlassIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <input
                            type="text"
                            placeholder="Search regions or areas..."
                            value={regionSearch}
                            onChange={e => setRegionSearch(e.target.value)}
                            className="text-xs bg-transparent outline-none w-full text-gray-600 placeholder-gray-400"
                        />
                    </div>
                </div>

                {/* Area search — only visible when a region is selected */}
                {selectedRegionId && (
                    <div className="px-2 py-1.5 border-b border-gray-100 bg-gray-50">
                        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded px-2 py-1">
                            <MagnifyingGlassIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <input
                                type="text"
                                placeholder="Filter areas..."
                                value={areaSearch}
                                onChange={e => setAreaSearch(e.target.value)}
                                className="text-xs bg-transparent outline-none w-full text-gray-600 placeholder-gray-400"
                            />
                        </div>
                    </div>
                )}

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {!selectedDivisionId ? (
                        <p className="text-xs text-gray-400 p-3">Select a division</p>
                    ) : filteredRegions.length === 0 ? (
                        <p className="text-xs text-gray-400 p-3">No regions found</p>
                    ) : (
                        filteredRegions.map(region => {
                            const isRegionSelected = selectedRegionId === region._id;
                            const isExpanded = expandedRegions[region._id] || isRegionSelected;
                            const filteredAreas = getFilteredAreas(region);

                            return (
                                <div key={region._id}>
                                    {/* Region row */}
                                    <div className={`flex items-center gap-1 border-b border-gray-50 ${
                                        isRegionSelected && !selectedAreaId
                                            ? 'bg-teal-50 border-l-2 border-l-teal-500'
                                            : 'hover:bg-gray-50'
                                    }`}>
                                        <button
                                            onClick={(e) => toggleRegion(region._id, e)}
                                            className="pl-2 py-2.5 text-gray-400 hover:text-gray-600"
                                        >
                                            {isExpanded
                                                ? <ChevronDownIcon className="w-3.5 h-3.5" />
                                                : <ChevronRightIcon className="w-3.5 h-3.5" />
                                            }
                                        </button>
                                        <button
                                            onClick={() => {
                                                onSelectRegion(region);
                                                setExpandedRegions(prev => ({ ...prev, [region._id]: true }));
                                            }}
                                            className="flex-1 text-left flex items-center gap-2 py-2.5 pr-2 min-w-0"
                                        >
                                            <MapIcon className={`w-4 h-4 flex-shrink-0 ${isRegionSelected ? 'text-teal-500' : 'text-gray-400'}`} />
                                            <div className="min-w-0">
                                                <p className={`text-sm font-medium truncate ${isRegionSelected && !selectedAreaId ? 'text-teal-700' : 'text-gray-700'}`}>
                                                    {region.name}
                                                </p>
                                                <p className="text-xs text-gray-400">{region.areas?.length ?? 0} areas</p>
                                            </div>
                                        </button>
                                        {isRegionSelected && (
                                            <button
                                                onClick={onAddArea}
                                                className="pr-2.5 text-teal-500 hover:text-teal-700 flex items-center gap-0.5 text-xs font-semibold"
                                                title="Add Area"
                                            >
                                                <PlusIcon className="w-3.5 h-3.5" />
                                                Area
                                            </button>
                                        )}
                                    </div>

                                    {/* Areas sub-list */}
                                    {isExpanded && filteredAreas.map(area => (
                                        <button
                                            key={area._id}
                                            onClick={() => onSelectArea(area)}
                                            className={`w-full text-left flex items-center gap-2 pl-9 pr-3 py-2 border-b border-gray-50 transition-colors ${
                                                selectedAreaId === area._id
                                                    ? 'bg-teal-50 border-l-2 border-l-teal-400 text-teal-700'
                                                    : 'hover:bg-gray-50 text-gray-600'
                                            }`}
                                        >
                                            <HomeModernIcon className={`w-3.5 h-3.5 flex-shrink-0 ${selectedAreaId === area._id ? 'text-teal-500' : 'text-gray-300'}`} />
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium truncate">{area.name}</p>
                                                <p className="text-xs text-gray-400">{area.branches?.length ?? 0} branches</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default HierarchyTree;