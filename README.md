# Acesso Liberado

Cópia em HTML e CSS da página https://entre-agora-online-hub.lovable.app/.

## Abrir

Abra `dist/index.html` diretamente no navegador. Para usar um servidor local, execute nesta pasta:

```sh
npm run dev
```

Acesse http://localhost:5173. Use Node.js 24. Não é necessário instalar dependências ou executar um build.
Para testar o rastreamento, use o servidor local ou o endereço publicado; abrir o HTML pelo sistema de arquivos serve apenas para conferir o visual.

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
- `dist/tracking.js`: encaminhamento dos parâmetros do anúncio e identificadores Meta.
- `dist/attribution.js`: armazenamento, recuperação e validade dos dados de campanha.

O botão abre `https://7s3venbet.io/?r=8yzbyk`, conforme solicitado. O selo de edição e o rastreamento da plataforma Lovable não estão incluídos.

Para hospedar em um servidor estático, envie o conteúdo de `dist/`.

## Rastreamento dos anúncios

O botão encaminha todos os parâmetros da URL de entrada: `utm_*`, `fbclid`, `gclid`, `gbraid`, `wbraid`, `ttclid`, `msclkid`, IDs de campanha/conjunto/anúncio e parâmetros personalizados. Valores repetidos, vazios e caracteres especiais são preservados. Os parâmetros fixos do destino têm prioridade: o código de afiliado continua sendo `r=8yzbyk`.

Exemplo de entrada:

```text
https://sua-pressel.com/?utm_source=facebook&utm_campaign=campanha1&ad_id=123&fbclid=ABC123
```

O botão mantém o domínio `7s3venbet.io` e acrescenta esses parâmetros à URL de destino.

A atribuição recebida fica guardada por até 90 dias em `sessionStorage` (por aba) e `localStorage` (para retornos ao site). O cookie próprio `_pressel_attribution` permite ao servidor recuperar esses dados mesmo sem JavaScript. Assim, recarregar ou retornar à pressel com uma URL sem parâmetros mantém a atribuição no botão.

Um novo identificador de clique ou mudança de campanha substitui a campanha anterior, evitando misturar UTMs e IDs de anúncios diferentes. Valores da URL atual têm prioridade; campos repetidos e personalizados continuam preservados. Reabrir a página não reinicia o prazo de 90 dias.

Campanhas que ultrapassam o limite seguro de um cookie são armazenadas integralmente no navegador, sem truncamento. Nesse caso, a recuperação após uma navegação sem parâmetros depende de JavaScript e do armazenamento do navegador. Se todos os mecanismos de armazenamento forem bloqueados ou apagados, o link ainda repassa os parâmetros da URL atual, mas não há como recuperar dados de uma visita anterior que já não estejam disponíveis.

- Se houver `fbclid`, aproveita um `fbc` correspondente ou forma o identificador com o horário de recebimento do clique. Um novo clique substitui um `_fbc` de outro anúncio. O `_fbc` é armazenado por 90 dias no domínio da pressel, com `Secure` em HTTPS e `SameSite=Lax`.
- Encaminha os identificadores recebidos pela URL ou pelos cookies `_fbc` e `_fbp`, usando os nomes `fbc`/`_fbc` e `fbp`/`_fbp`. Não cria um `fbp` fictício quando ele não está disponível.
- No Railway, o servidor entrega o botão já preenchido, inclusive sem JavaScript. No navegador, o link é atualizado ao interagir com o botão para incluir cookies que tenham sido criados após o carregamento. Em hospedagem somente estática, esse encaminhamento depende de JavaScript.
- Para esse repasse, o código lê os identificadores `_fbc` e `_fbp` e o registro próprio `_pressel_attribution`. Cookies de sessão/autenticação não são encaminhados. O código não acessa cookies de outros domínios.

O site de destino precisa ler e utilizar os parâmetros recebidos; enviá-los pela URL não instala o Meta Pixel nem configura a API de Conversões no destino. IDs de campanha/conjunto/anúncio e UTMs precisam estar configurados no link do anúncio para chegarem à pressel. Dados ausentes no clique não são recuperados pela página.

Referência: [formato de fbc e fbp na documentação da Meta](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/fbp-and-fbc).

Para executar os testes de encaminhamento com Node.js 24:

```sh
npm test
```
