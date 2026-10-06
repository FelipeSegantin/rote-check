// Casamento de um cliente (perfil) com a lista de "clientes esperados"
// (vem do roteiro/planilha — ver supabase/schema.sql e importar_producao.js).
// Usado tanto pra saber o veículo esperado (aviso de moto em Nova Coleta)
// quanto pra descobrir automaticamente qual coletor atende esse cliente
// (aceitar coleta em AbaColetas).
//
// Tenta primeiro pelo CNPJ do cadastro (mais confiável — não depende de o
// nome do estabelecimento ter sido digitado igual ao da planilha); só cai
// pro nome do estabelecimento quando o cliente não tem CNPJ cadastrado ou
// nenhum da planilha bate com o CNPJ dele.

// Tira acento e padroniza maiúsculas pra comparar nome de estabelecimento
// sem depender de digitação idêntica à da planilha.
export function normalizarNome(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
}

// Só os dígitos do CNPJ, pra comparar sem depender da máscara
// (00.000.000/0000-00) ser exatamente igual dos dois lados.
export function somenteDigitos(s) {
  return (s || "").replace(/\D/g, "");
}

// perfil: precisa de { cnpj, estabelecimento }. lista: linhas de
// clientes_esperados (nome, veiculo, cnpj, coletor_id, ...). Retorna a
// linha casada ou null quando nada bate.
export function casarClienteEsperado(perfil, lista) {
  if (!perfil) return null;

  const cnpjCliente = somenteDigitos(perfil.cnpj);
  if (cnpjCliente) {
    const achadoPorCnpj = lista.find((c) => c.cnpj && somenteDigitos(c.cnpj) === cnpjCliente);
    if (achadoPorCnpj) return achadoPorCnpj;
  }

  if (perfil.estabelecimento) {
    const alvo = normalizarNome(perfil.estabelecimento);
    const achadoPorNome = lista.find((c) => normalizarNome(c.nome) === alvo);
    if (achadoPorNome) return achadoPorNome;
  }

  return null;
}
