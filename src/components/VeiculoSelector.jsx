const OPCOES = [
  { valor: "fiorino", label: "Fiorino", icone: "🚐" },
  { valor: "van", label: "Van", icone: "🚚" },
  { valor: "moto", label: "Moto", icone: "🏍️" },
];

export default function VeiculoSelector({ valor, onChange }) {
  return (
    <div className="veiculo-selector">
      {OPCOES.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          onClick={() => onChange(opcao.valor)}
          className={`veiculo-opcao ${valor === opcao.valor ? "ativo" : ""}`}
          aria-pressed={valor === opcao.valor}
        >
          <span className="veiculo-opcao-icone" aria-hidden>
            {opcao.icone}
          </span>
          <span className="veiculo-opcao-label">{opcao.label}</span>
        </button>
      ))}
    </div>
  );
}
