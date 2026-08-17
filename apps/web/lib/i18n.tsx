"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

export type Locale = "en" | "zh";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const STORAGE_KEY = "notionclone.locale";

const messages: Record<Locale, Record<string, string>> = {
  en: {
    "app.name": "NotionClone",
    "common.workspace": "Workspace",
    "common.email": "Email",
    "common.password": "Password",
    "common.name": "Name",
    "common.cancel": "Cancel",
    "common.confirm": "Confirm",
    "common.delete": "Delete",
    "common.add": "Add",
    "common.close": "Close",
    "common.copy": "Copy",
    "common.loading": "Loading...",
    "home.description": "A Notion-inspired workspace with nested pages, blocks, and databases.",
    "auth.login": "Log in",
    "auth.register": "Register",
    "auth.loginSubtitle": "Use the account you registered for NotionClone.",
    "auth.registerSubtitle": "Start building your workspace.",
    "auth.loggingIn": "Logging in...",
    "auth.creatingAccount": "Creating account...",
    "auth.noAccount": "No account?",
    "auth.alreadyRegistered": "Already registered?",
    "auth.loginFailed": "Login failed",
    "auth.registerFailed": "Registration failed",
    "sidebar.search": "Search",
    "sidebar.templates": "Templates",
    "sidebar.workspaces": "Workspaces",
    "sidebar.pages": "Pages",
    "sidebar.newWorkspace": "New workspace",
    "sidebar.addRootPage": "Add root page",
    "sidebar.addRootDatabase": "Add root database",
    "sidebar.logout": "Log out",
    "workspace.deleteTitle": "Delete workspace",
    "workspace.deleteMessage": "Delete this workspace and all its pages?",
    "tree.noPages": "No pages yet. Create one to get started.",
    "tree.addChildPage": "Add child page",
    "tree.addChildDatabase": "Add child database",
    "tree.deletePage": "Delete page",
    "tree.collapse": "Collapse",
    "tree.expand": "Expand",
    "editor.placeholder": "Untitled",
    "editor.share": "Share",
    "editor.exportMd": "Export MD",
    "editor.importMd": "Import MD",
    "editor.copyLink": "Copy link",
    "editor.copyContent": "Copy content",
    "editor.duplicate": "Duplicate",
    "editor.history": "Version history",
    "editor.trash": "Move to trash",
    "move.title": "Move to",
    "move.subtitle": "Choose a new parent page.",
    "move.root": "Workspace root",
    "editor.selectPage": "Select a page to start editing.",
    "database.loading": "Loading database...",
    "database.unavailable": "Database unavailable",
    "database.title": "Database title",
    "database.newRow": "+ New row",
    "database.exportCsv": "Export CSV",
    "database.importCsv": "Import CSV",
    "database.propertyName": "Property name",
    "database.property.text": "Text",
    "database.property.number": "Number",
    "database.property.select": "Select",
    "database.property.date": "Date",
    "database.property.checkbox": "Checkbox",
    "database.selectOptions": "Options, comma separated",
    "database.addProperty": "Add property",
    "database.addFilter": "Add filter",
    "database.filterValue": "Filter value",
    "database.empty": "Empty",
    "database.checked": "Checked",
    "database.unchecked": "Unchecked",
    "database.deleteRow": "Delete row",
    "database.deleteProperty": "Delete property",
    "database.deleteRowTitle": "Delete row",
    "database.deleteRowMessage": "Delete this row and its page?",
    "database.deletePropertyTitle": "Delete property",
    "database.deletePropertyMessage": "Delete this property from all rows?",
    "dialog.deletePageTitle": "Delete page",
    "dialog.deletePageMessage": "Delete \"{title}\" and its children?",
    "search.placeholder": "Search pages by title or content...",
    "search.searching": "Searching...",
    "search.noResults": "No results found.",
    "search.failed": "Search failed",
    "share.title": "Share page",
    "share.create": "Create read-only link",
    "share.creating": "Creating...",
    "share.loading": "Loading shares...",
    "share.revoke": "Revoke",
    "share.revokeTitle": "Revoke share link",
    "share.revokeMessage": "Anyone with this link will lose access.",
    "share.created": "Share link created and copied.",
    "share.revoked": "Share link revoked.",
    "share.failedLoad": "Failed to load shares",
    "share.failedCreate": "Failed to create share",
    "share.failedRevoke": "Failed to revoke share",
    "templates.title": "Templates",
    "templates.subtitle": "Create reusable page templates.",
    "templates.name": "Template name",
    "templates.description": "Description",
    "templates.createBlank": "Create blank template",
    "templates.saveCurrent": "Save current page",
    "templates.loading": "Loading templates...",
    "templates.use": "Use",
    "templates.deleteTitle": "Delete template",
    "templates.deleteMessage": "Delete this template?",
    "templates.created": "Template created.",
    "templates.saved": "Current page saved as template.",
    "templates.deleted": "Template deleted.",
    "templates.selectPage": "Select a page to save it as a template.",
    "shared.badge": "Read-only shared page",
    "shared.unavailable": "Shared page unavailable",
    "shared.error": "This shared page is unavailable",
    "history.title": "Version history",
    "history.subtitle": "Recent revisions of this page.",
    "history.failed": "Failed to load history"
  },
  zh: {
    "app.name": "NotionClone",
    "common.workspace": "工作区",
    "common.email": "邮箱",
    "common.password": "密码",
    "common.name": "姓名",
    "common.cancel": "取消",
    "common.confirm": "确认",
    "common.delete": "删除",
    "common.add": "添加",
    "common.close": "关闭",
    "common.copy": "复制",
    "common.loading": "加载中...",
    "home.description": "一个受 Notion 启发的工作区，支持嵌套页面、块和数据库。",
    "auth.login": "登录",
    "auth.register": "注册",
    "auth.loginSubtitle": "使用你注册的 NotionClone 账号登录。",
    "auth.registerSubtitle": "开始搭建你的工作区。",
    "auth.loggingIn": "登录中...",
    "auth.creatingAccount": "创建中...",
    "auth.noAccount": "还没有账号？",
    "auth.alreadyRegistered": "已经注册？",
    "auth.loginFailed": "登录失败",
    "auth.registerFailed": "注册失败",
    "sidebar.search": "搜索",
    "sidebar.templates": "模板",
    "sidebar.workspaces": "工作区",
    "sidebar.pages": "页面",
    "sidebar.newWorkspace": "新建工作区",
    "sidebar.addRootPage": "新建根页面",
    "sidebar.addRootDatabase": "新建根数据库",
    "sidebar.logout": "退出登录",
    "workspace.deleteTitle": "删除工作区",
    "workspace.deleteMessage": "删除此工作区及其所有页面？",
    "tree.noPages": "还没有页面，先创建一个吧。",
    "tree.addChildPage": "新建子页面",
    "tree.addChildDatabase": "新建子数据库",
    "tree.deletePage": "删除页面",
    "tree.collapse": "折叠",
    "tree.expand": "展开",
    "editor.placeholder": "未命名",
    "editor.share": "分享",
    "editor.exportMd": "导出 MD",
    "editor.importMd": "导入 MD",
    "editor.copyLink": "复制链接",
    "editor.copyContent": "复制内容",
    "editor.duplicate": "复制一份",
    "editor.history": "历史版本",
    "editor.trash": "放到垃圾桶",
    "move.title": "移动到",
    "move.subtitle": "选择新的父页面。",
    "move.root": "工作区根目录",
    "editor.selectPage": "选择页面开始编辑。",
    "database.loading": "正在加载数据库...",
    "database.unavailable": "数据库不可用",
    "database.title": "数据库标题",
    "database.newRow": "+ 新建行",
    "database.exportCsv": "导出 CSV",
    "database.importCsv": "导入 CSV",
    "database.propertyName": "属性名称",
    "database.property.text": "文本",
    "database.property.number": "数字",
    "database.property.select": "单选",
    "database.property.date": "日期",
    "database.property.checkbox": "复选框",
    "database.selectOptions": "选项，用逗号分隔",
    "database.addProperty": "添加属性",
    "database.addFilter": "添加筛选",
    "database.filterValue": "筛选值",
    "database.empty": "空",
    "database.checked": "已勾选",
    "database.unchecked": "未勾选",
    "database.deleteRow": "删除行",
    "database.deleteProperty": "删除属性",
    "database.deleteRowTitle": "删除行",
    "database.deleteRowMessage": "删除这一行及其页面？",
    "database.deletePropertyTitle": "删除属性",
    "database.deletePropertyMessage": "从所有行中删除此属性？",
    "dialog.deletePageTitle": "删除页面",
    "dialog.deletePageMessage": "删除“{title}”及其子页面？",
    "search.placeholder": "按标题或内容搜索页面...",
    "search.searching": "正在搜索...",
    "search.noResults": "没有找到结果。",
    "search.failed": "搜索失败",
    "share.title": "分享页面",
    "share.create": "创建只读链接",
    "share.creating": "创建中...",
    "share.loading": "正在加载分享...",
    "share.revoke": "撤销",
    "share.revokeTitle": "撤销分享链接",
    "share.revokeMessage": "拥有此链接的人将失去访问权限。",
    "share.created": "分享链接已创建并复制。",
    "share.revoked": "分享链接已撤销。",
    "share.failedLoad": "加载分享失败",
    "share.failedCreate": "创建分享失败",
    "share.failedRevoke": "撤销分享失败",
    "templates.title": "模板",
    "templates.subtitle": "创建可复用的页面模板。",
    "templates.name": "模板名称",
    "templates.description": "描述",
    "templates.createBlank": "创建空白模板",
    "templates.saveCurrent": "保存当前页面",
    "templates.loading": "正在加载模板...",
    "templates.use": "使用",
    "templates.deleteTitle": "删除模板",
    "templates.deleteMessage": "删除此模板？",
    "templates.created": "模板已创建。",
    "templates.saved": "当前页面已保存为模板。",
    "templates.deleted": "模板已删除。",
    "templates.selectPage": "请选择页面后再保存为模板。",
    "shared.badge": "只读分享页面",
    "shared.unavailable": "分享页面不可用",
    "shared.error": "此分享页面不可用",
    "history.title": "版本历史",
    "history.subtitle": "此页面的最近版本记录。",
    "history.failed": "加载历史失败"
  }
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") {
      return "zh";
    }
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "en" || saved === "zh" ? saved : "zh";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const template = messages[locale][key] ?? messages.en[key] ?? key;
      if (!vars) {
        return template;
      }
      return Object.entries(vars).reduce(
        (result, [name, value]) =>
          result.replaceAll(`{${name}}`, String(value)),
        template
      );
    },
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
