import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/solid';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { UppercaseFirstLetter } from '@/lib/utils';
import { useSelector } from 'react-redux';
import { BehaviorSubject } from 'rxjs';
import { getApiBaseUrl } from '@/lib/constants';

const Breadcrumbs = () => {
    const selectedBranchSubject = new BehaviorSubject(process.browser && localStorage.getItem('selectedBranch'));
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const { uuid } = router.query;
    const paths = router.asPath
        .split('?')[0] // Remove query parameters to avoid issues
        .split('/')
        .filter((p, i) => i !== 0);

    useEffect(() => {
        let mounted = true;
        const setBreadcrumbsData = async () => {
            try {
                const currentPage = paths[0];
                let params = {};
                let crumbs = [];
                const url = getApiBaseUrl() + currentPage;

                if (paths.length == 2) {
                    params = { _id: paths[1] };
                    const response = await fetchWrapper.get(`${url}?` + new URLSearchParams(params));
                    let data;
                    let links = [];
                    let labels = [];

                    if (currentPage === 'groups' && response && response.group) {
                        data = response.group;
                        links = [`${process.env.NEXT_PUBLIC_URL}/${currentPage}`, null];
                        labels = [UppercaseFirstLetter(currentPage), data.name];
                    }

                    crumbs = paths.map((item, index) => {
                        return {
                            label: labels[index],
                            link: links[index]
                        }
                    });
                } else if (paths.length == 4) {
                    if (paths[0] === 'transactions' && (paths[1] === 'daily-cash-collection' || paths[1] === 'weekly-cash-collection')) {
                        const subCurrentPage = paths[1] ? paths[1].split('-') : [];
                        const title = subCurrentPage.length > 0 ? UppercaseFirstLetter(subCurrentPage[0]) + ' ' + UppercaseFirstLetter(subCurrentPage[1]) + ' ' + UppercaseFirstLetter(subCurrentPage[2]) : '';
                        params = { _id: paths[3] };
                        let response;
                        let data;
                        let labels = [];
                        let links = [];

                        // Check if we came from ModernBranchCashCollections
                        if (router.query.fromModernBranchCashCollections === 'true') {
                            // Build breadcrumb that links back to ModernBranchCashCollections
                            const backToModernBranchQuery = {};
                            
                            // Add preserved query parameters for back navigation
                            if (router.query.sourceViewMode) {
                                backToModernBranchQuery.viewMode = router.query.sourceViewMode;
                            }
                            if (router.query.sourceId) {
                                backToModernBranchQuery.id = router.query.sourceId;
                            }
                            if (router.query.sourceFilter) {
                                backToModernBranchQuery.filter = router.query.sourceFilter;
                            }
                            if (router.query.sourceParentId) {
                                backToModernBranchQuery.parentId = router.query.sourceParentId;
                            }
                            if (router.query.sourceGrandParentId) {
                                backToModernBranchQuery.grandParentId = router.query.sourceGrandParentId;
                            }

                            const queryString = new URLSearchParams(backToModernBranchQuery).toString();
                            const backUrl = `/transactions/cash-collection/${queryString ? '?' + queryString : ''}`;

                            if (paths[2] === 'client') {
                                try {
                                    response = await fetchWrapper.get(`${getApiBaseUrl()}groups?` + new URLSearchParams(params));
                                    if (response && response.group) {
                                        data = response.group;
                                        labels = ['Branch Cash Collections', data.name];
                                        links = [backUrl, null];
                                    } else {
                                        // Fallback if API call fails
                                        labels = ['Branch Cash Collections', 'Transaction Details'];
                                        links = [backUrl, null];
                                    }
                                } catch (error) {
                                    console.error('Error fetching group data:', error);
                                    labels = ['Branch Cash Collections', 'Transaction Details'];
                                    links = [backUrl, null];
                                }
                            }
                        } else {
                            // Original breadcrumb logic for other navigation sources
                            if (paths[2] === 'group') {
                                try {
                                    response = await fetchWrapper.get(`${getApiBaseUrl()}users?` + new URLSearchParams(params));
                                    if (response && response.user) {
                                        data = response.user;
                                        labels = [title, `${data.lastName}, ${data.firstName}`];
                                        links = [
                                            `${process.env.NEXT_PUBLIC_URL}/transactions/${paths[1]}`,
                                            null
                                        ];
                                    } else {
                                        labels = [title, 'Loan Officer'];
                                        links = [
                                            `${process.env.NEXT_PUBLIC_URL}/transactions/${paths[1]}`,
                                            null
                                        ];
                                    }
                                } catch (error) {
                                    console.error('Error fetching user data:', error);
                                    labels = [title, 'Loan Officer'];
                                    links = [
                                        `${process.env.NEXT_PUBLIC_URL}/transactions/${paths[1]}`,
                                        null
                                    ];
                                }
                            } else if (paths[2] === 'client') {
                                try {
                                    response = await fetchWrapper.get(`${getApiBaseUrl()}groups?` + new URLSearchParams(params));
                                    if (response && response.group) {
                                        data = response.group;
                                        labels = [title, data.name];
                                        links = [   // need to retrieve the selected LO
                                            `${process.env.NEXT_PUBLIC_URL}/transactions/${paths[1]}`,
                                            null
                                        ];
                                    } else {
                                        labels = [title, 'Group Details'];
                                        links = [
                                            `${process.env.NEXT_PUBLIC_URL}/transactions/${paths[1]}`,
                                            null
                                        ];
                                    }
                                } catch (error) {
                                    console.error('Error fetching group data:', error);
                                    labels = [title, 'Group Details'];
                                    links = [
                                        `${process.env.NEXT_PUBLIC_URL}/transactions/${paths[1]}`,
                                        null
                                    ];
                                }
                            } else if (paths[2] === 'users') {
                                try {
                                    params = {_id: selectedBranchSubject.value, date: currentDate}
                                    response = await fetchWrapper.get(`${getApiBaseUrl()}branches?` + new URLSearchParams(params));
                                    if (response && response.branch) {
                                        data = response.branch;
                                        labels = [title, data.name];
                                        links = [  
                                            `${process.env.NEXT_PUBLIC_URL}/transactions/${paths[1]}`,
                                            null
                                        ];
                                    } else {
                                        labels = [title, 'Branch Details'];
                                        links = [
                                            `${process.env.NEXT_PUBLIC_URL}/transactions/${paths[1]}`,
                                            null
                                        ];
                                    }
                                } catch (error) {
                                    console.error('Error fetching branch data:', error);
                                    labels = [title, 'Branch Details'];
                                    links = [
                                        `${process.env.NEXT_PUBLIC_URL}/transactions/${paths[1]}`,
                                        null
                                    ];
                                }
                            }
                        }

                        crumbs = paths.map((item, index) => {
                            return {
                                label: index < 4 && labels[index] ? labels[index] : null,
                                link: index < 4 && links[index] ? links[index] : null
                            }
                        });
                        
                        crumbs = crumbs.filter(c => c.label !== null && c.label !== undefined); // remove empty labels
                    }
                }

                if (mounted) {
                    setBreadcrumbs(crumbs);
                }
            } catch (error) {
                console.error('Error setting breadcrumbs:', error);
                // Set fallback breadcrumbs on error
                if (mounted) {
                    setBreadcrumbs([
                        {
                            label: 'Home',
                            link: '/'
                        }
                    ]);
                }
            }
        }

        if (mounted && paths.length > 0) {
            setBreadcrumbsData();
        }

        return () => {
            mounted = false;
        }
    }, [router.asPath, router.query]); // Add router.query to dependencies to react to query changes

    return (
        <div className="flex flex-row text-sm">
            {breadcrumbs && breadcrumbs.map((item, index) => {
                return (
                    <React.Fragment key={index}>
                        {item.link ? (
                            <Link href={item.link}>
                                <span className="underline capitalize cursor-pointer hover:text-blue-600">
                                    {item.label}
                                </span>
                            </Link>
                        ) : (
                            <span className='pl-1'>{item.label}</span>
                        )}
                        {breadcrumbs.length !== index + 1 && (
                            <span className='px-1'>
                                <ChevronRightIcon className='h-5 w-5' />
                            </span>
                        )}
                    </React.Fragment>
                )
            })}
        </div>
    );
}

export default Breadcrumbs;