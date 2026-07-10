# 📺 GLPI TV Dashboard II

> **Extensão Chrome — Manifest V3**  
> Versão `1.5.1` · Desenvolvida para exibição em painéis e televisões de central de atendimento

---

## 📋 Visão Geral

A **GLPI TV Dashboard II** é uma extensão para Google Chrome que coleta, processa e exibe os chamados do sistema **GLPI** em tempo real em um painel visual moderno e responsivo — ideal para TVs e monitores de NOC/suporte técnico.

O painel atualiza automaticamente em intervalos configuráveis, emite alertas sonoros para chamados críticos e SLA prestes a vencer, e envia notificações automáticas para os canais de comunicação da equipe (Microsoft Teams, Google Chat e Telegram).

---

## 🏗️ Arquitetura

```
glpi-extension-II/
├── manifest.json        # Manifest V3 — permissões e configurações da extensão
├── background.js        # Service Worker — extração de dados (scraping) e notificações automáticas
├── content.js           # Content Script — detecta páginas GLPI e sinaliza o background
├── dashboard.html       # Interface principal do painel (para display em TV)
├── dashboard.js         # Lógica do painel — renderização, filtros, alertas e estado global
├── popup.html           # Interface de configuração da extensão (popup do ícone)
├── popup.js             # Lógica de configuração — perfis, regras, contatos e cards
├── sirene.mp3           # Som de alerta para chamados críticos
└── tictac.mp3           # Som de alerta para novos chamados
```

### Fluxo de Dados

```
GLPI (página web)
      │
      ▼ (executeScript via background.js)
background.js  ──scraping──►  chrome.storage.local (glpi_data)
      │                                │
      │ mensagem DATA_UPDATED          │ leitura
      ▼                                ▼
dashboard.js  ◄──────────────────────────
      │
      ▼
dashboard.html (painel renderizado na TV)
```

---

## ✨ Funcionalidades

### 🖥️ Painel TV (dashboard.html / dashboard.js)

#### Cards de Métricas — Clicáveis e Interativos
Cada card exibe uma contagem em tempo real e, ao ser clicado, **filtra a tabela principal** exibindo apenas os chamados correspondentes. O card ativo recebe um destaque visual com brilho (glow) colorido.

| Card | Descrição | Cor do Glow |
|---|---|---|
| **Abertos** | Total de chamados em fila | Azul |
| **Críticos** | Chamados com urgência crítica | Vermelho |
| **SLA < 60min** | Chamados com prazo expirando em até 60 minutos | Âmbar |
| **Expirados** | Chamados abertos com SLA ≥ 100% + solucionados com estouro | Vermelho |
| **Solucionados Hoje** | Chamados encerrados na data atual | Verde |
| **Solucionados Semana** | Chamados encerrados na semana atual | Verde |
| **Cronograma (Lote)** | Aparece **somente** se houver regra configurada para agrupamento de lote | Azul |

#### Tabela de Chamados
Exibe os chamados com as seguintes colunas:

| Coluna | Descrição |
|---|---|
| **ID** | Número do chamado com link direto para abertura |
| **Título / Técnico** | Título do chamado e técnico atribuído |
| **Solicitante / Setor** | Nome do solicitante com setor e localização mapeada |
| **Urgência** | Badge colorido (Crítica / Média / Baixa) |
| **Status** | Pílula de status do chamado |
| **Fila / Grupo** | Grupo atribuído ao chamado |
| **SLA %** | Barra de progresso e percentual decorrido do prazo |
| **Prazo SLA** | Data/hora de vencimento do SLA |
| **Abertura** | Data/hora de abertura do chamado |
| **Ações** | Botão de notificação manual do chamado |

> **Obs.:** Nas visualizações **Solucionados Hoje** e **Solucionados Semana**, as colunas SLA % e Prazo são substituídas por um badge "✔ Solucionado" e a **data de resolução**, respectivamente, pois não fazem sentido para chamados já encerrados.

#### Filtros e Busca
- **Filtros de urgência** por chips clicáveis: Todos / Crítica / Média / Baixa
- **Campo de busca** por texto livre em tempo real
- **Filtros por grupo de fila** gerados automaticamente a partir dos dados coletados
- Todos os filtros trabalham em conjunto com a visualização ativa do card

#### Rotação Automática de Filas
- Alternância automática entre grupos de chamados em intervalos configuráveis (5 a 300 segundos)
- Habilita/desabilita via toggle no painel

