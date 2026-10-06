import { NavLink } from "react-router-dom";

// "/configuracoes" não entra mais aqui — agora é um botão fixo no canto
// superior direito da tela (ver BotaoConfiguracoes.jsx), sempre visível,
// em vez de um link nesta barra.
const LINKS_POR_PAPEL = {
  cliente: [{ to: "/", label: "Coletas" }],
  despachante: [{ to: "/", label: "Rotas" }],
  gerente: [{ to: "/", label: "Coletas" }],
  coletor: [{ to: "/", label: "Minhas coletas" }],
};

export default function BottomNav({ papel }) {
  const links = LINKS_POR_PAPEL[papel] || [];
  if (links.length === 0) return null;

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end className={({ isActive }) => (isActive ? "active" : "")}>
            {link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
