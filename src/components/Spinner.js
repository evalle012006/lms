import { useEffect, useState } from 'react';

const Spinner = () => {
    const [navWidth, setNavWidth] = useState(219); // Default sidebar width

    useEffect(() => {
        // Find the navigation sidebar element
        const sideNav = document.querySelector('[class*="fixed top-0 h-full"]');
        
        if (sideNav) {
            const width = sideNav.offsetWidth;
            if (width > 0) {
                setNavWidth(width);
            }
        }
        
        // For mobile responsiveness
        const updateDimensions = () => {
            const sideNav = document.querySelector('[class*="fixed top-0 h-full"]');
            if (sideNav) {
                const width = sideNav.offsetWidth;
                if (width > 0) {
                    setNavWidth(width);
                } else {
                    setNavWidth(0); // If sidebar is collapsed/hidden on mobile
                }
            }
        };
        
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    return (
        <div 
            className="fixed flex items-center justify-center bg-white/70 z-50"
            style={{
                top: 0,
                bottom: 0,
                right: 0,
                left: `${navWidth}px`
            }}
        >
            <div className="flex flex-col items-center">
                <div className="relative h-20 w-20 mb-3">
                    <div className="absolute inset-0 animate-spin">
                        <div className="absolute h-3 w-3 bg-blue-500 rounded-full top-0 left-1/2 -translate-x-1/2" />
                        <div className="absolute h-3 w-3 bg-blue-500 rounded-full right-0 top-1/2 -translate-y-1/2" />
                        <div className="absolute h-3 w-3 bg-blue-500 rounded-full bottom-0 left-1/2 -translate-x-1/2" />
                        <div className="absolute h-3 w-3 bg-blue-500 rounded-full left-0 top-1/2 -translate-y-1/2" />
                    </div>
                </div>
                <p className="text-gray-600 text-sm">Processing, please wait...</p>
            </div>
        </div>
    );
};

export default Spinner;