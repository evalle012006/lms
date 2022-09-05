import React from 'react'
import Notif from './notif';

function NotifCenter(props) {
    return (
        <div>
            {
                props.items.map((item, index) =>
                    <div key={index} className={`${props.bordered ? 'border rounded-md px-4 py-2 bg-white shadow-md' : '' } mb-4`}>
                        <h4 className='font-bold '>{item.date}</h4>
                        {item.data.map((notif, idx) => 
                            <Notif key={idx} userFullName={notif.userFullName} userImage={notif.userImage} title={notif.title} time={notif.time} status={notif.status}>
                                {notif.content}
                            </Notif>)}
                    </div>)
            }
        </div>
    )
}

export default NotifCenter