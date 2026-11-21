# panel-frontend

Website Management Platform'un **müşteri paneli**: müşterinin içerik, medya ve form başvurularını yönettiği arayüz. Ayrıca yayın API'sinin nasıl kullanıldığını gösteren örnek bir müşteri sitesi içerir. React 19, Vite, JavaScript.

| Depo | Görevi |
|---|---|
| [platform-api](https://github.com/website-management-platform/platform-api) | Platform paneli API'si (8781); migration'lar, demo verisi, ortak belgeler |
| [panel-api](https://github.com/website-management-platform/panel-api) | Müşteri paneli ve yayın API'si (8782) |
| [platform-frontend](https://github.com/website-management-platform/platform-frontend) | Platform paneli arayüzü |
| **panel-frontend** (bu depo) | Müşteri paneli arayüzü ve örnek müşteri sitesi |

`packages/ui` ve `packages/schema` iki panelde ortaktır; bir değişiklik iki depoda da aynı şekilde yapılmalıdır.

| Klasör | İçerik |
|---|---|
| `apps/customer-admin` | Panelin kendisi: `src/config` (ad, rotalar) ve `src/features` (ekranlar) |
| `apps/site-demo` | Örnek müşteri sitesi (üç tasarım); yayına alınmaz |
| `packages/ui` | Ortak katman: bileşenler, tasarım token'ları, API istemcisi, sayfa kabuğu |
| `packages/schema` | Alan tipleri ve şema motoru; backend'de birebir aynısı çalışır |
| `packages/sdk` | Müşteri sitelerinin yayın API'sini okuması için küçük istemci |

API sözleşmesi ve mimari kararlar: [platform-frontend → docs](https://github.com/website-management-platform/platform-frontend/tree/main/docs).

## Yerelde çalıştırma

Gerekenler: Node.js 22.12 veya üzeri ve çalışan panel-api (8782). Veritabanı ve demo verisi için platform-api da kurulmuş olmalı.

```sh
npm ci
npm run dev           # panel http://localhost:5301, örnek site http://localhost:5310
```

Giriş ekranındaki "Demo hesapları" bölümü demo hesabını tek tıkla doldurur.

## Kontroller

```sh
npm run lint
npm run build
```

CI her değişiklikte lint, derleme, bağımlılık denetimi (`npm audit`) ve sır taraması yapar.

## Yayına alma (Netlify)

Panel tek bir Netlify sitesidir; ayarlar `apps/customer-admin/netlify.toml` içinde. Sitede iki ortam değişkeni tanımlanır:

| Değişken | Değer |
|---|---|
| `API_ORIGIN` | API'nin https adresi (panel-api) |
| `STORAGE_ORIGIN` | Cloudflare R2 uç noktası, ör. `https://<hesap>.r2.cloudflarestorage.com` |

Derleme sonunda `scripts/netlify-config.mjs`, `/api` isteklerini API'ye aktaran yönlendirmeyi ve güvenlik başlıklarını (CSP, HSTS) üretir. Değişkenlerden biri eksikse derleme durur. Adım adım kurulum: platform-api deposundaki [docs/runbooks/deploy-northflank.md](https://github.com/website-management-platform/platform-api/blob/main/docs/runbooks/deploy-northflank.md).
