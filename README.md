# crawlerjs
Crawler that retrieves web pages links SAP with [phantomjs](http://phantomjs.org/).

## Dependencies
[Node.js](http://nodejs.org/) is necessary to launch the crawler. It's easy to install, go to the site for details.

## Usage

Firstly, install dependencies
```bash
cd crawler
npm install
```

### CrawlerSitemap
CrawlerSitemap retrieve URLs in the sitemap and analyze all pages to find links.
```bash
Usage: node crawlerSitemap.js [OPTION] baseUrl

  -s, --sitemap=ARG    Sitemap path (HTTP or FileSystem)
  -o, --output=ARG     CSV file to save links
  -p, --processes=ARG  number of processes to launch in same time (default: 5)
  -d, --delimitor=ARG  Delimitor CSV (default: ;)
  -h, --help           display this help
  -v, --version        show version

Respository: https://github.com/Azema/crawlerjs
```

### CrawlerSearch
CrawlerSearch research links and follows them to build a tree.
```bash
Usage: node crawlerSearch.js [OPTION] baseUrl

  -o, --output=ARG     output file to save links
  -p, --processes=ARG  number of processes to launch in same time (default: 5)
  -d, --depth=ARG      search depth (default: 3)
  -f, --format=ARG     format output file: CSV, XLS (default: CSV)
  -h, --help           display this help
  -v, --version        show version

Respository: https://github.com/Azema/crawlerjs
```
Enjoy

[Licence MIT](https://raw.githubusercontent.com/Azema/crawlerjs/master/LICENSE)
