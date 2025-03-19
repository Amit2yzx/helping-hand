import { Redirect } from 'expo-router';

export default function AuthIndexPage() {
  // Redirect from /auth to /auth/login instead of redirecting to root
  return <Redirect href={'/auth/login' as any} />;
} 