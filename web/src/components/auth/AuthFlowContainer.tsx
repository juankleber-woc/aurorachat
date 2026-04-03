import Link from "next/link";
import Image from "next/image";
import auroraLogo from "@public/aurora-logo.png";

export default function AuthFlowContainer({
  children,
  authState,
  footerContent,
}: {
  children: React.ReactNode;
  authState?: "signup" | "login" | "join";
  footerContent?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-6 sm:p-4">
      <div className="flex w-full max-w-md flex-col items-start rounded-16 bg-background-tint-00 p-5 shadow-lg shadow-02 sm:p-6">
        <Image
          src={auroraLogo}
          alt="AuroraChat logo"
          width={44}
          height={44}
          className="rounded-full ring-1 ring-[var(--border-02)]"
          priority
        />
        <div className="w-full mt-3">{children}</div>
      </div>
      {authState === "login" && (
        <div className="mx-auto mt-6 w-full max-w-md px-2 text-center text-sm text-text-03 mainUiBody">
          {footerContent ?? (
            <>
              New to AuroraChat?{" "}
              <Link
                href="/auth/signup"
                className="text-text-05 mainUiAction underline transition-colors duration-200"
              >
                Create an Account
              </Link>
            </>
          )}
        </div>
      )}
      {authState === "signup" && (
        <div className="mx-auto mt-6 w-full max-w-md px-2 text-center text-sm text-text-03 mainUiBody">
          Already have an account?{" "}
          <Link
            href="/auth/login?autoRedirectToSignup=false"
            className="text-text-05 mainUiAction underline transition-colors duration-200"
          >
            Sign In
          </Link>
        </div>
      )}
    </div>
  );
}
