/* eslint-disable import/no-unresolved */
/* eslint-disable import/extensions */
import Layout from "@/components/Layout";
import NotifCenter from "./notifCenter";

const NotificationsPage = () => {
    return (
        <Layout>
            <div className='p-5'>
            <div className="mt-4">
                <NotifCenter items={[
                    {
                        date: 'Today',
                        data: [
                            {
                                title: <span><b>Author Name</b> has changed Status to Pending Approval to <b>Superfoods Hilston Citrus</b></span>,
                                time: '2 mins. Ago',
                                content: <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Suscipit sequi harum, deleniti officiis necessitatibus voluptatibus, quisquam iusto veniam quod perspiciatis voluptas ratione perferendis culpa odio dignissimos dolores dolore consequuntur nemo.</p>,
                                status: 'active',
                                image: 'https://picsum.photos/32/32/?random'
                            },
                            {
                                title: <span><b>Author Name</b> has changed Status to Pending Approval to <b>Superfoods Hilston Citrus</b></span>,
                                time: '2 mins. Ago',
                                content: <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Suscipit sequi harum, deleniti officiis necessitatibus voluptatibus, quisquam iusto veniam quod perspiciatis voluptas ratione perferendis culpa odio dignissimos dolores dolore consequuntur nemo.</p>,
                                status: 'inactive',
                                image: 'https://picsum.photos/32/32/?random'
                            },
                            {
                                title: <span><b>Author Name</b> has changed Status to Pending Approval to <b>Superfoods Hilston Citrus</b></span>,
                                time: '2 mins. Ago',
                                content: <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Suscipit sequi harum, deleniti officiis necessitatibus voluptatibus, quisquam iusto veniam quod perspiciatis voluptas ratione perferendis culpa odio dignissimos dolores dolore consequuntur nemo.</p>,
                                image: 'https://picsum.photos/32/32/?random'
                            }
                        ]
                    },
                    {
                        date: 'Yesterday',
                        data: [
                            {
                                title: <span><b>Author Name</b> has changed Status to Pending Approval to <b>Superfoods Hilston Citrus</b></span>,
                                time: '2 mins. Ago',
                                content: <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Suscipit sequi harum, deleniti officiis necessitatibus voluptatibus, quisquam iusto veniam quod perspiciatis voluptas ratione perferendis culpa odio dignissimos dolores dolore consequuntur nemo.</p>,
                                status: 'inactive',
                                image: 'https://picsum.photos/32/32/?random'
                            },
                            {
                                title: <span><b>Author Name</b> has changed Status to Pending Approval to <b>Superfoods Hilston Citrus</b></span>,
                                time: '2 mins. Ago',
                                content: <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Suscipit sequi harum, deleniti officiis necessitatibus voluptatibus, quisquam iusto veniam quod perspiciatis voluptas ratione perferendis culpa odio dignissimos dolores dolore consequuntur nemo.</p>,
                                image: 'https://picsum.photos/32/32/?random'
                            }
                        ]
                    }
                ]} />
            </div>
        </div>
        </Layout>
    );
}
 
export default NotificationsPage;