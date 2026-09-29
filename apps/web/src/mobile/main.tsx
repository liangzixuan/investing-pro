import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router";
import { MobileWorkspaceRoutes } from "./MobileWorkspaceRoutes";
import "../workspace-styles.css";
import "./mobile.css";

const container = document.getElementById("root");
if (container === null) throw new Error("Missing application root");

createRoot(container).render(
  <StrictMode>
    <HashRouter>
      <MobileWorkspaceRoutes />
    </HashRouter>
  </StrictMode>,
);
