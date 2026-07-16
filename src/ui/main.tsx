import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root mount point");

createRoot(root).render(
  <StrictMode>
    <App graph={__LEARNING_GRAPH__} />
  </StrictMode>,
);
