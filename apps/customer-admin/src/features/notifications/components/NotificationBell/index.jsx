import { useState } from "react";
import { useNavigate } from "react-router";
import { FiAlertTriangle, FiBell, FiDownload, FiHardDrive, FiInbox } from "react-icons/fi";
import Button from "@/components/Button";
import Popover from "@/components/Popover";
import Skeleton from "@/components/Skeleton";
import { formatRelativeTime } from "@/utils/format";
import { useSiteScope } from "../../../sites/siteContext";
import { useMarkAllRead, useMarkNotification, useNotificationSummary, useNotifications } from "../../api";
import "./notification_bell.scss";

const TYPE_ICON = {
  "publish.failed": FiAlertTriangle,
  "form.submitted": FiInbox,
  "quota.threshold": FiHardDrive,
  "export.ready": FiDownload,
};

/** Başlıktaki bildirim zili (şartname §18): okunmamış sayısı 60 sn'de bir yenilenir; açılınca son bildirimler listelenir. */
const NotificationBell = () => {
  const scope = useSiteScope();
  const siteId = scope?.siteId;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const summary = useNotificationSummary(siteId);
  const list = useNotifications(siteId, { enabled: open });
  const mark = useMarkNotification(siteId);
  const markAll = useMarkAllRead(siteId);
  if (!scope) return null;
  const unread = summary.data?.unreadCount ?? 0;
  const items = list.data?.items ?? [];

  const openItem = (item) => {
    setOpen(false);
    if (!item.read) mark.mutate({ id: item.id, read: true });
    navigate(item.link);
  };

  return (
    <>
      <Popover
        open={open}
        onOpenChange={setOpen}
        placement="bottom"
        align="end"
        showArrow={false}
        size="lg"
        ariaLabel="Bildirimler"
        className="notification_bell_popover"
        trigger={({ triggerProps, toggle }) => (
          <button type="button" className="header_icon_btn notification_bell_button" {...triggerProps} onClick={toggle} aria-label={unread > 0 ? `Bildirimler, ${unread} okunmamış` : "Bildirimler"}>
            <FiBell size={19} aria-hidden="true" />
            {unread > 0 && <span className="notification_bell_count" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
          </button>
        )}
      >
        <div className="notification_bell">
          <div className="notification_bell_head">
            <strong>Bildirimler</strong>
            <Button size="sm" variant="ghost" disabled={unread === 0} loading={markAll.isPending} onClick={() => markAll.mutate()}>Tümünü okundu say</Button>
          </div>
          {list.isPending && <Skeleton variant="rectangle" height={120} radius="md" />}
          {list.data && items.length === 0 && <p className="notification_bell_empty">Bildirim yok. Form başvuruları ve yayın hataları burada görünür.</p>}
          {items.length > 0 && (
            <ul className="notification_bell_list">
              {items.map((item) => {
                const Icon = TYPE_ICON[item.type] ?? FiBell;
                return (
                  <li key={item.id}>
                    <button type="button" className={item.read ? "notification_bell_item" : "notification_bell_item notification_bell_item_unread"} onClick={() => openItem(item)}>
                      <Icon className="notification_bell_icon" aria-hidden="true" />
                      <span className="notification_bell_text">
                        <span className="notification_bell_title">{item.title}{item.count > 1 ? ` (${item.count})` : ""}</span>
                        {item.body && <span className="notification_bell_body">{item.body}</span>}
                        <span className="notification_bell_time">{formatRelativeTime(item.updatedAt)}{item.read ? "" : " · okunmadı"}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Popover>
    </>
  );
};

export default NotificationBell;
