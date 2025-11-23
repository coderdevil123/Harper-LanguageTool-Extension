import React from "react";
import { createRoot } from "react-dom/client";
import Popup from "./Popup";
import "./Popup.css"; // Changed from ./popup.css to ./Popup.css (capital P)

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<Popup />);
