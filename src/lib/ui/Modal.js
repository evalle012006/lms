import React, { useState } from "react";

const Modal = ({ children, show, title, onClose, footer = false, width }) => {
    return (
      <React.Fragment>
        {show && (
          <>
              <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none">
                <div className="relative w-auto my-6 mx-auto">
                  {/*content*/}
                  <div className={`border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-white outline-none focus:outline-none`} style={{ width: width }}>
                    {/*header*/}
                    <div className="flex items-start justify-between p-5 border-b border-solid border-slate-200 rounded-t">
                      {title && <span className="text-2xl font-proxima-bold font-semibold"> { title } </span>}
                      <button className="p-1 ml-auto border-0 text-gray-400 float-right text-3xl leading-none font-semibold outline-none focus:outline-none"
                        onClick={onClose}>
                        <span className="font-proxima h-6 w-6 text-2xl block outline-none focus:outline-none"> x </span>
                      </button>
                    </div>
                    {/*body*/}
                    <div className="relative p-6 flex-auto">
                      { children }
                    </div>
                    {/*footer*/}
                    {footer && (
                      <div className="flex items-center justify-end p-6 border-t border-solid border-slate-200 rounded-b">
                        <button className="bg-emerald-500 text-white active:bg-emerald-600 font-bold uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                          type="button" onClick={() => setShowModal(false)}>
                          Save Changes
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
          </>
        )}
      </React.Fragment>
    );
  };
  
  export default Modal;