var fs = require('fs'),
    utils = require('./util'),
    http  = require('http'),
    https = require('https'),
    events = require('events'),
    version = require('./package.json').version,
    defaultNbChild = 5;

if (process.argv.length < 3) {
  console.log('');
  console.log('Crawler version: %s', version);
  // console.log('');
  console.log('\x1b[33mUsage:\x1b[0m crawler.js <\x1b[33mbaseUrl\x1b[0m> <\x1b[33mfileCSV\x1b[0m> [\x1b[33mnbProcess\x1b[0m (default: %d)]', defaultNbChild);
  console.log('');
  console.log('\x1b[33m\tbaseUrl:\x1b[0m Correspond à l\'URL de base du site sans le slash à la fin.');
  console.log('');
  console.log('\x1b[33m\tfile CSV:\x1b[0m Indiquez le chemin du fichier où vous souhaitez\n\tstocker les liens. L\'encodage du fichier est en UTF-8.');
  console.log('');
  console.log('\x1b[33m\tnbProcess:\x1b[0m \x1b[36mOptionel\x1b[0m, permet d\'indiquer le nombre\n\tde process lancés pour l\'analyse des pages Web.');
  console.log('');
  process.exit(0);
}
var baseUrl = process.argv[2];
if (!checkUrl(baseUrl)) {
  console.log('L\'URL de base doit être de la forme HTTP');
  process.exit(1);
}
baseUrl = (baseUrl.substr(-1) === '/') ? baseUrl.substr(0, baseUrl.length-1) : baseUrl;
var site = new page(baseUrl);
var fileCSV = process.argv[4] || 'linksCrawler.csv';
var nbChilds = process.argv[5] || defaultNbChild;
var startTime = new Date().getTime();
var SAP = null;

var regSiteWeb = new RegExp('^'+baseUrl);
function checkUrl(url) {
  if (/^https?:\/\//.test(url)) {
    return true;
  }
  return false;
}

var pageLinks = [];
var pagesTreated = [];
var pagesPending = [];

function page(url) {
  this.url = utils.addBaseUrl(baseUrl, url);
  this.links = [];
}

function pagesToAnalyze() {
  this.pages = [];
  this.urls = [];
  events.EventEmitter.call(this);
}
require('util').inherits(pagesToAnalyze, events.EventEmitter);
pagesToAnalyze.prototype.add = function(page) {
  this.pages.push(page);
  this.urls.push(page.url);
  this.emit('newPage');
  return this;
};
pagesToAnalyze.prototype.exists = function(url) {
  return (this.urls.indexOf(url) >= 0);
};
pagesToAnalyze.prototype.shift = function() {
  if (this.pages.length <= 0) {
    return null;
  }
  var page = this.pages.shift();
  this.urls.splice(this.urls.indexOf(page.url), 1);
  return page;
};
pagesToAnalyze.prototype.isEmpty = function() {
  return (this.pages.length === 0);
};

var analyse = new pagesToAnalyze();

analyse.on('newPage', function() {
  var aPage = analyse.shift();
  pagesPending.push(aPage.url);
  console.log(aPage);
  getPage(aPage.url, function(err, html) {
    if (err) {
      console.error('Error getPage: ', err);
      return;
    }
    if (html) {
      // console.log('HTML: ', html);
      var linksOfPage = getLinks(html);
      if (linksOfPage) {
        //console.log('links: ', linksOfPage.length);
        for (var i = 0, _l = linksOfPage.length; i < _l; i++) {
          var url = utils.addBaseUrl(baseUrl, linksOfPage[i]);
          if (regSiteWeb.test(url) &&
            pagesTreated.indexOf(url) === -1 &&
            pagesPending.indexOf(url) === -1 &&
            !analyse.exists(url)) 
          {
            analyse.add(new page(url));
          }
          aPage.links.push(url);
        }
        pagesTreated.push(aPage.url);
        pagesPending.splice(pagesPending.indexOf(aPage.url), 1);
        // console.log('Page treated', aPage);
        pageLinks.push(aPage);
      }
    }
  });
});

analyse.add(site);

function isSAP(html) {
  var reg = /<meta.*name=(?:"|')fragment(?:"|')/i;
  return reg.test(html);
}

function getLinks(html) {
  var regLink = /<a([^>]+)>/g,
      regHref = /href\s*=\s*(?:"|')([^"']+)(?:"|')/i,
      regJsOrMailto = /javascript|#|mailto/i;
  var matches = html.match(regLink);
  if (matches) {
    //console.log('matches links: ', matches.length);
    var links = [],
        matchHref;
    for (var i=0, _l=matches.length; i < _l; i++) {
      matchHref = matches[i].match(regHref);
      if (matchHref && matchHref[1] && !regJsOrMailto.test(matchHref[1]) && links.indexOf(matchHref[1]) === -1) {
        links.push(matchHref[1]);
      }
    }
    return links;
  }
}

var pending = 5;
function getPage(url, done) {
  if (pending <= 0) {
    setTimeout(function() {
      getPage(url, done);
    }, 500);
    return;
  }
  pending--;
  var module = http;
  if (/^https/.test(url)) {
    module = https;
  }
  if (SAP && !/_escaped_fragment_/.test(url)) {
    var separator = '?';
    if (url.indexOf('?') >= 0) {
      separator = '&'
    }
    url += separator + '_escaped_fragment_=';
  }
  // console.log('URL: ', url);
  var options = require('url').parse(url);
  options.headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; rv:35.0) Gecko/20100101 Firefox/35.0'};
  module.get(options, function(res) {
    if (res.statusCode !== 200) {
      return done(res.statusCode);
    }
    var data = '';
    res.setEncoding('utf8');
    res
      .on('data', function(chunk) {
        data += chunk;
      })
      .on('end', function() {
        pending++;
        if (null === SAP) {
          SAP = isSAP(data);
          if (SAP) {
            return getPage(url, done);
          }
        } else {
          done(null, data);
        }
      })
      .on('error', function(err) {
        console.error('Error request: ', url);
        pending++;
        return done(err);
      });
  });
}

function writeToCSV(pages) {
  var csv = 'source;destination\n', separator = '', aPage, link;
  for (var i = 0, l = pages.length; i < l; i++) {
    aPage = pages[i];
    for (var j=0, _ll=aPage.links.length; j < _ll; j++) {
      csv += '"' + aPage.url + '";"' + aPage.links[j] + '"\n';
    }
  }
  console.log('writeToCSV', fileCSV);
  
  fs.writeFileSync(fileCSV, csv);
};
process.on('exit', function() {
  console.log('exit');
  writeToCSV(pageLinks);
});