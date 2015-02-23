var Crawler = require('./lib/crawler'),
    util = require('./util'),
    version   = require('./package.json').version,
    defaultNbChild = 5;

if (process.argv.length < 4) {
  console.log('');
  console.log('Crawler version: %s', version);
  // console.log('');
  console.log('\x1b[33mUsage:\x1b[0m crawlerSearch.js <\x1b[33mbaseUrl\x1b[0m> <\x1b[33mfileCSV\x1b[0m> [\x1b[33mnbProcess\x1b[0m (default: %d)]', defaultNbChild);
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
var fileCSV = process.argv[3];
var nbChilds = parseInt(process.argv[4]) || defaultNbChild;

var regBaseUrl = new RegExp('^' + baseUrl);
var options = {
  depth: 3,
  shouldCrawl: function(link) {
    if (/javascript|#|mailto/i.test(link) || (/^https?:/.test(link) && !regBaseUrl.test(link))) {
      return false;
    }
    return true;
  },
  optionsReq: {
    headers: {'user-agent': 'Mozilla/5.0 (Windows NT 6.1; rv:35.0) Gecko/20100101 Firefox/35.0 CrawlerjsBot'},
    debug: true
  },
  nbChilds: nbChilds
};
var delimtor = ';',
    csv = 'source' + delimtor + 'destination' + delimtor + 'ancre\n',
    nbLinks = 0,
    crawler = new Crawler(),
    stream = process.stdout,
    progress = '\x1b[36m%loader% %elaps% - %nbLinks% links - \x1b[32mTreated page(s):\x1b[0m %treated% \x1b[36m- \x1b[32mPending page(s):\x1b[0m %pending%', 
    lastDraw, interval, pages = {pending: 0, treated: 0};

function updateProgress(tokens) {
  var str = progress;
  if (tokens) for (var key in tokens) str = str.replace('%' + key + '%', tokens[key]);
  if (lastDraw !== str) {
    stream.clearLine(0);
    stream.cursorTo(0);
    stream.write(str);
    lastDraw = str;
  }
}
updateProgress({elaps: '0 s', nbLinks: nbLinks, loader: '-', pending: 0, treated: 0});
crawler
  .on('start', function() {
    var startTime = new Date().getTime();
    var loader = ['-', '\\', '|', '/'];
    var time = 0;
    interval = setInterval(function() {
      updateProgress({
        elaps: util.secondsToTime((new Date().getTime() - startTime)/1000),
        nbLinks: nbLinks,
        loader: loader[time++%4],
        pending: pages.pending,
        treated: pages.treated
      });
    }, 950);
  })
  .on('pending', function(page) {
    pages.pending++;
  })
  .on('end', function() {
    clearInterval(interval);
    console.log();
    console.log('%d links found on %d pages, being written on %s', nbLinks, treated, fileCSV);
    require('fs').writeFile(fileCSV, csv, function(err) {
      if (err) {
        console.error('Erreur lors de la création du fichier CSV ', err);
      } else {
        console.log('Data saved on %s', fileCSV);
      }
    });
  })
  .configure(options)
  .crawl(baseUrl, function onSuccess(page) {
    pages.pending--;
    pages.treated++;
    for (var i=0, _l=page.links.length; i < _l; i++) {
      csv += page.url + delimtor + page.links[i].dest + delimtor + '"' + page.links[i].anchor + '"\n';
      nbLinks++;
    }
    // console.log('%d nbLinks on : %s', nbLinks);
  }, function onFailure(page) {
    console.error('\x1b[36mError on page (%s):\x1b[0m ', page.url, page.error);
  });