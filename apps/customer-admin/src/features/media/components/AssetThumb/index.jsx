import { cx } from "@/utils/cx";
import { KIND_META } from "../../labels";
import "./asset_thumb.scss";

/** Dosyanın küçük önizlemesi: hazır görselde küçük varyant, diğer durumlarda türe göre simge. Görsel dekoratiftir. */
const AssetThumb = ({ asset, size = "md", className = "" }) => {
  const Icon = KIND_META[asset?.kind]?.icon ?? KIND_META.document.icon;
  const src = asset?.kind === "image" && asset.status === "ready" ? asset.variants?.find((variant) => variant.name === "thumb")?.url ?? asset.url : null;
  const focal = asset?.focalPoint ? `${asset.focalPoint.x * 100}% ${asset.focalPoint.y * 100}%` : "50% 50%";
  return (
    <span className={cx("asset_thumb", `asset_thumb_${size}`, className)} aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" style={{ objectPosition: focal }} /> : <Icon />}
    </span>
  );
};

export default AssetThumb;
