'use strict';
if (!Date.prototype.toISOString) {
  Date.prototype.toISOString = function () {
    function pad(n) { return n < 10 ? '0' + n : n; }
    function ms(n) { return n < 10 ? '00'+ n : n < 100 ? '0' + n : n; }
    return this.getFullYear() + '-' +
    pad(this.getMonth() + 1) + '-' +
    pad(this.getDate()) + 'T' +
    pad(this.getHours()) + ':' +
    pad(this.getMinutes()) + ':' +
    pad(this.getSeconds()) + '.' +
    ms(this.getMilliseconds()) + 'Z';
  };
}
var args, done, next;

args = require('system').args;

args = Array.prototype.slice.call(args, 0);

args.shift();

done = function(err) {
  return phantom.exit(err ? 1 : 0);
};

next = function(err) {
  var url;
  url = args.shift();
  if (typeof err !== 'undefined') {
    return done(err);
  }
  return getPage(url, next);
};

next();

function getPage(url, done) {
  var page = require('webpage').create();
  page.address = url;
  // page.settings.userAgent += ' CrawlerjsBot';
  page.settings.userAgent = 'Mozilla/5.0 (Windows NT 6.1; rv:35.0) Gecko/20100101 Firefox/35.0 CrawlerjsBot';
  // console.log('userAgent: ', page.settings.userAgent);
  page.onLoadStarted = function () {
    // console.log('page started');
    page.startTime = new Date();
  };
  page.open(page.address, {encoding: 'utf8'}, function (status) {
    if (status !== 'success') {
      console.error('FAIL to load the address');
      return done(1);
    } else {
      // console.log('page loaded');
      page.endTime = new Date();
      
      page.hasJQuery = page.evaluate(function () {
        if (typeof jQuery === 'function') {
          var links = [], $links = jQuery('a'), length = $links.length,
              reg = /(javascript|mailto|#)/i,
              address = document.location.toString();
          $links.each(function(index, link) {
            var href = link.href;
            if (!reg.test(href)) {
              links.push({
                src: address,
                dest: href,
                anchor: jQuery(link).text().trim()
              });
            }
          });
          return links;
        } else {
          return false;
        }
      });
      if (typeof page.hasJQuery === 'boolean') {
        page.links = [];
        page.includeJs('http://ajax.googleapis.com/ajax/libs/jquery/1.8.2/jquery.min.js', function() {
          // jQuery is loaded, now manipulate the DOM
          var $links = jQuery('a'), length = $links.length,
              reg = /(javascript|mailto|#)/i,
              address = document.location.toString();
          $links.each(function(index, link) {
            var href = link.href;
            if (!reg.test(href)) {
              page.links.push({
                src: address,
                dest: href,
                anchor: jQuery(link).text().trim()
              });
            }
          });
        });
      } else {
        page.links = page.hasJQuery;
      }
      console.log(JSON.stringify({
        id: page.address,
        links: page.links
      }));
      // console.log('page close');
      page.close();
    }
  });
  page.onError = function(msg, trace) {
    var msgStack = ['ERROR: ' + msg];
    if (trace && trace.length) {
      msgStack.push('TRACE:');
      trace.forEach(function(t) {
        msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function +'")' : ''));
      });
    }
    console.error('onError ' + msgStack.join('\n'));
    done(1);
  };
  page.onClosing = function(closingPage) {
    // console.log('page closing');
    
    done(0);
  };
}