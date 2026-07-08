window.RTN = window.RTN || {};

(function () {
  RTN.catalog = null;
  RTN.apelidos = {};

  RTN.loadCatalog = function () {
    return Promise.all([
      fetch('data/catalogo_variaveis.json').then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' ao buscar catalogo_variaveis.json');
        return r.json();
      }),
      fetch('data/apelidos.json').then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' ao buscar apelidos.json');
        return r.json();
      }),
    ]).then(function (results) {
      RTN.catalog = results[0];
      RTN.apelidos = results[1];
      return RTN.catalog;
    });
  };

  RTN.apelidoOuDescricao = function (codigo, descricao) {
    var apelido = codigo && RTN.apelidos[codigo];
    return apelido || descricao;
  };

  RTN.varKey = function (codigo, descricao) {
    return codigo + '||' + descricao;
  };
})();
