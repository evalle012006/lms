import React, { useState } from "react";

const Modal = ({ children, show, title, onClose }) => {
    return (
      <React.Fragment>
        {show && (
          <>
            <div className="flex justify-center items-center overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none">
              <div className="relative w-auto my-6 mx-auto max-w-3xl">
                <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-white outline-none focus:outline-none">
                  <div className="flex items-start justify-between p-5 border-b border-solid border-gray-300 rounded-t ">
                    <div>
                        {title && <h3 className="text-3xl font=semibold">{ title }</h3>}
                    </div>
                    <button
                      className="bg-transparent border-0 text-black float-right"
                      onClick={onClose}
                    >
                      <span className="text-black opacity-7 h-6 w-6 text-xl block bg-gray-400 py-0 rounded-full">
                        x
                      </span>
                    </button>
                  </div>
                  <div className="relative p-6 flex-auto">
                    { children }
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </React.Fragment>
    );
  };
  
  export default Modal;