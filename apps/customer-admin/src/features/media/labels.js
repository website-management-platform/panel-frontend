import { FiFile, FiFileText, FiImage, FiMusic, FiVideo } from "react-icons/fi";

export const KIND_META = {
  image: { label: "Görsel", icon: FiImage },
  video: { label: "Video", icon: FiVideo },
  audio: { label: "Ses", icon: FiMusic },
  document: { label: "Belge", icon: FiFileText },
  subtitle: { label: "Altyazı", icon: FiFile },
};

export const STATUS_META = {
  processing: { label: "İşleniyor", variant: "info" },
  ready: { label: "Hazır", variant: "success" },
  rejected: { label: "Reddedildi", variant: "danger" },
  archived: { label: "Silindi", variant: "neutral" },
};

export const KIND_FILTERS = [
  { value: "", label: "Tümü" },
  { value: "image", label: "Görsel" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Ses" },
  { value: "document", label: "Belge" },
];

// Dosya seçicide gösterilen kabul listesi; asıl denetim sunucudadır (şartname §25.6).
export const ACCEPT = ".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm,.mp3,.wav,.m4a,.pdf,.docx,.xlsx,.pptx,.vtt";
