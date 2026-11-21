// Duyarlı görsel: delivery'nin verdiği varyantlardan srcset; odak noktası object-position olur.
const Media = ({ media, sizes = "100vw", className = "", priority = false }) => {
  if (!media || media.kind !== "image") return null;
  const srcSet = (media.variants ?? []).filter((item) => item.name !== "thumb").map((item) => `${item.url} ${item.width}w`).join(", ");
  const focal = media.focalPoint ? `${Math.round(media.focalPoint.x * 100)}% ${Math.round(media.focalPoint.y * 100)}%` : undefined;
  return (
    <img
      className={`media ${className}`}
      src={media.url}
      srcSet={srcSet || undefined}
      sizes={srcSet ? sizes : undefined}
      width={media.width}
      height={media.height}
      alt={media.alt ?? ""}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      style={focal ? { objectPosition: focal } : undefined}
    />
  );
};

export default Media;
