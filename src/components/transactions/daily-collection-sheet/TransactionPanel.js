import React, { useState } from 'react';
import { Receipt, Plus, X } from 'lucide-react';

const TransactionPanel = () => {
    const [showCreateModal, setShowCreateModal] = useState(false);

    return (
        <>
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm">

                {/* HEADER */}
                <div className="px-5 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">

                        {/* LEFT SIDE */}
                        <div className="flex items-center space-x-2">
                            <Receipt className="w-5 h-5 text-teal-600" />

                            <div>
                                <h2 className="text-base font-bold text-gray-800">
                                    Transactions
                                </h2>

                                <p className="text-xs text-gray-500 mt-0.5">
                                    Daily transaction details
                                </p>
                            </div>
                        </div>

                        {/* RIGHT SIDE */}
                        <button
                            type="button"
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2
                                       bg-teal-600 hover:bg-teal-700
                                       text-white text-sm font-semibold
                                       rounded-md transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Create Transaction
                        </button>
                    </div>
                </div>

                {/* CONTENT */}
                <div className="p-6">
                    <div className="border border-dashed border-gray-300 rounded-lg py-16 text-center">

                        <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />

                        <p className="text-sm font-medium text-gray-600">
                            Transaction
                        </p>

                        <p className="text-xs text-gray-400 mt-1">
                            Transaction data will be added here.
                        </p>
                    </div>
                </div>
            </div>


            {/* CREATE TRANSACTION MODAL */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">

                    {/* BACKDROP */}
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setShowCreateModal(false)}
                    />

                    {/* MODAL */}
                    <div className="relative bg-white rounded-lg shadow-xl
                                    w-full max-w-2xl mx-4">

                        {/* MODAL HEADER */}
                        <div className="flex items-center justify-between
                                        px-5 py-4 border-b border-gray-200">

                            <div>
                                <h2 className="text-lg font-bold text-gray-800">
                                    Create Transaction
                                </h2>

                                <p className="text-xs text-gray-500 mt-0.5">
                                    Enter transaction details
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="p-2 text-gray-400 hover:text-gray-700
                                           hover:bg-gray-100 rounded-md"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>


                        {/* MODAL BODY */}
                        <div className="p-5">

                            <div className="border border-dashed border-gray-300
                                            rounded-lg py-16 text-center">

                                <Receipt className="w-10 h-10 text-gray-300
                                                    mx-auto mb-3" />

                                <p className="text-sm font-medium text-gray-600">
                                    Transaction Form
                                </p>

                                <p className="text-xs text-gray-400 mt-1">
                                    Transaction fields will be added here.
                                </p>
                            </div>

                        </div>


                        {/* MODAL FOOTER */}
                        <div className="flex justify-end gap-2
                                        px-5 py-4 border-t border-gray-200">

                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 border border-gray-300
                                           text-gray-700 text-sm font-medium
                                           rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="px-4 py-2 bg-teal-600
                                           hover:bg-teal-700 text-white
                                           text-sm font-semibold rounded-md"
                            >
                                Save Transaction
                            </button>

                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default TransactionPanel;