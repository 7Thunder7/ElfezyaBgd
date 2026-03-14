// src/main.tsx (or src/index.tsx)
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "preline/preline";
import "./index.css";

import App from "./App";
import LandingPage from "./pages/LandingPage";
import SignupPage from "./pages/signup";
import NotFoundPage from "./apps/nopage";
import StudyPage from "./pages/study";
import LearningPage from "./pages/Learning";
import ReviewPage from "./pages/review";
import ExamsPage from "./pages/Exams";
import FinalQuiz from "./pages/FinalQuiz";
import Login from "./pages/Login";
import Store from "./pages/Store";

import { ThemeProvider } from "./theme/ThemeProvider";

/**
 * ملاحظات تصميمية:
 * - route ديناميكي: /learning/:slugOrId
 * - /learning بدون باراميتر لعرض حالة عامة أو قائمة
 */

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: "signup", element: <SignupPage /> },
      { path: "study", element: <StudyPage /> },
      { path: "login", element: <Login /> },
      { path: "learning", element: <LearningPage /> },
      { path: "learning/:slugOrId", element: <LearningPage /> },
      { path: "final-quiz", element: <FinalQuiz /> },
      { path: "review", element: <ReviewPage /> },
      { path: "exams", element: <ExamsPage /> },
      { path: "store", element: <Store /> },

    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>
);