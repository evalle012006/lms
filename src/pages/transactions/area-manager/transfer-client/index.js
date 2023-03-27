import React, { useEffect, useState } from "react";
import { TabPanel, useTabs } from "react-headless-tabs";
import { TabSelector } from "@/lib/ui/tabSelector";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import TransferClientTransactionPage from "@/components/transactions/TransferClient";

const TransferClientPage = () => {
    const [loading, setLoading] = useState(true);
    const [selectedTab, setSelectedTab] = useTabs([
        'group',
        'lo',
        'branch'
    ]);

    useEffect(() => {
        let mounted = true;

        mounted && setLoading(false);

        return (() => {
            mounted = false;
        });
    }, []);

    return (
        <Layout>
            <div className="pb-4">
                { loading ? (
                    <div className="absolute top-1/2 left-1/2">
                        <Spinner />
                    </div>
                ) : (
                    <React.Fragment>
                        <nav className="flex pl-10 bg-white border-b border-gray-300">
                            <TabSelector
                                isActive={selectedTab === "group"}
                                onClick={() => setSelectedTab("group")}>
                                Transfer to Another Group
                            </TabSelector>
                            <TabSelector
                                isActive={selectedTab === "lo"}
                                onClick={() => setSelectedTab("lo")}>
                                Transfer to Another Loan Officer
                            </TabSelector>
                            <TabSelector
                                isActive={selectedTab === "branch"}
                                onClick={() => setSelectedTab("branch")}>
                                Transfer to Another branch
                            </TabSelector>
                        </nav>
                        <div>
                            <TabPanel hidden={selectedTab !== "group"}>
                                <TransferClientTransactionPage mode="group" setLoading={setLoading} />
                            </TabPanel>
                        </div>
                    </React.Fragment>
                )}
            </div>
        </Layout>
    )
}

export default TransferClientPage;