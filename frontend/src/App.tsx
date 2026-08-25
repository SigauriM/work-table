import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import LoginPage from "./pages/Login";
import EmployeeHome from "./pages/employee/EmployeeHome";
import AdminHome from "./pages/admin/AdminHome";
import EmployeeDetail from "./pages/admin/EmployeeDetail";

function RequireAuth({
  role,
  children,
}: {
  role?: "ADMIN" | "EMPLOYEE";
  children: ReactNode;
}) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="p-4">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === "ADMIN" ? "/admin" : "/employee"} replace />;
  }
  return children;
}

export default function App() {
  const { user, ready } = useAuth();

  if (!ready) return <div className="p-4">Loading…</div>;

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to={user.role === "ADMIN" ? "/admin" : "/employee"} replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route
        path="/employee"
        element={
          <RequireAuth role="EMPLOYEE">
            <EmployeeHome />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth role="ADMIN">
            <AdminHome />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/employees/:id"
        element={
          <RequireAuth role="ADMIN">
            <EmployeeDetail />
          </RequireAuth>
        }
      />
      <Route
        path="*"
        element={
          <Navigate
            to={user ? (user.role === "ADMIN" ? "/admin" : "/employee") : "/login"}
            replace
          />
        }
      />
    </Routes>
  );
}