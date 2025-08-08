import { Link } from "react-router-dom";

const Header = () => {
  return (
    <div className="w-full bg-neutral-900 text-left">
      <Link to="/" className="">
        <div className="flex gap-8 px-8 py-5 items-center">
          <img src="/development-icon.png" alt="logo" className="w-20 h-20" />
          <div className="">
            <h1 className="font-bold text-white hover:text-white">
              AI Course Directory
            </h1>
            <h2 className="opacity-90 text-xl italic text-white hover:text-white">
              Portal to all the games and sites for the course
            </h2>
          </div>
        </div>
      </Link>
    </div>
  )
}

export default Header;