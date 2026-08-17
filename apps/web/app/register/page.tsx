"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LanguageSwitch from "@/components/LanguageSwitch";
import { useI18n } from "@/lib/i18n";
import { apiFetch, AuthResponse, setAuthCookie } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await apiFetch<AuthResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password })
      });
      setAuthCookie(result.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.registerFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="absolute right-4 top-4">
        <LanguageSwitch />
      </div>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm"
      >
        <Card>
          <CardHeader>
            <CardTitle>{t("auth.register")}</CardTitle>
            <CardDescription>{t("auth.registerSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t("common.name")}</Label>
            <Input
              id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">{t("common.email")}</Label>
            <Input
              id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">{t("common.password")}</Label>
            <Input
              id="password"
            type="password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            />
          </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <Button
          type="submit"
          disabled={loading}
          className="w-full"
        >
          {loading ? t("auth.creatingAccount") : t("auth.register")}
        </Button>

        <p className="mt-6 text-center text-sm text-zinc-500">
          {t("auth.alreadyRegistered")}{" "}
          <Link href="/login" className="font-medium text-zinc-900">
            {t("auth.login")}
          </Link>
        </p>
          </CardContent>
        </Card>
      </form>
    </main>
  );
}
