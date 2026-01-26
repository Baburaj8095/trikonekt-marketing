import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ThemeProvider from "./theme/ThemeProvider";
import "../src/css/index.css";
import { installDomTextFixer } from "./utils/encodingFix";

if (typeof window !== "undefined" && "TextDecoder" in window) {
  requestAnimationFrame(() => installDomTextFixer());
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
