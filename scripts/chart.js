window.RTN = window.RTN || {};

(function () {
  var PALETTE = [
    '#003d6b', // accent (navy)
    '#b8460e', // warn (terracota)
    '#1f6e3d', // good (verde)
    '#a4243b', // bad (vermelho)
    '#2f7d8c', // teal
    '#a3781f', // mustard
    '#6b4570', // plum
    '#4a5a6b', // slate
  ];

  var FONT_BODY = "'Public Sans', sans-serif";
  var FONT_MONO = "'IBM Plex Mono', monospace";

  var UNIDADE_LABEL = {
    corrente: 'R$ milhões (valores correntes)',
    constante_ipca: 'R$ milhões (IPCA, valores constantes)',
    constante_ipca_acum12m: 'R$ milhões (IPCA, acum. 12 meses)',
    pct_pib: '% do PIB',
  };

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function formatNumber(value, unidadeTipo) {
    if (value === null || value === undefined || isNaN(value)) return '';
    // valores de pct_pib vem como fracao no CSV (0.167 = 16.7% do PIB) -- style:'percent'
    // ja multiplica por 100, nao aplicar essa conversao manualmente de novo.
    if (unidadeTipo === 'pct_pib') {
      return value.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  RTN.formatNumber = formatNumber;

  RTN.buildChartDatasets = function (resolvedVars, state) {
    var datasets = resolvedVars.map(function (v, i) {
      var rows = (RTN.cache.csv[v.csvFile] || []).filter(function (r) {
        return (
          r.codigo === v.codigo &&
          r.descricao === v.descricao &&
          r.periodicidade === state.periodicidade &&
          r.unidade_tipo === state.unidadeTipo
        );
      });
      rows.sort(function (a, b) {
        return a.periodo < b.periodo ? -1 : a.periodo > b.periodo ? 1 : 0;
      });
      var color = PALETTE[i % PALETTE.length];
      return {
        label: RTN.apelidoOuDescricao(v.codigo, v.descricao),
        varKey: RTN.varKey(v.codigo, v.descricao),
        borderColor: color,
        backgroundColor: color,
        pointBackgroundColor: color,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.15,
        data: rows.map(function (r) {
          return { x: r.periodo, y: parseFloat(r.valor) };
        }),
      };
    });

    var periodSet = {};
    datasets.forEach(function (d) {
      d.data.forEach(function (p) {
        periodSet[p.x] = true;
      });
    });
    var labels = Object.keys(periodSet).sort();

    return { labels: labels, datasets: datasets };
  };

  var chartInstance = null;

  RTN.renderChart = function (canvas, chartData, unidadeTipo) {
    var ink = cssVar('--ink') || '#1a1a1a';
    var muted = cssVar('--muted') || '#5b5b5b';
    var line = cssVar('--line') || '#d8d8d4';

    var options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          type: 'category',
          labels: chartData.labels,
          grid: { color: line, drawOnChartArea: false },
          ticks: { color: muted, maxRotation: 0, autoSkip: true, autoSkipPadding: 16, font: { family: FONT_BODY, size: 11 } },
        },
        y: {
          grid: { color: line },
          ticks: {
            color: muted,
            font: { family: FONT_MONO, size: 11 },
            callback: function (value) {
              return formatNumber(value, unidadeTipo);
            },
          },
        },
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: ink, usePointStyle: true, boxWidth: 8, font: { family: FONT_BODY, size: 12 } },
        },
        tooltip: {
          titleFont: { family: FONT_BODY, size: 12 },
          bodyFont: { family: FONT_MONO, size: 12 },
          padding: 10,
          callbacks: {
            label: function (ctx) {
              return ctx.dataset.label + ': ' + formatNumber(ctx.parsed.y, unidadeTipo);
            },
          },
        },
      },
    };

    if (!chartInstance) {
      chartInstance = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels: chartData.labels, datasets: chartData.datasets },
        options: options,
      });
    } else {
      chartInstance.data.labels = chartData.labels;
      chartInstance.data.datasets = chartData.datasets;
      chartInstance.options.scales.x.labels = chartData.labels;
      chartInstance.options.scales.y.ticks.callback = options.scales.y.ticks.callback;
      chartInstance.options.plugins.tooltip.callbacks.label = options.plugins.tooltip.callbacks.label;
      chartInstance.update();
    }
    return chartInstance;
  };

  RTN.destroyChart = function () {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
  };

  RTN.unidadeLabel = function (unidadeTipo) {
    return UNIDADE_LABEL[unidadeTipo] || unidadeTipo;
  };
})();
