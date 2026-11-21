import { createContext, useContext } from "react";
import { storageKey } from "@/config/app.config";

export const SiteContext = createContext(null);

// Site kapsamı dışındaki sayfalarda (ör. hesap güvenliği) null döner.
export const useSiteScope = () => useContext(SiteContext);

export const sitePath = (siteId, path = "") => `/siteler/${siteId}${path}`;

// Son kullanılan site kullanıcıya göre saklanır; aynı tarayıcıyı kullanan başka bir kişinin tercihi görünmez.
const lastSiteKey = (userId) => storageKey(`last_site_${userId}`);

export const readLastSiteId = (userId) => {
  try {
    return window.localStorage.getItem(lastSiteKey(userId));
  } catch {
    return null;
  }
};

export const writeLastSiteId = (userId, siteId) => {
  try {
    window.localStorage.setItem(lastSiteKey(userId), siteId);
  } catch {
    return;
  }
};

export const clearLastSiteId = (userId) => {
  try {
    window.localStorage.removeItem(lastSiteKey(userId));
  } catch {
    return;
  }
};
