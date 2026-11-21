import "./focal_point_picker.scss";

const STEP = 0.05;
const clamp = (value) => Math.min(1, Math.max(0, Math.round(value * 100) / 100));

/**
 * Odak noktası: görsele tıklanarak veya ok tuşlarıyla seçilir (şartname §6 focal point). Kırpılan görünümlerde
 * önemli bölgenin görünür kalması için kullanılır.
 */
const FocalPointPicker = ({ src, value, onChange, disabled }) => {
  const point = value ?? { x: 0.5, y: 0.5 };
  const keyDown = (event) => {
    const moves = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] };
    const move = moves[event.key];
    if (!move || disabled) return;
    event.preventDefault();
    onChange({ x: clamp(point.x + move[0]), y: clamp(point.y + move[1]) });
  };
  return (
    <div className="focal_point_picker">
      <div
        className="focal_point_picker_frame"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Odak noktası"
        aria-valuetext={`Yatay %${Math.round(point.x * 100)}, dikey %${Math.round(point.y * 100)}`}
        aria-disabled={disabled || undefined}
        onKeyDown={keyDown}
        onClick={(event) => {
          if (disabled) return;
          const rect = event.currentTarget.getBoundingClientRect();
          onChange({ x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) });
        }}
      >
        <img src={src} alt="" draggable={false} />
        <span className="focal_point_picker_marker" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} aria-hidden="true" />
      </div>
      <p className="focal_point_picker_hint">Görselin önemli bölgesine tıklayın veya ok tuşlarıyla taşıyın.</p>
    </div>
  );
};

export default FocalPointPicker;
