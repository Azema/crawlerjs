var Crawler = require('./lib/crawler'),
    util = require('./util'),
    fs = require('fs'),
    version   = require('./package.json').version,
    defaultNbChild = 5,
    Getopt = require('node-getopt'),
    iconv = require('iconv-lite');

var getopt = new Getopt([
  ['o' , 'output=ARG'          , 'output file to save links'],
  ['p' , 'processes=ARG'       , 'number of processes to launch in same time (default: 5)'],
  ['d' , 'depth=ARG'           , 'search depth (default: 3)'],
  ['f' , 'format=ARG'          , 'format output file: CSV, XLS (default: CSV)'],
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
var format = args.options.format.toLowerCase() || 'csv',
    nbLinks = 0,
    crawler = new Crawler(),
    stream = process.stdout,
    output = fs.createWriteStream(fileCSV),
    progress = '\x1b[40m\x1b[36m%loader% %elaps% - %nbLinks% links - \x1b[40m\x1b[32mTreated page(s):\x1b[40m\x1b[1;37m %treated%\x1b[0m \x1b[40m\x1b[36m-\x1b[0m \x1b[40m\x1b[32mPending page(s):\x1b[40m\x1b[1;37m %pending%\x1b[0m', 
    lastDraw, interval, pages = {pending: 0, treated: 0}, exit = false, delimitor;

switch (format) {
  case 'csv':
    delimitor = ';';
    break;
  case 'xls':
    delimitor = '\t';
    break;
  default:
    console.log('\x1b[40m\x1b[1;31mFormat unknown (%s)\x1b[0m\n', format);
    getopt.showHelp();
    process.exit(1);
}

output
  .on('error', function(error) {
    // console.log(error);
    console.log('\n\x1b[40m\x1b[1;31mThe file (%s) is not writeable, please check file\x1b[0m\n', fileCSV);
    process.exit(1);
  })
  .on('finish', function() {
      output.close();
      console.log('%d links found on %d pages, being written...', nbLinks, pages.treated);
      console.log('Data saved on %s', fileCSV);
  });

function writeOutput(data) {
  var txt = '';
  if (data instanceof Array && data[0] instanceof Array) {
    for (var i = 0, _l = data.length; i < _l; i++) {
      txt += data[i].join(delimitor) + '\n';
    };
  } else if (data instanceof Array) {
    txt = data.join(delimitor) + '\n';
  } else if (typeof data === 'string') {
    txt = data + '\n';
  } else {
    return;
  }
  return output.write(iconv.toEncoding(txt, 'win-1252'));
}
writeOutput(['source', 'destination', 'ancre', 'occurrences']);

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
    output.end('');
  })
  .configure(options)
  .crawl(baseUrl, function onSuccess(page) {
    pages.pending--;
    pages.treated++;
    var links = [], link, keys, key, duplicates = {}, i;
    for (i=0, _l=page.links.length; i < _l; i++) {
      key = page.url + page.links[i].dest;
      if (!duplicates.hasOwnProperty(key)) {
        page.links[i].number = 0;
        duplicates[key] = page.links[i];
      }
      duplicates[key].number++;
      nbLinks++;
    }
    keys = Object.keys(duplicates);
    for (i=0, _l=keys.length; i < _l; i++) {
      link = duplicates[keys[i]];
      links.push([page.url, link.dest, link.anchor, link.number]);
    }
    writeOutput(links);
    // console.log('%d nbLinks on : %s', nbLinks);
  }, function onFailure(page) {
    console.error('\n\x1b[36mError on page (%s):\x1b[0m ', page.url, page.error);
  });

process.on('exit', function() {
  console.log('Thank you for using \x1b[40m\x1b[31mcrawlerjs\x1b[0m and good day.\n');
});
function close() {
  exit = true;
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  if (output) {
    output.close();
  }
  console.log('\n\nSignal received. Closing childs in progress...\n');
  crawler.close('SIGINT');
}
//      SIGNALS
process.on('SIGINT', close);
process.on('SIGTERM', close);
process.on('SIGHUP', close);