"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import LanguageSwitch from "@/components/LanguageSwitch";
import { useI18n } from "@/lib/i18n";

export default function HomePage() {
  const { t } = useI18n();

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="absolute right-4 top-4">
        <LanguageSwitch />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardDescription>{t("common.workspace")}</CardDescription>
          <CardTitle className="text-3xl">{t("app.name")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">{t("home.description")}</p>
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/login">{t("auth.login")}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/register">{t("auth.register")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
