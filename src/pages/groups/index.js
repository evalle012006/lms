import React from "react";
import Layout from "@/components/Layout";
import { useDispatch, useSelector } from "react-redux";
import ViewByGroupsPage from "@/components/groups/ViewByGroups";
import ViewGroupsByBranch from "@/components/groups/ViewGroupsByBranch";

const GroupsPage = () => {
    const currentUser = useSelector(state => state.user.data);

    return (
        <React.Fragment>
            {(currentUser.role.rep === 1 || currentUser.role.rep === 2) && (
                <Layout>
                    <div className="pb-4">
                        <ViewGroupsByBranch />
                    </div>
                </Layout>
            ) }
            {currentUser.role.rep > 2 && <ViewByGroupsPage />}
        </React.Fragment>
    );
}

export default GroupsPage;