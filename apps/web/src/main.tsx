import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@/app/styles/globals.css";
import { AppRouter } from "@/app/router/app-router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
