# Acesso Liberado

Cópia em HTML e CSS da página https://entre-agora-online-hub.lovable.app/.

## Abrir

Abra `dist/index.html` diretamente no navegador. Para usar um servidor local, execute nesta pasta:

```sh
npm run dev
```

Acesse http://localhost:5173. Use Node.js 24. Não é necessário instalar dependências ou executar um build.

## Deploy no Railway

1. No Railway, selecione **New Project → Deploy from GitHub repo**.
2. Escolha **LipeDevN/pressel**, branch **main**.
3. Deixe **Root Directory** vazio (raiz do repositório). Não use `acesso-liberado` nem `dist`: os arquivos do projeto já estão na raiz do GitHub.
4. Aguarde o deploy. O `railway.json` configura o Railpack, o comando `node server.mjs` e a verificação de saúde em `/`.
5. No serviço, abra **Settings → Networking → Public Networking → Generate Domain** para obter o endereço público.

Não é necessário definir um comando de build, adicionar banco de dados ou configurar variáveis manualmente. O servidor usa a variável `PORT` fornecida pelo Railway e escuta em `0.0.0.0`. O Node.js 24 é selecionado pelo `package.json`.

Para executar localmente apenas na interface de loopback, defina `HOST=127.0.0.1` no ambiente antes de iniciar o servidor.

Referências: [configuração por arquivo](https://docs.railway.com/config-as-code/reference), [deploy pelo GitHub](https://docs.railway.com/guides/github-autodeploys) e [domínio público](https://docs.railway.com/networking/public-networking).

## Editar

- `dist/index.html`: textos e destino do botão (atributo `href` de `.al-cta`).
- `dist/styles.css`: cores, dimensões, brilho e animação.
- `dist/favicon.svg`: ícone da aba.

O botão abre `https://7s3venbet.io/?r=8yzbyk`, conforme solicitado. O selo de edição e o rastreamento da plataforma Lovable não estão incluídos.

Para hospedar em um servidor estático, envie o conteúdo de `dist/`.
