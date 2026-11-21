import { useCallback, useMemo } from "react";
import { FiDownload, FiGrid, FiHome, FiImage, FiInbox, FiShield } from "react-icons/fi";
import { moduleIcon } from "@/features/content/icons";
import { labelIn } from "@/features/content/labels";
import { sitePath, useSiteScope } from "@/features/sites/siteContext";

// Müşteri paneli rotaları. Site kapsamlı sayfalar /siteler/:siteId altındadır; adres siteyi taşır (şartname §12).
// permission: site izni (bootstrap'tan); arayüz denetimi yalnız deneyimdir, API her istekte denetler.
export const routeGroups = [
  {
    id: "site",
    title: "Site",
    items: [
      { id: "site-home", label: "Ana ekran", path: "/siteler/:siteId", end: true, icon: FiHome, load: () => import("@/features/home/pages/SiteHome") },
      {
        id: "content-module",
        label: "İçerik",
        path: "/siteler/:siteId/icerik/:moduleKey",
        hideInMenu: true,
        permission: "entry.read",
        load: () => import("@/features/content/pages/ModuleEntries"),
        indexPage: true,
        children: [
          { id: "content-entry-create", label: "Yeni kayıt", path: "/siteler/:siteId/icerik/:moduleKey/yeni", hideInMenu: true, permission: "entry.create", load: () => import("@/features/content/pages/EntryEditor") },
          { id: "content-entry", label: "Kayıt", path: "/siteler/:siteId/icerik/:moduleKey/:entryId", hideInMenu: true, permission: "entry.read", load: () => import("@/features/content/pages/EntryEditor") },
        ],
      },
      {
        id: "site-forms",
        label: "Başvurular",
        path: "/siteler/:siteId/formlar",
        icon: FiInbox,
        permission: "formSubmission.read",
        load: () => import("@/features/forms/pages/FormInbox"),
        indexPage: true,
        children: [
          { id: "site-form", label: "Başvurular", path: "/siteler/:siteId/formlar/:formKey", hideInMenu: true, permission: "formSubmission.read", load: () => import("@/features/forms/pages/FormInbox") },
          { id: "site-form-submission", label: "Başvuru", path: "/siteler/:siteId/formlar/:formKey/:submissionId", hideInMenu: true, permission: "formSubmission.read", load: () => import("@/features/forms/pages/FormInbox") },
        ],
      },
      { id: "site-media", label: "Medya", path: "/siteler/:siteId/medya", icon: FiImage, permission: "asset.read", load: () => import("@/features/media/pages/MediaLibrary") },
      { id: "site-transfer", label: "Dışa aktarma", path: "/siteler/:siteId/aktarim", icon: FiDownload, anyPermission: ["entry.export", "formSubmission.export"], load: () => import("@/features/transfer/pages/Transfer") },
    ],
  },
  {
    id: "account",
    title: "Hesap",
    hidden: true,
    items: [
      { id: "account-security", label: "Hesap güvenliği", path: "/hesap/guvenlik", icon: FiShield, load: () => import("@/account/pages/AccountSecurity") },
    ],
  },
];

if (import.meta.env.DEV) {
  routeGroups.push({
    id: "development",
    title: "Geliştirme",
    hidden: true,
    items: [
      { id: "components", label: "Bileşen Kütüphanesi", path: "/bilesenler", icon: FiGrid, load: () => import("@/pages/ComponentLibrary") },
    ],
  });
}

// Oturumsuz sayfalar (giriş düzeninde).
export const publicRoutes = [
];

// Oturumlu, ana kabuk dışındaki sayfalar: giriş sonrası site seçimi.
export const sessionRoutes = [
  { path: "/", load: () => import("@/features/sites/pages/SiteSelect") },
];

export { default as SessionScope } from "@/features/sites/components/SiteScope";
export { default as ContextSwitcher } from "@/features/sites/components/SiteSwitcher";
export { default as HeaderActions } from "@/features/notifications/components/NotificationBell";
export { useSiteSearch as useCommandSearch } from "@/features/search/useSiteSearch";

export const useRouteAccess = () => {
  const scope = useSiteScope();
  return useCallback((item) => {
    // anyPermission: izinlerden biri yeterli (ör. aktarım sayfasının her kartı ayrı izinle görünür).
    if (item.anyPermission) return item.anyPermission.some((permission) => scope?.can(permission));
    return !item.permission || Boolean(scope?.can(item.permission));
  }, [scope]);
};

// Menüdeki "Site yapısı" (sayfa, menü, yönlendirme, ayarlar) ve "İçerik" grupları sitenin açık bölümlerinden üretilir (bootstrap.modules).
export const useDynamicMenuGroups = () => {
  const scope = useSiteScope();
  return useMemo(() => {
    if (!scope || scope.modules.length === 0) return [];
    const toItem = (item) => ({
      id: `content-${item.key}`,
      label: labelIn(item.label, scope.site.defaultLocale),
      path: sitePath(scope.siteId, `/icerik/${item.key}`),
      icon: moduleIcon(item.icon),
      hint: item.area === "site" ? "Site yapısı" : "İçerik",
    });
    const structure = scope.modules.filter((item) => item.area === "site");
    const content = scope.modules.filter((item) => item.area !== "site");
    return [
      structure.length > 0 && { id: "structure", title: "Site yapısı", insertAfter: "site", items: structure.map(toItem) },
      content.length > 0 && { id: "content", title: "İçerik", insertAfter: structure.length > 0 ? "structure" : "site", items: content.map(toItem) },
    ].filter(Boolean);
  }, [scope]);
};

export const useHomeCrumb = () => {
  const scope = useSiteScope();
  return scope ? { label: "Ana ekran", path: `/siteler/${scope.siteId}` } : { label: "Sitelerim", path: "/" };
};