#### Indicadores Visuais de SLA
- 🟢 **Verde** (`slaPercent < 50%`): SLA tranquilo
- 🔵 **Azul** (`slaPercent >= 50%`): SLA em atenção
- 🟡 **Âmbar** (`slaMinutes <= 60`): SLA prestes a vencer
- 🔴 **Vermelho** (`slaMinutes < 0` ou `slaPercent >= 100`): SLA expirado

#### Alertas Sonoros e Toasts
- Som diferenciado para **novos chamados** e **chamados críticos**
- Toasts visuais flutuantes para eventos: chamado crítico, SLA iminente, dados atualizados
- Toast de alerta para **SLA < 60 minutos** a cada ciclo de dados

#### Gauge de Produtividade
- Gráfico circular exibindo a razão entre chamados solucionados vs. total (abertos + solucionados)

#### Ranking de Produtividade
- Classificação dos técnicos por volume de atendimentos no dia ou na semana

---

### ⚙️ Popup de Configuração (popup.html / popup.js)

#### 👤 Sistema de Perfis
- Suporte a **múltiplos perfis** de configuração (ex: N1, N2, Suporte Especializado)
- Seleção do perfil ativo via dropdown
- Criação e exclusão de perfis individualmente

#### 📌 Aba Config
| Campo | Descrição |
|---|---|
| **URL — Abertos** | URL da pesquisa do GLPI com filtro de chamados em aberto |
| **URL — Solucionados (Dia)** | URL com filtro de solucionados hoje |
| **URL — Solucionados (Semana)** | URL com filtro de solucionados na semana |
| **Som — Novo Chamado** | Caminho ou URL do arquivo de áudio para novos chamados |
| **Som — Chamado Crítico** | Caminho ou URL do arquivo de áudio para chamados críticos |
| **Intervalo (min)** | Frequência de atualização automática (1 a 60 minutos) |
| **Título do Dashboard** | Nome exibido no cabeçalho superior do painel |
| Botão **Testar Som** | Reproduz o som configurado para validação |
| Botão **Abrir Dashboard** | Abre o painel em nova aba para a TV |
| Botão **Forçar Atualização** | Dispara scraping imediato sem aguardar o intervalo |

#### 🔀 Aba Regras
- **Regras de Agrupamento:** Mapeia palavra-chave encontrada no título do chamado para um grupo específico.
  - Exemplo: Chamados com `"Cronograma"` no título → Grupo `"Atendimentos em Lote"`
  - O card **Cronograma** no painel só aparece quando há ao menos uma regra de lote/cronograma cadastrada
- **Mapa de Localizações:** JSON customizável que converte siglas de setor em endereços físicos.
  - Exemplo: `"SAJ": "1º andar — Sala de Audiências"`

#### 📊 Aba Cards
- Toggle individual para **mostrar ou ocultar** cada card de métrica no painel
- O grid de métricas se ajusta automaticamente ao número de cards visíveis

#### 📞 Aba Contatos / Notificações
| Campo | Descrição |
|---|---|
| **Roteamento Fila → Telegram** | Mapeia cada fila/grupo para um Chat ID específico do Telegram |
| **MS Teams — Webhook** | URL do Incoming Webhook do canal Microsoft Teams |
| **Google Chat — Webhook** | URL do webhook do espaço Google Chat |
| **Telegram — Bot Token** | Token do bot criado no @BotFather |
| **Telegram — Canal Global** | Chat ID de destino global (todos os alertas) |
| **API SAI APP Key** | Chave para resumo automático de chamados via IA (SAI APP) |

---

## 🔔 Sistema de Notificações Automáticas

O `background.js` monitora continuamente os chamados e dispara notificações automáticas quando:

### Critérios de Disparo
| Critério | Descrição |
|---|---|
| **Urgência Crítica** | Chamado com nível de urgência `crítica` detectado pela primeira vez |
| **SLA ≤ 60 minutos** | Chamado com prazo de SLA expirando em 60 minutos ou menos |

> Cada chamado é notificado **uma única vez por período de 24 horas** (controle via `notified_tickets` no storage local), evitando spam de notificações repetidas.

### Canais de Envio
1. **Microsoft Teams** — via Adaptive Card com link direto ao chamado
2. **Google Chat** — via webhook com card formatado
3. **Telegram** — via Bot API com HTML formatado, roteado por fila ou canal global

### Formato da Mensagem
- **Chamado Crítico:** Prefixo `🔔 CHAMADO CRÍTICO #ID`
- **SLA Expirando:** Prefixo `⏰ SLA EXPIRANDO EM X MINUTOS #ID`
- Inclui: Fila, Solicitante, Setor, Título, Resumo (via SAI APP), Técnico e link direto

