import SignInForm from "./SignInForm";

export default function SignInPage() {
  const testAuthSecret = process.env.TEST_AUTH_SECRET ?? null;
  return <SignInForm testAuthSecret={testAuthSecret} />;
}
