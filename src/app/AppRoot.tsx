import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { AppRouter } from "./AppRouter";
import "./styles.css";

registerSW({ immediate: true });

const routerBaseName = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

export function AppRoot() {
  return (
    <BrowserRouter basename={routerBaseName}>
      <AppRouter />
    </BrowserRouter>
  );
}
