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
      page.links = page.evaluate(function () {
        var links = [], $links = $('a'), length = $links.length,
            reg = /(javascript|mailto)/i,
            address = document.location.toString();
        $links.each(function(index, link) {
          var href = link.href;
          if (!reg.test(href)) {
            links.push({
              src: address,
              dest: href,
              anchor: $(link).text().trim()
            });
          }
        });
        return links;
      });
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