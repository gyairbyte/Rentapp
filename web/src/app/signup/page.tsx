import { AuthForm } from '@/components/auth-form'
import { signUp } from '@/lib/actions/auth'

export default function SignupPage() {
  return <AuthForm mode="signup" action={signUp} />
}
