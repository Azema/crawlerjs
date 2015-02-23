var _ = require('underscore'),
    http = require('http'),
    https = require('https'),
    events = require('events'),
    phantomjs = require('phantomjs'),
    child = require('child_process');

//require('request').debug = true;

var DEFAULT_DEPTH = 3;
var regSAP = /_escaped_fragment_/;

function Crawler() {
  this.closed = false;
  this.visitedURLs = {};
  this.depth = DEFAULT_DEPTH;
  this.ignoreRelative = false;
  this.SAP = false;
  this.shouldCrawl = function() {
    return true;
  };
  this.pending = 0;
  this.childs = {};
  events.EventEmitter.call(this);
}
require('util').inherits(Crawler, events.EventEmitter);

Crawler.prototype.configure = function(options) {
  this.depth = (options && options.depth) || this.depth;
  this.depth = Math.max(this.depth, 0);
  this.ignoreRelative = (options && options.ignoreRelative) || this.ignoreRelative;
  this.shouldCrawl = (options && options.shouldCrawl) || this.shouldCrawl;
  this.optionsReq = (options && options.optionsReq) || {};
  this.nbProcess = options.nbChilds || 5;
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
  if (0 == depth || this.visitedURLs[url] || this.closed) {
    return;
  }
  var self = this;
  self.pending++;
  self.visitedURLs[url] = true;
  this.emit('pending', url);

  this._run(url, function(error, data) {
    if (self.closed) { return; }
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
    delete self.childs[url];
    if (--self.pending <= 0) {
      self.emit('end');
    }
  });
};

Crawler.prototype.crawlUrls = function(links, depth, onSuccess, onFailure) {
  var self = this;

  _.each(links, function(link) {
    if (self.shouldCrawl(link.dest)) {
      self.crawlUrl(link.dest, depth, onSuccess, onFailure);
    }
  });
};

Crawler.prototype.close = function(signal) {
  this.closed = true;
  _.each(this.childs, function(child, index) {
    if (child) {
      try {
        child.kill(signal);
        // console.log(child);
      } catch (e) {
        // console.log('Error kill: ', e);
      }
    }
  });
};
Crawler.prototype._run = function(url, done) {
  var childSpawned, _data = '',
      self = this;

  if (self.closed) {
    return done();
  }
  if (self.nbProcess <= 0) {
    setTimeout(function() {self._run(url, done)}, 50);
    return;
  }
  self.nbProcess--;
  childSpawned = child.spawn(phantomjs.path, ["--load-images=false", "--ignore-ssl-errors=yes", '--ssl-protocol=tlsv1', __dirname + '/netsniff.js', url]);
  childSpawned.stdout.on('data', function(data) {
    _data += data.toString();
  });
  childSpawned.on('exit', function(code, signal) {
    var err = null;
    try {
      _data = JSON.parse(_data);
    } catch (e) {
      err = e;
      _data = null;
    }
    done(err, _data);
    self.nbProcess++;
    delete self.childs[url];
  });
  childSpawned.on('error', function(err) {
    done(err);
    self.nbProcess++;
    delete self.childs[url];
  });
  self.childs[url] = childSpawned;
};

module.exports = Crawler;