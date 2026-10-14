import React, { useState } from "react";
import Layout from "@/components/Layout";
import { useSelector } from "react-redux";
import { PlusIcon } from '@heroicons/react/24/solid';
import ViewByGroupsPage from "@/components/groups/ViewByGroups";
import ViewGroupsByBranch from "@/components/groups/ViewGroupsByBranch";
import AddUpdateGroup from "@/components/groups/AddUpdateGroupDrawer";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { canManageGroups } from "@/lib/group-permissions";

// Stable reference: the drawer's [group] effect must not re-run on every render
const NO_GROUP = {};

const GroupsPage = () => {
    const currentUser = useSelector(state => state.user.data);
    const [showDrawer, setShowDrawer] = useState(false);

    // Only admin (rep 1) / root can add groups. Area managers (rep 2) see the branch list but get no button.
    const actionButtons = canManageGroups(currentUser) ? [
        <ButtonSolid key="add" label="Add Group" type="button"
            className="p-2 mr-3"
            onClick={() => setShowDrawer(true)}
            icon={[<PlusIcon key="icon" className="w-5 h-5" />, 'left']} />,
    ] : null;

    return (
        <React.Fragment>
            {(currentUser.role.rep === 1 || currentUser.role.rep === 2) && (
                <Layout actionButtons={actionButtons}>
                    <div className="pb-4">
                        <ViewGroupsByBranch />
                    </div>
                </Layout>
            ) }
            {currentUser.role.rep > 2 && <ViewByGroupsPage />}

            {canManageGroups(currentUser) && (
                <AddUpdateGroup
                    mode="add"
                    group={NO_GROUP}
                    showSidebar={showDrawer}
                    setShowSidebar={setShowDrawer}
                    onClose={() => {}}
                />
            )}
        </React.Fragment>
    );
}

export default GroupsPage;