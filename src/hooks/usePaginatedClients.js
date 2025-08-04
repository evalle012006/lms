// src/hooks/usePaginatedClients.js
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export const usePaginatedClients = (initialParams = {}) => {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        pageSize: 50,
        totalCount: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
        startIndex: 0,
        endIndex: 0
    });

    const [params, setParams] = useState({
        page: 1,
        size: 50,
        sortBy: 'insertedDateTime',
        sortOrder: 'desc',
        ...initialParams
    });

    const fetchClients = useCallback(async (fetchParams = params) => {
        try {
            setLoading(true);
            setError(null);

            const queryParams = new URLSearchParams(fetchParams).toString();
            const response = await axios.get(`/api/v2/clients/list?${queryParams}`);

            if (response.data.success) {
                setClients(response.data.clients);
                setPagination(response.data.pagination);
            } else {
                throw new Error(response.data.message || 'Failed to fetch clients');
            }
        } catch (err) {
            setError(err.message);
            console.error('Error fetching clients:', err);
        } finally {
            setLoading(false);
        }
    }, [params]);

    // Initial fetch
    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    // Navigation functions
    const goToPage = useCallback((page) => {
        const newParams = { ...params, page };
        setParams(newParams);
        fetchClients(newParams);
    }, [params, fetchClients]);

    const nextPage = useCallback(() => {
        if (pagination.hasNextPage) {
            goToPage(pagination.currentPage + 1);
        }
    }, [pagination.hasNextPage, pagination.currentPage, goToPage]);

    const prevPage = useCallback(() => {
        if (pagination.hasPrevPage) {
            goToPage(pagination.currentPage - 1);
        }
    }, [pagination.hasPrevPage, pagination.currentPage, goToPage]);

    const changePageSize = useCallback((size) => {
        const newParams = { ...params, size, page: 1 };
        setParams(newParams);
        fetchClients(newParams);
    }, [params, fetchClients]);

    const changeSorting = useCallback((sortBy, sortOrder = 'desc') => {
        const newParams = { ...params, sortBy, sortOrder, page: 1 };
        setParams(newParams);
        fetchClients(newParams);
    }, [params, fetchClients]);

    const updateFilters = useCallback((newFilters) => {
        const newParams = { ...params, ...newFilters, page: 1 };
        setParams(newParams);
        fetchClients(newParams);
    }, [params, fetchClients]);

    const refresh = useCallback(() => {
        fetchClients();
    }, [fetchClients]);

    return {
        clients,
        loading,
        error,
        pagination,
        params,
        // Actions
        goToPage,
        nextPage,
        prevPage,
        changePageSize,
        changeSorting,
        updateFilters,
        refresh
    };
};