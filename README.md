# Finanças C6

App pessoal de finanças: gastos da conta e do cartão, saldo e investimentos do C6 Bank, lidos via Open Finance pela [Pluggy](https://pluggy.ai). Roda na Vercel, protegido por senha, e se atualiza uma vez por dia.

Nenhum dado financeiro fica neste repositório. As transações são buscadas na Pluggy a cada acesso (com cache de 15 minutos) e as chaves ficam só nas variáveis de ambiente da Vercel.

## Como colocar no ar

1. **Pluggy:** no [painel da Pluggy](https://dashboard.pluggy.ai), abra *Applications*, crie uma aplicação (se ainda não houver) e anote o **Client ID** e o **Client Secret**. Não cole esses valores em nenhum lugar além da Vercel.
2. **Vercel:** entre em [vercel.com](https://vercel.com) com a conta do GitHub, clique em *Add New → Project* e importe o repositório `financeiro`. Antes de clicar em *Deploy*, abra *Environment Variables* e cadastre:

   | Nome | Valor |
   |---|---|
   | `PLUGGY_CLIENT_ID` | Client ID da Pluggy |
   | `PLUGGY_CLIENT_SECRET` | Client Secret da Pluggy |
   | `APP_PASSWORD` | a senha que você vai usar para entrar no app |
   | `CRON_SECRET` | um texto longo e aleatório qualquer (protege a atualização diária) |

3. Clique em **Deploy**. Ao terminar, abra o endereço que a Vercel mostra (algo como `financeiro-xxxx.vercel.app`) e entre com a sua senha.
4. **Conectar o C6:** toque em *Banco → Conectar um banco*, escolha o C6 Bank e autorize no app do banco.
5. No fim, o app mostra um **código da conexão**. Na Vercel, em *Settings → Environment Variables*, crie `PLUGGY_ITEM_IDS` com esse código e depois vá em *Deployments → … → Redeploy*. Isso faz o banco aparecer em qualquer aparelho e entrar na atualização diária. (Se conectar mais de um banco, separe os códigos por vírgula.)
6. **No celular:** abra o endereço no Safari ou Chrome e use *Adicionar à Tela de Início*.

A autorização do Open Finance vale por um período definido pelo banco (normalmente 12 meses). Quando estiver perto de vencer, o app avisa; renove em *Banco → Renovar autorização*.

### Testar antes com o banco de testes da Pluggy

Cadastre `PLUGGY_SANDBOX=1` e o *Conectar um banco* passa a listar o "Pluggy Bank", que aceita o usuário `user-ok` e a senha `password-ok`. Depois de testar, apague a variável.

## Como o app classifica as transações

- **Conta:** débitos viram *Gasto*; créditos viram *Entrada*. Pix entre contas suas (mesmo CPF ou nome do titular) viram *Transferência recebida/enviada* e não contam como gasto nem como renda. Aplicações em CDB e afins viram *Investimento*; resgates, *Resgate*. O pagamento da fatura é ignorado nos gastos, porque as compras já entram pelo cartão.
- **Cartão:** cada compra é um gasto; estornos abatem do gasto.
- **Categorias:** as da Pluggy, agrupadas em português (`lib/categorias.js`).
- **Saldo diário:** calculado a partir do saldo atual, desfazendo as movimentações de cada dia.
- **Investimentos:** posição atual de cada título (bruto, líquido, aplicado, rendimento, IR e IOF) e o histórico de aplicações e resgates que o banco enviar.

## Rodar no computador

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev
```

## Estrutura

- `app/painel/` — telas de Gastos e Investimentos (`motor.js` desenha com d3, `template.js` tem a marcação).
- `app/api/dados` — busca tudo na Pluggy e devolve já organizado (`lib/dados.js`).
- `app/api/cron` — atualização diária, agendada em `vercel.json` (6h no horário de Brasília).
- `app/conectar` — tela de conexão com o widget da Pluggy.
- `proxy.js` e `lib/session.js` — login por senha.
