import type { ReactNode } from "react"

type TitleProps = {
  children?: ReactNode;
  level?: number;
}

export const Title = ({ children, level }: TitleProps) => {

  let styling = ""
  switch (level) {
    case 1:
      styling = "text-3xl font-bold border-b pb-3 my-5 w-full";
      break;
    case 2:
      styling = "text-2xl font-bold my-5 mt-10 underline";
      break;
    default:
      styling = "text-1xl font-bold my-5";
  }

  return (
    <p className={styling}>
      {children}
    </p>
  )
}


type ParagraphProps = {
  children?: ReactNode;
}

export const Paragraph = ({ children }: ParagraphProps) => {
  return (
    <p className="mb-5">
      {children}
    </p>
  )
}


type InstructionsProps = {
  children?: ReactNode;
}

export const Instructions = ({ children }: InstructionsProps) => {
  return (
    <div className="bg-amber-200 px-5 py-2 rounded border-l-amber-500 border-l-8 text-zinc-900 mb-5">
      {children}
    </div>
  )
}

type WarningProps = {
  children?: ReactNode;
}

export const Warning = ({ children }: WarningProps) => {
  return (
    <div className="bg-red-200 px-5 py-2 rounded border-l-red-500 border-l-8 text-zinc-900 mb-5">
      {children}
    </div>
  )
}


type ReferenceProps = {
  children?: ReactNode;
}

export const Reference = ({ children }: ReferenceProps) => {
  return (
    <div className="bg-violet-200 px-5 py-2 rounded border-l-violet-500 border-l-8 text-zinc-900 mb-5">
      {children}
    </div>
  )
}


type ULProps = {
  children?: ReactNode;
  className?: string;
};

export const UL = ({ children, className = "" }: ULProps) => {
  return (
    <ul className={`list-disc pl-8 mb-5 ${className}`}>
      {children}
    </ul>
  );
};

type LIProps = {
  children?: ReactNode;
  className?: string;
};

export const LI = ({ children, className = "" }: LIProps) => {
  return (
    <li className={`mb-2 ${className}`}>
      {children}
    </li>
  );
};