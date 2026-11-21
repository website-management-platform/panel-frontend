import { Link } from "react-router";
import { FiActivity, FiCalendar, FiCheckSquare, FiClock, FiExternalLink, FiHardDrive, FiInbox, FiPlus } from "react-icons/fi";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import Progress from "@/components/Progress";
import VisuallyHidden from "@/components/VisuallyHidden";
import { formatBytes, formatDateTime, formatRelativeTime } from "@/utils/format";
import { moduleIcon } from "../../../content/icons";
import { labelIn } from "../../../content/labels";
import { useSiteScope } from "../../../sites/siteContext";
import "./dashboard_widget.scss";

const STATE_TEXT = {
  draft: { label: "Hiç yayınlanmadı", variant: "neutral" },
  changed: { label: "Yayınlanmamış değişiklik", variant: "info" },
};

const Empty = ({ children }) => <p className="dashboard_widget_empty">{children}</p>;

const ItemList = ({ children }) => <ul className="dashboard_widget_list">{children}</ul>;

const PendingWork = ({ data, locale }) => (
  data.count === 0 ? <Empty>Yayın bekleyen kayıt yok.</Empty> : (
    <ItemList>
      {data.items.map((item) => (
        <li key={item.link} className="dashboard_widget_item">
          <Link to={item.link} className="dashboard_widget_title">{item.title}</Link>
          <span className="dashboard_widget_meta">
            <Badge size="sm" variant={STATE_TEXT[item.state]?.variant}>{STATE_TEXT[item.state]?.label}</Badge>
            {labelIn(item.module, locale)}
          </span>
        </li>
      ))}
    </ItemList>
  )
);

const RecentChanges = ({ data, locale }) => (
  data.items.length === 0 ? <Empty>Henüz içerik değişikliği yok.</Empty> : (
    <ItemList>
      {data.items.map((item) => (
        <li key={item.link} className="dashboard_widget_item">
          <Link to={item.link} className="dashboard_widget_title">{item.title}</Link>
          <span className="dashboard_widget_meta">
            {labelIn(item.module, locale)} · {item.updatedBy ? `${item.updatedBy}, ` : ""}{formatRelativeTime(item.updatedAt)}
            {!item.isPublished && <Badge size="sm" variant="neutral">Taslak</Badge>}
          </span>
        </li>
      ))}
    </ItemList>
  )
);

const Scheduled = ({ data, timezone }) => (
  data.items.length === 0 ? <Empty>Planlanmış yayın yok.</Empty> : (
    <ItemList>
      {data.items.map((item) => (
        <li key={`${item.link}-${item.executeAt}`} className="dashboard_widget_item">
          <Link to={item.link} className="dashboard_widget_title">{item.title}</Link>
          <span className="dashboard_widget_meta">
            {item.type.endsWith("unpublish") ? "Yayından kalkacak" : "Yayınlanacak"} · {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(item.executeAt))}
          </span>
        </li>
      ))}
    </ItemList>
  )
);

const FormInbox = ({ data, locale }) => (
  data.items.length === 0 ? <Empty>Sitede form yok.</Empty> : (
    <ItemList>
      {data.items.map((item) => (
        <li key={item.key} className="dashboard_widget_item dashboard_widget_item_row">
          <Link to={item.link} className="dashboard_widget_title">{labelIn(item.title, locale)}</Link>
          {item.unread > 0 ? <Badge size="sm" variant="info">{item.unread} yeni</Badge> : <span className="dashboard_widget_meta">{item.open} açık</span>}
        </li>
      ))}
    </ItemList>
  )
);

const QuickActions = ({ data, locale }) => (
  data.items.length === 0 ? <Empty>Eklenebilecek içerik türü yok.</Empty> : (
    <ul className="dashboard_widget_actions">
      {data.items.map((item) => {
        const Icon = moduleIcon(item.icon);
        return (
          <li key={item.moduleKey}>
            <Link to={item.link} className="dashboard_widget_action">
              <Icon aria-hidden="true" />
              <span>{labelIn(item.label, locale)}</span>
              <FiPlus className="dashboard_widget_action_plus" aria-hidden="true" />
              <VisuallyHidden>: yeni kayıt</VisuallyHidden>
            </Link>
          </li>
        );
      })}
    </ul>
  )
);

const MediaUsage = ({ data }) => (
  <div className="dashboard_widget_usage">
    <Progress value={Math.round(data.ratio * 100)} max={100} label="Kullanılan depolama" showLabel status={data.level === "critical" ? "danger" : data.level === "warning" ? "warning" : "default"} />
    <p className="dashboard_widget_meta">{formatBytes(data.usedBytes)} / {formatBytes(data.quotaBytes)}{data.level !== "ok" ? " · Kullanılmayan dosyaları silerek yer açabilirsiniz." : ""}</p>
    <Link to={data.link}>Medyaya git</Link>
  </div>
);

const SiteStatus = ({ data }) => (
  <div className="dashboard_widget_status">
    <Badge variant={data.status === "ACTIVE" ? "success" : "warning"} dot>{data.status === "ACTIVE" ? "Yayında" : "Geçici olarak kapalı"}</Badge>
    <p className="dashboard_widget_meta">Son yayın: {data.lastPublishedAt ? formatDateTime(data.lastPublishedAt) : "henüz yok"}</p>
    {data.url && (
      <a href={data.url} target="_blank" rel="noopener noreferrer" className="dashboard_widget_link">
        {data.url.replace(/^https:\/\//, "")} <FiExternalLink aria-hidden="true" /><VisuallyHidden> (yeni sekmede açılır)</VisuallyHidden>
      </a>
    )}
  </div>
);

const WIDGETS = {
  pendingWork: { title: "Yayın bekleyenler", icon: FiCheckSquare, Body: PendingWork, wide: true },
  recentChanges: { title: "Son değişiklikler", icon: FiClock, Body: RecentChanges, wide: true },
  scheduled: { title: "Planlı yayınlar", icon: FiCalendar, Body: Scheduled },
  formInbox: { title: "Form başvuruları", icon: FiInbox, Body: FormInbox },
  quickActions: { title: "Hızlı ekle", icon: FiPlus, Body: QuickActions },
  mediaUsage: { title: "Depolama", icon: FiHardDrive, Body: MediaUsage },
  siteStatus: { title: "Site durumu", icon: FiActivity, Body: SiteStatus },
};

/** Ana ekran kartı: kartlar sabittir (ADR-057); bilinmeyen tür çizilmez. */
const DashboardWidget = ({ widget }) => {
  const { site } = useSiteScope();
  const meta = WIDGETS[widget.type];
  if (!meta || !widget.data) return null;
  const { Body } = meta;
  const count = widget.type === "pendingWork" && widget.data.count > 0 ? <Badge size="sm" variant="info">{widget.data.count}</Badge> : null;
  return (
    <Card title={meta.title} icon={meta.icon} actions={count} className={meta.wide ? "dashboard_widget dashboard_widget_wide" : "dashboard_widget"}>
      <Body data={widget.data} locale={site.defaultLocale} timezone={site.timezone} />
    </Card>
  );
};

export default DashboardWidget;
