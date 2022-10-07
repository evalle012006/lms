import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/solid';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { UppercaseFirstLetter } from '@/lib/utils';

const Breadcrumbs = () => {
    const router = useRouter();
    const [breadcrumbs, setBreadcrumbs] = useState(null);
    const paths = router.asPath
        .split('/')
        .filter((p, i) => i !== 0);

    useEffect(() => {
        let mounted = true;

        const setBreadcrumbsData = async () => {
            const currentPage = paths[0];
            let params = {};
            let crumbs = {};
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

                setBreadcrumbs(crumbs);
            } else if (paths.length == 3) {
                const subCurrentPage = paths[1] ? paths[1].split('-') : [];
                const title = subCurrentPage.length > 0 ? UppercaseFirstLetter(subCurrentPage[0]) + ' ' + UppercaseFirstLetter(subCurrentPage[1]) + ' ' + UppercaseFirstLetter(subCurrentPage[2]) : '';

                params = { _id: paths[2] };
                const response = await fetchWrapper.get(`${process.env.NEXT_PUBLIC_API_URL}groups?` + new URLSearchParams(params));
                const data = response.group;

                const links = [
                    `${process.env.NEXT_PUBLIC_URL}/transactions/${paths[1]}`,
                    null
                ];
                const labels = [title, data.name];

                crumbs = paths.map((item, index) => {
                    return {
                        label: index < 3 && labels[index],
                        link: index < 3 && links[index]
                    }
                });
                
                crumbs = crumbs.filter(c => typeof c.label !== 'undefined'); // removed empty labels

                setBreadcrumbs(crumbs);
            } else if (paths.length == 4) {
                // const currentPage = paths[2];
                // params = { uuid: paths[2] };
                // const response = await fetchWrapper.get(`${url}/tests?` + new URLSearchParams(params));
                // const test = response.tests[0];
                // const links = [
                //     `${process.env.NEXT_PUBLIC_URL}/jobs`,
                //     `${process.env.NEXT_PUBLIC_URL}/jobs/${test.job_id}`
                // ];
                // const labels = ['Jobs', test.client, `${test.crop} - ${test.labnumber}`];

                // crumbs = paths.map((item, index) => {
                //     return {
                //         label: labels[index],
                //         link: links[index]
                //     }
                // });

                // setBreadcrumbs(crumbs)
            }
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
                            <Link href={item.link} passHref><a className="underline capitalize">{item.label}</a></Link>
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