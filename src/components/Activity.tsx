import type { ReactNode } from "react"

type ActivityProps = {
    children: ReactNode;
}

const Activity = ({children}: ActivityProps) => {
    return (
        <div className="">
            {children}
        </div>
    )
}

export default Activity;