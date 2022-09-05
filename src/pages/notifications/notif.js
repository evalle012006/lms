/* eslint-disable key-spacing */
/* eslint-disable react/jsx-no-comment-textnodes */
import React from 'react';

function Notif(props) {
    
    return (
        <div className='mb-6'>
            <div className='flex items-center justify-between leading-none p-2 md:p-4'>
                <a href="" className=' flex items-start no-underline leading-none p-2 md:p-4'>
                    <div className="relative">
                    <img alt="Placeholder" className="w-12 rounded-full" src={props.image} />
                    {props.status === 'inactive' && <span style={{width: 10, height: 10, left:17, backgroundColor:'#E03145'}} className="absolute top-0 bg-red border-2 border-white dark:border-gray-800 rounded-full"></span>}
                    {props.status === 'active' && <span style={{width: 10, height: 10, left:17, backgroundColor:'green'}} className="absolute top-0 bg-red border-2 border-white dark:border-gray-800 rounded-full"></span>}
                    </div>
                    <div>
                        <p className="ml-6 text-sm pb-0 mb-0 leading-none">
                            {props.title}
                        </p>
                        <small className='ml-6 pt-0 text-xs mt-0 leading-none text-gray-500'>{props.time}</small>

                        <div className='mt-6 ml-6'>
                        {props.children}
                        </div>
                    </div>
                </a>
            </div>
        </div>
    )
}

export default Notif