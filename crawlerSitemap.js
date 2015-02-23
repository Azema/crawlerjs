#!/usr/bin/node
// crawler.js

var fs        = require('fs'),
    libxmljs  = require('libxmljs'),
    phantomjs = require('phantomjs'),
    util      = require('./util'),
    version   = require('./package.json').version,
    defaultNbChild = 5,
    Getopt = require('node-getopt'),
    cluster = require('cluster');;


function getSitemap(pathSitemap, done) {
  if (/^https?:\/\//.test(pathSitemap)) {
    var module = 'http';
    if (pathSitemap.substr(0,5) === 'https') {
      module = 'https';
    }
    require(module).get(pathSitemap, function(res) {
      if (res.statusCode !== 200) {
        return done(res.statusCode);
      }
      var data = '';
      res.setEncoding('utf8');
      res.on('data', function(chunk) {
        data += chunk;
      });
      res.on('end', function() {
        return done(null, data);
      });
    });
  } else if (fs.existsSync(pathSitemap)) {
    fs.readFile(pathSitemap, done);
  } else {
    done('Sitemap inconnu (' + pathSitemap + ')');
  }
}

var numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  var data = [], pending = numCPUs;
  var ProgressBar = require('progress');

  var getopt = new Getopt([
    ['s' , 'sitemap=ARG'         , 'Sitemap path (HTTP or FileSystem)'],
    ['o' , 'output=ARG'          , 'CSV file to save links'],
    ['p' , 'processes=ARG'       , 'number of processes to launch in same time (default: 5)'],
    ['d' , 'delimitor=ARG'       , 'Delimitor CSV (default: ;)'],
    ['h' , 'help'                , 'display this help'],
    ['v' , 'version'             , 'show version']
  ])
    .bindHelp(
      "\x1b[40m\x1b[36mUsage:\x1b[0m node crawlerSitemap.js [OPTION] baseUrl\n\n" +
      '[[OPTIONS]]\n\n' +
      "\x1b[40m\x1b[36mRespository:\x1b[0m https://github.com/Azema/crawlerjs\n"
    );
  var args = getopt.parseSystem();
  // console.log(args);

  // console.log('');
  console.log('\x1b[45m\x1b[1;33mCrawler version:\x1b[0m %s', version);
  console.log('');

  if (args.options.version) {
    process.exit(0);
  }
  if (args.argv.length <= 0 || !args.options.hasOwnProperty('sitemap')) {
    getopt.showHelp();
    process.exit(1);
  }
  var baseUrl = args.argv[0];
  var sitemap = args.options.sitemap;
  var fileCSV = args.options.output || 'links.csv';
  var nbChilds = args.options.processes ? parseInt(args.options.processes) : defaultNbChild;
  var delimitor = args.options.delimitor || ';';

  baseUrl = (baseUrl.substr(-1) === '/') ? baseUrl.substr(0, baseUrl.length-1) : baseUrl;
  var startTime = new Date().getTime();

  getSitemap(sitemap, function(err, result) {
    if (err) {
      console.log('Error de récupération du sitemap: ', err);
      return process.exit(1);
    }
    if (!/<?xml\s/.test(result)) {
      result = '<?xml version="1.0" encoding="UTF-8"?>' + result;
    }
    var doc = libxmljs.parseXml(result  ),
        locations = doc.find('//default:loc', { default: 'http://www.sitemaps.org/schemas/sitemap/0.9' }),
        length = locations.length,
        urls = [], part;
    var parts = Math.round(length / numCPUs), worker;
    var progress = new ProgressBar('\x1b[36mPages analyzed [:bar] :percent :elaps :loader\x1b[0m', {
      complete: '=',
      incomplete: ' ',
      width: 50,
      total: length
    });
    var loader = ['-', '\\', '|', '/'];
    var time = 0;
    var interval = setInterval(function() {
      progress.render({
        elaps: util.secondsToTime((new Date().getTime() - startTime)/1000),
        loader: loader[time++%4]
      });
    }, 1000);
    for (var j=0; j < length; j++) {
      urls.push(locations[j].text());
    }
    for (var i = 0; i < numCPUs; i++) {
      part = (i == numCPUs - 1) ? urls.slice(i * parts) : urls.slice(i * parts, parts);
      cluster.fork().send({urls: part});
    }
    function messageHandler(msg) {
      if (msg && msg.cmd === 'data') {
        data = data.concat(msg.links);
        cluster.workers[msg.worker].kill();
        if (--pending <= 0) {
          clearInterval(interval);
          progress.render({
            elaps: util.secondsToTime((new Date().getTime() - startTime)/1000),
            loader: 'Finish'
          });
          console.log('\n\x1b[35mAll urls are called, %d links found\x1b[0m', data.length);
          util.transformToCsv(data, fileCSV, baseUrl, delimitor, function(err) {
            process.exit(err ? 1 : 0);
          });
        }
      } else if (msg && msg.cmd === 'time') {
        progress.curr++;
      }
    }
    Object.keys(cluster.workers).forEach(function(id) {
      cluster.workers[id].on('message', messageHandler);
    });
  });

  
} else {
  var waiting = nbChilds, 
      links = [],
      child = require('child_process');

  process.on('message', function(msg) {
    if (!msg.hasOwnProperty('urls')) {
      console.log('Worker(%d) - Error: no urls to msg', cluster.worker.id, msg);
      return;
    }
    // console.log('Worker(%d) - URLs %d', cluster.worker.id, msg.urls.length);
    var urls = msg.urls, url, web, _data, pending = 0;
    function run(url, done) {
      if (waiting <= 0) {
        setTimeout(function() {run(url, done)}, 50);
        return;
      }
      var _data = '', web;
      waiting--;
      web = child.spawn(phantomjs.path, ["--load-images=false", "--ignore-ssl-errors=yes", '--ssl-protocol=tlsv1', __dirname + '/lib/netsniff.js', url]);
      web.stdout.on('data', function(data) {
        _data += data.toString();
      });
      web.on('exit', function(code, signal) {
        try {
          _data = JSON.parse(_data);
        } catch (e) {
          console.error(e);
          console.log(_data);
          _data = null;
        }
        done(_data);
        waiting++;
      });
      web.on('error', function(err) {
        done();
        waiting++;
      });
    }
    while (urls.length) {
      pending++;
      url = urls.shift();
      run(url, function(data) {
        if (data && data.links) {
          links = links.concat(data.links);
        }
        process.send({ cmd: 'time' });
        if (--pending <= 0) {
          process.send({ cmd: 'data', worker: cluster.worker.id, links: links });
        }
      })
    }
  });
}
