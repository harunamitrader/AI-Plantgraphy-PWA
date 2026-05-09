import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { HomePage } from "../features/home/pages/HomePage";
import { ObservationsPage } from "../features/observations/pages/ObservationsPage";
import { ObservationDetailPage } from "../features/observations/pages/ObservationDetailPage";
import { UploadPage } from "../features/observations/pages/UploadPage";
import { PlantsPage } from "../features/plants/pages/PlantsPage";
import { PlantDetailPage } from "../features/plants/pages/PlantDetailPage";
import { ReviewPage } from "../features/review/pages/ReviewPage";
import { SettingsPage } from "../features/settings/pages/SettingsPage";
import { BackupPage } from "../features/backup/pages/BackupPage";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="/observations" element={<ObservationsPage />} />
        <Route path="/observations/:observationId" element={<ObservationDetailPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/plants" element={<PlantsPage />} />
        <Route path="/plants/:plantId" element={<PlantDetailPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/backup" element={<BackupPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
