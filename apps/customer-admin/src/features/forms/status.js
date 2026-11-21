// Başvuru durumları (şartname §17). "open": okunmamış, okunmuş ve işlemdeki başvurular (varsayılan görünüm).
export const SUBMISSION_STATUS = {
  unread: { label: "Okunmadı", variant: "info" },
  read: { label: "Okundu", variant: "neutral" },
  in_progress: { label: "İşlemde", variant: "warning" },
  resolved: { label: "Çözüldü", variant: "success" },
  spam: { label: "Spam", variant: "danger" },
  archived: { label: "Arşiv", variant: "neutral" },
};

export const INBOX_VIEWS = [
  { value: "open", label: "Açık" },
  { value: "unread", label: "Okunmadı" },
  { value: "in_progress", label: "İşlemde" },
  { value: "resolved", label: "Çözüldü" },
  { value: "archived", label: "Arşiv" },
  { value: "spam", label: "Spam" },
];
