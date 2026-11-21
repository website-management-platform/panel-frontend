import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router";
import { siteChooserLoader, sitePageLoader } from "./loaders";
import Loading from "./pages/Loading";
import SiteChooser from "./pages/SiteChooser";
import SiteError from "./pages/SiteError";
import SitePage from "./pages/SitePage";
import "./styles/base.scss";

const router = createBrowserRouter([
  { path: "/", element: <SiteChooser />, loader: siteChooserLoader, HydrateFallback: Loading },
  { path: "/:siteKey/*", element: <SitePage />, loader: sitePageLoader, errorElement: <SiteError />, HydrateFallback: Loading },
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
