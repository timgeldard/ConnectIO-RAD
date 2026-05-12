/* eslint-disable jsdoc/require-jsdoc */
import React from "react";
import ReactDOM from "react-dom/client";
import { ErrorBoundary } from "@connectio/shared-ui";
import "maplibre-gl/dist/maplibre-gl.css";
import "@connectio/shared-ui/styles/kerry-tokens.css";
import "@connectio/shared-ui/styles/kerry-app.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
