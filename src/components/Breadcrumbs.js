import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/solid';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import update from 'immutability-helper';

const Breadcrumbs = () => {
    const router = useRouter();
    const [breadcrumbs, setBreadcrumbs] = useState(null);
    const paths = router.asPath
        .split('/')
        .filter((p, i) => i !== 0);

    useEffect(() => {
        let mounted = true;

        // const fetchData = async (id, path, index) => {
        //     let data = { label: '', link: '' };
        //     const url = endpoint[path];
        //     if (url) {
        //         const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}${url}?`;
        //         const key = paramKey[path];
        //         const params = { [key]: id };
        //         const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
        //         data = {
        //             label: await response.success && response.jobs[0].name,
        //             ...(index > 1 && { link: await response.jobs[0]._id })
        //         }
        //     }

        //     return data;
        // }

        // const setBreadcrumbsData = async () => {
        //     const main = paths[0];
        //     const base = process.env.NEXT_PUBLIC_URL;

        //     // const promises = paths.map(async (item, index) => {
        //     //     console.log(item)
        //     //     // const data = index !== 0 && await fetchData(item, main, index);
        //     //     // let breadcrumbs = {
        //     //     //     label: index === 0 ? item : await data.label,
        //     //     //     link: index > 1 ? await data.link : (index === 0 && `${base}/${item}`)
        //     //     // };

        //     //     // return breadcrumbs;
        //     // });

        //     // const newState = await Promise.all(promises);
        //     // setBreadcrumbs(newState);
        // }
        const setBreadcrumbsData = async () => {
            let params = {};
            let crumbs = {};
            const url = process.env.NEXT_PUBLIC_API_URL + 'jobs';
            if (paths.length == 2) {
                params = { job: paths[1] };
                const response = await fetchWrapper.get(`${url}?` + new URLSearchParams(params));
                const job = response.jobs[0];

                crumbs = paths.map((item, index) => {
                    return {
                        label: index === 0 ? 'Jobs' : job.name,
                        link: index === 0 ? `${process.env.NEXT_PUBLIC_URL}/jobs` : null
                    }
                });

                setBreadcrumbs(crumbs)
            }
            if (paths.length == 3) {
                params = { test: paths[2] };
                const response = await fetchWrapper.get(`${url}/tests?` + new URLSearchParams(params));
                const test = response.tests[0];
                const links = [
                    `${process.env.NEXT_PUBLIC_URL}/jobs`,
                    `${process.env.NEXT_PUBLIC_URL}/jobs/${test.job_id}`
                ];
                const labels = ['Jobs', test.client, `${test.crop} - ${test.labnumber}`];

                crumbs = paths.map((item, index) => {
                    return {
                        label: labels[index],
                        link: links[index]
                    }
                });

                setBreadcrumbs(crumbs)
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
                        {breadcrumbs.length !== index + 1 && <span className='px-1'><ChevronRightIcon className='h-6 w-6' /></span>}
                    </React.Fragment>
                )
            })}
            {/* <Link href='/jobs' passHref><a className='underline'>Jobs</a></Link>
            <span className='px-1'><ChevronRightIcon className='h-6 w-6' /></span>
            {paths.length > 2 ? <Link href='/jobs/62ca12186752697a2da04984' passHref><a className='pl-1 underline'>555 Superfoods</a></Link> : <span className='pl-1'>555 Superfoods</span>}
            {paths.length > 2 && (
                <div className="flex flex-row">
                    <span className='px-1'><ChevronRightIcon className='h-6 w-6' /></span>
                    <span className='pl-1'>Blend Data</span>
                </div>
            )} */}
        </div>
    );
}

export default Breadcrumbs;