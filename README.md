# Base de dados RTN (Resultado do Tesouro Nacional)

## O que isso é

Um parser que transforma a planilha "Série Histórica" mensal do RTN (formato largo,
uma coluna por período) em uma **base tabular longa** (uma linha por
tabela + rubrica + período), pronta para alimentar um painel.

## Estrutura de arquivos recomendada para o repositório

```
rtn-painel/
├── raw/
│   └── serie_historica_mai26.xlsx      <- planilha baixada do Tesouro (mais recente)
├── scripts/
│   └── parse_rtn.py                    <- script de extração (anexo)
├── data/
│   ├── rtn_1_1.csv                     <- um CSV por tabela do relatório
│   ├── rtn_1_2.csv
│   ├── ... (24 tabelas)
│   └── rtn_meta.json                   <- títulos, unidades e contagem de linhas por tabela
└── index.html                          <- painel (lê os CSVs com PapaParse)
```

## Por que CSV por tabela, e não um JSON único

Testei os dois formatos com os dados reais desta planilha (322 mil linhas no total):

| Formato | Tamanho |
|---|---|
| CSV (uma linha por registro) | ~27 MB |
| JSON array-of-objects (chaves repetidas em cada linha) | ~68 MB |

O JSON "clássico" (lista de objetos `{tabela, codigo, descricao, periodo, valor}`)
repete os nomes dos campos em cada uma das 322 mil linhas — por isso fica 2,5x
maior. CSV não tem esse problema porque o cabeçalho aparece uma única vez.

Além disso, dividido por tabela, nenhum arquivo individual passa de ~5 MB
(a maior é a 1.2-B, com 5,2 MB) — perfeitamente carregável no navegador via
GitHub Pages, principalmente se o painel só carrega o CSV da tabela que o
usuário está visualizando (carregamento sob demanda), em vez de tudo de uma vez.

**Resumindo a recomendação:** CSV por tabela como fonte de verdade e formato de
consumo do painel (via PapaParse no navegador, sem precisar de um passo de
conversão para JSON). Simples, auditável linha a linha, e fácil de versionar no Git.

## Sobre as tabelas 3.1 e 3.2

Não entraram na base. Elas são "tabelas de variação" (mês atual vs. mesmo mês do
ano anterior, acumulado no ano, acumulado em 12 meses) — ou seja, são **cálculos
derivados** dos dados que já estão em 1.1/1.2, não uma série histórica nova. Se
você quiser esses comparativos no painel, é mais robusto calculá-los em JS a
partir da série mensal (1.1/1.2) do que manter uma cópia redundante da mesma
informação.

## Fluxo de atualização mensal

O Tesouro republica o arquivo inteiro todo mês (com a série completa desde 1997,
incluindo eventuais revisões de meses passados — dados fiscais são
retificados com alguma frequência). Por isso, o fluxo **não é de "acrescentar
uma coluna"**, e sim de **regerar os CSVs inteiros** a partir do arquivo novo:

1. Baixa a nova planilha do site do Tesouro Nacional e substitui o arquivo em `raw/`.
2. Roda `python scripts/parse_rtn.py` (ajustando o nome do arquivo de origem).
3. Isso sobrescreve todos os CSVs em `data/` com a versão mais atualizada
   (incluindo qualquer revisão retroativa que o Tesouro tenha feito).
4. Commit + push. Se o painel estiver no GitHub Pages, ele atualiza sozinho.

Esse processo é 100% automatizável com uma GitHub Action (você já tem esse
padrão no pipeline de RSS) — dá pra até agendar para rodar automaticamente
todo mês, embora nesse caso, como depende de baixar manualmente a planilha do
site do Tesouro, provavelmente faz mais sentido rodar sob demanda via Claude
Code (você sobe o arquivo, ele roda o script e faz o commit).

## Especificação do painel (definida, ainda não implementada)

### Filtros (menu lateral)

