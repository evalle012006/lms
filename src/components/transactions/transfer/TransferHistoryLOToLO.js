import React, { useEffect, useState } from "react";
import toast from 'react-hot-toast';
import Select from 'react-select';
import { DropdownIndicator, borderStyles } from "@/styles/select";

const TransferTable = ({ data }) => {

}

const TransferHistoryLOToLOPage = () => {
    // filters:
    // current date - month and year
    // list of all branches
        // then list of all LO on the selected branches
    
    return (
        <div className="py-8">
            <div className="flex flex-col">
                {/* daily */}
                <div>
                    <div className="flex flex-row justify-between">
                        <div>
                            <span>Month of: </span>
                        </div>
                    </div>
                </div>
                {/* weekly */}
                <div className="pt-8">
                    <div className="flex flex-row justify-between">

                    </div>
                </div>
            </div>
        </div>
    )
}

export default TransferHistoryLOToLOPage;