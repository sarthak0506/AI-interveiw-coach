import { useEffect } from "react";

const STUDENT_APP_URL = import.meta.env.VITE_STUDENT_APP_URL || "http://localhost:5173";

export default function App() {
  useEffect(() => {
    window.location.replace(STUDENT_APP_URL);
  }, []);

  return null;
}