---

## 🛠️ Extração de Dados (Scraping)

O `background.js` executa `executeScript` nas abas do GLPI para extrair dados diretamente do DOM da tabela de chamados.

### Mapeamento Inteligente de Colunas
O scraper mapeia as colunas da tabela **dinamicamente** lendo os cabeçalhos (`<thead>`), suportando variações de idioma e configuração do GLPI:

| Campo | Palavras-chave reconhecidas |
|---|---|
| ID | `id`, `#` |
| Título | `título`, `titulo` |
| Solicitante | `solicitante`, `requerente` |
| Urgência | `urgência`, `urgencia` |
| Status | `status` (exato), `estado`, `situação` |
| Grupo | `grupo` |
| Técnico | `atribuído`, `tecnico`, `técnico` |
| SLA | `tempo para solução`, `sla`, `tempo limite para` |
| Data Solução | `data de solução` |
| Abertura | `atualização`, `abertura` |

### Extração de Status — Tratamento de Patrimônio
A extração da coluna de status filtra automaticamente **linhas que contenham apenas números** (ex: número de patrimônio de equipamento vinculado), garantindo que apenas o texto real do status seja exibido (ex: *"Em atendimento"*, *"Novo"*).

### Cálculo de SLA
O SLA é calculado manualmente a partir de:
- **Data de Abertura** extraída da coluna de data
- **Data de Vencimento** extraída do campo de SLA (formato `dd-mm-yyyy hh:mm`)
- `slaPercent` = `(elapsed / totalAllowed) * 100`
- `slaMinutes` = minutos restantes até o vencimento (negativo = expirado)

---

## 📦 Instalação

1. Acesse `chrome://extensions/` no Google Chrome
2. Ative o **Modo do desenvolvedor** (toggle no canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `glpi-extension-II`
5. A extensão será carregada e o ícone aparecerá na barra do Chrome

---

## ⚡ Configuração Rápida

1. Clique no ícone da extensão → **GLPI TV · Configuração**
2. Em **Config**, cole as URLs das pesquisas salvas no GLPI:
   - Uma para chamados **abertos** (filtrar por status Novo + Em Atendimento)
   - Uma para **solucionados hoje**
   - Uma para **solucionados na semana**
3. Defina o intervalo de atualização (ex: `2` minutos)
4. Clique em **💾 Salvar e Iniciar Coleta**
5. Clique em **📺 Abrir Dashboard na TV**
6. Em **Contatos**, configure os webhooks e o bot do Telegram para receber alertas automáticos

> **Dica:** No GLPI, filtre a lista de chamados conforme necessário, configure o limite de itens por página para o máximo possível (ex: 5000), e copie a URL da barra de endereço.

---

## 🗂️ Permissões Utilizadas

| Permissão | Finalidade |
|---|---|
| `storage` | Armazenar configurações e dados dos chamados localmente |
| `alarms` | Agendamento da atualização periódica dos dados |
| `tabs` | Abertura de abas do GLPI para scraping e para o dashboard |
| `scripting` | Execução de scripts nas páginas do GLPI para extração dos dados |
| `host_permissions: *://*/*` | Acesso à instância do GLPI em qualquer endereço de rede interna |

---

## 🧩 Tecnologias

- **Manifest V3** — Arquitetura moderna para extensões Chrome
- **Service Worker** (`background.js`) — Processamento em segundo plano sem bloqueio
- **Chrome Storage API** — Persistência de dados e configurações
- **Chrome Scripting API** — Execução segura de scripts no contexto das páginas GLPI
- **Vanilla JS + CSS** — Interface sem dependências externas
- **Google Fonts (Outfit + JetBrains Mono)** — Tipografia moderna
- **Telegram Bot API** — Notificações via bot
- **Microsoft Teams / Google Chat Webhooks** — Integração corporativa

---

## 📝 Observações de Uso

- O Dashboard foi desenvolvido para exibição em **modo tela cheia** (F11) em monitores/TVs de central de atendimento
- As URLs das pesquisas do GLPI devem ser salvas pelo usuário no próprio GLPI antes de configurar a extensão
- A extensão **não armazena nem transmite credenciais** do GLPI. O acesso às páginas ocorre na sessão ativa do navegador do usuário
- O campo **API SAI APP** é necessário apenas se desejar o resumo automático de chamados por IA nas notificações
