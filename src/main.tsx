import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

function installChunkLoadRecovery(): void {
  const reloadKey = "aspire_admin_chunk_reload_once";

  const maybeRecover = (reason: unknown) => {
    const message = reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : String(reason ?? "");

    const isChunkFailure =
      /Failed to fetch dynamically imported module/i.test(message) ||
      /Importing a module script failed/i.test(message) ||
      /ChunkLoadError/i.test(message);

    if (!isChunkFailure) return;
    if (sessionStorage.getItem(reloadKey) === "1") return;

    sessionStorage.setItem(reloadKey, "1");
    window.location.reload();
  };

  window.addEventListener("error", (event) => maybeRecover((event as ErrorEvent).error ?? event.message));
  window.addEventListener("unhandledrejection", (event) => maybeRecover((event as PromiseRejectionEvent).reason));

  window.addEventListener("load", () => {
    // Clear guard on successful load so future deploys can recover once again.
    sessionStorage.removeItem(reloadKey);
  });
}

installChunkLoadRecovery();

createRoot(document.getElementById("root")!).render(<App />);
