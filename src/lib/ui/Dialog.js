import React from 'react'

function Dialog({ children, show = false, emoji = false }) {
  return (
    <React.Fragment>
        <div className={`modal-container ${!show && 'hidden'}`} aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="modal-backdrop"></div>

            <div className="modal-body">
                <div className="modal-body-container modal-body-container-sm">
                    {emoji ? (
                        <React.Fragment>
                            {children}
                        </React.Fragment>
                    ) : (
                        <div className="modal-body-content modal-body-content-sm">
                            { children }
                        </div>
                    )}
                </div>
            </div>
        </div>

    </React.Fragment>
  )
}

export default Dialog