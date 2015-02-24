var Crawler = require('./lib/crawler'),
    util = require('./util'),
    version   = require('./package.json').version,
    defaultNbChild = 5,
    Getopt = require('node-getopt');

var getopt = new Getopt([
  ['o' , 'output=ARG'          , 'CSV file to save links'],
  ['p' , 'processes=ARG'       , 'number of processes to launch in same time (default: 5)'],
  ['d' , 'depth=ARG'           , 'search depth (default: 3)'],
  ['s' , 'separator=ARG'       , 'Delimitor CSV (default: ;)'],
  ['h' , 'help'                , 'display this help'],
  ['v' , 'version'             , 'show version']
])
  .bindHelp(
    "\x1b[40m\x1b[36mUsage:\x1b[0m node crawlerSearch.js [OPTION] baseUrl\n\n" +
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
if (args.argv.length <= 0) {
  getopt.showHelp();
  process.exit(1);
}
var baseUrl = args.argv[0];
var fileCSV = args.options.output || 'links.csv';
var nbChilds = args.options.processes ? parseInt(args.options.processes) : defaultNbChild;

var regBaseUrl = new RegExp('^' + baseUrl);

var options = {
  depth: args.options.depth ? parseInt(args.options.depth) : 3,
  shouldCrawl: function(link) {
    if (/javascript|#|mailto/i.test(link) || (/^https?:/.test(link) && !regBaseUrl.test(link))) {
      return false;
    }
    return true;
  },
  nbChilds: nbChilds
};
var delimtor = args.options.separator || ';',
    csv = 'source' + delimtor + 'destination' + delimtor + 'ancre\n',
    nbLinks = 0,
    crawler = new Crawler(),
    stream = process.stdout,
    progress = '\x1b[40m\x1b[36m%loader% %elaps% - %nbLinks% links - \x1b[40m\x1b[32mTreated page(s):\x1b[40m\x1b[1;37m %treated%\x1b[0m \x1b[40m\x1b[36m-\x1b[0m \x1b[40m\x1b[32mPending page(s):\x1b[40m\x1b[1;37m %pending%\x1b[0m', 
    lastDraw, interval, pages = {pending: 0, treated: 0}, exit = false;

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
    if (exit) return;
    if (interval) {
      clearInterval(interval);
    }
    console.log();
    console.log('%d links found on %d pages, being written...', nbLinks, pages.treated);
    require('fs').writeFile(fileCSV, csv, function(err) {
      if (err) {
        console.error('Error on write CSV file ', err);
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

process.on('exit', function() {
  console.log('Thank you for using \x1b[40m\x1b[31mcrawlerjs\x1b[0m and good day.\n');
});

//      SIGNALS
process.on('SIGINT', function() {
  exit = true;
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  console.log('\n\nSignal received. Closing childs in progress...\n');
  crawler.close('SIGINT');
});
process.on('SIGTERM', function() {
  exit = true;
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  console.log('\n\nSignal received. Closing childs in progress...\n');
  crawler.close('SIGTERM');
});
process.on('SIGHUP', function() {
  exit = true;
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  crawler.close('SIGHUP');
});