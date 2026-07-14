import SignInForm from "./SignInForm";

export default function SignInPage() {
  // Compute the flag server-side; never pass the secret itself to the client (ENG-004).
  const devLoginEnabled =
    process.env.NODE_ENV !== "production" && !!process.env.TEST_AUTH_SECRET;
  return <SignInForm devLoginEnabled={devLoginEnabled} />;
}
