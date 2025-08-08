import Page from "@/components/Page"
import { Title, Paragraph, Instructions, Warning, Reference, UL, LI } from "@/components/Text";

const HelpPage = () => {
    return (
        <Page>
            <Title level={1}>
                Help Page
            </Title>
            <Title level={2}>
                General Information
            </Title>
            <Paragraph>
                This website was designed for my AI course, which is to follow the lesson contents exactly. To prevent spoilers, the course activities
                are only available via a code, which is announced in class and provided in the worksheets. This website is in active development for the course,
                and you may experience some bugs. If you do find a critical issue, please let me know my talking to me before/after class or contact the centre
                hosting the workshops. This website does not store any of your personal information! It runs as a static website with source code
                available upon request.
            </Paragraph>
            <Paragraph>
                This website is designed for use under supervision in the classroom, while the activities are occurring, and for use at home under parental supervision.
                All activities will be provided with a set of instructions, however to understand the full context, you will need to read the worksheet.
            </Paragraph>
            <Title level={2}>
                Technical Requirements
            </Title>
            <Paragraph>
                This course is designed to be used on a laptop computer. Specifically, the only devices that can be used must meet all of the following conditions.
                The device must have:
            </Paragraph>
            <UL>
                <LI>an internet connection and access to a modern browser (like Google Chrome, Firefox, Safari, etc.)</LI>
                <LI><b>easy</b> access to a desktop to create and manipulate files (specifically <code>.html</code>) files.</LI>
                <LI>access to a text file editor (most computers have one built in).</LI>
            </UL>
            <Paragraph>
                Latops can be provided for students who are unable to provide one. The following devices will not be able to support all activities for the course:
            </Paragraph>
            <UL>
                <LI>iPads or any tablet</LI>
                <LI>Mobile phones</LI>
            </UL>
            <Paragraph>
                If you are unsure about the specifications required for the course, please contact the centre or approach me before/after the lesson to enquire.
            </Paragraph>
            <Title level={2}>
                Keys of Important Information
            </Title>
            <Paragraph>
                Below are some examples of the types of text blocks and their purposes.
            </Paragraph>
            <Instructions>
                Instructions for the activities will appear in yellow blocks, like this one! It is important to read these instructions carefully.
            </Instructions>
            <Warning>
                This block is a warning block, alerting you of any potential risks of a resource or if there is any vital information needed. Think of a warning as an
                incredibly important notice that needs to be considered. There will be no access to dangerous or malicious material on this website.
            </Warning>
            <Paragraph>
                For the most part, you will need to read any of the above before attempting any activity. Remember, this site is meant to be used under supervision,
                so please do not neglect these warnings. Below are optional reads that you may find interesting.
            </Paragraph>
            <Reference>
                This type of block references outside material that complement the concepts being attempted in the activities on this website. If you would like to know
                more about the topic being covered in an activity, you can find additional reading in this section. The basics will be covered in the worksheet, but if
                you would like an extension, you will be able to find resources here.
            </Reference>
            <Title level={2}>
                Privacy and Requested Terms
            </Title>
            <Paragraph>
                This website is designed for use strictly for students in the AI course it is introduced in. The contents of this website are intentionally hidden
                so that they are only easily accessible with the activity codes. Please do not share access to this website unless it is with another entity enrolled
                in the program.
            </Paragraph>
            <Paragraph>
                As stated before, no personal information will be tracked through this website. The worst case would be tracking view numbers to get an idea of how
                often this website is visited. However, this has not yet been implemented (and probably won't be).
            </Paragraph>
        </Page>
    )
}

export default HelpPage;