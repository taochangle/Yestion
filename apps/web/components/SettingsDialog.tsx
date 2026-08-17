"use client";

import { ReactNode, useState } from "react";
import {
  Download,
  MonitorSmartphone,
  Settings2,
  SlidersHorizontal,
  Trash2,
  X
} from "lucide-react";
import LanguageSwitch from "@/components/LanguageSwitch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { User, Workspace } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  workspace?: Workspace;
};

type SettingsTab = "profile" | "preferences" | "general" | "import";

const navGroups = [
  {
    labelKey: "settings.account",
    items: [{ id: "preferences", labelKey: "settings.preferences" }]
  },
  {
    labelKey: "settings.workspace",
    items: [
      { id: "general", labelKey: "settings.general" },
      { id: "import", labelKey: "settings.import" }
    ]
  }
] as const;

function tabIcon(id: string) {
  if (id === "preferences") {
    return <SlidersHorizontal size={16} />;
  }
  if (id === "general") {
    return <Settings2 size={16} />;
  }
  return <Download size={16} />;
}

type SettingsRowProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

function SettingsRow({ title, description, children }: SettingsRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-3">
      <div className="min-w-[200px] flex-[3]">
        <p className="text-sm font-medium text-zinc-900">{title}</p>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-zinc-500">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-1 items-center justify-end">{children}</div>
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="border-b border-zinc-100 pb-3 text-base font-semibold text-zinc-900">
      {children}
    </h3>
  );
}

