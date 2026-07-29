import { Navigate, Route, Routes } from "react-router-dom";

import HomePage from "./pages/HomePage";
import InterviewPage from "./pages/InterviewPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/interview/:token" element={<InterviewPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
