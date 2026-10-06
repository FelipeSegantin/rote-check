# RoteCheck

App de coleta/roteirização para agência de correio. Vite + React + Supabase.

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com as credenciais do seu projeto Supabase
npm run dev
```

## Banco de dados

1. Crie um projeto no Supabase.
2. Rode `supabase/schema.sql` no SQL editor (cria tabelas, RLS e os
   gatilhos de push).
3. Crie três buckets no Storage: `fotos-coletas`, `fotos-perfil` e
   `prints-rotas` (públicos para leitura). Os prints de rota mais antigos
   que 15 dias são apagados sozinhos (ver `rotecheck_limpar_prints_antigos`
   em `schema.sql` — ative a extensão `pg_cron` pra isso rodar todo dia
   automaticamente, senão a limpeza só acontece quando um gerente abre a
   aba Mapa).
4. Configure a URL da Edge Function e a service role key como settings do
   banco (instruções no fim do `schema.sql`).

## Push notifications

Os gatilhos já estão ligados nesta versão:

- **Nova coleta** → avisa todo gerente e despachante.
- **Coleta aceita** → avisa o cliente (com o nome do coletor, se já
  definido).
- **Coleta recusada** → avisa o cliente, com o motivo.
- **Mensagem nova no chat** → se foi o cliente que mandou, avisa todo
  gerente e despachante; se foi despachante/gerente, avisa o cliente dono
  da coleta.

Para funcionar de ponta a ponta:

1. Gere as chaves VAPID:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Coloque a chave pública em `VITE_VAPID_PUBLIC_KEY` (frontend) e em
   `VAPID_PUBLIC_KEY` como secret da função `send-push`.
3. Coloque a chave privada **só** como secret da função (nunca no
   frontend):
   ```bash
   supabase secrets set VAPID_PRIVATE_KEY=... VAPID_PUBLIC_KEY=... VAPID_SUBJECT=mailto:voce@dominio.com
   ```
4. Faça o deploy da função:
   ```bash
   supabase functions deploy send-push
   ```
5. No banco, aponte os triggers para a função (ver comentário final do
   `schema.sql`).

Depois disso, qualquer INSERT/UPDATE relevante nas tabelas `coletas` e
`mensagens` já dispara o push automaticamente — não precisa chamar nada
manualmente do frontend.

## Build de produção

```bash
npm run build
```

Gera a pasta `dist/`, pronta para publicar no Netlify (ou qualquer
hospedagem estática).
