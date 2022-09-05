import React from 'react'

function List(props) {
    return (
        <div className="flex flex-col p-4">
            <div className="flex items-center justify-between bg-gray-200 border p-4">
                <div className=' flex items-center'>
                    {props.status === 'info' && <svg style={{ display: 'inline' }} xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 align-items-center inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>}
                    {props.image && <img style={{ display: 'inline' }} alt="Placeholder" className="w-12 rounded-full" src={props.image} />}
                    <div>
                        {props.description ?
                            !props.inverse ?
                                <>
                                    <p className='ml-6'>
                                        {props.label}
                                    </p>
                                    <small className='ml-6 text-gray-500'>
                                        {props.description}
                                    </small>
                                </> :
                                <>
                                    <small className='ml-6 text-gray-500'>
                                        {props.label}
                                    </small>
                                    <p className='ml-6'>
                                        {props.description}
                                    </p>

                                </>
                            : <p className='ml-6'>
                                {props.label}
                            </p>
                        }

                    </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
            </div>
        </div>
    )
}

export default List