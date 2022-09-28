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
                let data;
                const response = await fetchWrapper.get(`${url}?` + new URLSearchParams(params));

                if (currentPage === 'groups') {
                    data = response.group;
                }

                crumbs = paths.map((item, index) => {
                    return {
                        label: index === 0 ? UppercaseFirstLetter(currentPage) : data.name,
                        link: index === 0 ? `${process.env.NEXT_PUBLIC_URL}/${currentPage}` : null
                    }
                });

                setBreadcrumbs(crumbs)
            }
            // if (paths.length == 3) {
            //     params = { uuid: paths[2] };
            //     const response = await fetchWrapper.get(`${url}/tests?` + new URLSearchParams(params));
            //     const test = response.tests[0];
            //     const links = [
            //         `${process.env.NEXT_PUBLIC_URL}/jobs`,
            //         `${process.env.NEXT_PUBLIC_URL}/jobs/${test.job_id}`
            //     ];
            //     const labels = ['Jobs', test.client, `${test.crop} - ${test.labnumber}`];

            //     crumbs = paths.map((item, index) => {
            //         return {
            //             label: labels[index],
            //             link: links[index]
            //         }
            //     });

            //     setBreadcrumbs(crumbs)
            // }
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