- **Periodicidade**: mensal / anual / trimestral — seleção única (define o eixo X do gráfico).
- **Base de valores**: corrente / constante (IPCA) / % do PIB / acumulado 12 meses — seleção única.
- **Variável(is)**: lista pesquisável de rubricas, seleção múltipla. Quando mais
  de uma variável é selecionada, todas são sobrepostas no mesmo gráfico (linhas
  de cores diferentes). Isso deixa livre a decisão de comparar 1 ou N séries no
  mesmo lugar, sem precisar de dois modos de tela diferentes.

### Como o painel decide qual tabela usar (resolução automática)

Você tinha dúvida se a troca de tabela (ex: 1.1→2.1) devia ser automática ou
manual. Fui conferir um detalhe que resolve isso: **a tabela 1.1 (resumida) não
é um subconjunto da 1.2 (detalhada)** — ela tem linhas exclusivas que não
existem na 1.2, como "9. Juros Nominais", "10. Resultado Nominal do Governo
Central" e os "Ajustes Metodológicos" (6.1 a 6.4). Ou seja, cada rubrica só
existe em uma (ou mais) tabelas específicas, e isso varia rubrica a rubrica —
não dá pra tratar "resumida vs. detalhada" como só mais um botão de alternância,
porque a lista de variáveis disponíveis muda dependendo da escolha.

Por isso o design correto é **resolver a tabela por variável, não por um
toggle geral**: cada rubrica "sabe" em qual tabela mora, dado
(periodicidade, base de valores). Na prática:

1. Existe um **catálogo de variáveis** (`data/catalogo_variaveis.json`) — uma
   lista de todas as rubricas únicas, com metadados: código, descrição
   completa, apelido (ver seção seguinte), e em quais tabelas ela aparece.
2. O menu de "Variável(is)" é montado a partir desse catálogo — o usuário nunca
   escolhe uma "tabela" diretamente, só a rubrica que quer ver.
3. Quando o usuário muda periodicidade/base de valores, o painel troca sozinho
   o CSV de origem por trás das cortinas (ex: rubrica "Receita Total" em
   mensal+corrente → carrega `rtn_1_1.csv` ou `rtn_1_2.csv`; a mesma rubrica em
   anual+%PIB → carrega `rtn_2_1_A.csv` ou `rtn_2_2_A.csv`).
4. Se uma combinação não existir para a rubrica escolhida (ex: "Juros
   Nominais" não tem versão % do PIB), o painel avisa e sugere a base de
   valores mais próxima disponível, em vez de mostrar um gráfico vazio sem
   explicação.

Essa arquitetura resolve sua dúvida original: a troca é automática, mas a
"unidade" da automação é a variável, não um dropdown separado de tabela.

### Dicionário de apelidos

Fica em arquivo separado (`data/apelidos.json`), no formato `{"codigo": "apelido"}`,
por exemplo `{"4.3.05": "BPC"}`. Motivo de deixar separado do código do painel:
é a mesma lógica de separar dado de configuração da lógica do programa — você
(ou eu, via Claude Code) pode adicionar/corrigir um apelido a qualquer momento
só editando esse JSON, sem tocar no HTML/JS do painel nem precisar reimplantar
nada. O painel usa o apelido quando ele existe no dicionário, e cai de volta
para a descrição completa da planilha quando não existe — assim nenhuma
rubrica fica sem nome só porque ainda não foi apelidada.

### Gráficos padrão (default) e tipos de visualização

Ainda em aberto — decidimos deixar para depois, quando começarmos a
implementação de fato.

## Status

Implementado: `scripts/build_catalogo.py` (gera `data/catalogo_variaveis.json`
a partir dos 24 CSVs, agrupando por par código+descrição), `data/apelidos.json`
(skeleton vazio, a preencher aos poucos) e o painel `index.html` (filtros de
periodicidade/base de valores/variáveis, gráfico Chart.js, resolução
automática de tabela por variável com fallback quando a combinação não
existe). Ver `.claude/plans/logical-swimming-hoare.md` para o desenho da
arquitetura.

Pendente: apelidos reais em `data/apelidos.json` (só o usuário sabe quais
rubricas merecem alias); publicar no GitHub Pages; decidir se o calendário
semestral de publicações do Tesouro vira um indicador no painel (por ora é
só contexto, ver memória do projeto).
