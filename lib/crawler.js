var _ = require('underscore'),
    http = require('http'),
    https = require('https'),
    events = require('events'),
    phantomjs = require('phantomjs'),
    child = require('child_process');

//require('request').debug = true;

var DEFAULT_DEPTH = 2;
var regSAP = /_escaped_fragment_/;
var nbProcess = 5;

function Crawler() {
  this.visitedURLs = {};
  this.depth = DEFAULT_DEPTH;
  this.ignoreRelative = false;
  this.SAP = false;
  this.shouldCrawl = function() {
    return true;
  };
  this.pending = 0;
  events.EventEmitter.call(this);
}
require('util').inherits(Crawler, events.EventEmitter);

Crawler.prototype.configure = function(options) {
  this.depth = (options && options.depth) || this.depth;
  this.depth = Math.max(this.depth, 0);
  this.ignoreRelative = (options && options.ignoreRelative) || this.ignoreRelative;
  this.shouldCrawl = (options && options.shouldCrawl) || this.shouldCrawl;
  this.optionsReq = (options && options.optionsReq) || {};
  if (options.nbChilds) {
    nbProcess = options.nbChilds;
  }
  return this;
};

Crawler.prototype.crawl = function (url, onSuccess, onFailure) {
  this.baseUrl = (url.substr(-1) === '/') ? url : url + '/';
  this.emit('start');
  this.crawlUrl(this.baseUrl, this.depth, onSuccess, onFailure, true);
};

Crawler.prototype.crawlUrl = function(url, depth, onSuccess, onFailure, base) {
  base = base || false;
  // console.log('visitedURLs: (%s)', url, this.visitedURLs[url]);
  if (0 == depth || this.visitedURLs[url]) {
    return;
  }
  var self = this;
  self.pending++;
  self.visitedURLs[url] = true;
  this.emit('pending', url);

  run(url, function(error, data) {
    if (!error && data) {
      onSuccess({
        url: url,
        links: data.links
      });
      self.crawlUrls(data.links, depth - 1, onSuccess, onFailure);
    } else if (error) {
      onFailure({
        url: url,
        error: error
      });
    }
    if (--self.pending <= 0) {
      self.emit('end');
    }
  });
};

Crawler.prototype.crawlUrls = function(links, depth, onSuccess, onFailure) {
  var self = this;

  _.each(links, function(link, index, list) {
    if (self.shouldCrawl(link.dest)) {
      self.crawlUrl(link.dest, depth, onSuccess, onFailure);
    }
  });
};
module.exports = Crawler;

function run(url, done) {
  var web, _data;
  if (nbProcess <= 0) {
    setTimeout(function() {run(url, done)}, 50);
    return;
  }
  var _data = '', web;
  nbProcess--;
  web = child.spawn(phantomjs.path, ["--load-images=false", "--ignore-ssl-errors=yes", '--ssl-protocol=tlsv1', __dirname + '/netsniff.js', url]);
  web.stdout.on('data', function(data) {
    _data += data.toString();
  });
  web.on('exit', function(code, signal) {
    var err = null;
    try {
      _data = JSON.parse(_data);
    } catch (e) {
      err = e;
      _data = null;
    }
    done(err, _data);
    nbProcess++;
  });
  web.on('error', function(err) {
    done(err);
    nbProcess++;
  });
}