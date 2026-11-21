import * as Feather from "react-icons/fi";

// Paneldeki ikon adı (Feather adlandırması, ör. "alert-triangle") → simge. Bilinmeyen ad çizilmez.
const toComponentName = (name) => `Fi${String(name).split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("")}`;

const Icon = ({ name, className }) => {
  const Component = name ? Feather[toComponentName(name)] : null;
  return Component ? <Component className={className} aria-hidden="true" focusable="false" /> : null;
};

export default Icon;
