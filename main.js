const http = require('http');
const fs = require('fs');
const path = require('path');
const onceupon = require('onceupon.js');

module.exports = ({options: o, build}) => {
  let events = onceupon();
  let options = {};
  let server;

  let d = {
    port: 8080,
    base: './',

    static: true,
    index: 'index.html',

    cache: {
      enabled: true,
      keep: -1,
      ignore: []
    },

    auto: false,
    overwrite: true
  };

  options = Object.assign({}, d, o);
  options.cache = Object.assign({}, d.cache, o?.cache);

  let modules = {
    options: () => {
      return options;
    },

    stop: () => {
      if(server?.listening) {
        server.stop();
        events.fire('stop');
      }
    },

    start: (opt) => {
      options = Object.assign({}, options.overwrite ? options : d, opt);
      options.cache = Object.assign({}, options.overwrite ? options.cache : d.cache, opt?.cache);

      let base = path.resolve(options.base);
      let cache = {};

      server = http.createServer((req, res) => {
        let url = req.url;

        events.fire('connection', {req, res});

        if(options.static && !res.writableEnded) {
          let ps = url.split('/');

          if(!ps[ps.length - 1].includes('.') || ps[ps.length - 1]?.length === 0) {
            url = `${url}${ps[ps.length - 1]?.length === 0 ? '' : '/'}${options.index}`;
          }

          let location = path.join(
              base,
              path.normalize(url).replace(/^(\.\.[\/\\])+/, '')
          );

          if(options.cache.enabled ? (!options.cache.ignore?.includes(url) ? (cache[url] ? (options.cache.keep > -1 ? (new Date() - cache[url]?.date < options.cache.keep) : true) : false) : false) : false) {
            res.write(cache[url].data);
            return res.end();
          } else {
            let stream = fs.createReadStream(location);

            stream.on('error', () => {
              res.writeHead(404, 'Not Found');
              res.write('404: File Not Found!');
              res.end();
            });

            stream.on('open', () => {
              res.statusCode = 200;
              stream.pipe(res);
            });
            if(options.cache.enabled) {
              let parts = [];

              stream.on('data', chunk => {
                parts.push(chunk);
              });

              stream.on('end', () => {
                if(parts.length > 0 && !options.cache.ignore?.includes(url)) {
                  cache[url] = {
                    date: new Date(),
                    data: Buffer.concat(parts)
                  };
                }
              });
            }
          }
        }
      });

      server.listen(options.port);
      events.fire('start', server);
    }
  }

  if(options.auto) {
    modules.start(options);
  }

  build({
    name: 'http',
    version: 1,

    ...modules,

    on: events.on,
    once: events.once,
    only: events.only
  })
};