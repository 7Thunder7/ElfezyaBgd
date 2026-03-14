// src/App.tsx
import React from "react";
import { Outlet } from "react-router-dom"; // استخدم react-router-dom
import Header from "./components/Header";
import Footer from "./components/Footer";
import "@preline/carousel";

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="grow">
        <Outlet />
      </main>

      <Footer />

      {/* LoginModalPortal هنا داخل Router context -> LoginModal يستطيع استخدام useNavigate و useLocation */}
    </div>
  );
};

export default App;
