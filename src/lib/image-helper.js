import Image from 'next/image';
import { useEffect } from 'react';

export const checkImageExist = (src) => {
    var http = new XMLHttpRequest();
    http.open('HEAD', src, false);
    http.send();

    return http.status != 404;
};

const ImageHelper = ({ src, name }) => {
    const imageSrc = `${process.env.NEXT_PUBLIC_URL}/images/${src}`;
    const randomColor = Math.floor(Math.random() * 16777215).toString(16);

    const imageSource = () => {
        const source = `${process.env.NEXT_PUBLIC_URL}/images/${src}`;
        return checkImageExist(source) && source;
    };

    useEffect(() => {
        let mounted = true;

        return () => {
            mounted = false;
        };
    }, [src]);

    if (!src) {
        return (
            <div className="grid flex place-items-center rounded-full w-8 h-8 text-white" style={{ backgroundColor: '#003865' }}>
                <div className="inline-block align-middle">{name.charAt(0)}</div>
            </div>
        );
    } else {
        return (
            <Image src={imageSource} width={24} height={24} className="rounded-full" />
        );
    }
}

export default ImageHelper;