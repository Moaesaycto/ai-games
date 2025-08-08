import Page from "@/components/Page"

const HomePage = () => {
    return (
        <Page>
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <h1 className="text-6xl font-bold mb-4">404</h1>
                <p className="text-2xl font-semibold mb-2">Page Not Found</p>
                <p className="text-gray-400 mb-6">
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <a 
                    href="/" 
                >
                    Return Home
                </a>
            </div>
        </Page>
    )
}

export default HomePage;
