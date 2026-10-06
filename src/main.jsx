import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./lib/auth.jsx";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
// Só de importar já registra o listener do prompt de instalação (ver
// comentário no arquivo) — precisa disso bem cedo, antes de qualquer
// rota, pra não perder o evento caso ele dispare logo no carregamento.
import "./lib/instalarPwa.js";
import "leaflet/dist/leaflet.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
