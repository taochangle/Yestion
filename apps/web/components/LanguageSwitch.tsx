"use client";

import { useI18n } from "@/lib/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

export default function LanguageSwitch() {
  const { locale, setLocale } = useI18n();

  return (
    <Select
      value={locale}
      onValueChange={(value) => setLocale(value as "en" | "zh")}
    >
      <SelectTrigger size="sm" className="w-24">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="zh">中文</SelectItem>
        <SelectItem value="en">English</SelectItem>
      </SelectContent>
    </Select>
  );
}
