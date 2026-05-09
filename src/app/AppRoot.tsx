import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { AppRouter } from "./AppRouter";
import "./styles.css";

registerSW({ immediate: true });

export function AppRoot() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}
