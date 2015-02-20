#!/usr/bin/node
// crawler.js

var fs        = require('fs'),
    libxmljs  = require('libxmljs'),
    phantomjs = require('phantomjs'),
    util      = require('./util'),
    version   = require('./package.json').version,
    defaultNbChild = 5;

if (process.argv.length < 5) {
  console.log('');
  console.log('Crawler version: %s', version);
  // console.log('');
  console.log('\x1b[33mUsage:\x1b[0m crawler.js <\x1b[33mbaseUrl\x1b[0m> <\x1b[33msitemap\x1b[0m> <\x1b[33mfileCSV\x1b[0m> [\x1b[33mnbProcess\x1b[0m (default: %d)]', defaultNbChild);
  console.log('');
  console.log('\x1b[33m\tbaseUrl:\x1b[0m Correspond à l\'URL de base du site sans le slash à la fin.');
  console.log('');
  console.log('\x1b[33m\tsitemap:\x1b[0m Indiquez le chemin du fichier sitemap.xml du site.');
  console.log('\tLe chemin peut être une URL HTTP ou le chemin d\'un fichier');
  console.log('\tsystème (ex: ./sitemap.xml).');
  console.log('');
  console.log('\x1b[33m\tfile CSV:\x1b[0m Indiquez le chemin du fichier où vous souhaitez\n\tstocker les liens. L\'encodage du fichier est en UTF-8.');
  console.log('');
  console.log('\x1b[33m\tnbProcess:\x1b[0m \x1b[36mOptionel\x1b[0m, permet d\'indiquer le nombre\n\tde process lancés pour l\'analyse des pages Web.');
  console.log('');
  process.exit(0);
}
var baseUrl = process.argv[2];
baseUrl = (baseUrl.substr(-1) === '/') ? baseUrl.substr(0, baseUrl.length-1) : baseUrl;
var sitemap = process.argv[3];
var fileCSV = process.argv[4];
var nbChilds = process.argv[5] || defaultNbChild;
var startTime = new Date().getTime();

function getSitemap(pathSitemap, done) {
  if (/^https?:\/\//.test(pathSitemap)) {
    require('http').get(pathSitemap, function(res) {
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

var cluster = require('cluster');
var numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  var data = [], pending = numCPUs;
  var ProgressBar = require('progress');

  getSitemap(sitemap, function(err, result) {
    if (err) {
      console.log('Error de récupération du sitemap: ', err);
      return process.exit(1);
    }
    var doc = libxmljs.parseXml('<?xml version="1.0" encoding="UTF-8"?>' + result),
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
          util.transformToCsv(data, fileCSV, baseUrl, function(err) {
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
      web = child.spawn(phantomjs.path, ["--load-images=false", "--ignore-ssl-errors=yes", __dirname + '/netsniff.js', url]);
      web.stdout.on('data', function(data) {
        _data += data.toString();
      });
      web.on('exit', function(code, signal) {
        try {
          _data = JSON.parse(_data);
        } catch (e) {
          _data = null;
          console.error(e);
          console.log(_data);
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
