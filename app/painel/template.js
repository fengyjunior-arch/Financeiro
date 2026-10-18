// Markup of the painel, ported from the original dashboard. Static: every value is filled in by motor.js.
export const TEMPLATE = `
<div class="fc privado" id="fc-app">
  <div class="fc-top">
    <h1>Finanças <span>C6</span></h1>
    <div class="fc-tabs" role="tablist" aria-label="Seções">
      <button type="button" role="tab" data-tab="gastos" aria-selected="true">Gastos</button>
      <button type="button" role="tab" data-tab="investimentos" aria-selected="false">Investimentos</button>
    </div>
    <span class="per" id="periodo">—</span>
    <button type="button" class="fc-eye" id="fc-eye" aria-pressed="false"></button>
  </div>
  <div class="fc-row">
    <span class="fc-sync" id="fc-sync"></span>
    <div class="acoes">
      <button type="button" class="fc-btn" id="fc-atualizar">Atualizar</button>
      <a class="fc-btn" href="/conectar">Banco</a>
      <button type="button" class="fc-btn" id="fc-sair">Sair</button>
    </div>
  </div>
  <div id="fc-avisos" style="display: grid; gap: var(--g2)"></div>

  <div class="fc-page" id="pg-gastos">
  <section class="fc-hero" id="topo">
    <span class="lbl" id="h-lbl">Gastos no período</span>
    <span class="big" id="h-total">—</span>
    <span class="tk" id="h-tk">—</span>
    <div class="fc-share" id="h-share" role="img" aria-label="Divisão dos gastos por categoria"></div>
    <div class="fc-share-legend" id="h-legend"></div>
  </section>

  <div class="fc-filters" id="filtros" role="group" aria-label="Filtros">
    <div class="fc-chips" id="f-mes" role="group" aria-label="Mês"></div>
    <div class="fc-row">
      <div class="fc-chips" id="f-origem" role="group" aria-label="Conta ou cartão"></div>
      <button type="button" class="fc-clear" id="f-limpar">Limpar filtros</button>
    </div>
    <div class="fc-chips" id="f-cat" role="group" aria-label="Categoria"></div>
  </div>

  <section class="fc-det" id="categoria-detalhe" hidden>
    <div class="fc-det-head">
      <div><span class="eyebrow" id="d-eyebrow"></span><h2 id="d-nome"></h2></div>
      <button type="button" class="fc-x" id="d-fechar">Ver todas ×</button>
    </div>
    <div><div class="fc-det-total" id="d-total"></div><span class="fc-delta" id="d-delta" hidden></span></div>
    <div class="fc-det-stats">
      <div><span>Lançamentos</span><b id="d-qtd"></b></div>
      <div><span>Valor médio</span><b id="d-medio"></b></div>
      <div><span>Por dia</span><b id="d-dia"></b></div>
      <div><span>Maior gasto</span><b id="d-maior"></b><small id="d-maior-onde"></small></div>
    </div>
    <div class="fc-split" id="d-split"></div>
    <div class="fc-det-grid">
      <div><h3 id="d-tempo-tit">Ao longo do tempo</h3><div class="fc-chart" id="d-tempo"></div></div>
      <div><h3>Onde você mais gastou</h3><ol class="fc-top-list" id="d-lugares"></ol></div>
    </div>
  </section>

  <section class="fc-kpis" id="resumo">
    <div class="fc-kpi fc-in" style="--accent: var(--o1)"><span class="lbl">Entradas</span><span class="val" id="k-entradas">—</span><span class="sub" id="k-entradas-sub"></span></div>
    <div class="fc-kpi fc-in" style="--accent: var(--o3)"><span class="lbl">Investido</span><span class="val" id="k-invest">—</span><span class="sub">Aplicações no período</span></div>
    <div class="fc-kpi fc-in" style="--accent: var(--o4)"><span class="lbl">Média de gasto por dia</span><span class="val" id="k-dia">—</span><span class="sub" id="k-dia-sub"></span></div>
    <div class="fc-kpi fc-in" style="--accent: var(--o6)"><span class="lbl">Saldo da conta</span><span class="val" id="k-saldo">—</span><span class="sub" id="k-saldo-sub"></span></div>
  </section>

  <div class="fc-grid">
    <section class="fc-card" id="gastos-por-mes">
      <h2>Gastos por mês</h2>
      <p class="note" id="nota-mes">Toque num mês para filtrar.</p>
      <div class="fc-legend"><span><i style="background: var(--o1)"></i>Conta</span><span><i style="background: var(--o3)"></i>Cartão</span></div>
      <div class="fc-chart" id="ch-mes"></div>
    </section>
    <section class="fc-card" id="gastos-por-categoria">
      <h2>Para onde foi o dinheiro</h2>
      <p class="note">Toque numa categoria para filtrar.</p>
      <div class="fc-chart" id="ch-cat"></div>
    </section>
    <section class="fc-card fc-wide" id="saldo-da-conta">
      <h2>Saldo da conta</h2>
      <p class="note">Saldo no fim de cada dia com movimento. Arraste o dedo sobre a linha para ver o valor.</p>
      <div class="fc-chart" id="ch-saldo"></div>
    </section>
    <section class="fc-card fc-wide" id="transacoes">
      <h2>Transações</h2>
      <div class="fc-row">
        <div class="fc-chips" id="f-tipo" role="group" aria-label="Tipo"></div>
        <span class="fc-count" id="t-count"></span>
      </div>
      <input class="fc-search" id="t-busca" type="search" placeholder="Buscar por nome, loja ou categoria" aria-label="Buscar transações">
      <div class="fc-list">
        <table class="fc-table">
          <thead><tr><th>Data</th><th>Descrição</th><th class="col-cat">Categoria</th><th class="num">Valor</th></tr></thead>
          <tbody id="t-body"></tbody>
        </table>
      </div>
    </section>
  </div>
  </div>

  <div class="fc-page" id="pg-invest" hidden>
    <section class="fc-hero" id="inv-topo">
      <span class="lbl" id="iv-lbl">Patrimônio investido</span>
      <span class="big" id="iv-total">—</span>
      <span class="tk" id="iv-tk">—</span>
      <div class="fc-share" id="iv-share" role="img" aria-label="Divisão por tipo de rendimento"></div>
      <div class="fc-share-legend" id="iv-legend"></div>
    </section>

    <div class="fc-filters" role="group" aria-label="Filtros de investimentos">
      <div class="fc-row">
        <div class="fc-chips" id="iv-f-idx" role="group" aria-label="Tipo de rendimento"></div>
        <button type="button" class="fc-clear" id="iv-limpar">Limpar filtros</button>
      </div>
    </div>

    <section class="fc-kpis" id="inv-resumo">
      <div class="fc-kpi" style="--accent: var(--o1)"><span class="lbl">Rendimento bruto</span><span class="val" id="iv-rend">—</span><span class="sub" id="iv-rend-sub"></span></div>
      <div class="fc-kpi" style="--accent: var(--o3)"><span class="lbl">Rentabilidade</span><span class="val" id="iv-ret">—</span><span class="sub" id="iv-ret-sub"></span></div>
      <div class="fc-kpi" style="--accent: var(--o4)"><span class="lbl">Aplicado</span><span class="val" id="iv-apl">—</span><span class="sub" id="iv-apl-sub"></span></div>
      <div class="fc-kpi" style="--accent: var(--o6)"><span class="lbl">Líquido se resgatar hoje</span><span class="val" id="iv-liq">—</span><span class="sub" id="iv-liq-sub"></span></div>
    </section>

    <div class="fc-grid">
      <section class="fc-card fc-wide" id="inv-evolucao">
        <h2>Evolução do patrimônio</h2>
        <p class="note">A linha soma o que você aplicou menos o que resgatou. O ponto final é o valor de hoje, já com rendimento.</p>
        <div class="fc-legend" id="iv-leg-evo"></div>
        <div class="fc-chart" id="iv-ch-evo"></div>
      </section>
      <section class="fc-card" id="inv-mov-mes">
        <h2>Aplicações e resgates por mês</h2>
        <p class="note">Últimos 12 meses.</p>
        <div class="fc-legend"><span><i style="background: var(--o1)"></i>Aplicações</span><span><i style="background: var(--o3)"></i>Resgates</span></div>
        <div class="fc-chart" id="iv-ch-mes"></div>
      </section>
      <section class="fc-card" id="inv-projecao">
        <h2>Simulação</h2>
        <p class="note">Quanto a carteira pode chegar a valer mantendo a rentabilidade anual dos seus títulos, antes do IR.</p>
        <div class="fc-sim">
          <label for="iv-aporte">Aporte por mês (R$)<input id="iv-aporte" type="number" min="0" step="100" inputmode="numeric"></label>
          <div class="fc-chips" id="iv-prazo" role="group" aria-label="Prazo"></div>
        </div>
        <div class="fc-det-stats" id="iv-sim-out">
          <div><span>Valor estimado</span><b id="iv-sim-fv">—</b><small id="iv-sim-when"></small></div>
          <div><span>Você aportaria</span><b id="iv-sim-ap">—</b></div>
          <div><span>Rendimento</span><b id="iv-sim-j">—</b><small id="iv-sim-tx"></small></div>
        </div>
        <div class="fc-chart" id="iv-ch-sim" style="min-height: 110px"></div>
      </section>
      <section class="fc-card fc-wide" id="inv-titulos">
        <h2>Seus títulos</h2>
        <p class="note">Toque num título para ver só ele. A rentabilidade ao ano é a que o banco informa, ou a calculada desde a aplicação.</p>
        <div class="fc-list">
          <table class="fc-table fc-inv-table">
            <thead><tr><th>Título</th><th class="num">Saldo</th><th class="num col-cat">Rendeu</th><th class="num">% a.a.</th></tr></thead>
            <tbody id="iv-body"></tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</div>
`;
