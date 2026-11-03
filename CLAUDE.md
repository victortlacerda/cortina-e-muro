# Instruções para o Claude neste repositório

App de contenções (cortina em balanço e muro de contenção) em **um único `index.html`**, sem dependências e sem build. O usuário é engenheiro geotécnico e confere os resultados com cálculos feitos à mão.

## Estrutura do index.html
- `<script id="engine">`: motor de cálculo puro (sem DOM). Os testes o extraem por regex.
- `<script id="docxlib">`: gerador .docx (zip + OOXML + equações OMML a partir de LaTeX).
- Último `<script>`: interface, desenho SVG, gráficos interativos e memória Word (`rpCortina`, `rpMuro`, `exportDocx`).
- Unidades: kN, m, kPa, kN/m³, graus. Resultados por metro de contenção. Textos da interface em português.

## A cada atualização
1. Editar o `index.html` (manter tudo em um arquivo, abrindo offline).
2. Rodar `npm test` (motor e gerador Word) e, se mexer na interface, conferir no Chromium (Playwright).
3. Toda funcionalidade nova também entra na memória de cálculo do Word.
4. Atualizar `roadmap.txt` (marcar [x] e anotar premissas a confirmar) e `CHANGELOG.md` (nova versão).
5. Commit em português, descrevendo a etapa, e push para `main`.

## Observações
- Etapa 6 (Nspt → φ, c, γ) aguarda as correlações que o usuário vai enviar.
- O exemplo manual da cortina (`exemplos/cortina-exemplo-manual.json`) deve continuar dando Z = 2,42 m e ficha 2,91 m.
