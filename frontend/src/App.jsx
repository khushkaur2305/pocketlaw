import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import About from "./pages/About.jsx";
import Drafting from "./pages/Drafting.jsx";
import Home from "./pages/Home.jsx";
import Insights from "./pages/Insights.jsx";
import Matcher from "./pages/Matcher.jsx";
import Survival from "./pages/Survival.jsx";

function NotFound() {
  return (
    <div className="container page center">
      <h1>Page not found</h1>
      <p className="muted">The page you are looking for does not exist.</p>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/match" element={<Matcher />} />
        <Route path="/guide" element={<Survival />} />
        <Route path="/guide/:id" element={<Survival />} />
        <Route path="/draft" element={<Drafting />} />
        <Route path="/draft/:id" element={<Drafting />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
