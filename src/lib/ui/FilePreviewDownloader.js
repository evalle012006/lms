import React from 'react';
import { FileIcon } from 'react-file-icon';
import { DownloadIcon } from '@heroicons/react/outline';
import { formatBytes } from '../utils';

const FilePreviewDownloader =  ({ file }) => {
    const imgpath = process.env.NEXT_PUBLIC_LOCAL_HOST !== 'local' ? process.env.NEXT_PUBLIC_LOCAL_HOST : process.env.NEXT_PUBLIC_URL ;
    const url = imgpath + '/attachments/observations/' + file.path;
    const fileName = file.path.split('/')[1];
    const size = formatBytes(file.size);
    const fileType = { mime: file.type, ext: file.path && file.path.split('.').pop() };
    
    const handleDownload = () => {
        fetch(`${url}`)
            .then((res) => {
                return res.blob();
            }).then((blob) => {
                const href = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = href;
                link.setAttribute('download', fileName);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            })
            .catch((err) => {
                return Promise.reject({ Error: 'Something Went Wrong', err });
            });
    }

    return (
        <React.Fragment>
            <div className='flex flex-row w-72 h-20 bg-brown-1 rounded-lg mr-4 p-4 overflow-hidden'>
                <div className='flex-none w-10 mr-4 shadow-lg'>
                    {fileType.mime.includes('image') ? (
                        <FileIcon size={24} type="image" extension={fileType.ext} />
                    ) : (
                        <FileIcon size={24} type="document" />
                    )}
                </div>
                <div className='flex-col w-auto mr-4 overflow-hidden'>
                    <div className='font-proxima-bold text-xs truncate'>{ fileName }</div>
                    <div className='font-proxima text-xs'>{ fileType.ext.toUpperCase() } - { size }</div>
                </div>
                <div className='flex items-center w-6 text-center align-middle'>
                    <DownloadIcon className="cursor-pointer h-5" onClick={handleDownload}/>
                </div>
            </div>
        </React.Fragment>
    )
}

export default FilePreviewDownloader;