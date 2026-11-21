import {
  FiAward, FiBarChart2, FiBell, FiBook, FiBox, FiBriefcase, FiCalendar, FiClock, FiCornerUpRight, FiFile, FiFileText, FiFolder, FiGlobe, FiHeart,
  FiHelpCircle, FiImage, FiInfo, FiLayers, FiLayout, FiMapPin, FiMenu, FiMessageCircle, FiMic, FiSettings, FiShoppingBag, FiStar, FiUsers, FiVideo,
} from "react-icons/fi";

// Platformda modüle verilen ikon adı → menü simgesi. Bilinmeyen ad varsayılan simgeye düşer.
const ICONS = {
  award: FiAward, "bar-chart": FiBarChart2, bell: FiBell, book: FiBook, box: FiBox, briefcase: FiBriefcase, calendar: FiCalendar,
  clock: FiClock, "corner-up-right": FiCornerUpRight, file: FiFile, "file-text": FiFileText, folder: FiFolder, globe: FiGlobe, heart: FiHeart, "help-circle": FiHelpCircle,
  image: FiImage, info: FiInfo, layers: FiLayers, layout: FiLayout, "map-pin": FiMapPin, menu: FiMenu, "message-circle": FiMessageCircle, mic: FiMic, settings: FiSettings, "shopping-bag": FiShoppingBag,
  star: FiStar, users: FiUsers, video: FiVideo,
};

export const moduleIcon = (name) => ICONS[name] ?? FiLayers;
