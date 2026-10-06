import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";

export default function ProtectedRoute({ papeis, children }) {
  const { session, perfil, carregando } = useAuth();

  if (carregando) return null; // evita flash de redirecionamento durante o boot

  if (!session) return <Navigate to="/login" replace />;

  // Cliente é sempre aprovado na hora (ver Cadastro.jsx) — isto cobre
  // qualquer papel de equipe interna (coletor, despachante, gerente) que
  // ainda esteja esperando aprovação.
  if (perfil?.aprovado === false) {
    return <Navigate to="/cadastro-pendente" replace />;
  }

  if (papeis && perfil && !papeis.includes(perfil.papel)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
