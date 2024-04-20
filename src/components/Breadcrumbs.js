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
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const { uuid } = router.query;
    const paths = router.asPath
        .split('/')
        .filter((p, i) => i !== 0);

    useEffect(() => {
        let mounted = true;
        const setBreadcrumbsData = async () => {
            const currentPage = paths[0];
            let params = {};
            let crumbs = [];
            const url = process.env.NEXT_PUBLIC_API_URL + currentPage;

            if (paths.length == 2) {
                params = { _id: paths[1] };
                const response = await fetchWrapper.get(`${url}?` + new URLSearchParams(params));
                let data;
                let links = [];
                let labels = [];

                if (currentPage === 'groups') {
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
                if (paths[0] === 'transactions' && paths[1] === 'daily-cash-collection') {
                    const subCurrentPage = paths[1] ? paths[1].split('-') : [];
                    const title = subCurrentPage.length > 0 ? UppercaseFirstLetter(subCurrentPage[0]) + ' ' + UppercaseFirstLetter(subCurrentPage[1]) + ' ' + UppercaseFirstLetter(subCurrentPage[2]) : '';
                    params = { _id: paths[3] };
                    let response;
                    let data;
                    let labels;
                    let links;
                    if (paths[2] === 'group') {
                        response = await fetchWrapper.get(`${getApiBaseUrl()}users?` + new URLSearchParams(params));
                        data = response.user;
                        labels = [title, `${data.lastName}, ${data.firstName}`];
                        links = [
                            `${process.env.NEXT_PUBLIC_URL}/transactions/${paths[1]}`,
                            null
                        ];
                    } else if (paths[2] === 'client') {
                        response = await fetchWrapper.get(`${getApiBaseUrl()}groups?` + new URLSearchParams(params));
                        data = response.group;
                        labels = [title, data.name];
                        links = [   // need to retrived the selected LO
                            `${process.env.NEXT_PUBLIC_URL}/transactions/${paths[1]}`,
                            null
                        ];
                    } else if (paths[2] === 'users') {
                        params = {_id: selectedBranchSubject.value}
                        response = await fetchWrapper.get(`${process.env.NEXT_PUBLIC_API_URL}branches?` + new URLSearchParams(params));
                        data = response.branch;
                        labels = [title, data.name];
                        links = [  
                            `${process.env.NEXT_PUBLIC_URL}/transactions/${paths[1]}`,
                            null
                        ];
                    }

                    crumbs = paths.map((item, index) => {
                        return {
                            label: index < 4 && labels[index],
                            link: index < 4 && links[index]
                        }
                    });
                    
                    crumbs = crumbs.filter(c => typeof c.label !== 'undefined'); // removed empty labels
                }
            }

            setBreadcrumbs(crumbs);
        }

        mounted && setBreadcrumbsData();

        return () => {
            mounted = false;
        }
    }, []);

    return (
        <div className="flex flex-row text-sm">
            {breadcrumbs && breadcrumbs.map((item, index) => {
                return (
                    <React.Fragment key={index}>
                        {item.link ? (
                            <Link href={item.link}><span className="underline capitalize">{item.label}</span></Link>
                        ) : (
                            <span className='pl-1'>{item.label}</span>
                        )}
                        {breadcrumbs.length !== index + 1 && <span className='px-1'><ChevronRightIcon className='h-5 w-5' /></span>}
                    </React.Fragment>
                )
            })}
        </div>
    );
}

export default Breadcrumbs;