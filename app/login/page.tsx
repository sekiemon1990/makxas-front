import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  return (
    <AppShell>
      <div className="flex h-screen items-center justify-center bg-[linear-gradient(180deg,#fafafa_0%,#f4f4f5_100%)] p-8">
        <Card className="w-full max-w-[420px] rounded-lg border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl">makxas-front</CardTitle>
            <CardDescription>
              反響対応を始めるにはログインしてください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/api/auth/google" method="post">
              <Button className="w-full" size="lg" type="submit">
                <GoogleIcon />
                Googleでログイン
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21.6 12.23c0-.75-.07-1.47-.19-2.16H12v4.09h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.46Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.96-.9 6.62-2.31l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.05v2.59A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.4 14.02A6.01 6.01 0 0 1 6.08 12c0-.7.12-1.38.32-2.02V7.39H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.61l3.35-2.59Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.86c1.47 0 2.79.51 3.82 1.5l2.87-2.87C16.96 2.88 14.7 2 12 2a10 10 0 0 0-8.95 5.39L6.4 9.98c.79-2.36 3-4.12 5.6-4.12Z"
        fill="#EA4335"
      />
    </svg>
  );
}
