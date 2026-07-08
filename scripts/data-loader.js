window.RTN = window.RTN || {};

(function () {
  RTN.cache = {
    csv: {}, // { 'rtn_1_2.csv': [rows...] }
    inflight: {}, // { 'rtn_1_2.csv': Promise }
  };

  RTN.onFetchError = null; // opcional: function(file, err)

  function fetchOne(file) {
    if (RTN.cache.csv[file]) return Promise.resolve(RTN.cache.csv[file]);
    if (RTN.cache.inflight[file]) return RTN.cache.inflight[file];

    var p = fetch('data/' + file)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' ao buscar ' + file);
        return r.text();
      })
      .then(function (text) {
        return new Promise(function (resolve, reject) {
          Papa.parse(text, {
            header: true,
            dynamicTyping: false,
            skipEmptyLines: true,
            complete: function (results) {
              RTN.cache.csv[file] = results.data;
              delete RTN.cache.inflight[file];
              resolve(results.data);
            },
            error: function (err) {
              delete RTN.cache.inflight[file];
              reject(err);
            },
          });
        });
      })
      .catch(function (err) {
        delete RTN.cache.inflight[file];
        if (RTN.onFetchError) RTN.onFetchError(file, err);
        throw err;
      });

    RTN.cache.inflight[file] = p;
    return p;
  }

  RTN.ensureCsvLoaded = function (files) {
    var uniq = files.filter(function (f, i) {
      return files.indexOf(f) === i;
    });
    return Promise.all(uniq.map(fetchOne));
  };
})();