export default function SettingsDialog({
  open,
  onOpenChange,
  user,
  workspace
}: SettingsDialogProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<SettingsTab>("preferences");
  const [useSystemAppearance, setUseSystemAppearance] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [enterNewLine, setEnterNewLine] = useState(true);
  const [weekStartsMonday, setWeekStartsMonday] = useState(true);
  const [alwaysShowDirectionControls, setAlwaysShowDirectionControls] =
    useState(false);
  const [openLinksInDesktopApp, setOpenLinksInDesktopApp] = useState(false);
  const [autoTimeZone, setAutoTimeZone] = useState(true);
  const [profileDiscoverable, setProfileDiscoverable] = useState(true);

  const activeTitle =
    activeTab === "profile"
      ? t("settings.account")
      : activeTab === "preferences"
        ? t("settings.preferences")
        : activeTab === "general"
          ? t("settings.general")
          : t("settings.import");
  const activeSubtitle =
    activeTab === "profile" ? t("settings.profileTitle") : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[calc(100%-100px)] max-h-full w-[90vw] max-w-[1512px] overflow-hidden rounded-xl p-0 shadow-2xl">
        <div className="flex h-full">
          <aside className="flex h-full w-[240px] shrink-0 flex-col overflow-y-auto bg-zinc-50 p-2">
            {navGroups.map((group) => (
              <div key={group.labelKey} className="mb-3">
                <p className="px-2 py-2 text-xs font-medium text-zinc-400">
                  {t(group.labelKey)}
                </p>
                {group.labelKey === "settings.account" ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab("profile")}
                    className={`mb-1 flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-zinc-100 ${
                      activeTab === "profile" ? "bg-zinc-200" : ""
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-700">
                      {user.name?.slice(0, 1).toUpperCase() || "U"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800">
                      {user.name}
                    </span>
                  </button>
                ) : null}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const selected = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        className={`flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm ${
                          selected
                            ? "bg-zinc-200 font-medium text-zinc-900"
                            : "text-zinc-600 hover:bg-zinc-100"
                        }`}
                      >
                        <span className={selected ? "text-zinc-900" : "text-zinc-400"}>
                          {tabIcon(item.id)}
                        </span>
                        {t(item.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </aside>

          <section className="min-w-0 flex-1 overflow-y-auto">
            <header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-zinc-100 bg-white px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  {activeTitle}
                </h2>
                {activeSubtitle ? (
                  <p className="mt-1 text-sm text-zinc-500">{activeSubtitle}</p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => onOpenChange(false)}
                aria-label={t("common.close")}
              >
                <X size={18} />
              </Button>
            </header>

            <div className="px-6 py-6">
              {activeTab === "profile" ? (
                <div className="mx-auto max-w-3xl">
                  <SectionHeading>{t("settings.profileInfo")}</SectionHeading>
                  <div className="flex items-center">
                    <button
                      type="button"
                      className="flex h-15 w-15 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-300 bg-zinc-100 text-xl font-medium text-zinc-600"
                    >
                      {user.name?.slice(0, 1).toUpperCase() || "U"}
                    </button>
                    <div className="ml-5 w-64 max-w-full">
                      <label className="mb-1 block text-xs text-zinc-500">
                        {t("settings.preferredName")}
                      </label>
                      <Input defaultValue={user.name} className="h-9" />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-zinc-500">
                    {t("settings.useNotionFace")}{" "}
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                    >
                      {t("settings.createCustomAvatar")}
                    </button>
                  </p>

                  <div className="mt-8">
                    <SectionHeading>{t("settings.accountSecurity")}</SectionHeading>
                    <SettingsRow
                      title={t("settings.email")}
                      description={user.email}
                    >
                      <Button variant="outline" size="sm">
                        {t("settings.manageEmails")}
                      </Button>
                    </SettingsRow>
                    <SettingsRow
                      title={t("settings.password")}
                      description={t("settings.passwordDescription")}
                    >
                      <Button variant="outline" size="sm">
                        {t("settings.setPassword")}
                      </Button>
                    </SettingsRow>
                    <SettingsRow
                      title={t("settings.twoStepVerification")}
                      description={t("settings.twoStepVerificationDescription")}
                    >
                      <Button variant="outline" size="sm">
                        {t("settings.addVerificationMethod")}
                      </Button>
                    </SettingsRow>
                    <SettingsRow
                      title={t("settings.passkeys")}
                      description={t("settings.passkeysDescription")}
                    >
                      <Button variant="outline" size="sm">
                        {t("settings.addPasskey")}
                      </Button>
                    </SettingsRow>
                  </div>

                  <div className="mt-8">
                    <SectionHeading>{t("settings.support")}</SectionHeading>
                    <SettingsRow
                      title={t("settings.supportAccess")}
                      description={t("settings.supportAccessDescription")}
                    >
                      <Switch checked={false} />
                    </SettingsRow>
                  </div>

                  <div className="mt-8">
                    <SectionHeading>{t("settings.dangerZone")}</SectionHeading>
                    <SettingsRow
                      title={t("settings.deleteAccount")}
                      description={t("settings.deleteAccountDescription")}
                    >
                      <Button variant="destructive" size="sm" disabled>
                        <Trash2 size={14} />
                        {t("settings.deleteAccount")}
                      </Button>
                    </SettingsRow>
                  </div>

                  <div className="mt-8">
                    <SectionHeading>{t("settings.devices")}</SectionHeading>
                    <SettingsRow
                      title={t("settings.logOutAllDevices")}
                      description={t("settings.logOutAllDevicesDescription")}
                    >
                      <Button variant="outline" size="sm" className="text-red-600">
                        {t("settings.logOutAllDevices")}
                      </Button>
                    </SettingsRow>
                    <div className="mt-2 overflow-hidden rounded-lg border border-zinc-200">
                      <div className="grid grid-cols-[1.3fr_1fr_1fr_0.5fr] border-b border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500">
                        <span>{t("settings.deviceName")}</span>
                        <span>{t("settings.lastActivity")}</span>
                        <span>{t("settings.location")}</span>
                        <span />
                      </div>
                      <div className="grid grid-cols-[1.3fr_1fr_1fr_0.5fr] items-center px-3 py-3 text-xs">
                        <span className="flex items-center gap-2 font-medium text-zinc-900">
                          <MonitorSmartphone size={16} className="text-zinc-400" />
                          macOS
                          <span className="text-[11px] font-normal text-blue-600">
                            {t("settings.thisDevice")}
                          </span>
                        </span>
                        <span>{t("settings.now")}</span>
                        <span>Hong Kong</span>
                        <span />
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeTab === "preferences" ? (
                <div className="mx-auto max-w-3xl">
                  <SectionHeading>{t("settings.appearance")}</SectionHeading>
                  <div className="divide-y divide-zinc-100">
                    <SettingsRow
                      title={t("settings.appearance")}
                      description={t("settings.appearanceDescription")}
                    >
                      <Select
                        value={useSystemAppearance ? "system" : "light"}
                        onValueChange={(value) =>
                          setUseSystemAppearance(value === "system")
                        }
                      >
                        <SelectTrigger size="sm" className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="system">
                            {t("settings.useSystemAppearance")}
                          </SelectItem>
                          <SelectItem value="light">
                            {t("settings.light")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingsRow>
                    <SettingsRow
                      title={t("settings.highContrast")}
                      description={t("settings.highContrastDescription")}
                    >
                      <Switch
                        checked={highContrast}
                        onCheckedChange={setHighContrast}
                      />
                    </SettingsRow>
                  </div>

                  <div className="mt-8">
                    <SectionHeading>{t("settings.inputOptions")}</SectionHeading>
                    <SettingsRow
                      title={t("settings.enterNewLine")}
                      description={t("settings.enterNewLineDescription")}
                    >
                      <Switch
                        checked={enterNewLine}
                        onCheckedChange={setEnterNewLine}
                      />
                    </SettingsRow>
                  </div>

                  <div className="mt-8">
                    <SectionHeading>{t("settings.languageTime")}</SectionHeading>
                    <div className="divide-y divide-zinc-100">
                      <SettingsRow
                        title={t("settings.language")}
                        description={t("settings.languageDescription")}
                      >
                        <LanguageSwitch />
                      </SettingsRow>
                      <SettingsRow title={t("settings.numberFormat")}>
                        <Select defaultValue="default">
                          <SelectTrigger size="sm" className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">
                              {t("settings.default")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </SettingsRow>
                      <SettingsRow
                        title={t("settings.alwaysShowDirectionControls")}
                        description={t("settings.alwaysShowDirectionControlsDescription")}
                      >
                        <Switch
                          checked={alwaysShowDirectionControls}
                          onCheckedChange={setAlwaysShowDirectionControls}
                        />
                      </SettingsRow>
                      <SettingsRow
                        title={t("settings.weekStartsMonday")}
                        description={t("settings.weekStartsMondayDescription")}
                      >
                        <Switch
                          checked={weekStartsMonday}
                          onCheckedChange={setWeekStartsMonday}
                        />
                      </SettingsRow>
                      <SettingsRow
                        title={t("settings.dateFormat")}
                        description={t("settings.dateFormatDescription")}
                      >
                        <Select defaultValue="relative">
                          <SelectTrigger size="sm" className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="relative">
                              {t("settings.relativeDate")}
                            </SelectItem>
                            <SelectItem value="absolute">
                              {t("settings.absoluteDate")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </SettingsRow>
                      <SettingsRow
                        title={t("settings.autoTimeZone")}
                        description={t("settings.autoTimeZoneDescription")}
                      >
                        <Switch
                          checked={autoTimeZone}
                          onCheckedChange={setAutoTimeZone}
                        />
                      </SettingsRow>
                      <SettingsRow
                        title={t("settings.timeZone")}
                        description={t("settings.timeZoneDescription")}
                      >
                        <Select defaultValue="shanghai">
                          <SelectTrigger size="sm" className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="shanghai">
                              (GMT+8:00) {t("settings.shanghai")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </SettingsRow>
                    </div>
                  </div>

                  <div className="mt-8">
                    <SectionHeading>{t("settings.desktopApp")}</SectionHeading>
                    <SettingsRow
                      title={t("settings.openLinksInDesktopApp")}
                      description={t("settings.openLinksInDesktopAppDescription")}
                    >
                      <Switch
                        checked={openLinksInDesktopApp}
                        onCheckedChange={setOpenLinksInDesktopApp}
                      />
                    </SettingsRow>
                    <SettingsRow
                      title={t("settings.startupPage")}
                      description={t("settings.startupPageDescription")}
                    >
                      <Select defaultValue="last">
                        <SelectTrigger size="sm" className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="last">
                            {t("settings.lastVisitedPage")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingsRow>
                  </div>

                  <div className="mt-8">
                    <SectionHeading>{t("settings.privacy")}</SectionHeading>
                    <div className="divide-y divide-zinc-100">
                      <SettingsRow
                        title={t("settings.cookieSettings")}
                        description={t("settings.cookieSettingsDescription")}
                      >
                        <Button variant="outline" size="sm">
                          {t("settings.custom")}
                        </Button>
                      </SettingsRow>
                      <SettingsRow
                        title={t("settings.showViewHistory")}
                        description={t("settings.showViewHistoryDescription")}
                      >
                        <Switch checked />
                      </SettingsRow>
                      <SettingsRow
                        title={t("settings.profileDiscoverability")}
                        description={t(
                          "settings.profileDiscoverabilityDescription"
                        )}
                      >
                        <Switch
                          checked={profileDiscoverable}
                          onCheckedChange={setProfileDiscoverable}
                        />
                      </SettingsRow>
                    </div>
                  </div>
                </div>
              ) : activeTab === "general" ? (
                <div className="mx-auto max-w-3xl">
                  <SectionHeading>{t("settings.workspaceSettings")}</SectionHeading>
                  <div className="divide-y divide-zinc-100">
                    <SettingsRow
                      title={t("settings.workspaceName")}
                      description={t("settings.workspaceNameDescription")}
                    >
                      <Input
                        value={workspace?.name ?? ""}
                        readOnly
                        className="h-9 w-64 max-w-full"
                      />
                    </SettingsRow>
                    <SettingsRow
                      title={t("settings.workspaceIcon")}
                      description={t("settings.workspaceIconDescription")}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-xl">
                        {workspace?.icon || "🏠"}
                      </span>
                    </SettingsRow>
                    <SettingsRow
                      title={t("settings.customLandingPage")}
                      description={t("settings.customLandingPageDescription")}
                    >
                      <Button variant="outline" size="sm">
                        {t("settings.selectPage")}
                      </Button>
                    </SettingsRow>
                    <SettingsRow
                      title={t("settings.showNotionCalendar")}
                      description={t("settings.showNotionCalendarDescription")}
                    >
                      <Switch />
                    </SettingsRow>
                    <SettingsRow
                      title={t("settings.allowedEmailDomains")}
                      description={t("settings.allowedEmailDomainsDescription")}
                    >
                      <Input
                        placeholder="@example.com"
                        className="h-9 w-64 max-w-full"
                      />
                    </SettingsRow>
                  </div>

                  <div className="mt-8">
                    <SectionHeading>{t("settings.export")}</SectionHeading>
                    <SettingsRow
                      title={t("settings.workspaceContent")}
                      description={t("settings.workspaceContentDescription")}
                    >
                      <Button variant="outline" size="sm">
                        {t("settings.export")}
                      </Button>
                    </SettingsRow>
                  </div>

                  <div className="mt-8">
                    <SectionHeading>{t("settings.members")}</SectionHeading>
                    <SettingsRow
                      title={t("settings.workspaceMembers")}
                      description={t("settings.workspaceMembersDescription")}
                    >
                      <Button variant="outline" size="sm" disabled>
                        {t("settings.export")}
                      </Button>
                    </SettingsRow>
                  </div>

                  <div className="mt-8">
                    <SectionHeading>{t("settings.analytics")}</SectionHeading>
                    <SettingsRow
                      title={t("settings.analyticsTitle")}
                      description={t("settings.analyticsDescription")}
                    >
                      <Switch checked />
                    </SettingsRow>
                  </div>

                  <div className="mt-8">
                    <SectionHeading>{t("settings.dangerZone")}</SectionHeading>
                    <SettingsRow
                      title={t("settings.deleteWorkspace")}
                      description={t("settings.deleteWorkspaceDescription")}
                    >
                      <Button variant="destructive" size="sm" disabled>
                        {t("settings.deleteWorkspace")}
                      </Button>
                    </SettingsRow>
                  </div>

                  <div className="mt-8">
                    <SectionHeading>{t("settings.workspaceId")}</SectionHeading>
                    <div className="flex items-center justify-between py-3">
                      <span className="text-xs text-zinc-500">
                        {t("settings.workspaceId")}
                      </span>
                      <span className="text-xs text-zinc-900">
                        {workspace?.id ?? ""}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-3xl">
                  <SectionHeading>{t("settings.import")}</SectionHeading>
                  <p className="mt-4 text-sm text-zinc-500">
                    {t("settings.importDescription")}
                  </p>
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-zinc-900">
                      {t("settings.fileBasedImport")}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("settings.fileBasedImportDescription")}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {[
                        { label: "CSV", description: t("settings.csvDescription") },
                        { label: "PDF", description: t("settings.pdfDescription") },
                        {
                          label: t("settings.importMarkdown"),
                          description: t("settings.textDescription")
                        },
                        {
                          label: "HTML",
                          description: t("settings.htmlDescription")
                        },
                        {
                          label: t("settings.importWord"),
                          description: t("settings.wordDescription")
                        }
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className="rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-sm hover:bg-zinc-50"
                        >
                          <div className="text-sm font-medium text-zinc-900">
                            {item.label}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {item.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8">
                    <h3 className="text-sm font-medium text-zinc-900">
                      {t("settings.thirdPartyImport")}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("settings.thirdPartyImportDescription")}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {[
                        "Asana",
                        "Confluence",
                        "Trello",
                        "Workflowy",
                        "Evernote",
                        "Jira",
                        "Monday.com",
                        "Quip",
                        "Google Docs"
                      ].map((item) => (
                        <button
                          key={item}
                          type="button"
                          className="rounded-lg border border-zinc-200 bg-white p-3 text-left text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
