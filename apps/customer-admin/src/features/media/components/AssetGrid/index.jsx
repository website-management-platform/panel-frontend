import { FiCheck } from "react-icons/fi";
import Badge from "@/components/Badge";
import { cx } from "@/utils/cx";
import { formatBytes } from "@/utils/format";
import { KIND_META, STATUS_META } from "../../labels";
import AssetThumb from "../AssetThumb";
import "./asset_grid.scss";

/**
 * Dosya ızgarası. selectable ise kutucuk seçim düğmesidir (aria-pressed); değilse onOpen ayrıntıyı açar.
 * isDisabled(asset) → gerekçe metni döndürürse kutucuk seçilemez ve gerekçe gösterilir.
 */
const AssetGrid = ({ assets, selectedIds = [], selectable = false, onToggle, onOpen, isDisabled = () => null }) => (
  <ul className="asset_grid">
    {assets.map((asset) => {
      const selected = selectedIds.includes(asset.id);
      const disabledReason = isDisabled(asset);
      const status = STATUS_META[asset.status];
      return (
        <li key={asset.id}>
          <button
            type="button"
            className={cx("asset_grid_tile", selected && "asset_grid_tile_selected", disabledReason && "asset_grid_tile_disabled")}
            aria-pressed={selectable ? selected : undefined}
            aria-disabled={disabledReason ? true : undefined}
            onClick={() => {
              if (disabledReason) return;
              if (selectable) onToggle(asset);
              else onOpen(asset);
            }}
          >
            <AssetThumb asset={asset} size="fill" />
            {selected && <span className="asset_grid_check" aria-hidden="true"><FiCheck /></span>}
            <span className="asset_grid_name">{asset.title || asset.fileName}</span>
            <span className="asset_grid_meta">
              {KIND_META[asset.kind]?.label} · {asset.format?.toUpperCase()} · {formatBytes(asset.size)}
              {asset.width ? ` · ${asset.width}×${asset.height}` : ""}
            </span>
            {asset.status !== "ready" && <Badge size="sm" variant={status.variant}>{status.label}</Badge>}
            {disabledReason && <span className="asset_grid_reason">{disabledReason}</span>}
          </button>
        </li>
      );
    })}
  </ul>
);

export default AssetGrid;
