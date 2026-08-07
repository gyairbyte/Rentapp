import { AuthForm } from '@/components/auth-form'
import { signIn } from '@/lib/actions/auth'

export default function LoginPage() {
  return <AuthForm mode="signin" action={signIn} />
}
