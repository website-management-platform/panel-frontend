export const APP_NAME = "Site Yönetimi";

export const APP_SHORT_NAME = "SY";

export const STORAGE_PREFIX = "wmp_customer_";

// Kimlik alanı (realm): API yolunda /auth/{realm}/... ve ayrı oturum çerezi bu değere göre seçilir.
export const API_REALM = "customer";

export const storageKey = (name) => `${STORAGE_PREFIX}${name}`;

export const BREAKPOINTS = {
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1440,
};

export const MEDIA_QUERIES = {
  mobile: `(max-width: ${BREAKPOINTS.md - 1}px)`,
  belowDesktop: `(max-width: ${BREAKPOINTS.lg - 1}px)`,
  tablet: `(min-width: ${BREAKPOINTS.lg}px) and (max-width: ${BREAKPOINTS.xl - 1}px)`,
};
