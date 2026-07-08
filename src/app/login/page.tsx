import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getRequestBrand } from "@/lib/branding";
import { SignInButton } from "./sign-in-button";

export default async function LoginPage() {
  // Per-domain branding: the Alta domain shows Alta here too, pre-login.
  const brand = await getRequestBrand();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold tracking-tight">
            {brand.loginTitle}
          </CardTitle>
          <CardDescription className="text-base">
            {brand.loginTagline}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SignInButton />
          <p className="text-center text-sm text-muted-foreground">
            Sign in with your Microsoft account to connect Outlook
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
