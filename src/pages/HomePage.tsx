import Page from "@/components/Page"
import { Paragraph, Title } from "@/components/Text"
import { FaGamepad, FaGithub, FaYoutube } from "react-icons/fa";
import IconButton from "@/components/IconButton";
import { Link } from "react-router-dom";


const HomePage = () => {
  return (
    <Page>
      <Title level={1}>
        Welcome to the AI Course Directory!
      </Title>
      <Paragraph>
        Welcome to the AI Course Directory! Here, you will be able to access the content reference in the course.
        Activities are accessed via codes given in the worksheets. You will not be able to access them without
        the codes.
      </Paragraph>
      <div className="p-10">
        <IconButton
          icon={<FaGamepad size={40} />}
          title="Go to Activity Page"
          subtitle="Activities will be available here. Be sure to have your code ready!"
          color="#4CAF50"
          link="/ai-games/#/activities"
          suppressWarning
          openInNewTab={false}
        />
      </div>
      <Title level={1}>
        External Resources
      </Title>
      <Paragraph>
        This course will reference certain code repositories, videos and external websites. These websites are all safe to visit,
        and are available below. As the weeks progress, more and more links will be added. Some of these websites will require
        a login, so pay close attention to announcements ahead of time in order to know which websites need an account.
      </Paragraph>
      <div className="flex flex-col gap-6 md:flex-row md:gap-10">
        <IconButton
          icon={<FaYoutube size={40} />}
          title="YouTube Playlist"
          subtitle="All of the YouTube videos referenced in the course"
          color="#ff0000"
          link="https://www.youtube.com/watch?v=Sq1QZB5baNw&list=PLqloigyYltZzZeciSlnsrhIZrgsOuXSJ0&pp=gAQB"
        />
        <IconButton
          icon={<FaGithub size={40} />}
          title="Website Source Code"
          subtitle="Source code for this website"
          color="#010409"
          link="https://github.com/Moaesaycto/ai-games"
        />
      </div>
      <Title level={1}>
        Support
      </Title>
      <Paragraph>
        This website is designed for use during my AI course. If you are not enrolled in this course, then you will be unable
        to access most of the content in this website. In order to access activities, you will need to refer to the handouts
        from the lesson, as all access codes will be available in them. The codes will be a string of six letters or numbers,
        and will be clearly marked. If you require further assistance, or need some help, consider visiting
        the <Link to="/help">help</Link> portion of this website.
      </Paragraph>
    </Page>
  )
}

export default HomePage;