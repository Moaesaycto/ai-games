import { type ReactNode } from "react"

type PageProps = {
    children?: ReactNode
}

const Page = ({ children }: PageProps) => {
    return (
        <div className="w-full text-left px-10 py-5 text-lg">
            {children}
        </div>
    )
}

export default Page;