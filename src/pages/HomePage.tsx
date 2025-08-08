import Page from "@/components/Page"
import { Title } from "@/components/Text"
import { FaYoutube } from "react-icons/fa";
import IconButton from "@/components/IconButton";


const HomePage = () => {
    return (
        <Page>
            <Title level={1}>
                Welcome to the AI Course Directory!
            </Title>
            <div>
                <IconButton
                    icon={<FaYoutube size={28} />}
                    title="YouTube Playlist"
                    subtitle="All of the YouTube videos referenced in the course"
                    color="#ff0000"
                    link="https://www.youtube.com/"
                />
            </div>
        </Page>
    )
}

export default HomePage;