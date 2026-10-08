// src/components/clients/ClientAvatar.js
import React from 'react';
import AvatarV2 from '@/lib/avatarV2';

export default function ClientAvatar({ name, src, size = 40, delinquent = false }) {
    return (
        <AvatarV2
            name={name}
            src={src}
            size={size}
            status={delinquent ? 'delinquent' : null}
        />
    );
}