// @ts-nocheck
import React from 'react';
import Avatar from './Avatar';

const ListAvatar = ({ userList, size }) => {
    return (
        <div className={styles.listAvatar}>
            { userList && userList.length > 0 && userList.map((data, index) => {
                const user = data.user ? data.user : data;
                return (
                    <div className={styles.avatarWrapper} key={index}>
                        {data && <Avatar size={size ? size : 32} name={user.name ? user.name: user.title} src={user.photo}/>}
                    </div>
                )
            }) }
        </div>
    );
}

export default ListAvatar;