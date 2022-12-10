import React from "react";
import Layout from "@/components/Layout"
import { useEffect } from "react";
import { useState } from "react";
import Spinner from "@/components/Spinner";

const LoanOfficerSummary = () => {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        mounted && setLoading(false);

        return (() => {
            mounted = false;
        })
    }, []);
    return (
        <Layout>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <React.Fragment>

                </React.Fragment>
            )}
        </Layout>
    )
}

export default LoanOfficerSummary;