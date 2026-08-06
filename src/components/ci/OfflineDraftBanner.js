import React from 'react';
import { WifiOff, Wifi, Upload } from 'lucide-react';

const OfflineDraftBanner = ({ isOnline, draftCount, onSync, syncing }) => {
    if (isOnline && draftCount === 0) return null;

    return (
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl mb-4 border ${
            isOnline
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
            <div className="flex items-center gap-3">
                {isOnline
                    ? <Wifi className="w-4 h-4 flex-shrink-0" />
                    : <WifiOff className="w-4 h-4 flex-shrink-0" />
                }
                <span className="text-sm font-medium">
                    {isOnline
                        ? `${draftCount} offline draft${draftCount !== 1 ? 's' : ''} ready to sync`
                        : `Offline mode — ${draftCount} draft${draftCount !== 1 ? 's' : ''} saved locally`
                    }
                </span>
            </div>

            {isOnline && draftCount > 0 && (
                <button
                    onClick={onSync}
                    disabled={syncing}
                    className="flex items-center gap-1.5 text-xs font-semibold
                        bg-blue-600 text-white px-3 py-1.5 rounded-lg
                        hover:bg-blue-700 disabled:opacity-50"
                >
                    <Upload className="w-3.5 h-3.5" />
                    {syncing ? 'Syncing…' : 'Sync now'}
                </button>
            )}
        </div>
    );
};

export default OfflineDraftBanner;