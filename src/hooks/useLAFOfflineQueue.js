// src/hooks/useLAFOfflineQueue.js
// IndexedDB-backed offline LAF queue.
// Stores full form data + compressed photo blobs.
// Max 30 entries (one group meeting worth).

import { useState, useEffect, useCallback } from 'react';

const DB_NAME     = 'ambercash_laf_offline';
const DB_VERSION  = 1;
const STORE_NAME  = 'laf_queue';
export const MAX_ENTRIES = 30;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('qrToken',  'qrToken',  { unique: false });
                store.createIndex('status',   'status',   { unique: false });
                store.createIndex('queuedAt', 'queuedAt', { unique: false });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror   = (e) => reject(e.target.error);
    });
}

function getAllFromStore(db) {
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror   = (e) => reject(e.target.error);
    });
}

async function compressToBlob(file, maxW = 1000, quality = 0.75) {
    if (!file) return null;
    return new Promise(resolve => {
        const img = new window.Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const scale = Math.min(1, maxW / img.width);
            const c = document.createElement('canvas');
            c.width  = Math.round(img.width  * scale);
            c.height = Math.round(img.height * scale);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            c.toBlob(blob => resolve(blob || null), 'image/jpeg', quality);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
    });
}

export function useLAFOfflineQueue(qrToken) {
    const [queue,   setQueue]   = useState([]);
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        try {
            const db  = await openDB();
            const all = await getAllFromStore(db);
            setQueue(
                all
                    .filter(e => e.qrToken === qrToken)
                    .sort((a, b) => a.queuedAt - b.queuedAt)
            );
        } catch (err) {
            console.error('[LAFOfflineQueue] reload:', err);
        } finally {
            setLoading(false);
        }
    }, [qrToken]);

    useEffect(() => { reload(); }, [reload]);

    const stats = {
        total:   queue.length,
        pending: queue.filter(e => e.status === 'pending').length,
        synced:  queue.filter(e => e.status === 'synced').length,
        failed:  queue.filter(e => e.status === 'failed').length,
        isFull:  queue.filter(e => e.status === 'pending').length >= MAX_ENTRIES,
    };

    const addEntry = useCallback(async (formData, photoFiles = {}) => {
        if (stats.isFull) return null;
        try {
            const db = await openDB();
            const id = `laf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const [lafPhotoBlob, idPhotoBlob, selfieBlob] = await Promise.all([
                compressToBlob(photoFiles.lafPhoto,     1000, 0.78),
                compressToBlob(photoFiles.idPhoto,      1200, 0.80),
                compressToBlob(photoFiles.selfieWithId, 1000, 0.75),
            ]);
            const entry = {
                id, qrToken,
                status:   'pending',
                queuedAt: Date.now(),
                formData: {
                    ...formData,
                    lafPhotoKey:          null,
                    governmentIdPhotoKey: null,
                    selfieWithIdPhotoKey: null,
                },
                lafPhotoBlob:   lafPhotoBlob || null,
                idPhotoBlob:    idPhotoBlob  || null,
                selfieBlob:     selfieBlob   || null,
                ciReferenceCode: null,
                syncedAt:        null,
                syncError:       null,
            };
            await new Promise((res, rej) => {
                const tx  = db.transaction(STORE_NAME, 'readwrite');
                const req = tx.objectStore(STORE_NAME).add(entry);
                req.onsuccess = res; req.onerror = rej;
            });
            await reload();
            return id;
        } catch (err) {
            console.error('[LAFOfflineQueue] addEntry:', err);
            return null;
        }
    }, [qrToken, stats.isFull, reload]);

    const removeEntry = useCallback(async (id) => {
        try {
            const db = await openDB();
            await new Promise((res, rej) => {
                const tx  = db.transaction(STORE_NAME, 'readwrite');
                const req = tx.objectStore(STORE_NAME).delete(id);
                req.onsuccess = res; req.onerror = rej;
            });
            await reload();
        } catch (err) { console.error('[LAFOfflineQueue] removeEntry:', err); }
    }, [reload]);

    const updateEntryStatus = useCallback(async (id, patch) => {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(id);
            req.onsuccess = () => {
                if (req.result) store.put({ ...req.result, ...patch });
            };
            await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
            await reload();
        } catch (err) { console.error('[LAFOfflineQueue] updateEntry:', err); }
    }, [reload]);

    const markSynced = useCallback((id, ciReferenceCode) =>
        updateEntryStatus(id, { status: 'synced', ciReferenceCode, syncedAt: Date.now(), syncError: null }),
    [updateEntryStatus]);

    const markFailed = useCallback((id, reason) =>
        updateEntryStatus(id, { status: 'failed', syncError: reason }),
    [updateEntryStatus]);

    const clearSynced = useCallback(async () => {
        try {
            const db    = await openDB();
            const all   = await getAllFromStore(db);
            const tx    = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            all.filter(e => e.qrToken === qrToken && e.status === 'synced')
               .forEach(e => store.delete(e.id));
            await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
            await reload();
        } catch (err) { console.error('[LAFOfflineQueue] clearSynced:', err); }
    }, [qrToken, reload]);

    const getAll = useCallback(async () => {
        try {
            const db  = await openDB();
            const all = await getAllFromStore(db);
            return all.filter(e => e.qrToken === qrToken);
        } catch { return []; }
    }, [qrToken]);

    return { queue, stats, addEntry, removeEntry, markSynced, markFailed, clearSynced, getAll, loading, MAX_ENTRIES };
}