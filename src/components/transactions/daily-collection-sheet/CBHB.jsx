import React from "react";

const CBHB = ({ branchId, selectedDate }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-800">
        Details of CBHB and Clients Benefits Disbursement
      </h2>

      <div className="mt-3 text-sm text-gray-600">
        Branch ID: {branchId || "-"}
      </div>

      <div className="text-sm text-gray-600">
        Selected Date: {selectedDate || "-"}
      </div>
    </div>
  );
};

export default CBHB;