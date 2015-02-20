/*jshint sub: true */
var util = exports = module.exports = {};

util.transformToCsv = function(data, fileCSV, baseUrl, done) {
  var csv = 'source;destination;ancre\n', separator = '', page, link;
  for (var i = 0, l = data.length; i < l; i++) {
    link = data[i];
    csv += '"' + util.addBaseUrl(baseUrl, link.src) + '";"' + util.addBaseUrl(baseUrl, link.dest) + '";"' + link.anchor + '"\n';
  }
  
  require('fs').writeFile(fileCSV, csv, function (err) {
    if (err) {
      console.error('Error during saved links to file', err);
    } else {
      console.log('Links saved to %s!', fileCSV);
    }
    done(err);
  });
};

var regHttp = /^http/;
util.addBaseUrl = function(base, link) {
  if (!regHttp.test(link)) {
    if (base.substr(-1) !== '/' && link.substr(0, 1) !== '/') {
      link = base + '/' + link;
    } else {
      link = base + link;
    }
  }
  return link;
};

util.secondsToTime = function(seconds) {
  var times = [
    {suffix: 'm', dividor: 60},
    {suffix: 'h', dividor: 60},
    {suffix: 'd', dividor: 24}
  ], orig = seconds, time, remaining;
  if (seconds < 60) {
    return Math.round(seconds) + ' s';
  }
  for (var i=0; i<times.length; i++) {
    time = seconds / times[i].dividor;
    seconds = Math.round(time, 1);
    if (0 !== time % 1) {
      remaining = time % 1;
    }
    if ( seconds < times[i].dividor) {
      var string = seconds + ' ' + times[i].suffix;
      if (remaining && i > 0) {
        string += ' ' + Math.round(remaining * times[i-1].dividor) + ' ' + times[i-1].suffix;
      } else if (remaining) {
        string += ' ' + Math.round(remaining * 60) + ' s';
      }
      return string;
    }
  }
  return orig + ' s';
};