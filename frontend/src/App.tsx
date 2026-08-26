import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import LoginPage from "./pages/Login";
import EmployeeHome from "./pages/employee/EmployeeHome";
import EmployeeStatsPage from "./pages/employee/EmployeeStats";
import AdminHome from "./pages/admin/AdminHome";
import AdminEmployees from "./pages/admin/AdminEmployees";
import EmployeeDetail from "./pages/admin/EmployeeDetail";

function RequireAuth({
  role,
  children,
}: {
  role?: "ADMIN" | "EMPLOYEE";
  children: ReactNode;
}) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="min-h-dvh p-4">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === "ADMIN" ? "/admin" : "/employee"} replace />;
  }
  return children;
}

export default function App() {
  const { user, ready } = useAuth();

  if (!ready) return <div className="min-h-dvh p-4">Loading…</div>;

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
        path="/employee/stats"
        element={
          <RequireAuth role="EMPLOYEE">
            <EmployeeStatsPage />
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
        path="/admin/employees"
        element={
          <RequireAuth role="ADMIN">
            <AdminEmployees />
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
