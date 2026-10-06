// Rótulos em português dos 4 papéis do sistema — usado em qualquer tela
// que precise mostrar/escolher um papel (cadastro, lista de usuários,
// tela de "cadastro pendente" etc.), pra não duplicar esse texto.
export const LABEL_PAPEL = {
  cliente: "Cliente",
  despachante: "Despachante",
  gerente: "Gerente",
  coletor: "Coletor",
};

export const PAPEIS = ["cliente", "despachante", "gerente", "coletor"];

// Papéis que se autocadastram como "equipe interna" — ficam pendentes até
// um gerente aprovar (diferente de cliente, que é aprovado na hora).
export const PAPEIS_INTERNOS = ["despachante", "gerente", "coletor"];
